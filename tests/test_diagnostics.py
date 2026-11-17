import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from prepermint import diagnostics
from prepermint.settings import Settings
from tests.conftest import AUTH

PATHS = ["/_diag/db", "/_diag/stream", "/_diag/background"]


@pytest.mark.parametrize("path", PATHS)
def test_hidden_without_a_configured_token(client: TestClient, settings: Settings, path: str) -> None:
    settings.diagnostics_token = None
    assert client.get(path, headers=AUTH).status_code == 404


@pytest.mark.parametrize("path", PATHS)
@pytest.mark.parametrize(
    "headers", [{}, {"Authorization": "Bearer wrong"}, {"Authorization": "test-token"}, {"Authorization": "Basic x"}]
)
def test_hidden_without_the_right_token(client: TestClient, path: str, headers: dict[str, str]) -> None:
    assert client.get(path, headers=headers).status_code == 404


def test_stream_sends_five_chunks(client: TestClient) -> None:
    with client.stream("GET", "/_diag/stream", headers=AUTH) as response:
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        lines = list(response.iter_lines())
    assert [line.split(" sent")[0] for line in lines] == [f"chunk {n}" for n in range(1, 6)]


def test_background_task_runs_after_the_response(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="prepermint.diagnostics"):
        response = client.get("/_diag/background", headers=AUTH)
    assert response.status_code == 200
    assert response.json()["scheduled"] is True
    assert any("background task finished" in r.getMessage() for r in caplog.records)


def test_db_without_a_url(client: TestClient) -> None:
    response = client.get("/_diag/db", headers=AUTH)
    assert response.status_code == 503


def test_db_select_one(client: TestClient, settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    settings.database_url = SecretStr("postgresql://u:p@localhost/db")
    seen: list[str] = []

    async def fake_select_one(url: str) -> int:
        seen.append(url)
        return 1

    monkeypatch.setattr(diagnostics, "select_one", fake_select_one)
    response = client.get("/_diag/db", headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["instance"]["instance_age_s"] >= 0
    assert seen == ["postgresql://u:p@localhost/db"]


def test_db_failure_hides_the_error(
    client: TestClient, settings: Settings, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    settings.database_url = SecretStr("postgresql://secret-user:secret-pass@db.example/db")

    async def failing_select_one(url: str) -> int:
        raise OSError(f"could not connect to {url}")

    monkeypatch.setattr(diagnostics, "select_one", failing_select_one)
    with caplog.at_level(logging.INFO):
        response = client.get("/_diag/db", headers=AUTH)
    assert response.status_code == 502
    assert response.json() == {"detail": "Database check failed"}
    assert "secret" not in caplog.text
    assert "OSError" in caplog.text
