from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from prepermint import diagnostics
from prepermint.main import app
from prepermint.settings import Settings, get_settings

TOKEN = "test-token"


@pytest.fixture
def settings() -> Iterator[Settings]:
    """Settings that ignore the real environment and .env.local; tests change fields as needed."""
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
