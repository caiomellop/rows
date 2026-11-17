"""What the signed-in app's forms do (they were Server Actions in src/app/(app)/dashboard/actions.ts). Every action
takes the session user from the route, which got it from `require_user`, and only touches rows that user owns.

Results are `ActionResult`: ok with an optional message, or an error that is safe to show. Raw errors and stack
traces are logged, never returned.
"""

import base64
import io
import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass, field

import mammoth
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import FormData, UploadFile

from prepermint.config.starters import starter_by_id
from prepermint.db.models import WORK_MODES, AssistantThread, Experience, Profile, new_id, utcnow
from prepermint.lib import ai
from prepermint.lib.ai import AiError, ParsedExperience, PdfFile, TextFile
from prepermint.lib.dal import ensure_profile, get_thread
from prepermint.lib.experience_format import ROLE_TYPES
from prepermint.lib.session import SessionUser

logger = logging.getLogger(__name__)

GENERIC_ERROR = "Something went wrong."


@dataclass(frozen=True)
class ActionResult:
    ok: bool
    message: str | None = None
    error: str | None = None

    @staticmethod
    def success(message: str | None = None) -> "ActionResult":
        return ActionResult(ok=True, message=message)

    @staticmethod
    def failure(error: str) -> "ActionResult":
        return ActionResult(ok=False, error=error)


def fail(error: BaseException) -> ActionResult:
    if isinstance(error, AiError):
        return ActionResult.failure(str(error))
    logger.exception("action failed: %s", type(error).__name__)
    return ActionResult.failure(GENERIC_ERROR)


def _value(form: FormData, name: str) -> str:
    value = form.get(name)
    return value if isinstance(value, str) else ""


def clean(value: str | None, max_length: int) -> str | None:
    """Trimmed and cut to `max_length`; None when empty."""
    v = (value or "").strip()[:max_length]
    return v or None


# --- Profile -------------------------------------------------------------------------------------------------


async def save_profile(db: AsyncSession, user: SessionUser, form: FormData) -> ActionResult:
    try:
        profile = await ensure_profile(db, user)
        summary = clean(_value(form, "summary"), 800)
        summary_source = ("ai" if _value(form, "summarySource") == "ai" else "user") if summary else None
        work_mode = _value(form, "workMode")
        goals = {
            key: value
            for key, value in {
                "targetRole": clean(_value(form, "targetRole"), 100),
                "targetLevel": clean(_value(form, "targetLevel"), 60),
                "targetMarket": clean(_value(form, "targetMarket"), 100),
            }.items()
            if value is not None
        }
        await db.execute(
            update(Profile)
            .where(Profile.user_id == user.id)
            .values(
                display_name=clean(_value(form, "displayName"), 100),
                headline=clean(_value(form, "headline"), 120),
                summary=summary,
                summary_source=profile.summary_source if summary == profile.summary else summary_source,
                location=clean(_value(form, "location"), 100),
                timezone=clean(_value(form, "timezone"), 60),
                role_types=[r for r in form.getlist("roleTypes") if isinstance(r, str) and r in ROLE_TYPES],
                work_mode=work_mode if work_mode in WORK_MODES else None,
                work_authorization=clean(_value(form, "workAuthorization"), 120),
                goals=goals,
                updated_at=utcnow(),
            )
        )
        await db.commit()
        return ActionResult.success("Profile saved.")
    except Exception as error:
        return fail(error)


@dataclass(frozen=True)
class SummaryResult:
    ok: bool
    headline: str = ""
    summary: str = ""
    error: str | None = None


async def draft_profile_summary(db: AsyncSession, user: SessionUser) -> SummaryResult:
    """Returns a draft for the form; nothing is saved until the owner saves."""
    try:
        profile = await ensure_profile(db, user)
        rows = (await db.scalars(select(Experience).where(Experience.user_id == user.id))).all()
        draft = await ai.draft_summary(profile, rows)
        return SummaryResult(ok=True, headline=draft.headline, summary=draft.summary)
    except Exception as error:
        return SummaryResult(ok=False, error=fail(error).error)


