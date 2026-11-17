"""The interview routes, with the AI and the Deepgram token mocked at the module boundary (ported from
src/app/interview/routes.test.ts: same JSON contract the browser client in web/interview/ reads)."""

import json
from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from prepermint.features.interview import routes
from prepermint.features.interview.schemas import Feedback, LlmUsage, Plan, PlanDraft, PlanQuestion
from prepermint.features.interview.state import apply_move, start_state
from prepermint.lib import ai
from prepermint.lib.ai import AiError, DoneEvent, InterviewerEvent, TextEvent
from prepermint.main import app
from tests.conftest import Env

DRAFT = PlanDraft(
    roleTitle="Backend Engineer",
    companyName=None,
    questions=[
        PlanQuestion(topic="Background", question="Walk me through your background.", lookFor="Relevant experience."),
        PlanQuestion(topic="APIs", question="How do you design a public API?", lookFor="Versioning and errors."),
        PlanQuestion(topic="Conflict", question="Tell me about a disagreement.", lookFor="Their own role."),
    ],
)
PLAN = Plan(**DRAFT.model_dump(), language="en", interviewerName="Cliff")
JOB = "We are hiring a backend engineer to build and run payment APIs in Go and PostgreSQL."
USAGE = LlmUsage(input=1200, output=40, cacheRead=1000, cacheWrite=0)


class Calls:
    def __init__(self) -> None:
        self.plan: list[dict[str, object]] = []
        self.token: list[float] = []
        self.turn: list[tuple[str, list[object]]] = []


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> Calls:
    record = Calls()

    async def plan_interview(
        job_description: str, resume: str, duration_minutes: int, language: str
    ) -> tuple[PlanDraft, LlmUsage]:
        record.plan.append({"language": language, "duration": duration_minutes})
        return DRAFT, USAGE

    async def mint(ttl: float) -> str:
        record.token.append(ttl)
        return "browser-token"

    monkeypatch.setattr(ai, "plan_interview", plan_interview)
    monkeypatch.setattr(routes, "mint_browser_token", mint)
    return record


@pytest.fixture
def http() -> TestClient:
    return TestClient(app)


def post(http: TestClient, path: str, body: object) -> object:
    return http.post(f"/interview{path}", json=body)


def lines(text: str) -> list[dict[str, object]]:
    return [json.loads(line) for line in text.strip().split("\n")]


def test_closed_unless_enabled(http: TestClient, calls: Calls, env: Env) -> None:
    for path in ["/session", "/turn", "/feedback", "/read-job", "/warm-up"]:
        assert http.post(f"/interview{path}", json={}).status_code == 404
    assert http.get("/interview").status_code == 404
    env.set(PROTOTYPE_ENABLED="1")
    assert http.post("/interview/session", json={}).status_code == 404
    assert calls.plan == [] and calls.token == []


@pytest.fixture
def enabled(env: Env) -> None:
    env.set(PROTOTYPE_ENABLED="true")


