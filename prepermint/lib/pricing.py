"""PLACEHOLDER pricing. Plan names, prices and features are not decided yet (MVP-46).
Replace with the real plans before launch (see docs/landing-design-spec.md §8.4)."""

from dataclasses import dataclass, field
from typing import Literal

BillingCycle = Literal["monthly", "annual"]


@dataclass(frozen=True)
class Feature:
    text: str
    highlight: bool = False
    muted: bool = False


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    description: str
    # Price per month in USD for each billing cycle.
    monthly: float
    annual_per_month: float
    features: list[Feature] = field(default_factory=list)
    # Shown above the feature list, e.g. "Everything in Personal".
    includes_label: str | None = None
    featured: bool = False


ANNUAL_SAVINGS_LABEL = "Save up to 20%"

PLANS: list[Plan] = [
    Plan(
        id="personal",
        name="Personal",
        description="A polished public profile that stays in sync with your GitHub.",
        monthly=8,
        annual_per_month=6,
        features=[
            Feature("Public profile at prepermint.com/in/@you"),
            Feature("Automatic GitHub repo sync"),
            Feature("Unlimited experiences and projects"),
            Feature("3 profile themes"),
            Feature("Prepermint badge on your profile", muted=True),
        ],
    ),
    Plan(
        id="pro",
        name="Pro",
        description="For developers who treat their portfolio like a product.",
        monthly=15,
        annual_per_month=12,
        includes_label="Everything in Personal",
        featured=True,
        features=[
            Feature("AI-drafted About in your own voice", highlight=True),
            Feature("Your own domain", highlight=True),
            Feature("Every theme, plus custom accent colors"),
            Feature("Profile analytics: views, referrers, clicks"),
            Feature("Pin and reorder repos and experiences"),
            Feature("No Prepermint badge"),
        ],
    ),
    Plan(
        id="studio",
        name="Studio",
        description="For freelancers and small teams showing more than one profile.",
        monthly=36,
        annual_per_month=29,
        includes_label="Everything in Pro",
        features=[
            Feature("Up to 5 profiles under one account"),
            Feature("A team page that links every profile"),
            Feature("3 custom domains"),
            Feature("Priority support"),
        ],
    ),
]


def format_price(value: float) -> str:
    return f"${int(value)}" if float(value).is_integer() else f"${value:.2f}"
