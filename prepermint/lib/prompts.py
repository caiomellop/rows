"""Long prompts live as Markdown in prompts/<area>/<name>.md, so changing a prompt is a reviewed code change."""

import re
from functools import cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"

_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


@cache
def load_prompt(area: str, name: str) -> str:
    return (PROMPTS_DIR / area / f"{name}.md").read_text(encoding="utf-8")


def render_prompt(template: str, values: dict[str, str]) -> str:
    """Replaces each {{name}} with its value, in one pass. A placeholder without a value is a bug, so it raises."""

    def fill(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in values:
            raise KeyError(f"The prompt placeholder {{{{{name}}}}} has no value.")
        return values[name]

    return _PLACEHOLDER.sub(fill, template)
