"""Prepermint is served on two hosts from one deployment:

- the site (prepermint.com): landing, pricing, terms, privacy;
- the app (app.prepermint.com): sign-in, chat, memory, dashboard.

`prepermint/middleware.py` keeps each path on its host. Locally and on preview deployments both URLs are the same
origin and nothing is redirected.
"""

from urllib.parse import urlsplit

from prepermint.settings import LOCAL_URL, get_settings


def _clean(url: str) -> str:
    return url.rstrip("/")


def app_url() -> str:
    """Origin of the platform, e.g. https://app.prepermint.com (no trailing slash)."""
    return _clean(get_settings().app_url or LOCAL_URL)


def site_url() -> str:
    """Origin of the public site, e.g. https://prepermint.com. Defaults to the app origin."""
    settings = get_settings()
    return _clean(settings.site_url or settings.app_url or LOCAL_URL)


def hosts_are_split() -> bool:
    """True when the app lives on its own host (production)."""
    return app_url() != site_url()


def app_href(path: str) -> str:
    """Link to an app page. Relative while everything shares one origin."""
    return f"{app_url()}{path}" if hosts_are_split() else path


def site_href(path: str) -> str:
    """Link to a site page. Relative while everything shares one origin."""
    return f"{site_url()}{path}" if hosts_are_split() else path


def site_host() -> str:
    """ "prepermint.com", for showing a public address."""
    return site_url().split("://", 1)[-1]


# Paths that belong to the app host. Everything else belongs to the site.
# The interview prototype is on the app host but needs no session: it is open where PROTOTYPE_ENABLED is true.
APP_PATHS = ("/sign-in", "/sign-out", "/dashboard", "/chat", "/memory", "/interview")
# App paths that need a session: everything behind the sidebar.
SIGNED_IN_PATHS = ("/dashboard", "/chat", "/memory")


def _matches(paths: tuple[str, ...], pathname: str) -> bool:
    return any(pathname == p or pathname.startswith(f"{p}/") for p in paths)


def is_app_path(pathname: str) -> bool:
    return _matches(APP_PATHS, pathname)


def needs_session(pathname: str) -> bool:
    return _matches(SIGNED_IN_PATHS, pathname)


def _hostname(url: str) -> str:
    return urlsplit(url).hostname or ""


def _host(url: str) -> str:
    """Host with the port, as a Host header carries it."""
    return urlsplit(url).netloc


def session_cookie_domain() -> str | None:
    """Cookie `Domain` that lets the session set on app.prepermint.com be read on prepermint.com too (for example,
    a signed-in nav on the site). None when the hosts are not split or the app is not a subdomain of the site."""
    if not hosts_are_split():
        return None
    site = _hostname(site_url()).removeprefix("www.")
    app = _hostname(app_url())
    return site if app.endswith(f".{site}") else None


def is_site_host(host: str | None) -> bool:
    """True when `host` is the site, with or without the www prefix."""
    if not host:
        return False
    site = _host(site_url()).removeprefix("www.")
    return host in (site, f"www.{site}")


def is_app_host(host: str | None) -> bool:
    return host == _host(app_url())


# Hosts the product used before the rename to Prepermint. They are only kept to redirect (308) to the current
# hosts; nothing is served on them.
LEGACY_SITE_HOSTS = ("rows.so", "www.rows.so")
LEGACY_APP_HOSTS = ("app.rows.so",)


def legacy_host_target(host: str | None, pathname: str) -> str | None:
    """Where a request to an old host should go, or None when `host` is not an old host. Skipped while the
    configured URLs still point at that host, so the redirect cannot loop before the environment is switched."""
    if not host:
        return None
    hostname = host.split(":")[0]
    if hostname in (_hostname(app_url()), _hostname(site_url())):
        return None
    if hostname in LEGACY_APP_HOSTS:
        return f"{app_url()}{pathname}"
    if hostname in LEGACY_SITE_HOSTS:
        return f"{app_url() if is_app_path(pathname) else site_url()}{pathname}"
    return None
