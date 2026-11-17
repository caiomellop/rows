"""The languages the prototype interviews in and the voices that speak them: the one place to change either on the
server. The browser has its own copy for the setup form (web/interview/languages.ts); the two lists must match.

A Flux voice speaks one language (the model name is flux-{name}-{language}), so the voice chosen on the setup form
also chooses the language of the interview. Speed runs from 0.5 to 1.5 (1 is the voice's own pace) and
expressivity from -2 (calm) to 2 (animated); both are Deepgram Flux TTS settings. `name` is how the interviewer
introduces itself.
"""

from dataclasses import dataclass
from typing import Literal

Language = Literal["en", "es", "pt", "fr"]

# How the prompts name each language. The keys are the language codes Deepgram uses.
LANGUAGE_NAMES: dict[Language, str] = {
    "en": "English",
    "es": "Spanish (Spain)",
    "pt": "Brazilian Portuguese",
    "fr": "French",
}

VoiceId = Literal["cliff", "sienna", "eduardo", "roberto", "mathieu"]


@dataclass(frozen=True)
class Voice:
    id: VoiceId
    name: str
    label: str
    language: Language
    model: str
    speed: float
    expressivity: int


# In the order the drop-down shows them.
VOICES: tuple[Voice, ...] = (
    Voice("cliff", "Cliff", "🇺🇸 Cliff", "en", "flux-cliff-en", 0.9, 1),
    Voice("sienna", "Sienna", "🇺🇸 Sienna", "en", "flux-sienna-en", 0.9, 1),
    Voice("eduardo", "Eduardo", "🇪🇸 Eduardo", "es", "flux-eduardo-es", 0.9, 0),
    Voice("roberto", "Roberto", "🇧🇷 Roberto", "pt", "flux-roberto-pt", 0.9, 1),
    Voice("mathieu", "Mathieu", "🇫🇷 Mathieu", "fr", "flux-mathieu-fr", 0.9, 0),
)

DEFAULT_VOICE: VoiceId = "cliff"


def voice_by_id(voice_id: str) -> Voice:
    return next((v for v in VOICES if v.id == voice_id), VOICES[0])
