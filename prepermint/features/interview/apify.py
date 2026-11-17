"""The only place the app talks to Apify (docs/adr/0002). It asks Apify's RAG Web Browser for one link and gets the
page back as Markdown. Only the link is sent, never the résumé or anything from the interview.

It uses the Actor's own server (always running), not a new run per link: a run starts a container first, which
took about 8 s even for a page that loads in one.
"""

import asyncio
import logging
import time
from typing import Literal

import httpx
from pydantic import BaseModel, ValidationError

from prepermint.features.interview.text import Page, is_thin_page
from prepermint.settings import get_settings

logger = logging.getLogger(__name__)

JobPageFailure = Literal["not-configured", "rejected", "no-credit", "timeout", "failed", "empty"]

_INSTEAD = "Paste the text of the posting instead."
MESSAGES: dict[JobPageFailure, str] = {
    "not-configured": f"Reading a link is not set up yet. {_INSTEAD}",
    "rejected": f"Reading a link is not available right now. {_INSTEAD}",
    "no-credit": f"Reading a link is not available right now. {_INSTEAD}",
    "timeout": f"Reading the page took too long. {_INSTEAD}",
    "failed": f"Could not read that page. {_INSTEAD}",
    "empty": f"Could not read that page. {_INSTEAD}",
}


class JobPageError(Exception):
    """A failure with a message that is safe to show, and a code for the server log."""

    def __init__(self, code: JobPageFailure) -> None:
        super().__init__(MESSAGES[code])
        self.code: JobPageFailure = code


ENDPOINT = "https://rag-web-browser.apify.actor/search"

# The whole job request has to fit in one function call (60 s): the read, a browser retry, and the model.
READ_BUDGET_S = 50.0
# What the model call after the read needs.
MODEL_RESERVE_S = 8
# Not worth starting a browser run with less than this left.
MIN_BROWSER_S = 15

Tool = Literal["raw-http", "browser-playwright"]
# The longest to wait for each way of reading. The server answers a plain read in a few seconds; a browser takes
# longer.
MAX_WAIT_S: dict[Tool, int] = {"raw-http": 15, "browser-playwright": 30}


class _Metadata(BaseModel):
    title: str | None = None
    url: str | None = None
    redirectedUrl: str | None = None


class _Crawl(BaseModel):
    httpStatusCode: int | None = None


class _Item(BaseModel):
    markdown: str | None = None
    metadata: _Metadata | None = None
    crawl: _Crawl | None = None


def _api_token() -> str | None:
    token = get_settings().apify_token
    value = token.get_secret_value().strip() if token else ""
    return value or None


async def _read_once(requested_url: str, tool: Tool, token: str, deadline: float, log_label: str = "page read") -> Page:
    """One read of the page: waits for the server's answer, and returns the page it loaded."""
    timeout_s = min(MAX_WAIT_S[tool], int(deadline - time.monotonic()) - MODEL_RESERVE_S)
    if timeout_s < 5:
        raise JobPageError("timeout")

    # The link is sent as a query parameter, like any search; the token goes in a header, never in the address.
    params = {
        "query": requested_url,
        "maxResults": "1",
        "outputFormats": "markdown",
        "scrapingTool": tool,
        "removeCookieWarnings": "false",
    }
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            response = await client.get(ENDPOINT, params=params, headers={"Authorization": f"Bearer {token}"})
    except httpx.TimeoutException:
        raise JobPageError("timeout") from None
    except httpx.HTTPError:
        raise JobPageError("failed") from None

    if response.status_code in (401, 403):
        raise JobPageError("rejected")
    if response.status_code == 402:
        raise JobPageError("no-credit")
    if response.status_code == 408:
        raise JobPageError("timeout")
    if response.is_error:
        raise JobPageError("failed")

    try:
        items = [_Item.model_validate(i) for i in response.json()]
    except (ValueError, TypeError, ValidationError):
        items = []
    if not items:
        raise JobPageError("empty")
    item = items[0]
    meta = item.metadata or _Metadata()
    page = Page(
        requested_url=requested_url,
        final_url=meta.url or meta.redirectedUrl or requested_url,
        title=meta.title or "",
        status=item.crawl.httpStatusCode if item.crawl else None,
        text=item.markdown or "",
    )
    # Only numbers: how long it took and how much came back. Never the link or the text of the page.
    logger.info(
        "[interview-prototype] %s tool=%s ms=%d status=%s chars=%d",
        log_label,
        tool,
        round((time.monotonic() - started) * 1000),
        page.status,
        len(page.text),
    )
    return page


