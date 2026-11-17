"""Chat starters: shortcuts in the sidebar and on the new-chat screen. Clicking one opens a new chat with `prompt`
already sent. Edit this list to add, remove or reword them; no template needs to change. `icon` names a partial
in prepermint/templates/icons/."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Starter:
    id: str
    title: str
    icon: str
    prompt: str


STARTERS: list[Starter] = [
    Starter(
        id="discovery",
        title="Start my discovery",
        icon="compass",
        prompt=(
            "I want to start my discovery. Interview me about my goals, then each job and project, one question at "
            "a time, so we can build my profile."
        ),
    ),
    Starter(
        id="headline",
        title="Improve my headline",
        icon="sparkles",
        prompt=(
            "Help me improve my profile headline. Ask me what you need to know, then suggest a few stronger options."
        ),
    ),
    Starter(
        id="project",
        title="Describe a project",
        icon="folder-code",
        prompt=(
            "I want to describe a project I worked on. Ask me about the problem, what I built and the result, then "
            "write it up for my profile."
        ),
    ),
    Starter(
        id="interview",
        title="Prepare for an interview",
        icon="mic",
        prompt=(
            "Help me prepare for a job interview. Ask me which role it is for, then run a short mock interview "
            "based on my experience."
        ),
    ),
]


def starter_by_id(starter_id: str) -> Starter | None:
    return next((s for s in STARTERS if s.id == starter_id), None)
