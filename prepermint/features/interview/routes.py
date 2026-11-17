"""Routes of the voice interview prototype (CAI-36): a single page, no login, no database. Everything here exists
only where PROTOTYPE_ENABLED=true (a local run or a protected preview deployment), because anyone who can reach
an open route spends our API credits. The flag is read on every request.

The browser owns the interview state and sends it with each request; the server writes the plan, streams each
interviewer turn as one JSON event per line, and writes the feedback report.
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, ValidationError

from prepermint.features.interview.apify import JobPageError, read_page, warm_up
from prepermint.features.interview.deepgram import DeepgramError, listen_url, mint_browser_token, speak_url
from prepermint.features.interview.job_url import job_url_from
from prepermint.features.interview.languages import DEFAULT_VOICE, VOICES, voice_by_id
from prepermint.features.interview.prompt import build_turn_prompt
from prepermint.features.interview.schemas import (
    CRITERIA,
    DURATIONS,
    LIMIT_JOB_DESCRIPTION,
    LIMIT_RESUME,
    DeepgramAccess,
    FeedbackRequest,
    FeedbackResponse,
    JobRequest,
    Plan,
    ReadJobFailed,
    ReadJobOk,
    SessionResponse,
    StartRequest,
    TurnRequest,
)
from prepermint.features.interview.text import MoveTagParser, job_to_text
from prepermint.lib import ai
from prepermint.lib.ai import AiError, DoneEvent
from prepermint.settings import get_settings
from prepermint.templating import templates

logger = logging.getLogger(__name__)


def prototype_enabled() -> bool:
    return get_settings().prototype_enabled == "true"


def require_prototype() -> None:
    if not prototype_enabled():
        raise HTTPException(status_code=404)


router = APIRouter(prefix="/interview", dependencies=[Depends(require_prototype)])


def safe_message(error: BaseException, fallback: str) -> str:
    """A message that is safe to show: one of ours, never a raw provider error or a stack trace."""
    return str(error) if isinstance(error, AiError | DeepgramError | JobPageError) else fallback


def log_failure(route: str, error: BaseException) -> None:
    """Logs the kind of failure only. Transcripts and job descriptions are personal data and stay out of the logs."""
    kind = f"JobPageError ({error.code})" if isinstance(error, JobPageError) else type(error).__name__
    logger.error("[interview-prototype] %s failed: %s", route, kind)


def first_error(error: ValidationError, fallback: str = "Invalid request.") -> str:
    """The message of the first problem, when it is one of ours (a ValueError raised by a validator)."""
    for issue in error.errors():
        ctx = issue.get("ctx") or {}
        if "error" in ctx and isinstance(ctx["error"], ValueError):
            return str(ctx["error"])
    return fallback


async def read_json(request: Request) -> object:
    try:
        return await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def parse_body[T: BaseModel](model: type[T], body: object) -> T | ValidationError:
    try:
        return model.model_validate(body)
    except ValidationError as error:
        return error


# --- The page ------------------------------------------------------------------------------------------------


@router.get("", response_class=HTMLResponse)
async def page(request: Request) -> Response:
    return templates.TemplateResponse(
        request,
        "interview/page.html",
        {
            "voices": VOICES,
            "default_voice": DEFAULT_VOICE,
            "durations": DURATIONS,
            "criteria": CRITERIA,
            "limits": {"jobDescription": LIMIT_JOB_DESCRIPTION, "resume": LIMIT_RESUME},
        },
    )


# --- Start ---------------------------------------------------------------------------------------------------


@router.post("/session")
async def session(request: Request) -> Response:
    """Starts an interview: writes the question plan and mints the browser's short-lived Deepgram token."""
    parsed = parse_body(StartRequest, await read_json(request))
    if isinstance(parsed, ValidationError):
        return JSONResponse({"error": first_error(parsed)}, status_code=400)
    # The voice decides the language of the interview, and the speed and expressivity it speaks with.
    voice = voice_by_id(parsed.voice)

    try:
        (draft, usage), token = await asyncio.gather(
            ai.plan_interview(parsed.jobDescription, parsed.resume, parsed.durationMinutes, voice.language),
            # The token only has to be valid when each socket opens, so it lives as long as the interview plus a
            # margin.
            mint_browser_token(parsed.durationMinutes * 60 + 600),
        )
    except Exception as error:
        log_failure("session", error)
        return JSONResponse(
            {"error": safe_message(error, "Could not start the interview. Try again.")}, status_code=502
        )
    if len(draft.questions) < 3:
        return JSONResponse({"error": "The interview plan came back too short. Try again."}, status_code=502)

    plan = Plan(**draft.model_dump(), language=voice.language, interviewerName=voice.name)
    body = SessionResponse(
        plan=plan,
        budgetMs=parsed.durationMinutes * 60_000,
        usage=usage,
        deepgram=DeepgramAccess(
            token=token,
            listenUrl=listen_url(voice.language),
            speakUrl=speak_url(voice.model, speed=voice.speed, expressivity=voice.expressivity),
        ),
    )
    return JSONResponse(body.model_dump(mode="json"))


# --- One interviewer turn ------------------------------------------------------------------------------------


