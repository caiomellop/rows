"""The ASGI app. Vercel loads `app` from here ([tool.vercel] in pyproject.toml); locally:
`uv run uvicorn prepermint.main:app --reload`.
"""

import logging

from fastapi import FastAPI

from prepermint import diagnostics

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Prepermint", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(diagnostics.router)


@app.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}
