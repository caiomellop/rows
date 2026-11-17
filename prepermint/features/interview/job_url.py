"""Telling a link from pasted text, and refusing addresses we should not read. The browser runs its own copy of
the field logic (web/interview/job-url.ts); the server checks the address again before reading it."""

import re
from urllib.parse import urlsplit, urlunsplit

MAX_JOB_URL_LENGTH = 2_000

_IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
# A browser reads a host whose last label is a number (decimal, or hex with 0x) as an IPv4 address:
# "0x7f.0.0.1" is 127.0.0.1. Python's urlsplit does not, so this catches those spellings too.
_NUMERIC_LABEL = re.compile(r"^(0x[0-9a-f]*|\d+)$")
_LOCAL_NAME = re.compile(r"(^|\.)(localhost|local|internal|intranet|lan|home|corp)$")


def job_url_from(raw: str) -> str | None:
    """The link, when the whole field is one http(s) address, normalized the way a browser's URL does (a bare
    host gets a trailing slash). Pasted text (anything with a space in it) is not a link."""
    value = raw.strip()
    if not value or len(value) > MAX_JOB_URL_LENGTH or re.search(r"\s", value):
        return None
    try:
        parts = urlsplit(value)
        _ = parts.port
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return None
    scheme = parts.scheme.lower()
    netloc = parts.netloc
    # A URL drops the port of its own scheme.
    default = {"http": ":80", "https": ":443"}[scheme]
    if netloc.endswith(default):
        netloc = netloc[: -len(default)]
    host = parts.hostname.lower()
    netloc = netloc.replace(parts.hostname, host, 1)
    return urlunsplit((scheme, netloc, parts.path or "/", parts.query, parts.fragment))


def is_public_job_url(value: str) -> bool:
    """A public web address: no login in it, no unusual port, no IP number and no local or internal name. The page
    is read by Apify, not by us, but there is no reason to spend money reading those."""
    href = job_url_from(value)
    if href is None:
        return False
    parts = urlsplit(href)
    host = (parts.hostname or "").lower()
    if parts.username or parts.password:
        return False
    if parts.port is not None:
        return False
    if "." not in host or ":" in host:
        return False
    if _IPV4.match(host) or _NUMERIC_LABEL.match(host.rstrip(".").rsplit(".", 1)[-1]):
        return False
    return not _LOCAL_NAME.search(host)