# --- Experience ----------------------------------------------------------------------------------------------

MAX_UPLOAD = 4 * 1024 * 1024


def _key(title: str, organization: str) -> str:
    return f"{title.strip().lower()}|{organization.strip().lower()}"


@dataclass
class AddResult:
    added: int = 0
    merged: int = 0


async def add_experiences(db: AsyncSession, user_id: str, items: Sequence[ParsedExperience], source: str) -> AddResult:
    """Adds parsed entries; an entry with the same title and organization as an existing one is merged into it
    (new bullets and skills added, empty dates and location filled)."""
    existing = list((await db.scalars(select(Experience).where(Experience.user_id == user_id))).all())
    by_key = {_key(e.title, e.organization): e for e in existing}
    result = AddResult()
    position = len(existing)

    for item in items:
        if not item.title.strip() or not item.organization.strip():
            continue
        match = by_key.get(_key(item.title, item.organization))
        if match is not None:
            bullets = list(match.bullets)
            for b in item.bullets:
                if not any(x.lower() == b.lower() for x in bullets):
                    bullets.append(b)
            skills = list(dict.fromkeys([*match.skills, *item.skills]))
            await db.execute(
                update(Experience)
                .where(Experience.id == match.id, Experience.user_id == user_id)
                .values(
                    bullets=bullets,
                    skills=skills,
                    start_date=match.start_date or item.startDate,
                    end_date=match.end_date or item.endDate,
                    location=match.location or item.location,
                )
            )
            result.merged += 1
        else:
            row = Experience(
                id=new_id(),
                user_id=user_id,
                kind=item.kind,
                title=item.title.strip(),
                organization=item.organization.strip(),
                location=item.location,
                start_date=item.startDate,
                end_date=item.endDate,
                current=item.current,
                bullets=item.bullets,
                skills=item.skills,
                source=source,
                position=position,
            )
            position += 1
            db.add(row)
            await db.flush()
            by_key[_key(row.title, row.organization)] = row
            result.added += 1
    await db.commit()
    return result


def _entries(n: int) -> str:
    return "entry" if n == 1 else "entries"


async def read_upload(file: UploadFile) -> bytes | None:
    """The file's bytes, or None when it is over the limit (read no further than that)."""
    data = await file.read(MAX_UPLOAD + 1)
    return None if len(data) > MAX_UPLOAD else data


def docx_text(data: bytes) -> str:
    return str(mammoth.extract_raw_text(io.BytesIO(data)).value)


async def import_resume(db: AsyncSession, user: SessionUser, form: FormData) -> ActionResult:
    try:
        profile = await ensure_profile(db, user)
        file = form.get("file")
        if not isinstance(file, UploadFile) or not file.filename:
            return ActionResult.failure("Choose a PDF, DOCX or TXT file.")
        data = await read_upload(file)
        if data is None:
            return ActionResult.failure("That file is over 4 MB.")
        if not data:
            return ActionResult.failure("Choose a PDF, DOCX or TXT file.")

        source = "linkedin" if _value(form, "source") == "linkedin" else "resume"
        name = file.filename.lower()
        if name.endswith(".pdf") or file.content_type == "application/pdf":
            parsed = await ai.parse_resume(PdfFile(base64.b64encode(data).decode()))
        elif name.endswith(".docx"):
            parsed = await ai.parse_resume(TextFile(docx_text(data)))
        elif name.endswith((".txt", ".md", ".csv")):
            # .csv covers LinkedIn's data export (Positions.csv, Education.csv).
            parsed = await ai.parse_resume(TextFile(data.decode("utf-8", errors="replace")))
        else:
            return ActionResult.failure("Use a PDF, DOCX, TXT or LinkedIn CSV file.")

        counts = await add_experiences(db, user.id, parsed.experiences, source)

        # Fill empty header fields only; never overwrite what the owner wrote.
        await db.execute(
            update(Profile)
            .where(Profile.user_id == user.id)
            .values(
                display_name=profile.display_name or parsed.displayName,
                headline=profile.headline or parsed.headline,
                location=profile.location or parsed.location,
                updated_at=utcnow(),
            )
        )
        await db.commit()
        updated = f", updated {counts.merged}" if counts.merged else ""
        return ActionResult.success(
            f"Imported {counts.added} new {_entries(counts.added)}{updated}. Review them below."
        )
    except Exception as error:
        return fail(error)


