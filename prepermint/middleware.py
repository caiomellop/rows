"""Runs before every route (it replaces src/proxy.ts), with three jobs:

1. Host routing. The app (sign-in, chat, dashboard) lives on app.prepermint.com and everything else on
   prepermint.com; a path asked for on the wrong host is redirected to the right one. The old rows.so hosts only
   redirect to the new ones.
2. The gate for the signed-in app (chat, memory, dashboard): without a valid session the visitor is redirected to
   /sign-in. Pages check the session again when they read data (`require_user` in prepermint/lib/dal.py).
3. The Origin check on every form post: Next.js Server Actions refused cross-site posts on their own, so this
   keeps that protection now that actions are plain POSTs.
"""

import re
from urllib.parse import urlsplit

from starlette.responses import PlainTextResponse, RedirectResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send

from prepermint.lib.app_url import (
    app_url,
    hosts_are_split,
    is_app_host,
    is_app_path,
    is_site_host,
    legacy_host_target,
    needs_session,
    site_url,
)
from prepermint.lib.session import SESSION_COOKIE, verify_session_token

# Build assets, files with an extension and infrastructure routes are never routed or gated.
_SKIP = re.compile(r"^/(static/|_diag(/|$)|healthz$)|\.\w+$")
_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}

# Permanent moves. They run before the host routing and the session gate, as next.config.ts redirects did.
# The assistant moved out of the dashboard into Chat (MVP-25).
MOVED = {"/dashboard/assistant": "/chat"}


def _other_host(host: str | None, pathname: str) -> str | None:
    """The URL this path should be served from when it was asked for on the wrong host."""
    if not hosts_are_split():
        return None
    if is_app_host(host):
        if pathname == "/":
            return f"{app_url()}/chat"
        if not is_app_path(pathname):
            return f"{site_url()}{pathname}"
    elif is_site_host(host) and is_app_path(pathname):
        return f"{app_url()}{pathname}"
    # Any other host (preview deployments, localhost) serves everything.
    return None


def _origin_allowed(origin: str | None, host: str | None) -> bool:
    """A post from this host, from one of our two hosts, or with no Origin at all (not a browser form)."""
    if origin is None:
        return True
    netloc = urlsplit(origin).netloc
    ours = {urlsplit(app_url()).netloc, urlsplit(site_url()).netloc}
    return netloc == host or netloc in ours


def route_request(
    method: str,
    host: str | None,
    pathname: str,
    query: str,
    cookie: str | None,
    origin: str | None,
    scheme: str = "https",
) -> Response | None:
    """What the middleware answers instead of the route, or None to let the request through."""
    search = f"?{query}" if query else ""
    if _SKIP.search(pathname):
        return None

    if pathname in MOVED:
        return RedirectResponse(f"{MOVED[pathname]}{search}", 308)

    renamed = legacy_host_target(host, pathname)
    if renamed:
        return RedirectResponse(f"{renamed}{search}", 308)

    # The pre-MVP-23 sign-in address.
    if pathname == "/auth/signin":
        return RedirectResponse(f"{app_url()}/sign-in{search}", 308)

    elsewhere = _other_host(host, pathname)
    if elsewhere:
        return RedirectResponse(f"{elsewhere}{search}", 308)

    if method in _UNSAFE and not _origin_allowed(origin, host):
        return PlainTextResponse("Forbidden", 403)

    if needs_session(pathname) and verify_session_token(cookie) is None:
        return RedirectResponse(f"{scheme}://{host}/sign-in" if host else "/sign-in", 307)

    return None


class HostRoutingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope["headers"]}
        cookie = None
        for part in headers.get("cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == SESSION_COOKIE:
                cookie = value
        response = route_request(
            scope["method"],
            headers.get("x-forwarded-host") or headers.get("host"),
            scope["path"],
            scope.get("query_string", b"").decode("latin-1"),
            cookie,
            headers.get("origin"),
            headers.get("x-forwarded-proto") or scope.get("scheme", "http"),
        )
        if response is None:
            await self.app(scope, receive, send)
        else:
            await response(scope, receive, send)
