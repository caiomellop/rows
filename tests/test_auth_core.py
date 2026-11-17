import base64
import json
import time
from datetime import datetime, timedelta

import jwt
import pytest

from prepermint.lib.app_mode import is_active, mode_for
from prepermint.lib.app_url import (
    app_href,
    is_app_path,
    legacy_host_target,
    needs_session,
    session_cookie_domain,
    site_href,
    site_url,
)
from prepermint.lib.email import login_email
from prepermint.lib.login_token import (
    LOGIN_LINK_TTL,
    MAX_REQUESTS_PER_EMAIL,
    MAX_REQUESTS_PER_IP,
    LoginTokenState,
    expired_link_url,
    generate_login_token,
    hash_token,
    is_rate_limited,
    is_valid_email,
    login_token_status,
    normalize_email,
)
from prepermint.lib.session import SESSION_MAX_AGE, SessionUser, sign_session_token, verify_session_token
from tests.conftest import Env

USER = SessionUser(id="user-1", name="Ada Lovelace", email="ada@example.com", image="https://example.com/ada.png")


def split(env: Env) -> None:
    env.set(NEXT_PUBLIC_SITE_URL="https://prepermint.com", NEXT_PUBLIC_APP_URL="https://app.prepermint.com/")


# --- session -------------------------------------------------------------------------------------------------


def test_session_round_trips() -> None:
    assert verify_session_token(sign_session_token(USER)) == USER


def test_no_cookie_is_no_session() -> None:
    assert verify_session_token(None) is None
    assert verify_session_token("") is None


def test_tampered_token_is_rejected() -> None:
    header, _, signature = sign_session_token(USER).split(".")
    forged = base64.urlsafe_b64encode(json.dumps({"id": "someone-else"}).encode()).rstrip(b"=").decode()
    assert verify_session_token(f"{header}.{forged}.{signature}") is None


def test_token_from_another_secret_is_rejected(env: Env) -> None:
    token = sign_session_token(USER)
    env.set(AUTH_SECRET="a-completely-different-secret-value!!")
    assert verify_session_token(token) is None


def test_token_expires_after_30_days() -> None:
    issued = time.time() - SESSION_MAX_AGE + 60
    assert verify_session_token(sign_session_token(USER, now=issued)) == USER
    assert verify_session_token(sign_session_token(USER, now=issued - 120)) is None


def test_reads_a_cookie_the_nextjs_app_signed() -> None:
    """jose wrote {id, name, email, image, iat, exp} with HS256 and the raw AUTH_SECRET bytes."""
    now = int(time.time())
    payload = {"id": "u1", "name": None, "email": "a@b.co", "image": None, "iat": now, "exp": now + 3600}
    token = jwt.encode(payload, b"test-session-secret-0123456789abcdef", algorithm="HS256")
    assert verify_session_token(token) == SessionUser(id="u1", name=None, email="a@b.co", image=None)


def test_a_token_without_an_id_is_no_session() -> None:
    now = int(time.time())
    token = jwt.encode({"exp": now + 60}, b"test-session-secret-0123456789abcdef", algorithm="HS256")
    assert verify_session_token(token) is None


# --- hosts ---------------------------------------------------------------------------------------------------


def test_split_hosts_link_across_with_absolute_urls(env: Env) -> None:
    split(env)
    assert app_href("/sign-in") == "https://app.prepermint.com/sign-in"
    assert site_href("/pricing") == "https://prepermint.com/pricing"
    assert session_cookie_domain() == "prepermint.com"


def test_cookie_is_shared_when_the_site_has_www(env: Env) -> None:
    env.set(SITE_URL="https://www.prepermint.com", APP_URL="https://app.prepermint.com")
    assert session_cookie_domain() == "prepermint.com"


def test_cookie_is_not_shared_with_an_unrelated_domain(env: Env) -> None:
    env.set(SITE_URL="https://prepermint.com", APP_URL="https://app.example.com")
    assert session_cookie_domain() is None


def test_one_host_keeps_links_relative(env: Env) -> None:
    env.set(APP_URL="http://localhost:8000")
    assert site_url() == "http://localhost:8000"
    assert app_href("/sign-in") == "/sign-in"
    assert site_href("/pricing") == "/pricing"
    assert session_cookie_domain() is None


@pytest.mark.parametrize("path", ["/interview", "/interview/session", "/interview/turn", "/interview/feedback"])
def test_interview_is_on_the_app_host_without_a_session(path: str) -> None:
    assert is_app_path(path)
    assert not needs_session(path)


