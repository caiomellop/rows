"""Login is email only (MVP-23): request a link, open it, press "Log in". Sign-out is a POST."""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from prepermint.db import DB
from prepermint.lib.app_url import site_url
from prepermint.lib.login_link import (
    consume_login_token,
    find_or_create_user_by_email,
    peek_login_token,
    request_login_link,
)
from prepermint.lib.login_token import LOGIN_LINK_TTL_MINUTES, expired_link_url, is_valid_email, normalize_email
from prepermint.lib.session import attach_session_cookie, clear_session_cookie, get_session, sign_session_token
from prepermint.templating import templates

logger = logging.getLogger(__name__)

router = APIRouter()


def _form(request: Request, email: str, error: str | None = None, sent_to: str | None = None) -> Response:
    """The sign-in form, or the "we sent a link" message. A full page, or the fragment an HTMX post asks for."""
    template = "auth/sign_in_form.html" if request.headers.get("hx-request") else "auth/sign_in.html"
    return templates.TemplateResponse(
        request,
        template,
        {"email": email, "error": error, "sent_to": sent_to, "ttl_minutes": LOGIN_LINK_TTL_MINUTES},
    )


@router.get("/sign-in", response_class=HTMLResponse)
async def sign_in(request: Request, error: str | None = None, email: str | None = None) -> Response:
    if get_session(request) is not None:
        return RedirectResponse("/chat", status_code=307)
    prefill = normalize_email(email) if email and is_valid_email(normalize_email(email)) else ""
    return _form(request, prefill, "Link expired. Request a new one." if error == "expired" else None)


@router.post("/sign-in", response_class=HTMLResponse)
async def request_link(request: Request, db: DB) -> Response:
    form = await request.form()
    raw = form.get("email")
    email = normalize_email(raw if isinstance(raw, str) else "")
    if not is_valid_email(email):
        return _form(request, email, "Enter a valid email address.")

    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else "") or "unknown"
    try:
        await request_login_link(db, email, ip)
    except Exception as error:
        # A failed send says nothing about the address (it fails the same way for every email), so it is safe to
        # tell the user instead of claiming the link was sent. Rate limiting still answers as a success.
        logger.error("[auth] sending the login link failed: %s", type(error).__name__)
        return _form(request, email, "We couldn't send the email right now. Please try again in a moment.")
    return _form(request, email, sent_to=email)


@router.get("/sign-in/verify", response_class=HTMLResponse)
async def verify(request: Request, db: DB, token: str | None = None) -> Response:
    """Landing page of the emailed link. Opening it spends nothing: corporate mail scanners follow links on their
    own, so only the button's POST logs in. Works from any device or browser."""
    if not token:
        return RedirectResponse(expired_link_url(None), status_code=307)
    status, email = await peek_login_token(db, token)
    if status != "valid":
        return RedirectResponse(expired_link_url(email), status_code=307)
    return templates.TemplateResponse(request, "auth/verify.html", {"token": token, "email": email})


@router.post("/sign-in/verify")
async def confirm_login(request: Request, db: DB) -> Response:
    """The only place a login token is spent: the POST behind the "Log in" button."""
    form = await request.form()
    raw = form.get("token")
    token = raw if isinstance(raw, str) else ""
    email = await consume_login_token(db, token) if token else None
    if email is None:
        known = (await peek_login_token(db, token))[1] if token else None
        return RedirectResponse(expired_link_url(known), status_code=303)

    user = await find_or_create_user_by_email(db, email)
    response = RedirectResponse("/chat", status_code=303)
    attach_session_cookie(response, sign_session_token(user))
    return response


@router.post("/sign-out")
async def sign_out() -> Response:
    """POST only: a GET logout can be triggered by any third-party page (an <img> pointing at it)."""
    response = RedirectResponse(f"{site_url()}/", status_code=303)
    clear_session_cookie(response)
    return response