# The page really is gone: a browser would only read the same error page.
_GONE = {404, 410}
# Sites that turn plain HTTP away but may let a real browser through.
_TURNED_AWAY = {401, 403, 429}
# Failures of the plain read that a browser run might get around. A rejected token or an empty account would fail
# again.
_RETRYABLE: set[JobPageFailure] = {"timeout", "failed", "empty"}


def _needs_browser(page: Page) -> bool:
    if page.status is not None and page.status in _GONE:
        return False
    return is_thin_page(page.text) or (page.status is not None and (page.status in _TURNED_AWAY or page.status >= 500))


async def read_page(requested_url: str, deadline: float | None = None) -> Page:
    """Reads the page a link points to. Plain HTTP goes first because it is quick and cheap and most job boards
    (Lever, Greenhouse, Gupy) answer it in full. A page that comes back with no text, or that turned plain HTTP
    away, gets a second run in a real browser (script-only boards such as Ashby)."""
    token = _api_token()
    if token is None:
        raise JobPageError("not-configured")
    end = deadline if deadline is not None else time.monotonic() + READ_BUDGET_S

    plain: Page | None = None
    plain_error: JobPageError | None = None
    try:
        plain = await _read_once(requested_url, "raw-http", token, end)
    except JobPageError as error:
        if error.code not in _RETRYABLE:
            raise
        plain_error = error

    if plain is not None and not _needs_browser(plain):
        return plain

    left = end - time.monotonic() - MODEL_RESERVE_S
    if left < MIN_BROWSER_S:
        if plain is not None:
            return plain
        raise plain_error or JobPageError("timeout")

    try:
        browser = await _read_once(requested_url, "browser-playwright", token, end)
    except JobPageError:
        if plain is not None:
            return plain
        raise
    return browser if plain is None or len(browser.text) > len(plain.text) else plain


# --- Warming up ----------------------------------------------------------------------------------------------

# A fixed public page. Warming up sends nothing about the person or the job.
WARM_UP_URL = "https://example.com/"
# At most one warm-up this often per server instance, so opening the page again and again does not spend money
# again and again.
WARM_UP_EVERY_S = 4 * 60
_last_warm_up_at: float | None = None


async def warm_up(now: float | None = None) -> None:
    """Wakes the Actor's server before a link is pasted. After a quiet period the first reads were slow; a minute
    later the same links took a few seconds. It reads the fixed page both ways, plain and in a browser, at the same
    time. It never raises: a warm-up that fails changes nothing for the person."""
    global _last_warm_up_at
    token = _api_token()
    if token is None:
        return
    moment = now if now is not None else time.monotonic()
    if _last_warm_up_at is not None and moment - _last_warm_up_at < WARM_UP_EVERY_S:
        return
    # Set before the first await, so a second call in the same instant sees it.
    _last_warm_up_at = moment

    async def one(tool: Tool) -> None:
        started = time.monotonic()
        try:
            await _read_once(WARM_UP_URL, tool, token, started + MAX_WAIT_S[tool] + MODEL_RESERVE_S + 1, "warm-up")
        except Exception as error:
            # Only numbers and the kind of failure. A failed warm-up is not shown to anyone.
            code = error.code if isinstance(error, JobPageError) else "unknown"
            logger.info(
                "[interview-prototype] warm-up failed tool=%s ms=%d code=%s",
                tool,
                round((time.monotonic() - started) * 1000),
                code,
            )

    await asyncio.gather(one("raw-http"), one("browser-playwright"))
