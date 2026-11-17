"""Jinja2 templates, with the helpers every page uses."""

from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from fastapi.templating import Jinja2Templates
from jinja2 import pass_context
from jinja2.runtime import Context
from markupsafe import Markup

from prepermint.lib.app_mode import MODE_HOME, is_active, mode_for
from prepermint.lib.app_url import app_href, site_href

PACKAGE = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE / "static"

templates = Jinja2Templates(directory=PACKAGE / "templates")
env = templates.env


def icon(name: str, size: int | None = None, cls: str = "", stroke: float | None = None) -> Markup:
    """An inline SVG icon from templates/icons/. Parts marked .icon-anim animate while a parent with .has-icon is
    hovered (static/src/app.css)."""
    values: dict[str, object] = {"cls": cls}
    if size is not None:
        values["size"] = size
    if stroke is not None:
        values["stroke"] = stroke
    return Markup(env.get_template(f"icons/{name}.svg.j2").render(values))  # noqa: S704 - our own template


def _asset_version() -> str:
    """Changes whenever the built CSS or JS changes, so browsers fetch the new file."""
    stamps = [int(p.stat().st_mtime) for p in STATIC_DIR.glob("*.*") if p.is_file()]
    return str(max(stamps, default=0))


ASSET_VERSION = _asset_version()


def static_url(path: str) -> str:
    return f"/static/{path}?v={ASSET_VERSION}"


@pass_context
def current_path(context: Context) -> str:
    """The page the browser shows: for an HTMX fragment that is the page that asked for it, not the fragment's URL."""
    request = context.get("request")
    if request is None:
        return "/"
    shown = request.headers.get("hx-current-url")
    return urlsplit(shown).path if shown else str(request.url.path)


def thread_date(updated_at: datetime, now: datetime) -> str:
    """ "Nov 3" this year, "Nov 2025" before."""
    if updated_at.year == now.year:
        return f"{updated_at:%b} {updated_at.day}"
    return f"{updated_at:%b %Y}"


env.globals.update(
    icon=icon,
    static_url=static_url,
    app_href=app_href,
    site_href=site_href,
    mode_for=mode_for,
    is_active=is_active,
    MODE_HOME=MODE_HOME,
    current_path=current_path,
)
