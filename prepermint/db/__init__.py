"""The database engine and the per-request session. The tables are in prepermint/db/models.py."""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import uuid4

from fastapi import Depends
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from prepermint.settings import get_settings

_POSTGRES_SCHEMES = {"postgres", "postgresql", "postgresql+asyncpg"}


def asyncpg_url(raw: str) -> URL:
    """The DATABASE_URL used by the Next.js app, rewritten for SQLAlchemy's asyncpg driver."""
    url = make_url(raw)
    if url.drivername not in _POSTGRES_SCHEMES:
        raise ValueError("DATABASE_URL must be a postgres:// or postgresql:// URL")
    # Supabase's transaction pooler can run each statement on a different server connection, so a
    # statement prepared on one may not exist on the next: turn off SQLAlchemy's prepared-statement cache.
    return url.set(drivername="postgresql+asyncpg").update_query_dict({"prepared_statement_cache_size": "0"})


def create_engine(raw_url: str) -> AsyncEngine:
    return create_async_engine(
        asyncpg_url(raw_url),
        connect_args={
            # Same reason as above, for asyncpg's own cache; unique names keep two prepared
            # statements from colliding on one pooled server connection.
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        },
        # The pooler already pools; a pool inside a short-lived function only keeps stale connections.
        poolclass=NullPool,
    )


_engines: dict[str, AsyncEngine] = {}


def engine_for(raw_url: str) -> AsyncEngine:
    """One engine per URL for the life of the process. Creating it does not connect."""
    if raw_url not in _engines:
        _engines[raw_url] = create_engine(raw_url)
    return _engines[raw_url]


_sessionmakers: dict[str, async_sessionmaker[AsyncSession]] = {}


def sessionmaker_for(raw_url: str) -> async_sessionmaker[AsyncSession]:
    if raw_url not in _sessionmakers:
        # Rows stay readable after commit: pages render what they just wrote.
        _sessionmakers[raw_url] = async_sessionmaker(engine_for(raw_url), expire_on_commit=False)
    return _sessionmakers[raw_url]


def database_url() -> str:
    url = get_settings().database_url
    if url is None:
        raise RuntimeError(
            "DATABASE_URL is not set. On Vercel: Project → Settings → Environment Variables (Production AND Preview). "
            "Locally: copy .env.example to .env.local."
        )
    return url.get_secret_value()


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request, committed by the code that writes."""
    async with sessionmaker_for(database_url())() as session:
        yield session


DB = Annotated[AsyncSession, Depends(get_db)]
