"""Every AI feature in Prepermint: the summary draft, resume import, the CV interview and the voice interview.

The one rule all prompts share: never invent. Resume parsing copies what the document says, and the CV interview
asks questions instead of making up experience or numbers.
"""

from collections.abc import AsyncGenerator, Sequence
from dataclasses import dataclass
from typing import Literal

import anthropic
from anthropic.types import MessageParam
from anthropic.types.beta import BetaContentBlockParam, BetaMessageParam
from pydantic import BaseModel, Field

from prepermint.db.models import Experience, Profile
from prepermint.features.interview.languages import LANGUAGE_NAMES, Language
from prepermint.features.interview.schemas import Feedback, Job, LlmUsage, Plan, PlanDraft, Turn
from prepermint.features.interview.text import (
    Page,
    normalize_feedback,
    page_for_model,
    planned_questions_text,
    transcript_text,
)
from prepermint.lib.prompts import load_prompt, render_prompt
from prepermint.settings import get_settings

MODEL = "claude-opus-5-5"
# The voice interview prototype (CAI-36) has about 500 ms between the end of the candidate's answer and the first
# word of the reply, so its live turns and its question plan run on the small model with thinking off.
# The feedback report has no such pressure and uses MODEL.
INTERVIEW_MODEL = "claude-haiku-5-5"
# Server-side refusal fallback: if a safety classifier declines, the API re-runs the request on a fallback model
# inside the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

Effort = Literal["low", "medium", "high"]


class AiError(Exception):
    """A failure with a message that is safe to show."""


_client: anthropic.AsyncAnthropic | None = None


def ai_enabled() -> bool:
    settings = get_settings()
    return bool(settings.anthropic_keys or settings.anthropic_auth_token)


def _anthropic() -> anthropic.AsyncAnthropic:
    global _client
    if not ai_enabled():
        raise AiError("AI is not configured. Set ANTHROPIC_KEYS.")
    if _client is None:
        # The key lives in ANTHROPIC_KEYS, not the SDK's default variable name, so it is passed in.
        key = get_settings().anthropic_keys
        _client = anthropic.AsyncAnthropic(api_key=(key.get_secret_value().strip() or None) if key else None)
    return _client


def _usage(usage: object) -> LlmUsage:
    def n(name: str) -> int:
        value = getattr(usage, name, 0)
        return value if isinstance(value, int) else 0

    return LlmUsage(
        input=n("input_tokens"),
        output=n("output_tokens"),
        cacheRead=n("cache_read_input_tokens"),
        cacheWrite=n("cache_creation_input_tokens"),
    )


def _to_ai_error(error: Exception) -> Exception:
    if isinstance(error, AiError):
        return error
    if isinstance(error, anthropic.RateLimitError):
        return AiError("The AI is busy right now. Try again in a minute.")
    if isinstance(error, anthropic.AuthenticationError):
        return AiError("The AI key is invalid. Check ANTHROPIC_KEYS.")
    if isinstance(error, anthropic.BadRequestError):
        return AiError(f"The AI rejected the request: {error.message}")
    if isinstance(error, anthropic.APIStatusError):
        return AiError(f"The AI service failed ({error.status_code}). Try again.")
    if isinstance(error, anthropic.APIError):
        return AiError("The AI service failed (network). Try again.")
    return error


async def _structured[T: BaseModel](
    schema: type[T],
    system: str,
    content: Sequence[BetaContentBlockParam],
    effort: Effort,
    max_tokens: int = 16000,
    model: str = MODEL,
) -> tuple[T, LlmUsage]:
    """Structured call: returns the parsed object and what it cost in tokens, or raises AiError."""
    try:
        client = _anthropic().beta.messages
        messages: list[BetaMessageParam] = [{"role": "user", "content": list(content)}]
        if model == MODEL:
            # The refusal fallback is for the main model.
            res = await client.parse(
                model=model,
                max_tokens=max_tokens,
                betas=[FALLBACK_BETA],
                fallbacks="default",
                system=system,
                output_config={"effort": effort},
                output_format=schema,
                messages=messages,
            )
        else:
            # The small interview model has no fallback and runs without thinking.
            res = await client.parse(
                model=model,
                max_tokens=max_tokens,
                thinking={"type": "disabled"},
                system=system,
                output_config={"effort": effort},
                output_format=schema,
                messages=messages,
            )
        if res.stop_reason == "refusal":
            raise AiError("The AI declined this request. Try editing the text by hand.")
        if res.stop_reason == "max_tokens":
            raise AiError("The AI response was cut off. Try again with a shorter input.")
        parsed = res.parsed_output
        if parsed is None:
            raise AiError("The AI returned an unreadable answer. Try again.")
        return parsed, _usage(res.usage)
    except Exception as error:
        raise _to_ai_error(error) from error


