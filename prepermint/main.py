"""The ASGI app. Vercel loads `app` from here ([tool.vercel] in pyproject.toml); locally:
`uv run uvicorn prepermint.main:app --reload`.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from prepermint import diagnostics
from prepermint.icons import ICON_NAMES
from prepermint.web import STATIC_DIR, templates

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Prepermint", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.include_router(diagnostics.router)


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.get("/_ui", include_in_schema=False)
async def ui(request: Request) -> HTMLResponse:
    """Sample page for the visual base (CAI-100). Removed in CAI-115."""
    return templates.TemplateResponse(request, "ui.html", {"icon_names": sorted(ICON_NAMES)})