@pytest.mark.usefixtures("enabled")
class TestStart:
    def test_asks_for_the_job_description(self, http: TestClient, calls: Calls) -> None:
        response = http.post("/interview/session", json={"jobDescription": "Engineer", "durationMinutes": 15})
        assert response.status_code == 400
        assert "job description" in response.json()["error"]

    def test_refuses_a_duration_that_is_not_offered(self, http: TestClient, calls: Calls) -> None:
        for minutes in [45, 10]:
            response = http.post("/interview/session", json={"jobDescription": JOB, "durationMinutes": minutes})
            assert response.status_code == 400

    def test_returns_plan_budget_and_token(self, http: TestClient, calls: Calls) -> None:
        response = http.post("/interview/session", json={"jobDescription": JOB, "resume": "", "durationMinutes": 15})
        assert response.status_code == 200
        body = response.json()
        assert body["plan"] == PLAN.model_dump()
        assert body["budgetMs"] == 15 * 60_000
        assert body["usage"] == USAGE.model_dump()
        assert body["deepgram"]["token"] == "browser-token"
        assert "wss://api.deepgram.com/v2/listen" in body["deepgram"]["listenUrl"]
        assert "model=flux-cliff-en" in body["deepgram"]["speakUrl"]
        assert calls.token == [15 * 60 + 600]

    @pytest.mark.parametrize(
        ("voice", "name", "language", "model", "speed", "expressivity"),
        [
            (None, "Cliff", "en", "flux-cliff-en", "0.9", "1"),
            ("sienna", "Sienna", "en", "flux-sienna-en", "0.9", "1"),
            ("eduardo", "Eduardo", "es", "flux-eduardo-es", "0.9", "0"),
            ("roberto", "Roberto", "pt", "flux-roberto-pt", "0.9", "1"),
            ("mathieu", "Mathieu", "fr", "flux-mathieu-fr", "0.9", "0"),
        ],
    )
    def test_voice_sets_language_voice_and_name(
        self,
        http: TestClient,
        calls: Calls,
        voice: str | None,
        name: str,
        language: str,
        model: str,
        speed: str,
        expressivity: str,
    ) -> None:
        body: dict[str, object] = {"jobDescription": JOB, "durationMinutes": 15}
        if voice:
            body["voice"] = voice
        data = http.post("/interview/session", json=body).json()
        speak = parse_qs(urlsplit(data["deepgram"]["speakUrl"]).query)
        assert [speak["model"][0], speak["speed"][0], speak["expressivity"][0]] == [model, speed, expressivity]
        assert parse_qs(urlsplit(data["deepgram"]["listenUrl"]).query)["language_hint"] == [language]
        assert calls.plan[-1]["language"] == language
        assert data["plan"]["language"] == language
        assert data["plan"]["interviewerName"] == name

    def test_refuses_a_voice_not_offered(self, http: TestClient, calls: Calls) -> None:
        body = {"jobDescription": JOB, "durationMinutes": 15, "voice": "alexis"}
        assert http.post("/interview/session", json=body).status_code == 400

    def test_known_failure_shows_our_message_and_hides_the_rest(
        self, http: TestClient, calls: Calls, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async def busy(*args: object) -> tuple[PlanDraft, LlmUsage]:
            raise AiError("The AI is busy right now. Try again in a minute.")

        monkeypatch.setattr(ai, "plan_interview", busy)
        known = http.post("/interview/session", json={"jobDescription": JOB, "durationMinutes": 15})
        assert known.status_code == 502
        assert known.json()["error"] == "The AI is busy right now. Try again in a minute."

        async def leaky(*args: object) -> tuple[PlanDraft, LlmUsage]:
            raise RuntimeError("401 invalid x-api-key sk-ant-SECRET")

        monkeypatch.setattr(ai, "plan_interview", leaky)
        unknown = http.post("/interview/session", json={"jobDescription": JOB, "durationMinutes": 15})
        assert "Could not start the interview" in unknown.text and "sk-ant" not in unknown.text

    def test_a_plan_with_almost_no_questions_does_not_start(
        self, http: TestClient, calls: Calls, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        async def short(*args: object) -> tuple[PlanDraft, LlmUsage]:
            return DRAFT.model_copy(update={"questions": DRAFT.questions[:1]}), USAGE

        monkeypatch.setattr(ai, "plan_interview", short)
        response = http.post("/interview/session", json={"jobDescription": JOB, "durationMinutes": 15})
        assert response.status_code == 502


def model_stream(*events: InterviewerEvent) -> object:
    async def stream(system: str, messages: list[object]) -> AsyncIterator[InterviewerEvent]:
        for event in events:
            yield event

    return stream


@pytest.mark.usefixtures("enabled")
class TestTurn:
    def body(self) -> dict[str, object]:
        state = apply_move(start_state(900_000), "NEXT", PLAN)
        return {"jobDescription": JOB, "resume": "", "plan": PLAN.model_dump(), "state": state.model_dump()}

    def test_streams_move_then_words_then_usage(self, http: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        seen: list[tuple[str, list[object]]] = []

        async def stream(system: str, messages: list[object]) -> AsyncIterator[InterviewerEvent]:
            seen.append((system, messages))
            for event in [TextEvent("[[FOLLOW"), TextEvent("_UP]] Could you"), TextEvent(" give an example?")]:
                yield event
            yield DoneEvent(USAGE)

        monkeypatch.setattr(ai, "stream_interviewer_turn", stream)
        response = http.post("/interview/turn", json=self.body())
        assert response.headers["content-type"].startswith("application/x-ndjson")
        assert lines(response.text) == [
            {"t": "move", "move": "FOLLOW_UP"},
            {"t": "text", "text": "Could you"},
            {"t": "text", "text": " give an example?"},
            {"t": "done", "usage": USAGE.model_dump()},
        ]
        system, messages = seen[0]
        assert JOB in system
        last = messages[-1]
        assert isinstance(last, dict) and last["role"] == "user"

    def test_reply_without_a_tag_is_still_spoken(self, http: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            ai, "stream_interviewer_turn", model_stream(TextEvent("Tell me more about that."), DoneEvent(USAGE))
        )
        assert lines(http.post("/interview/turn", json=self.body()).text) == [
            {"t": "move", "move": None},
            {"t": "text", "text": "Tell me more about that."},
            {"t": "done", "usage": USAGE.model_dump()},
        ]

    def test_failure_is_an_event_not_a_broken_stream(self, http: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        async def broken(system: str, messages: list[object]) -> AsyncIterator[InterviewerEvent]:
            yield TextEvent("[[NEXT]] Okay.")
            raise RuntimeError("upstream exploded with a stack trace")

        monkeypatch.setattr(ai, "stream_interviewer_turn", broken)
        events = lines(http.post("/interview/turn", json=self.body()).text)
        assert events[-1] == {"t": "error", "message": "The interviewer could not answer. Try again."}

    def test_rejects_a_malformed_state(self, http: TestClient) -> None:
        body = {"jobDescription": JOB, "plan": PLAN.model_dump(), "state": {"stage": "nope"}}
        assert http.post("/interview/turn", json=body).status_code == 400


@pytest.mark.usefixtures("enabled")
class TestFeedback:
    BODY = {  # noqa: RUF012
        "jobDescription": JOB,
        "plan": PLAN.model_dump(),
        "transcript": [
            {"role": "interviewer", "text": "Hi.", "at": 1},
            {"role": "candidate", "text": "Hello.", "at": 4},
        ],
    }

    def test_returns_report_and_cost(self, http: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        report = Feedback(summary="Good.", scores=[], strengths=["a"], improvements=["b"])

        async def feedback(*args: object) -> tuple[Feedback, LlmUsage]:
            return report, USAGE

        monkeypatch.setattr(ai, "interview_feedback", feedback)
        response = http.post("/interview/feedback", json=self.BODY)
        assert response.status_code == 200
        assert response.json() == {"feedback": report.model_dump(), "usage": USAGE.model_dump()}

    def test_needs_a_transcript(self, http: TestClient) -> None:
        assert http.post("/interview/feedback", json={**self.BODY, "transcript": []}).status_code == 400

    def test_hides_raw_errors(self, http: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        async def boom(*args: object) -> tuple[Feedback, LlmUsage]:
            raise RuntimeError("boom with sk-ant-SECRET")

        monkeypatch.setattr(ai, "interview_feedback", boom)
        response = http.post("/interview/feedback", json=self.BODY)
        assert response.status_code == 502 and "SECRET" not in response.text


@pytest.mark.usefixtures("enabled")
def test_page_renders_voices_and_durations(http: TestClient) -> None:
    html = http.get("/interview").text
    assert 'value="cliff" selected' in html and "🇧🇷 Roberto" in html
    assert '<option value="30">30 minutes</option>' in html
    assert "interview.js" in html and "noindex" in html