def _text(text: str) -> BetaContentBlockParam:
    return {"type": "text", "text": text}


# --- Recruiter summary ---------------------------------------------------------------------------------------


class SummaryDraft(BaseModel):
    headline: str = Field(
        description='One line, at most ~70 characters, e.g. "Backend engineer · Go & PostgreSQL · 4 yrs".'
    )
    summary: str = Field(description="Exactly 3 sentences: what they build, at what level, and what they want next.")


SUMMARY_SYSTEM = """You write the top of a Prepermint profile: the part a recruiter reads first.

Write a headline and a 3-sentence summary in plain English, in the third person without pronouns ("Builds…", "Has worked…") or in a neutral voice.
- Sentence 1: what they build and with which core technologies.
- Sentence 2: their level and the strongest evidence (a job).
- Sentence 3: what they're looking for next, from their goals. If no goals are given, describe the kind of role the evidence fits.
Use only the facts given. Never invent years of experience, employers, numbers or seniority that the data doesn't support. No praise words."""  # noqa: E501


def summary_input(profile: Profile, experiences: Sequence[Experience]) -> str:
    goals = profile.goals or {}
    lines: list[str] = []
    if profile.display_name:
        lines.append(f"Name: {profile.display_name}")
    if profile.location:
        lines.append(f"Location: {profile.location}")
    role, level, market = goals.get("targetRole"), goals.get("targetLevel"), goals.get("targetMarket")
    if role or level or market:
        lines.append(f"Goals: {' '.join(p for p in [level, role, f'in {market}' if market else None] if p)}")
    if profile.role_types or profile.work_mode:
        lines.append(f"Looking for: {', '.join(p for p in [', '.join(profile.role_types), profile.work_mode] if p)}")
    lines += ["", "Experience (self-reported):"]
    for e in experiences:
        end = "present" if e.current else (e.end_date or "?")
        bullets = f": {'; '.join(e.bullets)}" if e.bullets else ""
        kind = "Education" if e.kind == "education" else "Work"
        lines.append(f"- {kind}: {e.title} at {e.organization} ({e.start_date or '?'} to {end}){bullets}")
    return "\n".join(lines)


async def draft_summary(profile: Profile, experiences: Sequence[Experience]) -> SummaryDraft:
    draft, _ = await _structured(
        SummaryDraft,
        SUMMARY_SYSTEM,
        [_text(f"<profile_data>\n{summary_input(profile, experiences)}\n</profile_data>")],
        effort="medium",
    )
    return draft


# --- Resume / LinkedIn import --------------------------------------------------------------------------------


class ParsedExperience(BaseModel):
    kind: Literal["work", "education"]
    title: str = Field(description="Job title, or degree/course for education.")
    organization: str = Field(description="Company, or school for education.")
    location: str | None
    startDate: str | None = Field(description='"YYYY-MM" when the month is known, else "YYYY". Null if absent.')
    endDate: str | None = Field(description="Same format. Null when current or absent.")
    current: bool
    bullets: list[str] = Field(
        description="Achievements and responsibilities, copied or lightly tightened from the document. Never add facts."
    )
    skills: list[str] = Field(description="Technologies or skills named for this role.")


class ParsedResume(BaseModel):
    displayName: str | None
    headline: str | None = Field(description="The person's own headline or current title, if the document has one.")
    location: str | None
    experiences: list[ParsedExperience] = Field(description="Every job and education entry, most recent first.")


