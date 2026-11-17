"""Server-rendered pages: Jinja2 templates and static files (docs/adr/0003-python-fastapi.md)."""

import hashlib
from functools import lru_cache
from pathlib import Path

from fastapi.templating import Jinja2Templates

from prepermint.icons import icon

PACKAGE_DIR = Path(__file__).resolve().parent
STATIC_DIR = PACKAGE_DIR / "static"
TEMPLATES_DIR = PACKAGE_DIR / "templates"

# Same key as the Next.js app (src/components/app-shell/theme-toggle.tsx), so a saved choice carries over.
THEME_KEY = "rows-theme"
HTMX_FILE = "js/htmx-2.0.10.min.js"


@lru_cache
def static_url(path: str) -> str:
    """URL of a file in prepermint/static with a content hash, so a changed file is never served stale."""
    file = (STATIC_DIR / path).resolve()
    if not file.is_relative_to(STATIC_DIR) or not file.is_file():
        raise FileNotFoundError(f"No static file: {path}")
    digest = hashlib.sha256(file.read_bytes()).hexdigest()[:10]
    return f"/static/{path}?v={digest}"


templates = Jinja2Templates(directory=TEMPLATES_DIR)
templates.env.globals.update(icon=icon, static_url=static_url, theme_key=THEME_KEY, htmx_file=HTMX_FILE)
