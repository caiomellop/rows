"""Types and request schemas of the voice interview prototype (CAI-36). Nothing here is stored: the interview
state lives in the browser and travels with each request.

Field names are camelCase on purpose: they are the JSON contract with the browser client (web/interview/) and
the names the prompts in prompts/interviews/ refer to.
"""

import json
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, StringConstraints, field_validator

from prepermint.features.interview.job_url import MAX_JOB_URL_LENGTH, is_public_job_url
from prepermint.features.interview.languages import DEFAULT_VOICE, Language, VoiceId

# 15 minutes is the shortest interview that fits the whole arc in planner.md (CAI-91).
DURATIONS = (15, 20, 30)

# Size limits shared by the form and the routes, so a pasted document can't run up the Claude bill.
LIMIT_JOB_DESCRIPTION = 12_000
LIMIT_RESUME = 12_000
LIMIT_TURN_TEXT = 4_000
LIMIT_TURNS = 200

# What the interviewer can do in one turn. The model writes it as a tag at the start of its reply.
Move = Literal["FOLLOW_UP", "NEXT", "END"]
MOVES: tuple[Move, ...] = ("FOLLOW_UP", "NEXT", "END")

# --- Question plan (written by Claude from the job description and CV) ---------------------------------------


class PlanQuestion(BaseModel):
    topic: str = Field(description='Two or three words, e.g. "Team leadership".')
    question: str = Field(description="Exactly what the interviewer says: one natural spoken sentence.")
    lookFor: str = Field(description="One sentence on what a strong answer contains.")


class PlanDraft(BaseModel):
    """What the planner model writes. The language is not its choice: it comes from the voice the candidate
    picked."""

    roleTitle: str
    companyName: str | None
    questions: list[PlanQuestion] = Field(description="The questions, in the order they will be asked.")


class Plan(PlanDraft):
    """The plan that travels with the interview: the draft plus the language the interview is held in and the name
    the interviewer introduces itself with (the name of the chosen voice)."""

    language: Language
    interviewerName: str | None = Field(default=None, max_length=40)


# --- Interview state -----------------------------------------------------------------------------------------


class Turn(BaseModel):
    role: Literal["interviewer", "candidate"]
    text: str = Field(max_length=LIMIT_TURN_TEXT)
    # Seconds since the interview started.
    at: float = Field(ge=0)
    # The candidate cut the interviewer off: `text` is only the part they heard.
    interrupted: bool | None = None


# opening: the interviewer introduces itself and the structure. firstQuestion: it bridges into planned question 1.
# questions: the plan. candidateQuestions: the candidate asks theirs. closing: goodbye.
Stage = Literal["opening", "firstQuestion", "questions", "candidateQuestions", "closing", "done"]


class InterviewState(BaseModel):
    """The interview state is the product: where the interview is, not only what was said. `questionIndex` is the
    planned question being discussed (the last one asked). `followUps` counts follow-ups on that question, or, in
    candidateQuestions, the candidate's questions answered."""

    stage: Stage
    questionIndex: int = Field(ge=0, le=20)
    followUps: int = Field(ge=0, le=20)
    elapsedMs: float = Field(ge=0, le=4 * 3_600_000)
    budgetMs: int = Field(ge=60_000, le=3_600_000)
    transcript: list[Turn] = Field(max_length=LIMIT_TURNS)


# --- Route requests ------------------------------------------------------------------------------------------


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _job_description(value: str) -> str:
    if len(value) < 40:
        raise ValueError("Paste the job description (at least a few lines).")
    return value


def _small_plan(plan: Plan) -> Plan:
    # The plan comes back from the browser on later requests, so it is validated and capped again.
    if len(json.dumps(plan.model_dump(exclude_none=True))) >= 20_000:
        raise ValueError("The plan is too large.")
    return plan


JobDescription = Annotated[
    str,
    BeforeValidator(_strip),
    StringConstraints(max_length=LIMIT_JOB_DESCRIPTION),
    AfterValidator(_job_description),
]
Resume = Annotated[str, BeforeValidator(_strip), StringConstraints(max_length=LIMIT_RESUME)]
CheckedPlan = Annotated[Plan, AfterValidator(_small_plan)]


class StartRequest(BaseModel):
    jobDescription: JobDescription
    resume: Resume = ""
    voice: VoiceId = DEFAULT_VOICE
    durationMinutes: Literal[15, 20, 30]


class TurnRequest(BaseModel):
    jobDescription: JobDescription
    resume: Resume = ""
    plan: CheckedPlan
    state: InterviewState


class FeedbackRequest(BaseModel):
    jobDescription: JobDescription
    plan: CheckedPlan
    transcript: list[Turn] = Field(min_length=1, max_length=LIMIT_TURNS)


class JobRequest(BaseModel):
    url: Annotated[str, BeforeValidator(_strip), StringConstraints(max_length=MAX_JOB_URL_LENGTH)]

    @field_validator("url")
    @classmethod
    def _public(cls, value: str) -> str:
        if not is_public_job_url(value):
            raise ValueError("That link cannot be read. Paste the public address of the job posting.")
        return value


# --- Feedback report (written by Claude after the interview) -------------------------------------------------

Criterion = Literal["relevance", "structure", "specificity", "communication", "roleFit"]
CRITERIA: tuple[Criterion, ...] = ("relevance", "structure", "specificity", "communication", "roleFit")


class Score(BaseModel):
    criterion: Criterion
    score: float = Field(description="Integer from 1 to 5.")
    note: str = Field(description="One sentence that points to something the candidate said.")


class Feedback(BaseModel):
    summary: str = Field(description="Two or three sentences with the overall impression.")
    scores: list[Score] = Field(description="One entry per criterion.")
    strengths: list[str] = Field(description="Two or three items.")
    improvements: list[str] = Field(description="Two or three concrete, actionable items.")


# --- Job posting read from a link (written by Claude from the page text) -------------------------------------


class Job(BaseModel):
    isJobPosting: bool = Field(
        description="True only if the page describes one specific job and it is the job the link points to."
    )
    roleTitle: str = Field(description="The job title as written. Empty when isJobPosting is false.")
    companyName: str | None = Field(description="The employer, or null if the page does not say.")
    seniority: str | None = Field(
        description="The level (for example Junior, Senior, Staff), only if the posting states it. Otherwise null."
    )
    responsibilities: list[str] = Field(description="What the person will do, one short item each.")
    requirements: list[str] = Field(
        description="The must-haves: skills, experience, education, languages, certifications."
    )
    niceToHave: list[str] = Field(description="What the posting calls preferred, a plus or a differential.")
    tools: list[str] = Field(description="Technologies, tools and methods named in the role.")


# --- Route responses -----------------------------------------------------------------------------------------


class LlmUsage(BaseModel):
    input: int = 0
    output: int = 0
    cacheRead: int = 0
    cacheWrite: int = 0


class DeepgramAccess(BaseModel):
    token: str
    listenUrl: str
    speakUrl: str


class SessionResponse(BaseModel):
    plan: Plan
    budgetMs: int
    usage: LlmUsage
    deepgram: DeepgramAccess


class FeedbackResponse(BaseModel):
    feedback: Feedback
    usage: LlmUsage


class ReadJobOk(BaseModel):
    """What reading a job link answers: the text the interview is built from, the role and company for the form
    to show, and what the model call cost."""

    ok: Literal[True] = True
    jobDescription: str
    roleTitle: str
    companyName: str | None
    usage: LlmUsage


class ReadJobFailed(BaseModel):
    """A failure carries a message that is safe to show."""

    ok: Literal[False] = False
    error: str


ReadJobResult = ReadJobOk | ReadJobFailed
