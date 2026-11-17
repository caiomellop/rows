"""The interview state machine. Pure functions only: the browser owns the state (web/interview/state.ts runs the
same machine), the turn route reads it to brief the model, and the tests exercise every transition.

opening ──▶ firstQuestion ──▶ questions ──(plan done)──▶ candidateQuestions ──(END)──▶ done
                                  └──────(time low)──────▶ closing ──(END)──▶ done

The opening introduces the interviewer and the structure and waits for the candidate; planned question 1 comes in
the next turn (CAI-91).
"""

from prepermint.features.interview.schemas import InterviewState, Move, Plan, Stage, Turn

# Follow-ups the interviewer may ask on one planned question.
MAX_FOLLOW_UPS = 2
# Questions of the candidate the interviewer answers at the end before it must close.
MAX_CANDIDATE_QUESTIONS = 3
# With this little time left the interviewer stops opening questions and closes.
WRAP_UP_AT_MS = 90_000
# Extra time after the budget before the app asks for the closing turn by itself.
OVERTIME_GRACE_MS = 30_000


def start_state(budget_ms: int) -> InterviewState:
    return InterviewState(stage="opening", questionIndex=0, followUps=0, elapsedMs=0, budgetMs=budget_ms, transcript=[])


def remaining_ms(state: InterviewState) -> float:
    return max(0.0, state.budgetMs - state.elapsedMs)


def add_turn(state: InterviewState, turn: Turn) -> InterviewState:
    return state.model_copy(update={"transcript": [*state.transcript, turn]})


def stage_for_next_turn(state: InterviewState) -> Stage:
    """The stage the next interviewer turn happens in. Low time, or enough of the candidate's questions, means
    closing."""
    if state.stage in ("done", "opening", "closing"):
        return state.stage
    if remaining_ms(state) <= WRAP_UP_AT_MS:
        return "closing"
    if state.stage == "candidateQuestions" and state.followUps >= MAX_CANDIDATE_QUESTIONS:
        return "closing"
    return state.stage


def prepare_turn(state: InterviewState, elapsed_ms: float) -> InterviewState:
    """Bring the state up to date right before the interviewer speaks."""
    with_time = state.model_copy(update={"elapsedMs": elapsed_ms})
    return with_time.model_copy(update={"stage": stage_for_next_turn(with_time)})


def allowed_moves(state: InterviewState) -> list[Move]:
    match state.stage:
        case "opening" | "firstQuestion":
            return ["NEXT"]
        case "questions":
            # NEXT on the last planned question opens the candidate's questions.
            return ["FOLLOW_UP", "NEXT"] if state.followUps < MAX_FOLLOW_UPS else ["NEXT"]
        case "candidateQuestions":
            return ["FOLLOW_UP", "END"] if state.followUps < MAX_CANDIDATE_QUESTIONS else ["END"]
        case "closing" | "done":
            return ["END"]


def coerce_move(move: Move | None, allowed: list[Move]) -> Move:
    """A model slip (missing or illegal tag) never skips the plan or breaks a limit."""
    if move is not None and move in allowed:
        return move
    if "NEXT" in allowed:
        return "NEXT"
    return allowed[0] if allowed else "END"


def apply_move(state: InterviewState, move: Move, plan: Plan) -> InterviewState:
    """Record a turn that the candidate heard to the end. A turn that was cut off does not move the interview
    forward: the candidate may not have heard the question."""
    if state.stage == "opening":
        return state.model_copy(update={"stage": "firstQuestion", "questionIndex": 0, "followUps": 0})
    if state.stage == "firstQuestion":
        return state.model_copy(update={"stage": "questions", "questionIndex": 0, "followUps": 0})
    match move:
        case "FOLLOW_UP":
            return state.model_copy(update={"followUps": state.followUps + 1})
        case "NEXT":
            if state.questionIndex >= len(plan.questions) - 1:
                return state.model_copy(update={"stage": "candidateQuestions", "followUps": 0})
            return state.model_copy(
                update={"stage": "questions", "questionIndex": state.questionIndex + 1, "followUps": 0}
            )
        case "END":
            return state.model_copy(update={"stage": "done"})


