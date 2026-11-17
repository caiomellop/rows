"""Data Access Layer: every read and write of user data goes through here (or a feature's data module), and
every query filters by the session user's id."""

from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import and_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint.db.models import AssistantThread, Experience, Profile
from prepermint.lib.session import SessionUser, get_session


class Redirect(Exception):
    """Raised anywhere in a request to send the browser elsewhere (handled in prepermint/main.py)."""

    def __init__(self, location: str, status_code: int = 303) -> None:
        super().__init__(location)
        self.location = location
        self.status_code = status_code


def require_user(request: Request) -> SessionUser:
    """The signed-in user, or a redirect to the login. Use it at the start of every page, action and route that
    touches user data: the middleware gates paths, but it is not enough on its own."""
    user = get_session(request)
    if user is None:
        raise Redirect("/sign-in", 307)
    return user


CurrentUser = Annotated[SessionUser, Depends(require_user)]


async def ensure_profile(db: AsyncSession, user: SessionUser) -> Profile:
    """The signed-in user's profile. It is created on first use, so a new user goes straight to the app. A double
    submit or two tabs at once are safe: the primary key on userId turns the second insert into a no-op."""
    existing = await db.get(Profile, user.id)
    if existing is not None:
        return existing
    await db.execute(pg_insert(Profile).values(user_id=user.id, display_name=user.name).on_conflict_do_nothing())
    await db.commit()
    created = await db.get(Profile, user.id)
    if created is None:
        raise RuntimeError("The profile could not be created.")
    return created


async def list_experiences(db: AsyncSession, user_id: str) -> list[Experience]:
    rows = await db.scalars(
        select(Experience)
        .where(Experience.user_id == user_id)
        .order_by(Experience.position.asc(), Experience.start_date.desc().nulls_first())
    )
    return list(rows)


@dataclass(frozen=True)
class EditorData:
    profile: Profile
    experiences: list[Experience]


async def get_editor_data(db: AsyncSession, user: SessionUser) -> EditorData:
    """Everything the dashboard edits. The profile is created on the first visit."""
    profile = await ensure_profile(db, user)
    return EditorData(profile=profile, experiences=await list_experiences(db, user.id))


# How many unpinned conversations the sidebar lists.
RECENT_THREADS = 20


@dataclass(frozen=True)
class ThreadSummary:
    id: str
    title: str
    pinned: bool
    updated_at: datetime


@dataclass(frozen=True)
class ThreadList:
    pinned: list[ThreadSummary]
    recent: list[ThreadSummary]


async def list_threads(db: AsyncSession, user_id: str) -> ThreadList:
    """The user's conversations for the sidebar: every pinned one, then the latest."""

    async def mine(pinned: bool) -> list[ThreadSummary]:
        rows = await db.execute(
            select(AssistantThread.id, AssistantThread.title, AssistantThread.pinned, AssistantThread.updated_at)
            .where(and_(AssistantThread.user_id == user_id, AssistantThread.pinned.is_(pinned)))
            .order_by(AssistantThread.updated_at.desc())
            .limit(RECENT_THREADS)
        )
        return [ThreadSummary(id=r.id, title=r.title, pinned=r.pinned, updated_at=r.updated_at) for r in rows]

    return ThreadList(pinned=await mine(True), recent=await mine(False))


async def get_thread(db: AsyncSession, user_id: str, thread_id: str) -> AssistantThread | None:
    """One conversation, only if it belongs to the user."""
    return await db.scalar(
        select(AssistantThread).where(AssistantThread.id == thread_id, AssistantThread.user_id == user_id).limit(1)
    )
