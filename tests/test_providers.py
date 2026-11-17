"""Apify, Deepgram and Claude, with HTTP mocked at the module boundary. No test calls a real API."""

import re
from pathlib import Path
from types import SimpleNamespace

import anthropic
import httpx
import httpx2
import pytest
import respx

from prepermint.db.models import Profile
from prepermint.features.interview import apify
from prepermint.features.interview.apify import ENDPOINT, JobPageError, read_page, warm_up
from prepermint.features.interview.deepgram import GRANT_URL, DeepgramError, mint_browser_token
from prepermint.features.interview.languages import LANGUAGE_NAMES, VOICES
from prepermint.lib import ai
from prepermint.lib.ai import AiError, SummaryDraft
from prepermint.lib.prompts import load_prompt, render_prompt
from tests.conftest import Env

ROOT = Path(__file__).resolve().parents[1]
LINK = "https://jobs.lever.co/Flex/1"
POSTING = "Requirement. " * 60


def item(text: str, status: int = 200, url: str = LINK) -> list[dict[str, object]]:
    return [{"markdown": text, "metadata": {"title": "Flex", "url": url}, "crawl": {"httpStatusCode": status}}]


def tool(request: httpx.Request) -> str:
    return request.url.params["scrapingTool"]


# --- Apify ---------------------------------------------------------------------------------------------------


async def test_reading_needs_a_token() -> None:
    with pytest.raises(JobPageError) as error:
        await read_page(LINK)
    assert error.value.code == "not-configured"


@respx.mock
async def test_plain_read_is_enough_for_a_full_page(env: Env) -> None:
    env.set(APIFY_TOKEN="apify-token")
    route = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=item(POSTING)))
    page = await read_page(LINK)
    assert page.text == POSTING and page.status == 200 and page.final_url == LINK
    request = route.calls.last.request
    assert tool(request) == "raw-http" and request.url.params["query"] == LINK
    # The token goes in a header, never in the address.
    assert request.headers["authorization"] == "Bearer apify-token" and "apify-token" not in str(request.url)


@respx.mock
async def test_thin_or_turned_away_pages_get_a_browser_run(env: Env) -> None:
    env.set(APIFY_TOKEN="t")
    respx.get(ENDPOINT).mock(
        side_effect=lambda r: httpx.Response(
            200, json=item("Engineer @ Flossy" if tool(r) == "raw-http" else POSTING, 200)
        )
    )
    assert (await read_page(LINK)).text == POSTING

    respx.get(ENDPOINT).mock(
        side_effect=lambda r: httpx.Response(200, json=item(POSTING if tool(r) != "raw-http" else "x", 403))
    )
    assert (await read_page(LINK)).text == POSTING


@respx.mock
async def test_a_page_that_is_gone_is_not_read_again(env: Env) -> None:
    env.set(APIFY_TOKEN="t")
    route = respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=item("Not found", 404)))
    assert (await read_page(LINK)).status == 404
    assert route.call_count == 1


@respx.mock
@pytest.mark.parametrize(("status", "code"), [(401, "rejected"), (403, "rejected"), (402, "no-credit")])
async def test_account_problems_are_not_retried(env: Env, status: int, code: str) -> None:
    env.set(APIFY_TOKEN="t")
    route = respx.get(ENDPOINT).mock(return_value=httpx.Response(status))
    with pytest.raises(JobPageError) as error:
        await read_page(LINK)
    assert error.value.code == code and route.call_count == 1
    assert "Paste the text of the posting instead." in str(error.value)


@respx.mock
async def test_a_failed_plain_read_falls_back_to_the_browser(env: Env) -> None:
    env.set(APIFY_TOKEN="t")

    def answer(request: httpx.Request) -> httpx.Response:
        if tool(request) == "raw-http":
            raise httpx.ReadTimeout("slow")
        return httpx.Response(200, json=item(POSTING))

    respx.get(ENDPOINT).mock(side_effect=answer)
    assert (await read_page(LINK)).text == POSTING


@respx.mock
async def test_timeouts_and_empty_answers(env: Env) -> None:
    env.set(APIFY_TOKEN="t")
    respx.get(ENDPOINT).mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(JobPageError) as error:
        await read_page(LINK)
    assert error.value.code == "timeout"
    respx.get(ENDPOINT).mock(return_value=httpx.Response(200, json=[]))
    with pytest.raises(JobPageError) as error:
        await read_page(LINK)
    assert error.value.code == "empty"


