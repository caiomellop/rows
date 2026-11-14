export type BillingPeriod = "monthly" | "annual";

export type PlanId =
  | "free"
  | "personal"
  | "plus"
  | "starter"
  | "pro"
  | "max";

export type Plan = {
  id: PlanId;
  name: string;
  blurb: string;
  monthly: number;
  annualMonthly: number;
  annualTotal: number;
  cta: string;
  href: string;
  features: string[];
  popular?: boolean;
  group: "builder" | "pro";
};

export const builderPlans: Plan[] = [
  {
    id: "personal",
    name: "Personal",
    blurb: "An unlimited private workspace for the work you want to show.",
    monthly: 9,
    annualMonthly: 7.5,
    annualTotal: 90,
    cta: "Choose Personal",
    href: "/auth/signin",
    group: "builder",
    features: [
      "Unlimited projects and experiences",
      "GitHub sync for every repo you want listed",
      "Public profile at rows.so/u/you",
      "Custom About you write yourself",
      "Contact form on your profile",
    ],
  },
  {
    id: "plus",
    name: "Personal Plus",
    blurb: "Your portfolio, plus AI that writes from your real work.",
    monthly: 15,
    annualMonthly: 12.5,
    annualTotal: 150,
    cta: "Choose Personal Plus",
    href: "/auth/signin",
    group: "builder",
    features: [
      "Everything in Personal",
      "AI About grounded in your repos and experiences",
      "Role and stacks suggestions from your actual work",
      "150 AI credits every month",
      "Resume PDF upload with experience extraction",
    ],
  },
];

export const proPlans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For shipping a portfolio that stays current with your work.",
    monthly: 19,
    annualMonthly: 15.75,
    annualTotal: 189,
    cta: "Choose Starter",
    href: "/auth/signin",
    group: "pro",
    features: [
      "Everything in Free",
      "Unlimited GitHub project sync",
      "Up to 8 experiences with linked projects",
      "AI About and stacks from your data",
      "200 AI credits a month",
      "Custom domain for your public profile",
      "30 days of profile analytics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For people who treat their portfolio like a career asset.",
    monthly: 39,
    annualMonthly: 32.5,
    annualTotal: 390,
    cta: "Choose Pro",
    href: "/auth/signin",
    group: "pro",
    popular: true,
    features: [
      "Everything in Starter",
      "Unlimited experiences and project links",
      "Hugging Face sync alongside GitHub",
      "Resume PDF → reviewable experiences",
      "750 AI credits a month",
      "3 custom domains",
      "90 days of analytics",
      "Priority support",
    ],
  },
  {
    id: "max",
    name: "Max",
    blurb: "For operators running every profile, client, and brand on Rows.",
    monthly: 79,
    annualMonthly: 65.75,
    annualTotal: 789,
    cta: "Choose Max",
    href: "/auth/signin",
    group: "pro",
    features: [
      "Everything in Pro",
      "3,000 AI credits a month",
      "Unlimited custom domains",
      "Team seats for editors and reviewers",
      "365 days of analytics",
      "White-label profile chrome",
      "Private Slack with the Rows team",
    ],
  },
];

