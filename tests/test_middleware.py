import pytest

from prepermint.lib.session import SessionUser, sign_session_token
from prepermint.middleware import route_request
from tests.conftest import Env


@pytest.fixture(autouse=True)
def split(env: Env) -> None:
    env.set(SITE_URL="https://prepermint.com", APP_URL="https://app.prepermint.com")


def signed_in() -> str:
    return sign_session_token(SessionUser(id="u1", name=None, email=None, image=None))


def where(path: str, host: str, cookie: str | None = None, method: str = "GET", origin: str | None = None) -> str:
    pathname, _, query = path.partition("?")
    response = route_request(method, host, pathname, query, cookie, origin)
    if response is None:
        return "served"
    if response.status_code in (307, 308):
        return f"{response.status_code} {response.headers['location']}"
    return f"status {response.status_code}"


def test_app_pages_on_the_site_go_to_the_app_host() -> None:
    c = signed_in()
    assert where("/sign-in", "prepermint.com", c) == "308 https://app.prepermint.com/sign-in"
    assert (
        where("/dashboard/profile?x=1", "prepermint.com", c) == "308 https://app.prepermint.com/dashboard/profile?x=1"
    )
    assert where("/chat/abc", "prepermint.com", c) == "308 https://app.prepermint.com/chat/abc"
    assert where("/memory", "prepermint.com", c) == "308 https://app.prepermint.com/memory"
    assert where("/sign-in", "www.prepermint.com", c) == "308 https://app.prepermint.com/sign-in"
    assert where("/pricing", "www.prepermint.com", c) == "served"


def test_old_sign_in_address_keeps_the_query() -> None:
    assert (
        where("/auth/signin?error=expired", "prepermint.com") == "308 https://app.prepermint.com/sign-in?error=expired"
    )


def test_app_host_serves_app_pages() -> None:
    c = signed_in()
    for path in ["/sign-in", "/sign-in/verify", "/sign-out", "/dashboard", "/dashboard/profile", "/chat", "/memory"]:
        assert where(path, "app.prepermint.com", c) == "served", path


def test_site_pages_on_the_app_host_go_back() -> None:
    assert where("/pricing", "app.prepermint.com") == "308 https://prepermint.com/pricing"
    assert where("/terms", "app.prepermint.com") == "308 https://prepermint.com/terms"
    assert where("/", "app.prepermint.com") == "308 https://app.prepermint.com/chat"


def test_site_serves_its_pages_and_look_alikes() -> None:
    assert where("/", "prepermint.com") == "served"
    assert where("/pricing", "prepermint.com") == "served"
    assert where("/sign-inx", "prepermint.com") == "served"


def test_other_hosts_serve_everything() -> None:
    assert where("/dashboard", "prepermint-git-x.vercel.app", signed_in()) == "served"
    assert where("/pricing", "localhost:8000") == "served"


def test_same_origin_does_nothing(env: Env) -> None:
    env.set(SITE_URL="https://prepermint.com", APP_URL="https://prepermint.com")
    assert where("/sign-in", "prepermint.com") == "served"


def test_gate_sends_visitors_without_a_session_to_the_login() -> None:
    for path in ["/chat", "/chat/abc", "/memory", "/dashboard", "/dashboard/experience"]:
        assert where(path, "app.prepermint.com") == "307 https://app.prepermint.com/sign-in"
        assert where(path, "app.prepermint.com", "expired") == "307 https://app.prepermint.com/sign-in"
        assert where(path, "app.prepermint.com", signed_in()) == "served"


def test_login_and_site_stay_open() -> None:
    for path in ["/sign-in", "/sign-in/verify", "/sign-out"]:
        assert where(path, "app.prepermint.com") == "served"
    assert where("/pricing", "prepermint.com") == "served"
    assert where("/chatty", "prepermint.com") == "served"


def test_old_hosts_redirect() -> None:
    assert where("/chat/abc?x=1", "app.rows.so") == "308 https://app.prepermint.com/chat/abc?x=1"
    assert where("/sign-in/verify?token=t", "app.rows.so") == "308 https://app.prepermint.com/sign-in/verify?token=t"
    assert where("/", "www.rows.so") == "308 https://prepermint.com/"
    assert where("/sign-in", "rows.so") == "308 https://app.prepermint.com/sign-in"


def test_posts_from_another_site_are_refused() -> None:
    c = signed_in()
    assert where("/chat/new", "app.prepermint.com", c, "POST", "https://evil.example") == "status 403"
    assert where("/chat/new", "app.prepermint.com", c, "POST", "https://app.prepermint.com") == "served"
    # The site's nav posts the sign-out to the app host.
    assert where("/sign-out", "app.prepermint.com", None, "POST", "https://prepermint.com") == "served"


def test_static_files_are_not_routed() -> None:
    assert where("/static/app.css", "app.prepermint.com") == "served"
    assert where("/favicon.ico", "app.prepermint.com") == "served"
