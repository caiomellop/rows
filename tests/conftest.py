import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint import diagnostics
from prepermint.main import app
from prepermint.settings import Settings, get_settings

TOKEN = "test-token"
AUTH_SECRET = "test-session-secret-0123456789abcdef"

ENV_VARS = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SITE_URL",
    "APP_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_APP_URL",
    "ANTHROPIC_KEYS",
    "ANTHROPIC_AUTH_TOKEN",
    "PROTOTYPE_ENABLED",
    "DEEPGRAM_API_KEYS",
    "APIFY_TOKEN",
    "APP_ENV",
    "VERCEL",
    "DIAGNOSTICS_TOKEN",
]

# Tests that need a real Postgres read TEST_DATABASE_URL (CI starts one); they are skipped without it.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


class Env:
    """Sets environment variables for one test; get_settings() sees them at once."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._mp = monkeypatch

    def set(self, **values: str | None) -> None:
        for key, value in values.items():
            if value is None:
                self._mp.delenv(key, raising=False)
            else:
                self._mp.setenv(key, value)
        get_settings.cache_clear()


@pytest.fixture(autouse=True)
def env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[Env]:
    """Every test starts from a clean environment (no .env.local, no real keys) with only AUTH_SECRET set."""
    monkeypatch.chdir(tmp_path)
    for key in ENV_VARS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("AUTH_SECRET", AUTH_SECRET)
    get_settings.cache_clear()
    yield Env(monkeypatch)
    get_settings.cache_clear()


@pytest.fixture
def settings() -> Iterator[Settings]:
    """Settings for the diagnostics routes, which take them as a dependency; tests change fields as needed."""
    current = Settings(_env_file=None, database_url=None, diagnostics_token=SecretStr(TOKEN))
    app.dependency_overrides[get_settings] = lambda: current
    yield current
    app.dependency_overrides.clear()


@pytest.fixture
def client(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(diagnostics, "STREAM_INTERVAL_S", 0)
    monkeypatch.setattr(diagnostics, "BACKGROUND_DELAY_S", 0)
    return TestClient(app)


AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest_asyncio.fixture
async def db(env: Env) -> AsyncIterator[AsyncSession]:
    """A session on an empty test database with the Alembic schema. Every table is emptied first."""
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set")
    env.set(DATABASE_URL=TEST_DATABASE_URL)
    from prepermint.db import create_engine
    from prepermint.db.models import Base

    engine = create_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {tables} CASCADE"))
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
    await engine.dispose()
