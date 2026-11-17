"""The signed-in app end to end over HTTP, on a real Postgres (TEST_DATABASE_URL) with the AI faked."""

import re
from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint.db.models import AssistantThread, Experience, Profile, User, new_id, utcnow
from prepermint.lib import actions, ai, login_link
from prepermint.lib.ai import AiError, InterviewExtract, InterviewGoals, ParsedExperience, ParsedResume
from prepermint.lib.session import SESSION_COOKIE, SessionUser, sign_session_token
from prepermint.main import app
from tests.conftest import Env


async def make_user(db: AsyncSession, email: str = "ada@example.com") -> SessionUser:
    user = User(id=new_id(), email=email, email_verified=utcnow())
    db.add(user)
    await db.commit()
    return SessionUser(id=user.id, name=None, email=email, image=None)


def client_for(user: SessionUser | None) -> TestClient:
    http = TestClient(app, follow_redirects=False)
    if user is not None:
        http.cookies.set(SESSION_COOKIE, sign_session_token(user))
    return http


def experience(title: str, org: str, bullets: list[str] | None = None) -> ParsedExperience:
    return ParsedExperience(
        kind="work",
        title=title,
        organization=org,
        location=None,
        startDate="2021-03",
        endDate=None,
        current=True,
        bullets=bullets or [],
        skills=["Go"],
    )


@pytest.fixture
def ai_on(env: Env) -> None:
    env.set(ANTHROPIC_KEYS="sk-test")


# --- Pages ---------------------------------------------------------------------------------------------------


async def test_every_signed_in_page_renders(db: AsyncSession) -> None:
    http = client_for(await make_user(db))
    for path in ["/chat", "/memory", "/dashboard", "/dashboard/profile", "/dashboard/experience"]:
        response = http.get(path)
        assert response.status_code == 200, path
        assert "Account menu for ada@example.com" in response.text
    assert "The assistant needs ANTHROPIC_KEYS to be set." in http.get("/chat").text
    # The first visit creates the profile.
    assert await db.get(Profile, (await db.scalars(select(User.id))).one()) is not None


async def test_signed_out_visitors_go_to_the_login(db: AsyncSession) -> None:
    for path in ["/chat", "/dashboard"]:
        assert client_for(None).get(path).headers["location"].endswith("/sign-in")


async def test_dashboard_steps_follow_the_data(db: AsyncSession) -> None:
    user = await make_user(db)
    http = client_for(user)
    assert http.get("/dashboard").text.count("(to do)") == 2
    db.add(Experience(id=new_id(), user_id=user.id, title="Engineer", organization="Acme"))
    await db.commit()
    page = http.get("/dashboard").text
    assert page.count("(to do)") == 1 and page.count("(done)") == 1


async def test_old_assistant_address_moves_to_chat() -> None:
    response = TestClient(app, follow_redirects=False).get("/dashboard/assistant")
    assert response.status_code == 308 and response.headers["location"] == "/chat"


# --- Profile -------------------------------------------------------------------------------------------------


async def test_profile_is_cleaned_before_it_is_saved(db: AsyncSession) -> None:
    user = await make_user(db)
    http = client_for(user)
    http.get("/dashboard/profile")
    form = {
        "displayName": "  Ada Lovelace  ",
        "headline": "x" * 200,
        "summary": "Builds payment APIs.",
        "summarySource": "ai",
        "roleTypes": ["Contract", "Astronaut"],
        "workMode": "space",
        "targetRole": "Staff engineer",
        "targetLevel": "",
    }
    response = http.post("/dashboard/profile", data=form)
    assert "Profile saved." in response.text
    profile = await db.get(Profile, user.id, populate_existing=True)
    assert profile is not None
    assert profile.display_name == "Ada Lovelace" and profile.headline == "x" * 120
    assert profile.role_types == ["Contract"] and profile.work_mode is None
    assert profile.goals == {"targetRole": "Staff engineer"} and profile.summary_source == "ai"

    # The same summary keeps its source; an edited one becomes the owner's.
    http.post("/dashboard/profile", data={**form, "summarySource": "user"})
    await db.refresh(profile)
    assert profile.summary_source == "ai"
    http.post("/dashboard/profile", data={**form, "summary": "My own words.", "summarySource": "ai"})
    await db.refresh(profile)
    assert profile.summary_source == "ai"
    http.post("/dashboard/profile", data={**form, "summary": "Changed again.", "summarySource": "user"})
    await db.refresh(profile)
    assert profile.summary_source == "user"


