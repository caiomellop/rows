"""ATS-ready resume: one column, real text, standard headings, no tables. Built-in Helvetica keeps text extraction
reliable. Nothing renders it yet; MVP-16 adds the route and the download.

fpdf2's core fonts cover Latin-1 only (the React PDF version's Helvetica also had dashes, curly quotes and the
bullet). Those are mapped to their nearest Latin-1 form, and anything else outside Latin-1 (other scripts, emoji)
becomes "?", so a resume always renders. MVP-16 should embed a Unicode font before it ships the download.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from fpdf import FPDF

from prepermint.db.models import Experience
from prepermint.lib.experience_format import format_range

INK = (17, 17, 17)
SOFT = (51, 51, 51)
MUTED = (68, 68, 68)
RULE = (153, 153, 153)
LINE = 1.4


@dataclass(frozen=True)
class ResumeProfile:
    display_name: str | None
    headline: str | None
    summary: str | None
    location: str | None


_NEAREST = str.maketrans(
    {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "\u00b7",
        "\u2026": "...",
        "\u00a0": " ",
    }
)


def _safe(text: str) -> str:
    return text.translate(_NEAREST).encode("latin-1", errors="replace").decode("latin-1")


class _Resume(FPDF):
    def text_block(self, text: str, size: float, style: str = "", color: tuple[int, int, int] = INK) -> None:
        self.set_font("Helvetica", style, size)
        self.set_text_color(*color)
        self.multi_cell(0, size * LINE * 0.3528, _safe(text), new_x="LMARGIN", new_y="NEXT")

    def heading(self, title: str) -> None:
        self.ln(14 * 0.3528)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*INK)
        self.set_char_spacing(0.6)
        self.cell(0, 11 * LINE * 0.3528, title.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_char_spacing(0)
        self.set_draw_color(*RULE)
        self.set_line_width(0.75 * 0.3528)
        self.line(self.l_margin, self.get_y() + 0.6, self.w - self.r_margin, self.get_y() + 0.6)
        self.ln(6 * 0.3528)

    def entry(self, e: Experience, with_location: bool) -> None:
        # One entry stays on one page when it fits.
        estimate = 12 + 5 * len(e.bullets)
        if self.get_y() + estimate > self.h - self.b_margin:
            self.add_page()
        top = self.get_y()
        dates = _safe(format_range(e.start_date, e.end_date, e.current))
        self.set_font("Helvetica", "", 9.5)
        dates_width = self.get_string_width(dates) + 1
        self.set_text_color(*MUTED)
        self.set_xy(self.w - self.r_margin - dates_width, top)
        self.cell(dates_width, 10.5 * LINE * 0.3528, dates, align="R")
        self.set_xy(self.l_margin, top)
        self.set_font("Helvetica", "B", 10.5)
        self.set_text_color(*INK)
        width = self.w - self.l_margin - self.r_margin - dates_width - 2
        self.multi_cell(
            width, 10.5 * LINE * 0.3528, _safe(f"{e.title}, {e.organization}"), new_x="LMARGIN", new_y="NEXT"
        )
        if with_location and e.location:
            self.text_block(e.location, 9.5, color=MUTED)
        for bullet in e.bullets:
            self.set_font("Helvetica", "", 10)
            self.set_text_color(*INK)
            self.ln(2 * 0.3528)
            self.cell(10 * 0.3528, 10 * LINE * 0.3528, _safe("•"))
            self.multi_cell(
                self.w - self.get_x() - self.r_margin - 8 * 0.3528,
                10 * LINE * 0.3528,
                _safe(bullet),
                new_x="LMARGIN",
                new_y="NEXT",
            )
        self.ln(8 * 0.3528)


def resume_pdf(profile: ResumeProfile, experiences: Sequence[Experience], email: str | None) -> bytes:
    name = profile.display_name or email or "Resume"
    work = [e for e in experiences if e.kind == "work"]
    education = [e for e in experiences if e.kind == "education"]
    skills = list(dict.fromkeys(skill for e in experiences for skill in e.skills))[:30]
    contact = [x for x in [profile.location, email] if x]

    # Points to millimetres: the layout numbers match the React PDF version.
    pdf = _Resume(format="A4", unit="mm")
    pdf.set_margins(48 * 0.3528, 40 * 0.3528, 48 * 0.3528)
    pdf.set_auto_page_break(True, 40 * 0.3528)
    pdf.set_title(_safe(f"{name} - Resume"))
    pdf.set_author(_safe(name))
    pdf.set_subject("Resume")
    pdf.set_creator("Prepermint")
    pdf.set_producer("Prepermint")
    pdf.add_page()

    pdf.text_block(name, 20, "B")
    if profile.headline:
        pdf.text_block(profile.headline, 11, color=SOFT)
    if contact:
        pdf.text_block("  |  ".join(contact), 9, color=SOFT)
    if profile.summary:
        pdf.heading("Summary")
        pdf.text_block(profile.summary, 10)
    if work:
        pdf.heading("Experience")
        for e in work:
            pdf.entry(e, with_location=True)
    if skills:
        pdf.heading("Skills")
        pdf.text_block(", ".join(skills), 10)
    if education:
        pdf.heading("Education")
        for e in education:
            pdf.entry(e, with_location=False)
    return bytes(pdf.output())