export function displayPrice(plan: Plan, period: BillingPeriod): string {
  const value = period === "annual" ? plan.annualMonthly : plan.monthly;
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export type ComparisonCell = string | boolean;

export type ComparisonRow = {
  feature: string;
  hint?: string;
  free: ComparisonCell;
  starter: ComparisonCell;
  pro: ComparisonCell;
  max: ComparisonCell;
};

export type ComparisonSection = {
  title: string;
  description?: string;
  rows: ComparisonRow[];
};

export const comparisonSections: ComparisonSection[] = [
  {
    title: "Profile and publishing",
    description: "Ship a public page that stays tied to your real work.",
    rows: [
      {
        feature: "Public profile",
        free: true,
        starter: true,
        pro: true,
        max: true,
      },
      {
        feature: "Custom domains",
        free: "—",
        starter: "1",
        pro: "3",
        max: "Unlimited",
      },
      {
        feature: "Contact form",
        free: true,
        starter: true,
        pro: true,
        max: true,
      },
      {
        feature: "Analytics history",
        free: "—",
        starter: "30 days",
        pro: "90 days",
        max: "365 days",
      },
      {
        feature: "White-label chrome",
        free: false,
        starter: false,
        pro: false,
        max: true,
      },
    ],
  },
  {
    title: "Workspace",
    description: "Where your projects, experiences, and sources live.",
    rows: [
      {
        feature: "Projects",
        free: "5",
        starter: "Unlimited",
        pro: "Unlimited",
        max: "Unlimited",
      },
      {
        feature: "Experiences",
        free: "2",
        starter: "8",
        pro: "Unlimited",
        max: "Unlimited",
      },
      {
        feature: "GitHub sync",
        free: "Manual select",
        starter: true,
        pro: true,
        max: true,
      },
      {
        feature: "Hugging Face sync",
        free: false,
        starter: false,
        pro: true,
        max: true,
      },
      {
        feature: "Resume PDF import",
        free: false,
        starter: false,
        pro: true,
        max: true,
      },
    ],
  },
  {
    title: "AI",
    description: "Grounded in your repos and experiences — never invented.",
    rows: [
      {
        feature: "AI credits",
        free: "—",
        starter: "200 / month",
        pro: "750 / month",
        max: "3,000 / month",
      },
      {
        feature: "AI About",
        free: false,
        starter: true,
        pro: true,
        max: true,
      },
      {
        feature: "Role and stacks",
        free: false,
        starter: true,
        pro: true,
        max: true,
      },
      {
        feature: "Experience rewrite assists",
        free: false,
        starter: false,
        pro: true,
        max: true,
      },
    ],
  },
  {
    title: "Team",
    rows: [
      {
        feature: "Included seats",
        free: "1",
        starter: "1",
        pro: "1",
        max: "5",
      },
      {
        feature: "Extra seats",
        free: "—",
        starter: "$12/mo",
        pro: "$12/mo",
        max: "Included to 5, then $9",
      },
      {
        feature: "Priority support",
        free: false,
        starter: false,
        pro: true,
        max: true,
      },
    ],
  },
];

export type StackRow = {
  category: string;
  tools: string;
  from: string;
  note?: string;
};

export const stackRows: StackRow[] = [
  {
    category: "Portfolio sites",
    tools: "Read.cv $0–paid · Carrd $19/yr · Framer $15/mo",
    from: "from $2/mo",
  },
  {
    category: "Personal sites",
    tools: "Webflow $18/mo · Squarespace $16/mo · Cargo $19/mo",
    from: "from $16/mo",
  },
  {
    category: "Notion portfolios",
    tools: "Notion $10/mo · Super $16/mo · Potion $8/mo",
    from: "from $8/mo",
  },
  {
    category: "Resume builders",
    tools: "Teal $9/mo · Rezi $29/mo · Enhancv $25/mo",
    from: "from $9/mo",
  },
  {
    category: "GitHub showcases",
    tools: "GitHub Pages free · custom theme upkeep",
    from: "from $0",
  },
  {
    category: "AI writing",
    tools: "ChatGPT $20/mo · Claude $20/mo · Jasper $39/mo",
    from: "from $20/mo",
  },
  {
    category: "Link-in-bio",
    tools: "Linktree $9/mo · Beacons $10/mo",
    from: "from $9/mo",
  },
];

export const testimonials = [
  {
    name: "Maya Chen",
    role: "Staff engineer",
    quote:
      "I stopped maintaining a Notion page, a Carrd, and a half-broken GitHub README. Rows just syncs the work and lets me shape the story.",
  },
  {
    name: "Jonah Reid",
    role: "Product designer",
    quote:
      "The About draft actually used my repos. I edited two sentences and published. That alone was worth switching.",
  },
  {
    name: "Priya Nair",
    role: "ML engineer",
    quote:
      "Hugging Face and GitHub in one profile was the missing piece. Recruiters finally see both sides of my work.",
  },
  {
    name: "Alex Ortiz",
    role: "Founding engineer",
    quote:
      "I used to rebuild my site every time I changed jobs. Now I update experiences and the public page stays current.",
  },
];
