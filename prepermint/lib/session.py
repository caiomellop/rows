"""The session cookie: an HS256 JWT signed with AUTH_SECRET.

Same cookie name, claims, lifetime and domain as the Next.js app (which signed it with `jose`), so sessions
issued there stay valid here and nobody is signed out at the cutover.
"""

import time
from dataclasses import asdict, dataclass

import jwt
from fastapi import Request, Response

from prepermint.lib.app_url import session_cookie_domain
from prepermint.settings import get_settings

SESSION_COOKIE = "pp_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30


@dataclass(frozen=True)
class SessionUser:
    id: str
    name: str | None
    email: str | None
    image: str | None


def _secret() -> bytes:
    """Key used to sign session cookies: `openssl rand -base64 32`."""
    secret = get_settings().auth_secret
    if secret is None or not secret.get_secret_value():
        raise RuntimeError("AUTH_SECRET is not set")
    return secret.get_secret_value().encode()


def sign_session_token(user: SessionUser, now: float | None = None) -> str:
    issued = int(now if now is not None else time.time())
    payload = {**asdict(user), "iat": issued, "exp": issued + SESSION_MAX_AGE}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def verify_session_token(token: str | None) -> SessionUser | None:
    """Verifies a raw session cookie value. Any failure (bad signature, expired, malformed) is no session."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=["HS256"], options={"require": ["exp"]})
    except jwt.PyJWTError:
        return None
    user_id = payload.get("id")
    if not isinstance(user_id, str):
        return None

    def text(key: str) -> str | None:
        value = payload.get(key)
        return value if isinstance(value, str) else None

    return SessionUser(id=user_id, name=text("name"), email=text("email"), image=text("image"))


def get_session(request: Request) -> SessionUser | None:
    return verify_session_token(request.cookies.get(SESSION_COOKIE))


def attach_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        path="/",
        domain=session_cookie_domain(),
        secure=get_settings().is_production,
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        "",
        max_age=0,
        path="/",
        domain=session_cookie_domain(),
        secure=get_settings().is_production,
        httponly=True,
        samesite="lax",
    )
