"""The ASGI app. Vercel loads `app` from here ([tool.vercel] in pyproject.toml); locally:
`uv run uvicorn prepermint.main:app --reload`.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from prepermint import diagnostics
from prepermint.features.interview import routes as interview
from prepermint.lib.dal import Redirect
from prepermint.middleware import HostRoutingMiddleware
from prepermint.routes import auth, chat, dashboard, site
from prepermint.templating import STATIC_DIR, templates

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Prepermint", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(HostRoutingMiddleware)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(diagnostics.router)
app.include_router(site.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(interview.router)


@app.exception_handler(Redirect)
async def redirect(request: Request, exc: Redirect) -> Response:
    # An HTMX request follows a redirect inside the fragment it asked for; tell it to navigate instead.
    if request.headers.get("hx-request"):
        return Response(status_code=204, headers={"HX-Redirect": exc.location})
    return RedirectResponse(exc.location, status_code=exc.status_code)


@app.exception_handler(StarletteHTTPException)
async def not_found(request: Request, exc: StarletteHTTPException) -> Response:
    if exc.status_code == 404 and "text/html" in request.headers.get("accept", ""):
        return templates.TemplateResponse(request, "not_found.html", {}, status_code=404)
    return await http_exception_handler(request, exc)


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}