_DATE = re.compile(r"^\d{4}(-\d{2})?$")


@dataclass
class ExperienceFields:
    kind: str
    title: str
    organization: str
    location: str | None
    start_date: str | None
    end_date: str | None
    current: bool
    bullets: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)


def experience_fields(form: FormData) -> ExperienceFields:
    def date(name: str) -> str | None:
        s = _value(form, name).strip()
        return s if _DATE.match(s) else None

    current = _value(form, "current") == "on"
    bullets = [re.sub(r"^[-•*]\s*", "", b).strip() for b in _value(form, "bullets").split("\n")]
    skills = [s.strip() for s in _value(form, "skills").split(",")]
    return ExperienceFields(
        kind="education" if _value(form, "kind") == "education" else "work",
        title=_value(form, "title").strip()[:120],
        organization=_value(form, "organization").strip()[:120],
        location=clean(_value(form, "location"), 100),
        start_date=date("startDate"),
        end_date=None if current else date("endDate"),
        current=current,
        bullets=[b for b in bullets if b][:12],
        skills=[s for s in skills if s][:20],
    )


async def save_experience(db: AsyncSession, user: SessionUser, form: FormData) -> ActionResult:
    try:
        await ensure_profile(db, user)
        fields = experience_fields(form)
        if not fields.title or not fields.organization:
            return ActionResult.failure("Add a title and an organization.")
        values = {
            "kind": fields.kind,
            "title": fields.title,
            "organization": fields.organization,
            "location": fields.location,
            "start_date": fields.start_date,
            "end_date": fields.end_date,
            "current": fields.current,
            "bullets": fields.bullets,
            "skills": fields.skills,
        }
        experience_id = _value(form, "id")
        if experience_id:
            found = (
                await db.execute(
                    update(Experience)
                    .where(Experience.id == experience_id, Experience.user_id == user.id)
                    .values(**values)
                    .returning(Experience.id)
                )
            ).first()
            if found is None:
                return ActionResult.failure("Entry not found.")
        else:
            top = await db.scalar(select(func.max(Experience.position)).where(Experience.user_id == user.id))
            await db.execute(
                insert(Experience).values(
                    id=new_id(),
                    user_id=user.id,
                    source="manual",
                    position=(top if top is not None else -1) + 1,
                    created_at=utcnow(),
                    **values,
                )
            )
        await db.commit()
        return ActionResult.success("Saved.")
    except Exception as error:
        return fail(error)


async def delete_experience(db: AsyncSession, user: SessionUser, experience_id: str) -> ActionResult:
    try:
        await ensure_profile(db, user)
        await db.execute(delete(Experience).where(Experience.id == experience_id, Experience.user_id == user.id))
        await db.commit()
        return ActionResult.success()
    except Exception as error:
        return fail(error)


# --- Chat with the AI assistant ------------------------------------------------------------------------------


class NotFoundError(Exception):
    pass


async def owned_thread(db: AsyncSession, user_id: str, thread_id: str) -> AssistantThread:
    thread = await get_thread(db, user_id, thread_id)
    if thread is None:
        raise NotFoundError("Conversation not found.")
    return thread


async def _store_thread(db: AsyncSession, user_id: str, thread_id: str, messages: list[dict[str, str]]) -> None:
    await db.execute(
        update(AssistantThread)
        .where(AssistantThread.id == thread_id, AssistantThread.user_id == user_id)
        .values(messages=messages, updated_at=utcnow())
    )
    await db.commit()


def thread_title(text: str) -> str:
    """First line of the opening message, shortened for the sidebar."""
    line = text.split("\n")[0].strip()
    return f"{line[:57].rstrip()}…" if len(line) > 60 else line


