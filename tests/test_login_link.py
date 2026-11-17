from datetime import timedelta

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint.db.models import LoginToken, User, utcnow
from prepermint.lib import login_link
from prepermint.lib.login_link import (
    consume_login_token,
    find_or_create_user_by_email,
    peek_login_token,
    request_login_link,
)

SENT: list[tuple[str, str]] = []


@pytest.fixture(autouse=True)
def mailbox(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    SENT.clear()

    async def fake_send(to: str, link: str) -> None:
        SENT.append((to, link))

    monkeypatch.setattr(login_link, "send_login_email", fake_send)
    return SENT


def token_from(link: str) -> str:
    return link.split("token=", 1)[1]


async def test_link_logs_in_once(db: AsyncSession) -> None:
    await request_login_link(db, "ada@example.com", "1.2.3.4")
    assert len(SENT) == 1 and SENT[0][1].startswith("http://localhost:8000/sign-in/verify?token=")
    token = token_from(SENT[0][1])

    assert await peek_login_token(db, token) == ("valid", "ada@example.com")
    assert await consume_login_token(db, token) == "ada@example.com"
    assert await consume_login_token(db, token) is None
    assert (await peek_login_token(db, token))[0] == "used"
    assert await peek_login_token(db, "never-issued") == ("unknown", None)


async def test_expired_link_does_not_log_in(db: AsyncSession) -> None:
    await request_login_link(db, "ada@example.com", "1.2.3.4")
    token = token_from(SENT[0][1])
    await db.execute(update(LoginToken).values(expires_at=utcnow() - timedelta(seconds=1)))
    await db.commit()
    assert await peek_login_token(db, token) == ("expired", "ada@example.com")
    assert await consume_login_token(db, token) is None


async def test_rate_limit_per_email_and_ip(db: AsyncSession) -> None:
    for _ in range(5):
        await request_login_link(db, "ada@example.com", "1.2.3.4")
    assert len(SENT) == 3
    for n in range(10):
        await request_login_link(db, f"user{n}@example.com", "9.9.9.9")
    assert len(SENT) == 3 + 10
    await request_login_link(db, "late@example.com", "9.9.9.9")
    assert len(SENT) == 13


async def test_a_failed_send_does_not_count(db: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(to: str, link: str) -> None:
        raise OSError("provider down")

    monkeypatch.setattr(login_link, "send_login_email", broken)
    with pytest.raises(OSError):
        await request_login_link(db, "ada@example.com", "1.2.3.4")
    assert (await db.scalars(select(LoginToken))).all() == []


async def test_ip_is_stored_only_as_a_salted_hash(db: AsyncSession) -> None:
    await request_login_link(db, "ada@example.com", "1.2.3.4")
    row = (await db.scalars(select(LoginToken))).one()
    assert "1.2.3.4" not in row.ip_hash and len(row.ip_hash) == 64


async def test_user_is_created_once_and_verified(db: AsyncSession) -> None:
    first = await find_or_create_user_by_email(db, "ada@example.com")
    second = await find_or_create_user_by_email(db, "ada@example.com")
    assert first == second and first.email == "ada@example.com"
    user = (await db.scalars(select(User))).one()
    assert user.email_verified is not None
