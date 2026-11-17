import pytest
from pydantic import ValidationError

from prepermint.db.models import Experience
from prepermint.features.discovery.schema import DiscoveryContext
from prepermint.features.resume.pdf import ResumeProfile, resume_pdf

JOB = Experience(
    id="e1",
    user_id="u1",
    kind="work",
    title="Backend engineer",
    organization="Acme",
    location="Lisbon",
    start_date="2022-03",
    end_date=None,
    current=True,
    bullets=["Built the billing service"],
    skills=["Go", "PostgreSQL"],
)


def test_resume_renders_a_pdf_with_real_text() -> None:
    profile = ResumeProfile(
        display_name="Ada Lovelace", headline="Backend engineer", summary="Builds services.", location="Lisbon"
    )
    pdf = resume_pdf(profile, [JOB], "ada@example.com")
    assert pdf[:5] == b"%PDF-"
    assert b"/Title (Ada Lovelace - Resume)" in pdf or b"Ada Lovelace" in pdf


def test_resume_renders_with_an_empty_profile() -> None:
    assert resume_pdf(ResumeProfile(None, None, None, None), [], None)[:5] == b"%PDF-"


def test_resume_survives_text_the_core_font_cannot_draw() -> None:
    odd = Experience(
        **{
            **{
                c: getattr(JOB, c)
                for c in ["id", "user_id", "kind", "location", "start_date", "end_date", "current", "skills"]
            },
            "title": "Engenheira — São Paulo 数据",
            "organization": "Ação 🚀",
            "bullets": ["Cut costs – 20%"] * 40,
        }
    )
    pdf = resume_pdf(ResumeProfile("José Ñúñez", None, None, None), [odd], None)
    assert pdf[:5] == b"%PDF-"


VALID = {
    "targetRole": "Senior Product Designer",
    "targetLevel": "senior",
    "targetMarket": "Portugal, hybrid, English",
    "goals": ["Join a product team that ships weekly"],
    "achievements": [
        {
            "what": "I redesigned the checkout flow",
            "scope": "Team of 4, 120k monthly users",
            "result": "Checkout drop-off went from 38% to 29%",
            "evidence": {"kind": "link", "detail": "https://example.com/case-study"},
        }
    ],
    "hiddenResults": [
        {"what": "I wrote the onboarding guide", "evidence": {"kind": "stated", "detail": "Told me in the chat"}}
    ],
}


def achievement(**changes: object) -> dict[str, object]:
    first = VALID["achievements"]
    assert isinstance(first, list)
    return {**first[0], **changes}


def test_discovery_accepts_a_complete_context() -> None:
    DiscoveryContext.model_validate(VALID)
    DiscoveryContext.model_validate({**VALID, "achievements": [achievement(scope=None, result=None)]})
    DiscoveryContext.model_validate({**VALID, "hiddenResults": []})


@pytest.mark.parametrize(
    "changes",
    [
        {"achievements": [achievement(evidence=None)]},
        {"achievements": [achievement(evidence={"kind": "stated", "detail": "   "})]},
        {"achievements": [achievement(evidence={"kind": "guess", "detail": "x"})]},
        {"targetLevel": "wizard"},
        {"goals": []},
        {"targetRole": "  "},
        {"targetMarket": "  "},
    ],
)
def test_discovery_rejects_guesses_and_blanks(changes: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        DiscoveryContext.model_validate({**VALID, **changes})