RESUME_SYSTEM = """You extract a person's career history from their resume or LinkedIn profile export into structured data.
Copy what the document says. Don't infer, embellish or add achievements. Keep bullets close to the original wording; you may fix obvious typos and split run-on sentences. If a field is missing, use null."""  # noqa: E501


@dataclass(frozen=True)
class PdfFile:
    base64: str


@dataclass(frozen=True)
class TextFile:
    text: str


async def parse_resume(file: PdfFile | TextFile) -> ParsedResume:
    document: BetaContentBlockParam
    if isinstance(file, PdfFile):
        document = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": file.base64},
        }
    else:
        document = {"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": file.text}}
    parsed, _ = await _structured(
        ParsedResume, RESUME_SYSTEM, [document, _text("Extract the career history from this document.")], effort="low"
    )
    return parsed


# --- CV interview assistant ----------------------------------------------------------------------------------


def interview_context(profile: Profile, experiences: Sequence[Experience]) -> str:
    goals = profile.goals or {}
    targets = " / ".join(g for g in [goals.get("targetLevel"), goals.get("targetRole"), goals.get("targetMarket")] if g)
    lines = [
        f"Name: {profile.display_name or '(unknown)'}",
        f"Goals so far: {targets or '(none yet)'}",
        "Current experience entries:",
    ]
    if not experiences:
        lines.append("(none yet)")
    for e in experiences:
        end = "present" if e.current else (e.end_date or "?")
        bullets = f" — {' | '.join(e.bullets)}" if e.bullets else ""
        lines.append(
            f"- {e.title} at {e.organization} ({e.start_date or '?'}–{end}): {len(e.bullets)} bullets{bullets}"
        )
    return "\n".join(lines)


INTERVIEW_SYSTEM = """You are the career assistant inside Prepermint. You help a tech worker turn a weak or empty CV into a strong one by interviewing them.

How you work:
1. Start with goals if they're missing: target role, level and market (country or "remote, international").
2. Then go through their jobs one at a time. Ask concrete questions that pull out evidence: What did you ship? For how many users? What changed after? Which technologies? What was hard?
3. Ask one or two questions per message. Keep messages short (under ~80 words). Be warm and direct.
4. When you have enough for a role, show 2–4 strong CV bullets you'd write from their answers, and ask if they're accurate.

Never invent experience, employers, numbers or results. If an answer is vague, ask a follow-up instead of filling the gap. Numbers only come from what the person told you.

The person can press "Save to my CV" at any time; you don't save anything yourself. Reply in the language the person writes in."""  # noqa: E501


async def interview_reply(
    profile: Profile, experiences: Sequence[Experience], messages: Sequence[dict[str, str]]
) -> str:
    history: list[BetaMessageParam] = []
    for m in messages:
        if m["role"] == "user":
            history.append({"role": "user", "content": m["content"]})
        else:
            history.append({"role": "assistant", "content": m["content"]})
    if not history or history[0]["role"] != "user":
        history.insert(0, {"role": "user", "content": "Hi! Help me build my CV."})

    try:
        res = await _anthropic().beta.messages.create(
            model=MODEL,
            max_tokens=4000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=[
                {"type": "text", "text": INTERVIEW_SYSTEM},
                {
                    "type": "text",
                    "text": f"<what_rows_knows>\n{interview_context(profile, experiences)}\n</what_rows_knows>",
                },
            ],
            messages=history,
        )
        if res.stop_reason == "refusal":
            raise AiError("The assistant declined to answer that. Try rephrasing.")
        text = "\n".join(b.text for b in res.content if b.type == "text").strip()
        if not text:
            raise AiError("The assistant returned an empty answer. Try again.")
        return text
    except Exception as error:
        raise _to_ai_error(error) from error


class InterviewGoals(BaseModel):
    targetRole: str | None
    targetLevel: str | None
    targetMarket: str | None


class InterviewExtract(BaseModel):
    goals: InterviewGoals
    experiences: list[ParsedExperience] = Field(
        description="Only roles the person discussed. Bullets only from facts they stated or confirmed."
    )


