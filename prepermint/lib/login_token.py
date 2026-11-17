"""Pure rules for the email login link (no DB, no network), so they can be unit-tested. The database side
lives in `login_link.py`."""

import base64
import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import quote

LOGIN_LINK_TTL_MINUTES = 15
LOGIN_LINK_TTL = timedelta(minutes=LOGIN_LINK_TTL_MINUTES)

# Requests allowed per rolling window of LOGIN_LINK_TTL.
MAX_REQUESTS_PER_EMAIL = 3
MAX_REQUESTS_PER_IP = 10

TokenStatus = Literal["valid", "expired", "used", "unknown"]


def hash_token(token: str) -> str:
    """SHA-256 hex. Only this is stored; the raw token exists only in the email."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_login_token() -> tuple[str, str]:
    """A 32-byte random token (base64url, no padding) and the hash to store for it."""
    token = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    return token, hash_token(token)


def normalize_email(raw: str) -> str:
    """Accounts are keyed by the trimmed, lowercased address."""
    return raw.strip().lower()


# Deliberately simple: one @, something on each side, a dot in the domain.
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_valid_email(email: str) -> bool:
    return len(email) <= 254 and _EMAIL_RE.fullmatch(email) is not None


@dataclass(frozen=True)
class LoginTokenState:
    expires_at: datetime
    used_at: datetime | None


def login_token_status(row: LoginTokenState | None, now: datetime) -> TokenStatus:
    """A link works once, and only until it expires."""
    if row is None:
        return "unknown"
    if row.used_at is not None:
        return "used"
    if row.expires_at <= now:
        return "expired"
    return "valid"


def is_rate_limited(by_email: int, by_ip: int) -> bool:
    """True when one more request would exceed the per-email or per-IP limit."""
    return by_email >= MAX_REQUESTS_PER_EMAIL or by_ip >= MAX_REQUESTS_PER_IP


def expired_link_url(email: str | None) -> str:
    """Where an expired, used or unknown link sends the user, with the email prefilled when it is known."""
    return f"/sign-in?error=expired&email={quote(email, safe='')}" if email else "/sign-in?error=expired"
