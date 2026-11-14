# Rows — product plan

Status: draft, 2026-11-14. Builds on Phase 0 (GitHub OAuth, landing, placeholder pricing).

---

## 1. The bet in one sentence

**Rows turns a developer's GitHub and career history into one link a recruiter can read in 60 seconds.** You paste it into LinkedIn, your resume or an application. Later, those same profiles become a talent pool that recruiters search instead of LinkedIn.

### Why this gap exists

- **Recruiters can't read GitHub.** A repo list, a contribution graph and a README written for other engineers tell a non-technical recruiter almost nothing.
- **LinkedIn can't verify skills.** Anyone can type "React, 5 years". Nobody can see the work behind it.
- **The resume throws the evidence away.** It says "built a payments service" with no link, no stack and no proof.

Rows sits in between. It reads the real work from GitHub, translates it into a recruiter's language, and keeps the evidence one click away.

### What we learned from others

Pretty developer profiles alone haven't made a business. Read.cv and Polywork both shut down in 2025. Rows has to be **useful to the person who reads the profile** (the recruiter), not just nice for the person who owns it. That's why every decision below is judged from the recruiter's side.

---

## 2. Sequencing: wedge first, marketplace later

There are two ideas here, and they need to happen in this order:

| | A. Shareable link (wedge) | B. Recruiter search (marketplace) |
|---|---|---|
| Who gets value | The candidate, alone, on day one | Recruiters, once enough candidates exist |
| Cold-start problem | None: one user, one link | Severe: an empty search is worthless |
| Growth loop | Every shared link is an ad seen by recruiters | Needs supply first |
| Who pays | Candidates (low, episodic) | Recruiters / companies (high, recurring) |

**Decision: build A now and design it so it fills B's supply.** Every profile is structured data from day one: stack, seniority, recency, location and availability. When B launches, the pool already exists. Recruiters who open shared links are the first recruiter users, so B's demand side starts from A as well.

Don't build recruiter search until a single niche has about **1–2k opted-in, searchable profiles**. Below that, search results disappoint and recruiters don't come back.

### Pick one beachhead

Launch for one group, not "all developers". Choose one where the link solves a sharp problem. Some options:

1. **Devs in Brazil / Portugal applying to international remote roles.** They compete with candidates they can't easily stand out from, and English-language recruiters are filtering them fast. The "readable in 60 seconds" promise matters most here.
2. **Junior / bootcamp graduates.** They have little job history, so GitHub projects are their whole case. Bootcamps can also bring cohorts in bulk (see §6).
3. **Senior engineers with mostly private work.** Their story is hard to show, which needs the private-repo aggregates (§3.4).

Recommendation: **option 1**, with bootcamps from option 2 as the supply channel. Landing copy, examples and the first 100 users all come from that group.

---

## 3. The product: what a recruiter sees

The public page (`rows.so/u/[username]`) has two audiences. It shows the **recruiter view by default**, with a toggle to the full developer view.

### 3.1 The 60-second header

Above the fold, with no scrolling:

- Name, photo, one-line headline ("Backend engineer · Go & Postgres · 4 yrs")
- **AI summary**: 3 sentences in plain English covering what they build, at what level, and what they want next
- Stack chips **with evidence**: "TypeScript: 14 repos, last commit 3 days ago". Not a self-rating.
- Status: open to work / role types / remote or on-site / location and timezone / work authorization (optional)
- Two actions: **Download resume (PDF)** and **Contact**

### 3.2 Projects, translated

Every pinned repo becomes a card written for a non-engineer:

- **What it is**, in one plain sentence ("A booking system for a dental clinic, used in production")
- **Their role**: sole author / main contributor / contributor (from commit share)
- **Stack**, with a link to a live demo when one exists
- **Signals** a recruiter can trust: commit count and span, recency, tests/CI present, stars, deployments
- "See the code" link for the engineer the recruiter forwards it to

**Grounding rule:** every AI sentence has to trace back to repo data (README, languages, commits, package files). The UI marks what's **verified from GitHub** and what's **self-reported**. That distinction is the whole advantage over LinkedIn, so it never gets blurred.

### 3.3 Experience timeline

Jobs and education, with projects linked to the job they came from (the planned `experience_projects` table). Sources, in order of effort for the user:

1. **Resume upload (PDF/DOCX)**, parsed by AI into experiences. This is the main path.
2. **LinkedIn import**, through the profile's "Save to PDF" or LinkedIn's data export (`Positions.csv`). See §4 for why it can't use the API.
3. Manual edit for everything.

### 3.4 Private work (later in Phase 1)

Most professional code is private. An optional GitHub App install with read access to private repos would show **aggregates only**: languages, commit volume over time, repo count per organization. No code, names or descriptions unless the user opts in per repo. This makes Rows work for senior devs, not just juniors with public side projects.

Merged PRs to other people's well-known open-source repos get their own section. It's one of the strongest signals a recruiter can get.

---

## 4. The LinkedIn integration, realistically

**LinkedIn won't let us read profiles.** "Sign In with LinkedIn" (OpenID Connect) returns only name, email and photo. Work history isn't available to apps like ours, and LinkedIn sues scrapers (Proxycurl shut down in 2025 after a LinkedIn lawsuit). So:

- **Reading LinkedIn** = the user uploads their LinkedIn PDF or data export. AI parses it. We never scrape.
- **Writing to LinkedIn** = we make it trivial for the user to put the Rows link there, and make the link look great when it's there.

That second part is the "link inside LinkedIn" idea, and it's mostly **design work, not an integration**:

