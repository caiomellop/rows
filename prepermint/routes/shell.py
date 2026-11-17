"""What every signed-in page shares: the sidebar (thread list, account) around the page."""

from typing import Any

from fastapi import Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint.config.starters import STARTERS
from prepermint.db.models import Profile, utcnow
from prepermint.lib.dal import ThreadSummary, ensure_profile, list_threads
from prepermint.lib.session import SessionUser
from prepermint.templating import templates, thread_date


async def thread_items(db: AsyncSession, user_id: str) -> dict[str, list[dict[str, str]]]:
    """Pinned and recent conversations, each with its title and date, for the sidebar."""
    threads = await list_threads(db, user_id)
    now = utcnow()

    def items(rows: list[ThreadSummary]) -> list[dict[str, str]]:
        return [{"id": t.id, "title": t.title, "date": thread_date(t.updated_at, now)} for t in rows]

    return {"pinned": items(threads.pinned), "recent": items(threads.recent)}


def account_label(user: SessionUser, profile: Profile) -> str:
    """What the account button shows: the name, or the email while there is no name."""
    name = (profile.display_name or user.name or "").strip()
    return name or user.email or "Account"


async def render_app(
    request: Request,
    db: AsyncSession,
    user: SessionUser,
    template: str,
    context: dict[str, Any],
    status_code: int = 200,
) -> Response:
    profile = await ensure_profile(db, user)
    shell = {
        "user": user,
        "profile": profile,
        "account_label": account_label(user, profile),
        "show_email": bool((profile.display_name or user.name) and user.email),
        "threads": await thread_items(db, user.id),
        "starters": STARTERS,
    }
    return templates.TemplateResponse(request, template, {**shell, **context}, status_code=status_code)
