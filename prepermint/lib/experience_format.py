"""Helpers that format experience dates and profile choices."""

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def format_year_month(value: str | None) -> str:
    """ "2023-04" → "Apr 2023", "2021" → "2021"."""
    if not value:
        return ""
    year, _, month = value.partition("-")
    if month.isdigit() and 1 <= int(month) <= 12:
        return f"{MONTHS[int(month) - 1]} {year}"
    return year


def format_range(start: str | None, end: str | None, current: bool) -> str:
    begin = format_year_month(start)
    finish = "Present" if current else format_year_month(end)
    if begin and finish:
        return f"{begin} – {finish}"
    return begin or finish


WORK_MODE_LABEL = {
    "remote": "Remote",
    "hybrid": "Hybrid",
    "onsite": "On-site",
    "flexible": "Remote or on-site",
}

ROLE_TYPES = ("Full-time", "Part-time", "Contract", "Freelance", "Internship")