def _line(event: dict[str, object]) -> str:
    return json.dumps(event, ensure_ascii=False) + "\n"


@router.post("/turn")
async def turn(request: Request) -> Response:
    """One interviewer turn, streamed as one JSON event per line: the move first, then the words to speak as Claude
    writes them, then the usage. The browser starts the voice on the first words."""
    parsed = parse_body(TurnRequest, await read_json(request))
    if isinstance(parsed, ValidationError):
        return JSONResponse({"error": "Invalid request."}, status_code=400)
    system, messages = build_turn_prompt(parsed.jobDescription, parsed.resume, parsed.plan, parsed.state)

    async def events() -> AsyncIterator[str]:
        parser = MoveTagParser()
        move_sent = False

        def move_line() -> str:
            nonlocal move_sent
            if move_sent or not parser.settled:
                return ""
            move_sent = True
            return _line({"t": "move", "move": parser.move})

        stream = ai.stream_interviewer_turn(system, messages)
        try:
            async for event in stream:
                if isinstance(event, DoneEvent):
                    rest = parser.flush()
                    yield move_line()
                    if rest:
                        yield _line({"t": "text", "text": rest})
                    yield _line({"t": "done", "usage": event.usage.model_dump()})
                else:
                    speakable = parser.push(event.text)
                    yield move_line()
                    if speakable:
                        yield _line({"t": "text", "text": speakable})
        except Exception as error:
            log_failure("turn", error)
            yield _line({"t": "error", "message": safe_message(error, "The interviewer could not answer. Try again.")})
        finally:
            # A barge-in closes the request: closing the model stream stops the spending.
            await stream.aclose()

    async def non_empty() -> AsyncIterator[str]:
        async for chunk in events():
            if chunk:
                yield chunk

    return StreamingResponse(
        non_empty(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


# --- Feedback ------------------------------------------------------------------------------------------------


@router.post("/feedback")
async def feedback(request: Request) -> Response:
    """The feedback report. It has no latency pressure, so the browser asks for it after the interview and waits."""
    parsed = parse_body(FeedbackRequest, await read_json(request))
    if isinstance(parsed, ValidationError):
        return JSONResponse({"error": "Invalid request."}, status_code=400)
    try:
        report, usage = await ai.interview_feedback(parsed.jobDescription, parsed.plan, parsed.transcript)
    except Exception as error:
        log_failure("feedback", error)
        return JSONResponse({"error": safe_message(error, "Could not write the feedback. Try again.")}, status_code=502)
    return JSONResponse(FeedbackResponse(feedback=report, usage=usage).model_dump(mode="json"))


# --- Reading a job link (docs/adr/0002) ----------------------------------------------------------------------

_INSTEAD = "Paste the text of the posting instead."
NOT_A_POSTING = f"No job posting was found at that address. {_INSTEAD}"
FAILED = f"Could not read that page. {_INSTEAD}"


def _short(value: str) -> str:
    return re.sub(r"[<>]", "", value).strip()[:200]


@router.post("/read-job")
async def read_job(request: Request) -> Response:
    """Reads the job posting a link points to and keeps only what the interview needs: the role, the work and the
    requirements, without the company's mission, values or boilerplate. The form calls it as soon as the "Job
    posting URL" field holds a complete link. It answers with messages that are safe to show."""

    def fail(message: str) -> Response:
        return JSONResponse(ReadJobFailed(error=message).model_dump())

    parsed = parse_body(JobRequest, await read_json(request))
    if isinstance(parsed, ValidationError):
        return fail(first_error(parsed, "That link cannot be read."))
    url = job_url_from(parsed.url) or parsed.url

    try:
        read_started = time.monotonic()
        page_read = await read_page(url)
        read_ms = round((time.monotonic() - read_started) * 1000)
        # A page that did not load (not found, gone, forbidden) has no posting, so the model is not asked.
        if page_read.status is not None and page_read.status >= 400:
            return fail(NOT_A_POSTING)

        model_started = time.monotonic()
        job, usage = await ai.extract_job(page_read)
        # Only numbers, so the next speed-up can be aimed at what is slow. Never the link, the text or the result.
        logger.info(
            "[interview-prototype] read-job read_ms=%d model_ms=%d input_tokens=%d output_tokens=%d",
            read_ms,
            round((time.monotonic() - model_started) * 1000),
            usage.input,
            usage.output,
        )
        if not job.isJobPosting or (not job.requirements and not job.responsibilities):
            return fail(NOT_A_POSTING)
    except Exception as error:
        log_failure("read-job", error)
        return fail(safe_message(error, FAILED))

    result = ReadJobOk(
        jobDescription=job_to_text(job),
        roleTitle=_short(job.roleTitle),
        companyName=_short(job.companyName) if job.companyName and _short(job.companyName) else None,
        usage=usage,
    )
    return JSONResponse(result.model_dump())


@router.post("/warm-up", status_code=204)
async def warm_up_job_reader(tasks: BackgroundTasks) -> Response:
    """Called when the page opens, so the Apify server is awake by the time a link is pasted. It answers at once and
    does the work after the response."""
    tasks.add_task(warm_up)
    return Response(status_code=204)