def test_look_alike_paths_are_not_app_paths() -> None:
    assert needs_session("/chat")
    assert not is_app_path("/interviews")
    assert not is_app_path("/prototype/interview")


def test_old_hosts_point_to_the_new_ones(env: Env) -> None:
    env.set(SITE_URL="https://prepermint.com", APP_URL="https://app.prepermint.com")
    assert legacy_host_target("app.rows.so", "/chat") == "https://app.prepermint.com/chat"
    assert legacy_host_target("rows.so", "/pricing") == "https://prepermint.com/pricing"
    assert legacy_host_target("www.rows.so", "/terms") == "https://prepermint.com/terms"
    assert legacy_host_target("rows.so", "/dashboard") == "https://app.prepermint.com/dashboard"
    assert legacy_host_target("rows.so", "/interview") == "https://app.prepermint.com/interview"
    assert legacy_host_target("app.rows.so:443", "/chat") == "https://app.prepermint.com/chat"
    assert legacy_host_target("prepermint.com", "/pricing") is None
    assert legacy_host_target("localhost:3000", "/chat") is None
    assert legacy_host_target(None, "/chat") is None


def test_old_hosts_do_not_redirect_while_configured(env: Env) -> None:
    env.set(SITE_URL="https://rows.so", APP_URL="https://app.rows.so")
    assert legacy_host_target("app.rows.so", "/chat") is None


# --- app mode ------------------------------------------------------------------------------------------------


def test_mode_comes_from_the_path() -> None:
    assert [mode_for(p) for p in ["/chat", "/chat/abc", "/memory", "/dashboard", "/dashboard/x", "/dashboards"]] == [
        "chat",
        "chat",
        "chat",
        "dashboard",
        "dashboard",
        "chat",
    ]


def test_active_item() -> None:
    assert is_active("/dashboard", "/dashboard")
    assert not is_active("/dashboard/profile", "/dashboard")
    assert not is_active("/chat/abc", "/chat")
    assert is_active("/memory", "/memory")
    assert is_active("/chat/abc", "/chat/abc")
    assert not is_active("/chat/abcd", "/chat/abc")


# --- login token ---------------------------------------------------------------------------------------------


def test_token_is_32_random_bytes_stored_as_sha256() -> None:
    token, token_hash = generate_login_token()
    assert len(base64.urlsafe_b64decode(token + "=")) == 32
    assert len(token_hash) == 64 and token_hash == hash_token(token) and token not in token_hash
    assert len({generate_login_token()[0] for _ in range(50)}) == 50


def test_hash_is_sha256_hex() -> None:
    assert hash_token("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_token_status() -> None:
    now = datetime(2026, 11, 14, 12)

    def issued(minutes_ago: int, used: datetime | None = None) -> LoginTokenState:
        return LoginTokenState(expires_at=now - timedelta(minutes=minutes_ago) + LOGIN_LINK_TTL, used_at=used)

    assert login_token_status(issued(0), now) == "valid"
    assert login_token_status(issued(14), now) == "valid"
    assert login_token_status(issued(15), now) == "expired"
    assert login_token_status(issued(1, now - timedelta(seconds=1)), now) == "used"
    assert login_token_status(None, now) == "unknown"


def test_rate_limit() -> None:
    assert not is_rate_limited(MAX_REQUESTS_PER_EMAIL - 1, MAX_REQUESTS_PER_IP - 1)
    assert is_rate_limited(MAX_REQUESTS_PER_EMAIL, 0)
    assert is_rate_limited(0, MAX_REQUESTS_PER_IP)


def test_email_normalization_and_validation() -> None:
    assert normalize_email("  Caio@Prepermint.COM ") == "caio@prepermint.com"
    for good in ["caio@prepermint.com", "a.b+tag@sub.example.com"]:
        assert is_valid_email(good)
    for bad in ["caio@", "caio", "@prepermint.com", "caio@prepermint", "a b@prepermint.com", ""]:
        assert not is_valid_email(bad)


def test_expired_link_url() -> None:
    assert expired_link_url(None) == "/sign-in?error=expired"
    assert expired_link_url("a+b@c.co") == "/sign-in?error=expired&email=a%2Bb%40c.co"


def test_login_email() -> None:
    email = login_email("https://app.prepermint.com/sign-in/verify?token=abc")
    for part in [email.subject, email.text, email.html]:
        assert "Prepermint" in part and "Rows" not in part
    assert "https://app.prepermint.com/sign-in/verify?token=abc" in email.text
    assert 'href="https://app.prepermint.com/sign-in/verify?token=abc"' in email.html