@respx.mock
async def test_warm_up_reads_a_fixed_page_once_per_window(env: Env, monkeypatch: pytest.MonkeyPatch) -> None:
    env.set(APIFY_TOKEN="t")
    monkeypatch.setattr(apify, "_last_warm_up_at", None)
    route = respx.get(ENDPOINT).mock(return_value=httpx.Response(500))
    await warm_up(now=1000.0)
    assert route.call_count == 2
    assert {c.request.url.params["query"] for c in route.calls} == {"https://example.com/"}
    await warm_up(now=1000.0 + 60)
    assert route.call_count == 2
    await warm_up(now=1000.0 + 4 * 60 + 1)
    assert route.call_count == 4


# --- Deepgram ------------------------------------------------------------------------------------------------


@respx.mock
async def test_browser_token(env: Env) -> None:
    with pytest.raises(DeepgramError, match="not configured"):
        await mint_browser_token(900)
    env.set(DEEPGRAM_API_KEYS=" first-key , second-key")
    route = respx.post(GRANT_URL).mock(return_value=httpx.Response(200, json={"access_token": "short-lived"}))
    assert await mint_browser_token(15 * 60 + 600) == "short-lived"
    request = route.calls.last.request
    assert request.headers["authorization"] == "Token first-key"
    assert request.content == b'{"ttl_seconds":1500}'
    await mint_browser_token(99_999)
    assert route.calls.last.request.content == b'{"ttl_seconds":3600}'


@respx.mock
@pytest.mark.parametrize(
    ("status", "body", "message"),
    [
        (401, {}, "rejected the key"),
        (403, {}, "Member role"),
        (500, {}, "could not create a token \\(500\\)"),
        (200, {"nope": 1}, "unreadable"),
    ],
)
async def test_browser_token_failures(env: Env, status: int, body: dict[str, object], message: str) -> None:
    env.set(DEEPGRAM_API_KEYS="k")
    respx.post(GRANT_URL).mock(return_value=httpx.Response(status, json=body))
    with pytest.raises(DeepgramError, match=message):
        await mint_browser_token(900)


# --- The two voice lists (server and browser) agree ----------------------------------------------------------


def test_voices_match_the_browser_copy() -> None:
    source = (ROOT / "web" / "interview" / "languages.ts").read_text()
    browser = re.findall(
        r'\{ id: "(\w+)", name: "(\w+)", label: "([^"]+)", language: "(\w+)", model: "([\w-]+)"', source
    )
    assert browser == [(v.id, v.name, v.label, v.language, v.model) for v in VOICES]
    for code, name in LANGUAGE_NAMES.items():
        assert f'{code}: "{name}"' in source


# --- Prompts -------------------------------------------------------------------------------------------------


def placeholders(text: str) -> set[str]:
    return set(re.findall(r"\{\{(\w+)\}\}", text))


def test_prompt_rendering() -> None:
    assert render_prompt("A {{x}} and {{y}}.", {"x": "{{y}}", "y": "2"}) == "A {{y}} and 2."
    with pytest.raises(KeyError, match="name"):
        render_prompt("Hello {{name}}", {})


def test_interview_prompts_and_code_are_in_step() -> None:
    assert placeholders(load_prompt("interviews", "interviewer")) == {
        "language_name",
        "interviewer_name",
        "job_description",
        "resume",
        "plan",
    }
    assert placeholders(load_prompt("interviews", "planner")) == {"question_count", "language_name"}
    assert placeholders(load_prompt("interviews", "feedback")) == {"language_name"}
    assert placeholders(load_prompt("interviews", "job-extractor")) == set()


# --- Claude --------------------------------------------------------------------------------------------------


