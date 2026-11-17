"""The dashboard: overview, profile and resume (experience)."""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

from prepermint.db import DB
from prepermint.db.models import Experience
from prepermint.lib import actions
from prepermint.lib.actions import ActionResult
from prepermint.lib.ai import ai_enabled
from prepermint.lib.dal import CurrentUser, get_editor_data
from prepermint.lib.experience_format import ROLE_TYPES, WORK_MODE_LABEL, format_range
from prepermint.lib.session import SessionUser
from prepermint.routes.shell import render_app
from prepermint.templating import templates

router = APIRouter(prefix="/dashboard")

SOURCE_LABEL = {
    "resume": "from your resume",
    "linkedin": "from LinkedIn",
    "assistant": "from the AI interview",
    "manual": "added by hand",
}


@router.get("", response_class=HTMLResponse)
async def overview(request: Request, db: DB, user: CurrentUser) -> Response:
    data = await get_editor_data(db, user)
    steps = [
        {
            "done": len(data.experiences) > 0,
            "title": "Add your experience",
            "body": "Upload your resume or LinkedIn PDF, or build it from scratch with the AI assistant.",
            "href": "/dashboard/experience",
            "cta": "Add experience",
        },
        {
            "done": bool(data.profile.headline and data.profile.summary),
            "title": "Write your headline and summary",
            "body": "The short header that sums you up. AI can draft it from your experience.",
            "href": "/dashboard/profile",
            "cta": "Edit profile",
        },
    ]
    return await render_app(request, db, user, "dashboard/overview.html", {"steps": steps, "title": "Dashboard"})


# --- Profile -------------------------------------------------------------------------------------------------


@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request, db: DB, user: CurrentUser) -> Response:
    data = await get_editor_data(db, user)
    return await render_app(
        request,
        db,
        user,
        "dashboard/profile.html",
        {
            "p": data.profile,
            "goals": data.profile.goals or {},
            "ai_enabled": ai_enabled(),
            "role_types": ROLE_TYPES,
            "work_modes": WORK_MODE_LABEL,
            "title": "Profile",
        },
    )


@router.post("/profile", response_class=HTMLResponse)
async def save_profile(request: Request, db: DB, user: CurrentUser) -> Response:
    result = await actions.save_profile(db, user, await request.form())
    return templates.TemplateResponse(request, "dashboard/form_status.html", {"result": result})


@router.post("/profile/draft", response_class=HTMLResponse)
async def draft_summary(request: Request, db: DB, user: CurrentUser) -> Response:
    """A draft headline and summary for the form; nothing is saved until the owner saves."""
    form = await request.form()
    draft = await actions.draft_profile_summary(db, user)

    def field(name: str) -> str:
        value = form.get(name)
        return value if isinstance(value, str) else ""

    if draft.ok:
        context = {"headline": draft.headline, "summary": draft.summary, "summary_source": "ai", "draft_error": None}
    else:
        context = {
            "headline": field("headline"),
            "summary": field("summary"),
            "summary_source": field("summarySource"),
            "draft_error": draft.error,
        }
    return templates.TemplateResponse(request, "dashboard/summary_fields.html", {**context, "oob_draft_error": True})


# --- Experience ----------------------------------------------------------------------------------------------


def _entry_meta(e: Experience) -> str:
    bullets = len(e.bullets)
    parts = [
        "Education" if e.kind == "education" else None,
        format_range(e.start_date, e.end_date, e.current),
        f"{bullets} bullet{'' if bullets == 1 else 's'}",
        SOURCE_LABEL.get(e.source),
    ]
    return " · ".join(p for p in parts if p)


def to_month(value: str | None) -> str:
    """Month inputs need "YYYY-MM"; a bare year becomes January."""
    if not value:
        return ""
    return f"{value}-01" if len(value) == 4 else value


async def _entries(
    request: Request, db: DB, user: SessionUser, result: ActionResult | None, import_result: ActionResult | None = None
) -> Response:
    """The entries section, re-rendered after a change, with the result of the change. An import also updates the
    import form's message (out of band: it lives outside the section)."""
    data = await get_editor_data(db, user)
    return templates.TemplateResponse(
        request,
        "dashboard/entries.html",
        {
            "experiences": data.experiences,
            "result": result,
            "import_result": import_result,
            "oob_import": import_result is not None,
        },
    )


@router.get("/experience", response_class=HTMLResponse)
async def experience_page(request: Request, db: DB, user: CurrentUser) -> Response:
    data = await get_editor_data(db, user)
    return await render_app(
        request,
        db,
        user,
        "dashboard/experience.html",
        {
            "experiences": data.experiences,
            "ai_enabled": ai_enabled(),
            "result": None,
            "import_result": None,
            "oob_import": False,
            "title": "Resume",
        },
    )


@router.post("/experience", response_class=HTMLResponse)
async def save_experience(request: Request, db: DB, user: CurrentUser) -> Response:
    result = await actions.save_experience(db, user, await request.form())
    return await _entries(request, db, user, result)


@router.post("/experience/{experience_id}/delete", response_class=HTMLResponse)
async def delete_experience(request: Request, experience_id: str, db: DB, user: CurrentUser) -> Response:
    result = await actions.delete_experience(db, user, experience_id)
    return await _entries(request, db, user, result if not result.ok else ActionResult.success("Deleted."))


@router.post("/experience/import", response_class=HTMLResponse)
async def import_resume(request: Request, db: DB, user: CurrentUser) -> Response:
    # Uploads are capped at 4 MB in the action; the form itself allows a little more for the other fields.
    result = await actions.import_resume(db, user, await request.form(max_part_size=5 * 1024 * 1024))
    return await _entries(request, db, user, None, import_result=result)


templates.env.globals.update(entry_meta=_entry_meta, to_month=to_month)
