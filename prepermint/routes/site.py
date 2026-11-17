"""The public site: landing, pricing, terms and privacy."""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

from prepermint.lib.pricing import ANNUAL_SAVINGS_LABEL, PLANS, format_price
from prepermint.lib.session import get_session
from prepermint.templating import templates

router = APIRouter()

# Keep the lead-in short enough for one line at desktop size (~25 chars); the italic phrase always sits on its
# own second line (spec §5).
LEAD_IN = "A developer portfolio that"
PHRASES = ["looks like you.", "updates itself.", "tells your story.", "gets you hired."]


@router.get("/", response_class=HTMLResponse)
async def home(request: Request) -> Response:
    return templates.TemplateResponse(
        request,
        "site/home.html",
        {
            "viewer": get_session(request),
            "lead_in": LEAD_IN,
            "phrases": PHRASES,
            "sr_phrases": ", ".join(p.rstrip(".") for p in PHRASES[:-1]) + ", " + PHRASES[-1],
        },
    )


@router.get("/pricing", response_class=HTMLResponse)
async def pricing(request: Request) -> Response:
    return templates.TemplateResponse(
        request,
        "site/pricing.html",
        {
            "viewer": get_session(request),
            "plans": PLANS,
            "format_price": format_price,
            "savings_label": ANNUAL_SAVINGS_LABEL,
        },
    )


@router.get("/terms", response_class=HTMLResponse)
async def terms(request: Request) -> Response:
    """Placeholder: the legal text is still to be written (out of scope for MVP-23)."""
    return templates.TemplateResponse(
        request, "site/legal.html", {"title": "Terms", "page_title": "Terms | Prepermint"}
    )


@router.get("/privacy", response_class=HTMLResponse)
async def privacy(request: Request) -> Response:
    """Placeholder: the legal text is still to be written (out of scope for MVP-23)."""
    return templates.TemplateResponse(
        request, "site/legal.html", {"title": "Privacy Policy", "page_title": "Privacy Policy | Prepermint"}
    )