class FakeMessages:
    """Stands in for client.beta.messages: records the request and answers with `response`."""

    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[dict[str, object]] = []

    async def parse(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response

    create = parse


def fake_client(monkeypatch: pytest.MonkeyPatch, messages: FakeMessages) -> None:
    client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    monkeypatch.setattr(ai, "_anthropic", lambda: client)


def usage() -> SimpleNamespace:
    return SimpleNamespace(
        input_tokens=10, output_tokens=5, cache_read_input_tokens=None, cache_creation_input_tokens=2
    )


def test_ai_is_off_without_a_key(env: Env) -> None:
    assert not ai.ai_enabled()
    env.set(ANTHROPIC_KEYS="sk-test")
    assert ai.ai_enabled()


async def test_structured_call_uses_the_main_model_with_the_refusal_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    draft = SummaryDraft(headline="Backend engineer", summary="Builds APIs.")
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn", parsed_output=draft, usage=usage()))
    fake_client(monkeypatch, messages)
    profile = Profile(
        user_id="u1",
        display_name="Ada",
        location=None,
        goals={"targetRole": "Staff engineer"},
        role_types=[],
        work_mode="remote",
    )
    result = await ai.draft_summary(profile, [])
    assert result == draft
    call = messages.calls[0]
    assert call["model"] == ai.MODEL and call["betas"] == [ai.FALLBACK_BETA] and call["fallbacks"] == "default"
    assert call["output_config"] == {"effort": "medium"} and call["output_format"] is SummaryDraft
    assert "thinking" not in call
    assert "Goals: Staff engineer" in str(call["messages"]) and "Looking for: remote" in str(call["messages"])


@pytest.mark.parametrize(
    ("stop_reason", "parsed", "message"),
    [
        ("refusal", None, "declined"),
        ("max_tokens", None, "cut off"),
        ("end_turn", None, "unreadable"),
    ],
)
async def test_structured_call_failures(
    monkeypatch: pytest.MonkeyPatch, stop_reason: str, parsed: object, message: str
) -> None:
    fake_client(
        monkeypatch, FakeMessages(SimpleNamespace(stop_reason=stop_reason, parsed_output=parsed, usage=usage()))
    )
    with pytest.raises(AiError, match=message):
        await ai.extract_from_interview([{"role": "user", "content": "hi"}])


def api_error(cls: type[anthropic.APIStatusError], status: int) -> anthropic.APIStatusError:
    response = httpx2.Response(status, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"))
    return cls("raw provider message sk-ant-SECRET", response=response, body=None)


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (lambda: api_error(anthropic.RateLimitError, 429), "busy right now"),
        (lambda: api_error(anthropic.AuthenticationError, 401), "key is invalid"),
        (lambda: api_error(anthropic.InternalServerError, 500), r"failed \(500\)"),
    ],
)
async def test_provider_errors_become_safe_messages(
    monkeypatch: pytest.MonkeyPatch, error: object, message: str
) -> None:
    assert callable(error)
    fake_client(monkeypatch, FakeMessages(error=error()))
    with pytest.raises(AiError, match=message) as raised:
        await ai.extract_from_interview([{"role": "user", "content": "hi"}])
    assert "SECRET" not in str(raised.value)


async def test_interview_planning_uses_the_small_model_without_thinking(monkeypatch: pytest.MonkeyPatch) -> None:
    from prepermint.features.interview.schemas import PlanDraft

    draft = PlanDraft(roleTitle="Engineer", companyName=None, questions=[])
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn", parsed_output=draft, usage=usage()))
    fake_client(monkeypatch, messages)
    plan, cost = await ai.plan_interview("job", "", 20, "pt")
    assert plan == draft and cost.model_dump() == {"input": 10, "output": 5, "cacheRead": 0, "cacheWrite": 2}
    call = messages.calls[0]
    assert call["model"] == ai.INTERVIEW_MODEL and call["thinking"] == {"type": "disabled"}
    assert "betas" not in call and call["max_tokens"] == 3000
    # About two minutes per question: 20 minutes is 9 questions.
    assert "9" in str(call["system"]) and "Brazilian Portuguese" in str(call["system"])


async def test_cv_assistant_starts_on_the_user_and_joins_text(monkeypatch: pytest.MonkeyPatch) -> None:
    content = [SimpleNamespace(type="text", text="What did you ship?"), SimpleNamespace(type="thinking", text="x")]
    messages = FakeMessages(SimpleNamespace(stop_reason="end_turn", content=content))
    fake_client(monkeypatch, messages)
    profile = Profile(user_id="u1", display_name=None, goals={})
    reply = await ai.interview_reply(profile, [], [{"role": "assistant", "content": "Hello"}])
    assert reply == "What did you ship?"
    sent = messages.calls[0]["messages"]
    assert isinstance(sent, list) and sent[0] == {"role": "user", "content": "Hi! Help me build my CV."}
    assert "Goals so far: (none yet)" in str(messages.calls[0]["system"])
