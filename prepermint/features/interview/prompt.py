"""What Claude sees for one interviewer turn."""

import re
from dataclasses import dataclass, field
from typing import Literal

from anthropic.types import MessageParam, TextBlockParam

from prepermint.features.interview.languages import LANGUAGE_NAMES
from prepermint.features.interview.schemas import InterviewState, Plan
from prepermint.features.interview.state import describe_state
from prepermint.features.interview.text import planned_questions_text
from prepermint.lib.prompts import load_prompt, render_prompt

START = "The interview is starting now."
SILENCE = "(The candidate has not said anything since.)"


def _clean(text: str) -> str:
    """Speech never needs angle brackets, and they would let the candidate close our tags."""
    return re.sub(r"[<>]", "", text).strip()


@dataclass
class _Group:
    role: Literal["user", "assistant"]
    parts: list[str] = field(default_factory=list)


def build_turn_prompt(
    job_description: str, resume: str, plan: Plan, state: InterviewState
) -> tuple[str, list[MessageParam]]:
    """The system prompt is the same on every turn of an interview, so it can be cached. What changes each turn
    (the state briefing) goes at the end of the last message, after the candidate's words, which stay inside
    <candidate_said> tags as data."""
    system = render_prompt(
        load_prompt("interviews", "interviewer"),
        {
            "language_name": LANGUAGE_NAMES[plan.language],
            "interviewer_name": plan.interviewerName or "(none)",
            "job_description": job_description,
            "resume": resume or "(none provided)",
            "plan": planned_questions_text(plan),
        },
    )

    # The API wants alternating roles that start with the user. Neighbours of the same role are joined.
    groups = [_Group("user", [START])]

    def add(role: Literal["user", "assistant"], text: str) -> None:
        if groups[-1].role == role:
            groups[-1].parts.append(text)
        else:
            groups.append(_Group(role, [text]))

    for turn in state.transcript:
        text = _clean(turn.text)
        if not text:
            continue
        if turn.role == "candidate":
            add("user", f"<candidate_said>{text}</candidate_said>")
        else:
            add("assistant", f"{text} …" if turn.interrupted else text)

    if groups[-1].role == "assistant":
        groups.append(_Group("user", [SILENCE]))
    groups[-1].parts.append(f"<interview_state>\n{describe_state(state, plan)}\n</interview_state>")

    messages: list[MessageParam] = []
    for group in groups:
        content: list[TextBlockParam] = [{"type": "text", "text": text} for text in group.parts]
        if group.role == "user":
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "assistant", "content": content})
    return system, messages