| Placement | What Rows provides |
|---|---|
| **Featured section** | LinkedIn shows the link's OG image as a large card. Rows generates a **dynamic OG image that is a mini resume**: name, headline, top stack, a project, plus "View portfolio". This image is the most important pixel real estate in the product. |
| Contact info → Website | Short, clean URL: `rows.so/caio` (drop the `/u/` prefix later) |
| Headline / About | Copy suggestions with the link ("Portfolio + verified projects → rows.so/caio") |
| Banner image | Optional generated banner in the same visual style |
| Posts | "I'm open to work" post template that unfurls the same card |

A guided **"Add to LinkedIn" checklist** after publishing walks through each placement with copy buttons and deep links.

---

## 5. Share links and tracking (what people pay for)

Candidates pay when Rows helps them **in an active job search**. Two features do that:

1. **Tailored links per application.** The user pastes a job description. Rows reorders projects, rewrites the summary for that role (still grounded) and creates a link: `rows.so/caio/acme`. The PDF resume follows the same tailoring.
2. **View tracking per link.** "Your Acme link was opened 3 times. Last visit 2 h ago, 2 min on page, opened the payments project." Candidates hear nothing back after most applications, so knowing someone opened the link is the hook. Tracking is privacy-respecting: link-level, referrer and time on page. No fingerprinting, and no guessing which person viewed it.

These two features are the paid core. A free, untracked public profile stays free.

---

## 6. Pricing (replaces the placeholder in `src/lib/pricing.ts`)

The current Personal / Pro / Studio plans charge for the basic profile. That works against the plan: **free profiles are the supply for recruiter search.** Proposed:

| Plan | Price | For | Includes |
|---|---|---|---|
| **Free** | $0 | Everyone | Public profile, GitHub sync, AI project summaries, resume PDF, OG card, Rows badge |
| **Job Search** | ~$12/mo, or **$29 for a 3-month pass** | Active job search | Tailored links per job, view tracking, custom domain, no badge, every theme |
| **Bootcamps & schools** | per cohort seat | B2B2C supply channel | Profiles for a whole cohort, a cohort page, placement dashboard |
| **Recruiter** (Phase 4) | per seat/month | Demand side | Search, saved lists, outreach |

A job search is episodic: people pay for 2–4 months, then churn after they're hired. The 3-month pass prices that honestly, and the profile stays live for free afterwards, ready for the next search and for recruiter search.

---

## 7. Roadmap

Phase 0 is done: OAuth, users/accounts tables and the landing page.

### Phase 1: A profile a recruiter can read (MVP)

- `connected_accounts`, `projects`, `experiences`, `experience_projects` tables (already planned in `src/db/schema.ts`)
- GitHub repo sync, plus AI project cards (§3.2) with grounding and verified/self-reported labels
- Resume / LinkedIn-PDF import into experiences
- 60-second header (§3.1), recruiter view by default
- Public page, dynamic OG image, PDF resume export
- Onboarding: sign in → pick repos → upload resume → publish, in **under 5 minutes**

**Done when:** 50 users from the beachhead have published profiles, and recruiters in five user interviews can say what the candidate does after 60 seconds on the page.

### Phase 2: Share and track (start charging)

- "Add to LinkedIn" checklist (§4)
- Tailored links + tailored PDF (§5)
- Link-level view tracking and the candidate's dashboard
- Short URLs, custom domain, Job Search plan, Stripe

**Done when:** 10% of active profiles create a tailored link, and the first paid conversions come in.

### Phase 3: Recruiters show up (light demand side)

- A **"Contact"** button that routes recruiter messages to the candidate (with spam protection), so recruiters register with Rows
- Free recruiter accounts: save candidates, leave private notes
- Private-repo aggregates (§3.4)
- Bootcamp / cohort pages

**Done when:** a meaningful share of contact requests comes from repeat recruiters, which shows the pull exists.

### Phase 4: Talent search (the marketplace)

- Opt-in "searchable" flag for candidates, with control over what's visible
- Search by **verified** stack, recency, seniority, location/timezone, availability
- Paid recruiter seats

**Start when:** the beachhead has about 1–2k searchable profiles (§2).

---

## 8. Metrics

| Stage | Metric |
|---|---|
| Activation | Published profile with ≥3 summarized projects and ≥1 experience |
| Distribution | Profiles whose link was opened by someone other than the owner (the north star early on) |
| Recruiter value | Median time on page by visitors from linkedin.com or a tailored link; contact requests per 100 views |
| Revenue | Free → Job Search conversion; pass renewals |
| Outcome | Self-reported "got an interview through this link" (ask on the dashboard) |

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| AI summaries overclaim or invent | Grounding rule; each claim links to evidence; user approves every card before publishing |
| Sparse public GitHub for experienced devs | Resume import first; private-repo aggregates in Phase 3 |
| LinkedIn changes or blocks link previews | OG card works anywhere (email, Slack, ATS); LinkedIn is the first channel, not the only one |
| Users churn after getting hired | Profile stays live for free; recruiter search gives a reason to stay findable |
| Recruiter search launches too early | Hard threshold on supply per niche (§2) |
| Privacy of view tracking and private repos | Link-level tracking only; aggregate-only private stats; explicit opt-ins |

---

## 10. Decisions to make now

1. **Beachhead.** Recommended: devs in Brazil/Portugal targeting international remote roles.
2. **Free tier.** Recommended: yes, the base profile is free (changes the pricing page).
3. **Is recruiter search in scope for year one?** Recommended: Phase 3's light demand side yes, full search only after the supply threshold.
4. **Landing message.** It currently says "A developer portfolio that … gets you hired." Proposal: lead with the recruiter angle, e.g. *"Your GitHub, readable by recruiters."*
