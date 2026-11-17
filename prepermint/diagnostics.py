"""Routes that prove the hosting can do what the app needs (CAI-99): a database query through the
transaction pooler, a streamed response and a task that runs after the response.

They answer 404 unless DIAGNOSTICS_TOKEN is set and the request sends it as a Bearer token, and they
are removed in the cleanup sub-issue (CAI-115).
"""

import asyncio
import logging
import os
import secrets
import time
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import text

from prepermint.db import engine_for
from prepermint.settings import Settings, get_settings

logger = logging.getLogger(__name__)

# Import time of this module, roughly when the instance started: a small age means a cold start.
BOOTED_AT = time.monotonic()

STREAM_CHUNKS = 5
STREAM_INTERVAL_S = 1.0
BACKGROUND_DELAY_S = 2.0


def require_token(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.diagnostics_token
    scheme, _, token = (authorization or "").partition(" ")
    if (
        expected is None
        or scheme.lower() != "bearer"
        or not secrets.compare_digest(token.encode(), expected.get_secret_value().encode())
    ):
        # 404 rather than 401, so the routes look absent to anyone without the token.
        raise HTTPException(status_code=404)


router = APIRouter(prefix="/_diag", include_in_schema=False, dependencies=[Depends(require_token)])


class Instance(BaseModel):
    region: str | None
    instance_age_s: float


def instance() -> Instance:
    return Instance(region=os.environ.get("VERCEL_REGION"), instance_age_s=round(time.monotonic() - BOOTED_AT, 3))


class DbCheck(BaseModel):
    ok: bool
    query_ms: float
    instance: Instance


async def select_one(database_url: str) -> int | None:
    async with engine_for(database_url).connect() as conn:
        value = await conn.scalar(text("select 1"))
    return value if isinstance(value, int) else None


@router.get("/db")
async def db_check(settings: Annotated[Settings, Depends(get_settings)]) -> DbCheck:
    if settings.database_url is None:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not set")
    started = time.perf_counter()
    try:
        value = await select_one(settings.database_url.get_secret_value())
    except Exception as error:
        # The error text can carry the host or user name; log only its type.
        logger.warning("diagnostics db check failed: %s", type(error).__name__)
        raise HTTPException(status_code=502, detail="Database check failed") from None
    query_ms = round((time.perf_counter() - started) * 1000, 1)
    logger.info("diagnostics db check: %s ms", query_ms)
    return DbCheck(ok=value == 1, query_ms=query_ms, instance=instance())


@router.get("/stream")
async def stream() -> StreamingResponse:
    async def chunks() -> AsyncIterator[str]:
        started = time.perf_counter()
        for n in range(1, STREAM_CHUNKS + 1):
            if n > 1:
                await asyncio.sleep(STREAM_INTERVAL_S)
            yield f"chunk {n} sent at {time.perf_counter() - started:.2f}s\n"

    return StreamingResponse(
        chunks(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


class Scheduled(BaseModel):
    scheduled: bool
    instance: Instance


async def background_job(scheduled_at: float) -> None:
    await asyncio.sleep(BACKGROUND_DELAY_S)
    elapsed_ms = round((time.perf_counter() - scheduled_at) * 1000)
    logger.info("diagnostics background task finished %s ms after it was scheduled", elapsed_ms)


@router.get("/background")
async def background(tasks: BackgroundTasks) -> Scheduled:
    tasks.add_task(background_job, time.perf_counter())
    return Scheduled(scheduled=True, instance=instance())