def format_clock(ms: float) -> str:
    """125000 -> "2:05". Halves round up, as JavaScript's Math.round does."""
    total = max(0, int(ms / 1000 + 0.5))
    return f"{total // 60}:{total % 60:02d}"


def _last_interviewer_turn(state: InterviewState) -> Turn | None:
    return next((t for t in reversed(state.transcript) if t.role == "interviewer"), None)


def describe_state(state: InterviewState, plan: Plan) -> str:
    """The operator briefing for the next interviewer turn. Rebuilt every turn from the state alone."""
    total = len(plan.questions)
    current = plan.questions[state.questionIndex] if state.questionIndex < total else None
    upcoming = plan.questions[state.questionIndex + 1] if state.questionIndex + 1 < total else None
    lines = [
        f"Stage: {state.stage}",
        f"Time: {format_clock(state.elapsedMs)} used of {format_clock(state.budgetMs)} "
        f"({format_clock(remaining_ms(state))} left)",
    ]

    if state.stage == "opening":
        lines += [
            'Open the interview as your instructions describe under "Opening", first turn: greet, introduce '
            "yourself, explain the structure, and ask if that sounds good.",
            "Do not ask planned question 1 yet.",
        ]
    elif state.stage == "firstQuestion":
        first = plan.questions[0] if plan.questions else None
        lines += [
            "The candidate has heard your introduction. If they asked or raised something, answer it in one short "
            "sentence.",
            f"Then move on with a short bridge and ask planned question 1 ({first.topic if first else ''}): "
            f'"{first.question if first else ""}"',
        ]
    elif state.stage == "candidateQuestions":
        lines += [
            "The plan is finished and you asked whether the candidate has any questions for you.",
            "If they asked something, answer briefly using only <job_description>, or say you don't have that "
            "information, then ask if there is anything else they would like to know: [[FOLLOW_UP]].",
            "If they have no more questions, close: thank them and say goodbye: [[END]].",
            f"Questions of the candidate answered so far: {state.followUps} (maximum {MAX_CANDIDATE_QUESTIONS})",
        ]
    elif state.stage in ("closing", "done"):
        lines.append(
            "Time is nearly up. Close the interview now: if the candidate just asked you something, answer it in "
            "one sentence (only from <job_description>), then thank them and say goodbye."
        )
    elif current is not None:
        lines += [
            f'Current question ({state.questionIndex + 1} of {total}, area: {current.topic}): "{current.question}"',
            f"A strong answer contains: {current.lookFor}",
            f"Follow-ups already asked on this question: {state.followUps} (maximum {MAX_FOLLOW_UPS})",
        ]
        if upcoming is not None:
            lines.append(
                f"Next planned question ({state.questionIndex + 2} of {total}, area: {upcoming.topic}): "
                f'"{upcoming.question}"'
            )
            if upcoming.topic != current.topic:
                lines.append(
                    f"The next question opens a new area ({upcoming.topic}): if you move on, bridge to it with one "
                    "short sentence first."
                )
        else:
            lines.append(
                "This is the last planned question. When it is covered, [[NEXT]] means: ask the candidate if they "
                "have any questions for you."
            )
        left = total - state.questionIndex
        lines.append(
            f"Pace: {left} planned question{'' if left == 1 else 's'} left including this one, about "
            f"{format_clock(remaining_ms(state) / left)} each."
        )

    lines.append(f"Allowed moves now: {', '.join(f'[[{m}]]' for m in allowed_moves(state))}")

    last = _last_interviewer_turn(state)
    if last is not None and last.interrupted:
        lines.append(
            "Your previous turn was cut off by the candidate. They heard only the text shown for it. Do not assume "
            "they heard the rest."
        )
    return "\n".join(lines)