@pytest.mark.usefixtures("ai_on")
async def test_summary_draft_fills_the_form_and_saves_nothing(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await make_user(db)

    async def draft(profile: Profile, experiences: Sequence[Experience]) -> ai.SummaryDraft:
        return ai.SummaryDraft(headline="Backend engineer · Go", summary="Builds APIs.")

    monkeypatch.setattr(ai, "draft_summary", draft)
    response = client_for(user).post("/dashboard/profile/draft", data={"headline": "", "summary": ""})
    assert 'value="Backend engineer · Go"' in response.text and "AI draft." in response.text
    assert 'value="ai"' in response.text
    profile = await db.get(Profile, user.id)
    assert profile is not None and profile.headline is None

    async def failing(profile: Profile, experiences: Sequence[Experience]) -> ai.SummaryDraft:
        raise AiError("The AI is busy right now. Try again in a minute.")

    monkeypatch.setattr(ai, "draft_summary", failing)
    response = client_for(user).post("/dashboard/profile/draft", data={"headline": "Mine", "summary": "Kept"})
    assert 'value="Mine"' in response.text and "busy right now" in response.text


# --- Experience ----------------------------------------------------------------------------------------------


async def test_experience_add_edit_delete(db: AsyncSession) -> None:
    user = await make_user(db)
    http = client_for(user)
    form = {
        "title": "Engineer",
        "organization": "Acme",
        "startDate": "2021-03",
        "endDate": "2023-01",
        "current": "on",
        "bullets": "- Built payments\n• Cut CI time\n\n",
        "skills": "Go, Postgres, ",
        "kind": "work",
    }
    response = http.post("/dashboard/experience", data=form)
    assert "Saved." in response.text and "Mar 2021 – Present · 2 bullets · added by hand" in response.text
    row = (await db.scalars(select(Experience))).one()
    assert row.bullets == ["Built payments", "Cut CI time"] and row.skills == ["Go", "Postgres"]
    assert row.end_date is None and row.position == 0

    response = http.post("/dashboard/experience", data={**form, "id": row.id, "title": "Lead", "startDate": "bad"})
    await db.refresh(row)
    assert row.title == "Lead" and row.start_date is None

    assert "Add a title and an organization." in http.post("/dashboard/experience", data={"title": " "}).text

    # Someone else cannot edit or delete it.
    other = client_for(await make_user(db, "eve@example.com"))
    assert "Entry not found." in other.post("/dashboard/experience", data={**form, "id": row.id}).text
    other.post(f"/dashboard/experience/{row.id}/delete")
    assert (await db.scalars(select(Experience))).one() is not None

    assert "Deleted." in http.post(f"/dashboard/experience/{row.id}/delete").text
    assert (await db.scalars(select(Experience))).all() == []


async def test_imported_entries_merge_into_existing_ones(db: AsyncSession) -> None:
    user = await make_user(db)
    db.add(
        Experience(
            id=new_id(),
            user_id=user.id,
            title="Engineer",
            organization="Acme",
            bullets=["Built payments"],
            skills=["Go"],
            location=None,
        )
    )
    await db.commit()
    result = await actions.add_experiences(
        db,
        user.id,
        [
            experience(" engineer ", "ACME", ["built payments", "Led the migration"]),
            experience("Analyst", "Beta"),
            experience("", "No title"),
        ],
        "resume",
    )
    assert (result.added, result.merged) == (1, 1)
    rows = {e.title: e for e in (await db.scalars(select(Experience).execution_options(populate_existing=True)))}
    assert rows["Engineer"].bullets == ["Built payments", "Led the migration"]
    assert rows["Engineer"].start_date == "2021-03"
    assert rows["Analyst"].source == "resume" and rows["Analyst"].position == 1


@pytest.mark.usefixtures("ai_on")
async def test_resume_import(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    user = await make_user(db)
    http = client_for(user)
    seen: list[object] = []

    async def parse(file: object) -> ParsedResume:
        seen.append(file)
        return ParsedResume(
            displayName="Ada", headline="Engineer", location="Porto", experiences=[experience("Engineer", "Acme")]
        )

    monkeypatch.setattr(ai, "parse_resume", parse)
    http.get("/dashboard/experience")
    response = http.post(
        "/dashboard/experience/import",
        data={"source": "linkedin"},
        files={"file": ("Positions.csv", b"Title,Company\nEngineer,Acme", "text/csv")},
    )
    assert "Imported 1 new entry. Review them below." in response.text
    assert re.search(r'id="import-status"[^>]*hx-swap-oob="true"', response.text)
    assert isinstance(seen[0], ai.TextFile) and "Engineer,Acme" in seen[0].text
    row = (await db.scalars(select(Experience))).one()
    assert row.source == "linkedin"
    profile = await db.get(Profile, user.id, populate_existing=True)
    assert profile is not None and (profile.display_name, profile.location) == ("Ada", "Porto")

    response = http.post("/dashboard/experience/import", files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")})
    assert isinstance(seen[1], ai.PdfFile) and "updated 1" in response.text

    assert "Use a PDF, DOCX, TXT" in http.post("/dashboard/experience/import", files={"file": ("a.png", b"x")}).text
    big = b"x" * (4 * 1024 * 1024 + 1)
    assert "over 4 MB" in http.post("/dashboard/experience/import", files={"file": ("big.txt", big)}).text


# --- Chat ----------------------------------------------------------------------------------------------------


async def start_thread(http: TestClient, text: str) -> str:
    response = http.post("/chat", data={"text": text})
    assert response.status_code == 303
    match = re.fullmatch(r"/chat/([0-9a-f-]{36})", response.headers["location"])
    assert match is not None
    return match.group(1)


@pytest.mark.usefixtures("ai_on")
async def test_a_chat_from_start_to_cv(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    user = await make_user(db)
    http = client_for(user)
    replies: list[Sequence[dict[str, str]]] = []

    async def reply(profile: Profile, experiences: Sequence[Experience], messages: Sequence[dict[str, str]]) -> str:
        replies.append(list(messages))
        return f"Reply {len(replies)}"

    monkeypatch.setattr(ai, "interview_reply", reply)
    first_line = "First line of my question that is long enough to be shortened somewhere"
    thread_id = await start_thread(http, f"{first_line}\nmore")
    thread = await db.get(AssistantThread, thread_id)
    assert thread is not None and thread.title == f"{first_line[:57]}…"

    page = http.get(f"/chat/{thread_id}").text
    assert f'hx-post="/chat/{thread_id}/reply" hx-trigger="load"' in page
    response = http.post(f"/chat/{thread_id}/reply")
    assert response.headers["hx-trigger"] == "threads-changed" and "Reply 1" in response.text
    response = http.post(f"/chat/{thread_id}/messages", data={"text": "  I built payments  "})
    assert "I built payments" in response.text and "Reply 2" in response.text
    assert replies[-1][-1] == {"role": "user", "content": "I built payments"}

    sidebar = http.get("/chat/_threads", headers={"HX-Current-URL": f"http://localhost/chat/{thread_id}"}).text
    assert 'aria-current="page"' in sidebar and "Recents" in sidebar

    pin = http.post(f"/chat/{thread_id}/pin", data={"pinned": "true"})
    assert 'aria-pressed="true"' in pin.text and pin.headers["hx-trigger"] == "threads-changed"
    assert "Pinned" in http.get("/chat/_threads").text

    async def extract(messages: Sequence[dict[str, str]]) -> InterviewExtract:
        return InterviewExtract(
            goals=InterviewGoals(targetRole="Staff engineer", targetLevel=None, targetMarket="EU"),
            experiences=[experience("Engineer", "Acme", ["Built payments"])],
        )

    monkeypatch.setattr(ai, "extract_from_interview", extract)
    saved = http.post(f"/chat/{thread_id}/save").text
    assert "Saved to your CV: 1 new entry, 0 updated." in saved
    profile = await db.get(Profile, user.id, populate_existing=True)
    assert profile is not None and profile.goals == {"targetRole": "Staff engineer", "targetMarket": "EU"}


@pytest.mark.usefixtures("ai_on")
async def test_a_failed_reply_keeps_what_the_user_wrote(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    user = await make_user(db)
    http = client_for(user)

    async def failing(*args: object) -> str:
        raise RuntimeError("upstream exploded sk-ant-SECRET")

    monkeypatch.setattr(ai, "interview_reply", failing)
    thread_id = await start_thread(http, "Hello")
    response = http.post(f"/chat/{thread_id}/messages", data={"text": "My answer"})
    assert "Something went wrong." in response.text and "SECRET" not in response.text
    thread = await db.get(AssistantThread, thread_id, populate_existing=True)
    assert thread is not None and [m["content"] for m in thread.messages] == ["Hello", "My answer"]


async def test_starters_and_empty_messages(db: AsyncSession) -> None:
    http = client_for(await make_user(db))
    response = http.post("/chat/starters/headline")
    thread = (await db.scalars(select(AssistantThread))).one()
    assert response.headers["location"] == f"/chat/{thread.id}" and thread.title == "Improve my headline"
    assert thread.messages[0]["content"].startswith("Help me improve my profile headline.")
    assert http.post("/chat/starters/nope").headers["location"] == "/chat"
    assert http.post("/chat", data={"text": "   "}).headers["location"] == "/chat"


async def test_conversations_are_private(db: AsyncSession) -> None:
    owner = client_for(await make_user(db))
    thread_id = await start_thread(owner, "Mine")
    other = client_for(await make_user(db, "eve@example.com"))
    assert other.get(f"/chat/{thread_id}").status_code == 404
    assert other.post(f"/chat/{thread_id}/messages", data={"text": "x"}).status_code == 404
    assert other.post(f"/chat/{thread_id}/pin", data={"pinned": "true"}).status_code == 404
    assert "Conversation not found." in other.post(f"/chat/{thread_id}/save").text
    assert "Mine" not in other.get("/chat/_threads").text


async def test_a_cross_site_post_is_refused(db: AsyncSession) -> None:
    http = client_for(await make_user(db))
    response = http.post("/chat", data={"text": "x"}, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert (await db.scalars(select(AssistantThread))).all() == []


# --- Login ---------------------------------------------------------------------------------------------------


async def test_login_from_link_to_session(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[str] = []

    async def send(to: str, link: str) -> None:
        sent.append(link)

    monkeypatch.setattr(login_link, "send_login_email", send)
    http = client_for(None)
    response = http.post("/sign-in", data={"email": " Ada@Example.com "}, headers={"HX-Request": "true"})
    assert 'We sent a link to <span class="font-medium">ada@example.com</span>' in response.text
    assert "<html" not in response.text
    assert "Enter a valid email address." in http.post("/sign-in", data={"email": "nope"}).text

    token = sent[0].split("token=")[1]
    page = http.get(f"/sign-in/verify?token={token}")
    assert "Continue as" in page.text and "ada@example.com" in page.text

    response = http.post("/sign-in/verify", data={"token": token})
    assert response.status_code == 303 and response.headers["location"] == "/chat"
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=") and "HttpOnly" in cookie and "SameSite=lax" in cookie

    again = client_for(None).post("/sign-in/verify", data={"token": token})
    assert again.headers["location"] == "/sign-in?error=expired&email=ada%40example.com"
    assert client_for(None).get("/sign-in/verify").headers["location"] == "/sign-in?error=expired"
    expired = client_for(None).get("/sign-in?error=expired&email=ada%40example.com").text
    assert "Link expired. Request a new one." in expired and 'value="ada@example.com"' in expired

    signed_in = TestClient(app, follow_redirects=False)
    signed_in.cookies.set(SESSION_COOKIE, response.cookies[SESSION_COOKIE])
    assert signed_in.get("/sign-in").headers["location"] == "/chat"
    out = signed_in.post("/sign-out")
    assert out.status_code == 303 and 'pp_session=""' in out.headers["set-cookie"]


async def test_a_failed_send_is_reported(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(to: str, link: str) -> None:
        raise OSError("provider down")

    monkeypatch.setattr(login_link, "send_login_email", broken)
    response = client_for(None).post("/sign-in", data={"email": "ada@example.com"})
    assert "We couldn&#39;t send the email right now." in response.text