async def create_thread(db: AsyncSession, user: SessionUser, text: str, title: str | None = None) -> str | None:
    """Stores a new conversation with its first message and returns its id (None when the message is empty). The
    thread page asks for the reply, so the new chat opens right away."""
    await ensure_profile(db, user)
    message = text.strip()[:4000]
    if not message:
        return None
    thread_id = new_id()
    now = utcnow()
    await db.execute(
        insert(AssistantThread).values(
            id=thread_id,
            user_id=user.id,
            title=(title if title is not None else thread_title(text)) or "New chat",
            messages=[{"role": "user", "content": message}],
            pinned=False,
            created_at=now,
            updated_at=now,
        )
    )
    await db.commit()
    return thread_id


async def start_starter(db: AsyncSession, user: SessionUser, starter_id: str) -> str | None:
    """New chat from a starter: its prompt is sent as the first message."""
    starter = starter_by_id(starter_id)
    if starter is None:
        return None
    return await create_thread(db, user, starter.prompt, starter.title)


@dataclass(frozen=True)
class ChatResult:
    ok: bool
    messages: list[dict[str, str]]
    error: str | None = None


async def send_chat_message(db: AsyncSession, user: SessionUser, thread_id: str, text: str) -> ChatResult:
    """Adds the user's message (if any) and the assistant's reply to a conversation."""
    profile = await ensure_profile(db, user)
    thread = await owned_thread(db, user.id, thread_id)
    message = text.strip()[:4000]
    messages = [*thread.messages, {"role": "user", "content": message}] if message else list(thread.messages)

    try:
        rows = (await db.scalars(select(Experience).where(Experience.user_id == user.id))).all()
        reply = await ai.interview_reply(profile, rows, messages)
        updated = [*messages, {"role": "assistant", "content": reply}]
        await _store_thread(db, user.id, thread_id, updated)
        return ChatResult(ok=True, messages=updated)
    except Exception as error:
        # Keep the user's message so they don't lose what they typed.
        await db.rollback()
        await _store_thread(db, user.id, thread_id, messages)
        return ChatResult(ok=False, messages=messages, error=fail(error).error or GENERIC_ERROR)


async def set_thread_pinned(db: AsyncSession, user: SessionUser, thread_id: str, pinned: bool) -> ActionResult:
    try:
        await owned_thread(db, user.id, thread_id)
        await db.execute(
            update(AssistantThread)
            .where(AssistantThread.id == thread_id, AssistantThread.user_id == user.id)
            .values(pinned=pinned)
        )
        await db.commit()
        return ActionResult.success()
    except NotFoundError as error:
        return ActionResult.failure(str(error))
    except Exception as error:
        return fail(error)


async def save_chat_to_cv(db: AsyncSession, user: SessionUser, thread_id: str) -> ActionResult:
    try:
        profile = await ensure_profile(db, user)
        thread = await owned_thread(db, user.id, thread_id)
        if not any(m["role"] == "user" for m in thread.messages):
            return ActionResult.failure("Answer a few questions first.")

        extract = await ai.extract_from_interview(thread.messages)
        counts = await add_experiences(db, user.id, extract.experiences, "assistant")
        old = profile.goals or {}
        g = extract.goals
        goals = {
            key: value
            for key, value in {
                "targetRole": g.targetRole or old.get("targetRole"),
                "targetLevel": g.targetLevel or old.get("targetLevel"),
                "targetMarket": g.targetMarket or old.get("targetMarket"),
            }.items()
            if value
        }
        await db.execute(update(Profile).where(Profile.user_id == user.id).values(goals=goals, updated_at=utcnow()))
        await db.commit()
        return ActionResult.success(
            f"Saved to your CV: {counts.added} new {_entries(counts.added)}, {counts.merged} updated. "
            "Review them in Resume."
        )
    except NotFoundError as error:
        return ActionResult.failure(str(error))
    except Exception as error:
        return fail(error)
