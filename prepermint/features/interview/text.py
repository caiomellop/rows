"""Pure text helpers of the interview: the transcript and plan as the models read them, the feedback cleanup, the
move tag in a streamed reply, and the scraped job page."""

import re

from prepermint.features.interview.schemas import CRITERIA, MOVES, Feedback, Job, Move, Plan, Turn

# --- Transcript and plan -------------------------------------------------------------------------------------


def transcript_text(turns: list[Turn]) -> str:
    """The transcript as the feedback model reads it. An interrupted turn is labelled, so it is not read as the
    whole sentence."""
    lines = []
    for turn in turns:
        text = turn.text.strip()
        if not text:
            continue
        if turn.role == "candidate":
            lines.append(f"Candidate: {text}")
        elif turn.interrupted:
            lines.append(f"Interviewer (interrupted, the candidate heard only this): {text}")
        else:
            lines.append(f"Interviewer: {text}")
    return "\n".join(lines)


def planned_questions_text(plan: Plan) -> str:
    return "\n".join(f"{i + 1}. [{q.topic}] {q.question}" for i, q in enumerate(plan.questions))


def _js_round(value: float) -> int:
    """Math.round: halves go up."""
    return int(value // 1 + (1 if value % 1 >= 0.5 else 0))


def normalize_feedback(feedback: Feedback) -> Feedback:
    """Keeps the report readable whatever the model returned: integer scores in 1-5, one entry per criterion at
    most, in rubric order."""
    scores = []
    for criterion in CRITERIA:
        found = next((s for s in feedback.scores if s.criterion == criterion), None)
        if found is not None:
            scores.append(found.model_copy(update={"score": min(5, max(1, _js_round(found.score)))}))
    return feedback.model_copy(update={"scores": scores})


# --- Move tag ------------------------------------------------------------------------------------------------


class MoveTagParser:
    """Reads the move tag the model writes at the start of its reply (`[[NEXT]]`, `[[FOLLOW_UP]]`, `[[END]]`) out of
    a stream, and passes everything after it on to be spoken. The tag is a few tokens, so the voice starts as soon
    as the first words arrive."""

    def __init__(self) -> None:
        # The move, once the tag has been read. None if the reply had no valid tag.
        self.move: Move | None = None
        # True once the start of the reply has been classified as tag or no tag.
        self.settled = False
        self._buffer = ""

    def push(self, piece: str) -> str:
        """Feeds a streamed piece. Returns the text that is ready to be spoken."""
        if self.settled:
            return piece
        self._buffer += piece
        text = self._buffer.lstrip()
        if len(text) < 2:
            return ""
        if not text.startswith("[["):
            return self._release()
        close = text.find("]]")
        if close == -1:
            return self._release() if len(text) > 24 else ""
        name = text[2:close].strip().upper()
        self.move = next((m for m in MOVES if m == name), None)
        self.settled = True
        self._buffer = ""
        return text[close + 2 :].lstrip()

    def flush(self) -> str:
        """Call when the stream ends. Returns any text that was held back."""
        return "" if self.settled else self._release()

    def _release(self) -> str:
        self.settled = True
        out = self._buffer.lstrip()
        self._buffer = ""
        return out


# --- Job posting read from a link ----------------------------------------------------------------------------

# A page with less text than this has no posting in it: usually a script-only page that showed nothing without
# a browser.
THIN_PAGE_CHARS = 500
# What reaches the model. A long posting fits; a huge page cannot run up the bill.
MAX_PAGE_CHARS = 30_000


class Page:
    """One web page as Apify returned it."""

    def __init__(self, requested_url: str, final_url: str, title: str, status: int | None, text: str) -> None:
        self.requested_url = requested_url
        # Where the page really loaded from. It differs from the link when the site redirected.
        self.final_url = final_url
        self.title = title
        # The HTTP status of the page, or None when Apify did not say.
        self.status = status
        self.text = text


def clean_page_text(markdown: str) -> str:
    """Makes the page's Markdown cheaper and clearer to read: images go, links keep only their text, blank runs
    shrink."""
    out = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", markdown)
    out = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", out)
    out = re.sub(r"<br\s*/?>", " ", out, flags=re.IGNORECASE)
    out = re.sub(r"[ \t]+$", "", out, flags=re.MULTILINE)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def is_thin_page(text: str) -> bool:
    return len(clean_page_text(text)) < THIN_PAGE_CHARS


def _plain(value: str) -> str:
    return re.sub(r"[<>]", "", value)


def page_for_model(page: Page) -> str:
    """The page as the extractor sees it. Angle brackets are removed so the page cannot close our tags."""
    return "\n".join(
        [
            "<page>",
            f"<requested_link>{_plain(page.requested_url)}</requested_link>",
            f"<final_address>{_plain(page.final_url)}</final_address>",
            f"<http_status>{page.status if page.status is not None else 'unknown'}</http_status>",
            f"<title>{_plain(page.title)}</title>",
            "<text>",
            _plain(clean_page_text(page.text))[:MAX_PAGE_CHARS],
            "</text>",
            "</page>",
        ]
    )


MAX_ITEMS = 20
MAX_ITEM_CHARS = 300


def _tidy(value: str) -> str:
    return re.sub(r"\s+", " ", _plain(value)).strip()[:MAX_ITEM_CHARS]


def job_to_text(job: Job) -> str:
    """The text the interviewer gets as the job description: only what the model kept, in a fixed order."""

    def section(title: str, items: list[str]) -> list[str]:
        rows = [row for row in (_tidy(i) for i in items) if row][:MAX_ITEMS]
        return ["", f"{title}:", *(f"- {row}" for row in rows)] if rows else []

    lines = [f"Role: {_tidy(job.roleTitle)}"]
    if job.companyName and _tidy(job.companyName):
        lines.append(f"Company: {_tidy(job.companyName)}")
    if job.seniority and _tidy(job.seniority):
        lines.append(f"Level: {_tidy(job.seniority)}")
    lines += section("What the person will do", job.responsibilities)
    lines += section("Requirements", job.requirements)
    lines += section("Nice to have", job.niceToHave)
    tools = [t for t in (_tidy(i) for i in job.tools) if t][:MAX_ITEMS]
    if tools:
        lines += ["", f"Tools and technologies: {', '.join(tools)}"]
    return "\n".join(lines)
