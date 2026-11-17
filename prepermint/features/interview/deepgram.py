"""Server side of Deepgram: the API key never leaves here. The browser gets a short-lived token and opens the speech
and voice WebSockets itself, because Vercel functions cannot hold a WebSocket."""

import math
import re
from urllib.parse import urlencode

import httpx
from pydantic import BaseModel, Field, ValidationError

from prepermint.features.interview.languages import Language
from prepermint.settings import get_settings

GRANT_URL = "https://api.deepgram.com/v1/auth/grant"

# Flux Multilingual: streaming speech recognition with built-in end-of-turn detection.
STT_MODEL = "flux-general-multi"
STT_SAMPLE_RATE = 16_000
TTS_SAMPLE_RATE = 24_000
# End-of-turn confidence needed to close the candidate's turn (0.5 to 1.0, default 0.7). A higher value waits a
# little longer, so a pause to think is less likely to cut the candidate off.
END_OF_TURN_THRESHOLD = "0.8"


class DeepgramError(Exception):
    """A failure with a message that is safe to show."""


def _api_key() -> str | None:
    """DEEPGRAM_API_KEYS holds one key; if several are listed with commas, the first is used."""
    raw = get_settings().deepgram_api_keys
    keys = [k.strip() for k in (raw.get_secret_value() if raw else "").split(",")]
    return next((k for k in keys if k), None)


class _Grant(BaseModel):
    access_token: str = Field(min_length=1)


async def mint_browser_token(ttl_seconds: float) -> str:
    """A token for the browser. It only has to be valid when each socket opens, so the lifetime covers the
    interview."""
    key = _api_key()
    if key is None:
        raise DeepgramError("Deepgram is not configured. Set DEEPGRAM_API_KEYS.")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            GRANT_URL,
            headers={"Authorization": f"Token {key}"},
            json={"ttl_seconds": min(3600, max(30, round(ttl_seconds)))},
        )
    if res.status_code == 401:
        raise DeepgramError("Deepgram rejected the key. Check DEEPGRAM_API_KEYS.")
    if res.status_code == 403:
        raise DeepgramError("This Deepgram key cannot create temporary tokens. Use a key with the Member role.")
    if res.is_error:
        raise DeepgramError(f"Deepgram could not create a token ({res.status_code}). Try again.")
    try:
        return _Grant.model_validate_json(res.content).access_token
    except ValidationError:
        raise DeepgramError("Deepgram returned an unreadable token response.") from None


def listen_url(language: Language) -> str:
    """The recognizer is told which language to expect: the one of the voice the candidate chose."""
    query = urlencode(
        {
            "model": STT_MODEL,
            "encoding": "linear16",
            "sample_rate": str(STT_SAMPLE_RATE),
            "eot_threshold": END_OF_TURN_THRESHOLD,
            "language_hint": language,
        }
    )
    return f"wss://api.deepgram.com/v2/listen?{query}"


def is_flux_voice(value: str) -> bool:
    """A Flux TTS model string: flux-{voice}-{language}, for example flux-cliff-en."""
    return re.fullmatch(r"flux-[a-z]+-[a-z]{2}", value) is not None


def _number(value: float) -> str:
    """As JavaScript prints a number: 1.0 -> "1", 0.9 -> "0.9"."""
    return str(int(value)) if float(value).is_integer() else repr(value)


def speak_url(voice: str, speed: float | None = None, expressivity: int | None = None) -> str:
    if not is_flux_voice(voice):
        raise ValueError(f'"{voice}" is not a Flux voice (expected flux-{{voice}}-{{language}}).')
    query = {"model": voice, "encoding": "linear16", "sample_rate": str(TTS_SAMPLE_RATE)}
    # Deepgram rejects values outside these ranges with a 400, which would close the socket: fail here clearly.
    if speed is not None:
        if not (0.5 <= speed <= 1.5 and math.isclose(speed * 20, round(speed * 20), abs_tol=1e-9)):
            raise ValueError(f"Speed {speed} is not valid (0.5 to 1.5 in steps of 0.05).")
        query["speed"] = _number(speed)
    if expressivity is not None:
        if not (-2 <= expressivity <= 2):
            raise ValueError(f"Expressivity {expressivity} is not valid (-2 to 2, whole numbers).")
        query["expressivity"] = str(expressivity)
    return f"wss://api.deepgram.com/v2/speak?{urlencode(query)}"
