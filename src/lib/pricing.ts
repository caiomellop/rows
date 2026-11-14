// PLACEHOLDER pricing. Plan names, prices and features are not decided yet.
// Replace with the real plans before launch (see docs/landing-design-spec.md §8.4).

export type BillingCycle = "monthly" | "annual";

export type Plan = {
  id: string;
  name: string;
  description: string;
  /** Price per month in USD for each billing cycle. */
  monthly: number;
  annualPerMonth: number;
  /** Shown above the feature list, e.g. "Everything in Personal". */
  includesLabel?: string;
  features: { text: string; highlight?: boolean; muted?: boolean }[];
  featured?: boolean;
};

export const ANNUAL_SAVINGS_LABEL = "Save up to 20%";

export const PLANS: Plan[] = [
  {
    id: "personal",
    name: "Personal",
    description: "A polished public profile that stays in sync with your GitHub.",
    monthly: 8,
    annualPerMonth: 6,
    features: [
      { text: "Public profile at rows.so/in/@you" },
      { text: "Automatic GitHub repo sync" },
      { text: "Unlimited experiences and projects" },
      { text: "3 profile themes" },
      { text: "Rows badge on your profile", muted: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For developers who treat their portfolio like a product.",
    monthly: 15,
    annualPerMonth: 12,
    includesLabel: "Everything in Personal",
    featured: true,
    features: [
      { text: "AI-drafted About in your own voice", highlight: true },
      { text: "Your own domain", highlight: true },
      { text: "Every theme, plus custom accent colors" },
      { text: "Profile analytics: views, referrers, clicks" },
      { text: "Pin and reorder repos and experiences" },
      { text: "No Rows badge" },
    ],
  },
  {
    id: "studio",
    name: "Studio",
    description: "For freelancers and small teams showing more than one profile.",
    monthly: 36,
    annualPerMonth: 29,
    includesLabel: "Everything in Pro",
    features: [
      { text: "Up to 5 profiles under one account" },
      { text: "A team page that links every profile" },
      { text: "3 custom domains" },
      { text: "Priority support" },
    ],
  },
];

export function formatPrice(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}
