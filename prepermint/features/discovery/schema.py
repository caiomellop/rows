"""Structured result of the discovery conversation. The script that produces it is docs/discovery/roteiro.md.

Rule shared by every field: nothing here may be invented. Text, numbers and dates come from the candidate's
answers or from a document or link they provided. When the candidate does not know something, `scope` / `result`
stay `None` instead of being filled with a guess.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

TargetLevel = Literal["intern", "junior", "mid", "senior", "lead", "manager", "director", "executive"]
TARGET_LEVELS: tuple[str, ...] = ("intern", "junior", "mid", "senior", "lead", "manager", "director", "executive")

# stated: the candidate said it and has no document (weakest); document: a file the candidate uploaded;
# link: a public link the candidate gave; reference: a person the candidate named who can confirm it.
EvidenceKind = Literal["stated", "document", "link", "reference"]
EVIDENCE_KINDS: tuple[str, ...] = ("stated", "document", "link", "reference")


class Evidence(BaseModel):
    kind: EvidenceKind
    # What supports the claim: the candidate's own words, a file name, a URL or a person.
    detail: Text


class Achievement(BaseModel):
    # What the candidate did, in the first person.
    what: Text
    # Size of it: people, users, money, time. None when the candidate did not say.
    scope: Text | None
    # What changed, with a number only if the candidate gave it. None when unknown.
    result: Text | None
    evidence: Evidence


class HiddenResult(BaseModel):
    """Something the candidate did but does not call an achievement."""

    what: Text
    evidence: Evidence


class DiscoveryContext(BaseModel):
    target_role: Text = Field(alias="targetRole")
    target_level: TargetLevel = Field(alias="targetLevel")
    # Country, city or remote, and working language, as the candidate described it.
    target_market: Text = Field(alias="targetMarket")
    goals: list[Text] = Field(min_length=1)
    achievements: list[Achievement]
    hidden_results: list[HiddenResult] = Field(alias="hiddenResults")
