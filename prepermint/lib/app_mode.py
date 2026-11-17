"""The app has two modes, each with its own sidebar navigation. The mode comes from the URL, never from client
state, so a reload or a shared link keeps it."""

from typing import Literal

AppMode = Literal["chat", "dashboard"]

MODE_HOME: dict[AppMode, str] = {"chat": "/chat", "dashboard": "/dashboard"}


def _under(pathname: str, base: str) -> bool:
    return pathname == base or pathname.startswith(f"{base}/")


def mode_for(pathname: str) -> AppMode:
    """/dashboard and below is Dashboard; the rest of the app (/chat, /memory) is Chat."""
    return "dashboard" if _under(pathname, "/dashboard") else "chat"


def is_active(pathname: str, href: str) -> bool:
    """True when a sidebar item is the current page. A mode's home (/chat, /dashboard) only matches exactly, or
    every page below it would light it up."""
    return pathname == href if href in MODE_HOME.values() else _under(pathname, href)