EXTRACT_SYSTEM = """You turn a CV interview transcript into structured CV data.
Write strong, concise CV bullets (action verb first, result where the candidate gave one) in English.
Use only facts the candidate stated or confirmed. Suggestions the assistant made that the candidate did not confirm don't count. Never invent numbers. If a field is unknown, use null."""  # noqa: E501


async def extract_from_interview(messages: Sequence[dict[str, str]]) -> InterviewExtract:
    transcript = "\n\n".join(f"{'Candidate' if m['role'] == 'user' else 'Assistant'}: {m['content']}" for m in messages)
    extract, _ = await _structured(
        InterviewExtract, EXTRACT_SYSTEM, [_text(f"<transcript>\n{transcript}\n</transcript>")], effort="medium"
    )
    return extract


# --- Voice interview prototype (CAI-36) ----------------------------------------------------------------------


async def plan_interview(
    job_description: str, resume: str, duration_minutes: int, language: Language
) -> tuple[PlanDraft, LlmUsage]:
    """The question plan, built from the job description and the resume summary and written in the interview's
    language."""
    # About two minutes per question, so the plan fits the time budget. Halves round up, as Math.round did.
    question_count = min(10, max(4, int(duration_minutes / 2.2 + 0.5)))
    return await _structured(
        PlanDraft,
        render_prompt(
            load_prompt("interviews", "planner"),
            {"question_count": str(question_count), "language_name": LANGUAGE_NAMES[language]},
        ),
        [
            _text(
                f"<job_description>\n{job_description}\n</job_description>\n\n"
                f"<resume>\n{resume or '(none provided)'}\n</resume>"
            )
        ],
        effort="low",
        max_tokens=3000,
        model=INTERVIEW_MODEL,
    )


async def extract_job(page: Page) -> tuple[Job, LlmUsage]:
    """Reads a scraped job page and keeps only what a job interview needs: the role, the work and the requirements.
    It says so when the page is not one specific posting."""
    return await _structured(
        Job,
        load_prompt("interviews", "job-extractor"),
        [_text(page_for_model(page))],
        effort="low",
        max_tokens=3000,
        model=INTERVIEW_MODEL,
    )


@dataclass(frozen=True)
class TextEvent:
    text: str


@dataclass(frozen=True)
class DoneEvent:
    usage: LlmUsage


InterviewerEvent = TextEvent | DoneEvent


async def stream_interviewer_turn(system: str, messages: list[MessageParam]) -> AsyncGenerator[InterviewerEvent]:
    """One spoken turn of the interviewer, streamed. No thinking, lowest effort and a cached briefing keep the time
    to the first token short. Closing the generator (a barge-in closes the request) closes the model stream, so it
    stops the spending too."""
    try:
        async with _anthropic().messages.stream(
            model=INTERVIEW_MODEL,
            max_tokens=400,
            thinking={"type": "disabled"},
            output_config={"effort": "low"},
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield TextEvent(text)
            message = await stream.get_final_message()
        if message.stop_reason == "refusal":
            raise AiError("The interviewer declined to continue. End the interview and try again.")
        yield DoneEvent(_usage(message.usage))
    except Exception as error:
        raise _to_ai_error(error) from error


async def interview_feedback(job_description: str, plan: Plan, transcript: list[Turn]) -> tuple[Feedback, LlmUsage]:
    """The feedback report: the whole transcript and a scoring rubric. It runs after the interview, off the
    real-time path."""
    feedback, usage = await _structured(
        Feedback,
        render_prompt(load_prompt("interviews", "feedback"), {"language_name": LANGUAGE_NAMES[plan.language]}),
        [
            _text(
                "\n\n".join(
                    [
                        f"<job_description>\n{job_description}\n</job_description>",
                        f"<planned_questions>\n{planned_questions_text(plan)}\n</planned_questions>",
                        f"<transcript>\n{transcript_text(transcript)}\n</transcript>",
                    ]
                )
            )
        ],
        effort="medium",
        max_tokens=4000,
    )
    return normalize_feedback(feedback), usage
