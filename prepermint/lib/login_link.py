"""The database side of the email login link."""

import hashlib
import logging
from datetime import timedelta

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from prepermint.db.models import LoginToken, User, new_id, utcnow
from prepermint.lib.app_url import app_url
from prepermint.lib.email import send_login_email
from prepermint.lib.login_token import (
    LOGIN_LINK_TTL,
    LoginTokenState,
    TokenStatus,
    generate_login_token,
    hash_token,
    is_rate_limited,
    login_token_status,
)
from prepermint.lib.session import SessionUser
from prepermint.settings import get_settings

logger = logging.getLogger(__name__)


def hash_ip(ip: str) -> str:
    """IPs are only kept as a salted hash, and only to count requests."""
    secret = get_settings().auth_secret
    salt = secret.get_secret_value() if secret else ""
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()


async def request_login_link(db: AsyncSession, email: str, ip: str) -> None:
    """Issues a login link for `email` (already normalized and validated) and emails it. Says nothing about
    whether an account exists or whether the request was rate limited: the caller shows the same message either
    way."""
    now = utcnow()
    window_start = now - LOGIN_LINK_TTL
    ip_hash = hash_ip(ip)

    # Housekeeping: rows older than a day are no use even for rate limiting.
    await db.execute(delete(LoginToken).where(LoginToken.created_at < now - timedelta(days=1)))

    recent = (
        await db.execute(
            select(
                func.count().filter(LoginToken.email == email),
                func.count().filter(LoginToken.ip_hash == ip_hash),
            ).where(LoginToken.created_at > window_start)
        )
    ).one()
    if is_rate_limited(by_email=int(recent[0]), by_ip=int(recent[1])):
        await db.commit()
        logger.warning("[auth] login link rate limit reached")
        return

    token, token_hash = generate_login_token()
    await db.execute(
        insert(LoginToken).values(
            token_hash=token_hash, email=email, ip_hash=ip_hash, expires_at=now + LOGIN_LINK_TTL, created_at=now
        )
    )
    await db.commit()
    try:
        await send_login_email(email, f"{app_url()}/sign-in/verify?token={token}")
    except Exception:
        # An email that never left must not count toward the rate limit.
        await db.execute(delete(LoginToken).where(LoginToken.token_hash == token_hash))
        await db.commit()
        raise


async def peek_login_token(db: AsyncSession, token: str) -> tuple[TokenStatus, str | None]:
    """Looks at a token without spending it, for the confirmation page. Opening the link (which mail scanners do
    on their own) must not use it up."""
    row = (
        await db.execute(
            select(LoginToken.email, LoginToken.expires_at, LoginToken.used_at)
            .where(LoginToken.token_hash == hash_token(token))
            .limit(1)
        )
    ).first()
    state = LoginTokenState(expires_at=row.expires_at, used_at=row.used_at) if row else None
    return login_token_status(state, utcnow()), (row.email if row else None)


async def consume_login_token(db: AsyncSession, token: str) -> str | None:
    """Spends the token. Returns its email exactly once: the single UPDATE is what guarantees that two concurrent
    confirmations cannot both succeed."""
    now = utcnow()
    email = (
        await db.execute(
            update(LoginToken)
            .where(
                LoginToken.token_hash == hash_token(token), LoginToken.used_at.is_(None), LoginToken.expires_at > now
            )
            .values(used_at=now)
            .returning(LoginToken.email)
        )
    ).scalar_one_or_none()
    await db.commit()
    return email


async def find_or_create_user_by_email(db: AsyncSession, email: str) -> SessionUser:
    """The account for a confirmed email, created on first login."""
    await db.execute(
        pg_insert(User)
        .values(id=new_id(), email=email, email_verified=utcnow())
        .on_conflict_do_nothing(index_elements=[User.email])
    )
    row = (await db.execute(select(User).where(User.email == email).limit(1))).scalar_one()
    if row.email_verified is None:
        row.email_verified = utcnow()
    await db.commit()
    return SessionUser(id=row.id, name=row.name, email=row.email, image=row.image)
