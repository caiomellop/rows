# Landing design spec — nav bar, hero, pricing

Reference: **eden.so** (home + `/pricing/`), studied 2026-11-14.
Audience: coding agents building the Rows marketing pages (`/` and `/pricing`).

This spec copies Eden's **layout, proportions, type scale, spacing and weights**. It does **not** copy Eden's copy, logo, product screenshots or brand. All text in the examples is Rows placeholder copy.

> **How the numbers were measured.** Exact values (sizes, `clamp()`s, radii, shadows, colors) come from Eden's production HTML and its compiled Tailwind CSS. Nav-bar sizes come from screenshots: Eden renders its nav on the client, so the nav isn't in the server HTML. The screenshots were taken at **1.5× device scale (viewport ≈ 1263 CSS px)**, so every screenshot pixel was divided by 1.5. That ratio checks out: the hero subtitle `clamp(…,1.65vw,1.28rem)` measures 28 px line height = 20.5 px × 1.375. Values marked **≈** come from screenshots. Check them in a browser against the reference.

---

## 1. Fonts

Eden uses EB Garamond for headings and Figtree for everything else, plus a custom wordmark face. Rows uses the same split, with **Geist** taking the wordmark and "subtitle" roles.

| Role | Font | Weight | Notes |
|---|---|---|---|
| Hero `h1`, every `h2`/`h3` (section titles, plan names) | **EB Garamond** | 400 (regular). Italic 400 for the accent phrase | Headings are never bold. The thin, high-contrast serif is the whole look |
| Logo wordmark | **Geist** | 600 | Tight tracking `-0.04em`. Eden uses 650 in Inter Tight |
| Subtitles: hero subtitle, eyebrows ("Pricing", "Creator plans"), billing badge | **Geist** | 400 subtitle / 500 eyebrows | |
| Paragraphs, nav links, buttons, plan descriptions, feature lists, prices | **Figtree** | 400 body / 500 buttons & labels / 600 `<strong>` | Eden's body font. Price numerals use `tabular-nums` |

Load them with `next/font/google` the same way `src/app/layout.tsx` already does (replace the current Fraunces/Outfit):

```tsx
import { EB_Garamond, Figtree, Geist } from "next/font/google";

const serif = EB_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600"] });
const sans  = Figtree({ variable: "--font-sans", subsets: ["latin"] }); // variable font, 400–800
```

> AGENTS.md: this repo's Next.js version may differ from what you know. Check `node_modules/next/dist/docs/` for the font API before you write this code. `node_modules` was not installed when this spec was written.

Eden's heading rule is worth copying as-is. It makes *every* heading Garamond by default and italicizes the accent span inside `h1`/`h2`:

```css
:is(h1, h2, h3, h4, h5, h6):not(.font-sans) {
  font-family: var(--font-serif), Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.01em;          /* this beats Tailwind's tracking-tight on headings */
}
:is(h1, h2):not(.font-sans) .text-accent { font-style: italic; }
```

---

## 2. Color tokens (light is the default)

Eden stores colors as space-separated RGB channels so that `rgb(var(--x) / alpha)` works. It also aliases Tailwind's `white` to `--c-ink`, so the same `border-white/[0.14]` reads as a light hairline in dark mode and a dark hairline in light mode. In Rows, use an `ink` color for this instead of redefining `white`.

| Token | Light (default) | Dark | Used for |
|---|---|---|---|
| `--page` | `252 252 250` `#FCFCFA` | `10 10 10` | Page background (warm off-white) |
| `--card` | `255 255 255` | `20 20 20` | Plan cards |
| `--panel` / `--surface-subtle` | `245 244 241` `#F5F4F1` | `26 26 26` | Group panels, tab tracks |
| `--ink` | `17 17 17` `#111` | `255 255 255` | Base for every alpha tint (`ink/5`, `ink/14`…) |
| `--text-primary` | `17 17 17` | `245 245 245` | Emphasis, prices, headings in cards |
| `--text-secondary` | `82 80 76` `#52504C` | `163 163 163` | Hero `h1` (non-accent part), body copy, nav links |
| `--text-muted` | `112 110 105` `#706E69` | `115 115 115` | "Billed $X/year", "Everything in …", footnotes |
| `--accent` | `17 17 17` | `250 250 250` | Italic accent phrase, eyebrows. **Not a hue: it's full-strength ink** |
| `--border` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.08)` | Card borders, nav bottom border |
| `--border-subtle` | `rgba(0,0,0,.05)` | `rgba(255,255,255,.04)` | Divider above feature lists |
| `--cta-to` | `43 43 43` `#2B2B2B` | `232 232 232` | Bottom stop of the primary-button gradient |
| selection | `rgba(92,151,118,.28)` | — | The only hint of color: a muted sage |

Tailwind v4 (`globals.css` uses `@theme inline`):

```css
:root {
  --page: 252 252 250; --card: 255 255 255; --panel: 245 244 241;
  --ink: 17 17 17; --text-primary: 17 17 17; --text-secondary: 82 80 76; --text-muted: 112 110 105;
  --accent: 17 17 17; --cta-to: 43 43 43;
  --border: rgba(0,0,0,.08); --border-subtle: rgba(0,0,0,.05);
}
@theme inline {
  --color-page: rgb(var(--page)); --color-card: rgb(var(--card)); --color-panel: rgb(var(--panel));
  --color-ink: rgb(var(--ink)); --color-fg: rgb(var(--text-primary));
  --color-fg-2: rgb(var(--text-secondary)); --color-fg-3: rgb(var(--text-muted));
  --color-accent: rgb(var(--accent)); --color-line: var(--border); --color-line-subtle: var(--border-subtle);
  --font-serif: var(--font-serif); --font-geist: var(--font-geist); --font-sans: var(--font-sans);
}
body { background: rgb(var(--page)); color: rgb(var(--text-primary)); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
```

The palette is **monochrome**. All depth comes from alpha tints of ink, hairline borders and soft layered shadows. Don't add a brand hue to buttons or highlights.

---

## 3. Shared components

### 3.1 Primary button (dark, gradient)

Used for the nav CTA, hero CTA, featured plan CTA and Team CTA.

```
bg: linear-gradient(to bottom, rgb(var(--ink)), rgb(var(--cta-to)))   /* #111 → #2B2B2B */
color: rgb(var(--page))
font: Figtree 500, letter-spacing -0.035em (tracking-tight)
shadow: inset 0 1px 0 rgba(255,255,255,.18),
        0 1px 1.5px rgba(0,0,0,.16),
        0 3px 6px -1px rgba(0,0,0,.22),
        0 8px 14px -4px rgba(0,0,0,.18)
hover: translateY(-2px); shadow grows to
        inset 0 1px 0 rgba(255,255,255,.22), 0 1px 2px rgba(0,0,0,.18),
        0 5px 10px -1px rgba(0,0,0,.26), 0 12px 22px -4px rgba(0,0,0,.22)
active: translateY(0)
transition: all 200ms ease-out
```

| Variant | Radius | Padding | Font size | Rendered size |
|---|---|---|---|---|
| Hero CTA | `rounded-xl` 12px | `px-6 py-2 sm:py-2.5` | `0.9rem` → `sm:0.95rem` | ≈ 146 × 45 px, label + `→` icon, `gap-1.5` |
| Nav CTA | 12px | ≈ `px-5` | ≈ 15px | ≈ 107 × 38 px, no icon |
| Plan / Team CTA | `rounded-full` | `px-4 py-2` (plan) / `px-5 py-2.5` (Team) | `0.85rem` / `0.88rem` | Plan CTAs are full card width, label + `→` |

### 3.2 Secondary button (light pill)

`rounded-full border border-ink/14 bg-ink/5 px-4 py-2 text-[0.85rem] font-medium text-fg`. Hover: `border-ink/22 bg-ink/9`. Full width in plan cards, label + `→` icon (`gap-1.5`).

### 3.3 Dotted-grid background

The page is mostly flat `#FCFCFA` with a faint dot grid that fades out from a corner or from the center:

```css
background-image: radial-gradient(rgba(17,17,17,.11) 1px, transparent 1.4px);
background-size: 24px 24px;
background-position: 12px 12px;
mask-image: radial-gradient(farthest-side at 0 0, #000 0, rgba(0,0,0,.5) 45%, transparent 100%); /* corner fade */
```

- Home hero: dots across the whole fold, masked `radial-gradient(85% 85% at 50% 38%, #000 45%, transparent 100%)`. Eden draws this on a `<canvas>`. A CSS gradient looks the same.
- Section frames (each section after the hero): a 460 px-tall dot patch in the **top-left** corner, then the **top-right** corner on the next section, alternating. Dots at `.13` alpha.
- Optional grain: a 180 px SVG `feTurbulence` noise tile at `opacity: .07` over the hero.

### 3.4 Arrow icon

A thin `→` (lucide `ArrowRight`, 16px, stroke 2) after CTA labels, `gap-1.5`. On hover it may move `translate-x-0.5`.

---

## 4. Nav bar

Measured from screenshots (≈). It looks the same on `/` and `/pricing`.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [■] Rows                          Features  Teams  Pricing  Download  Help  Sign in [Start] │  ≈66px
└──────────────────────────────────────────────────────────────────────────────────────────┘  1px border-bottom
```

| Part | Spec |
|---|---|
| Container | Full width, **no max-width**, `px-8` (32px) each side. `flex items-center justify-between` |
| Height | ≈ 66px plus a 1px bottom border `--border` (`rgba(0,0,0,.08)`) |
| Background | Same as page (`#FCFCFA`). Make it `sticky top-0 z-50` with `bg-page/80 backdrop-blur-md` so content scrolls under it. Eden's nav slides away with `translateY(-100%)` in one state, so it is fixed/sticky |
| Logo mark | ≈ 26px square, dark (`#111`) fill, ≈ 6–7px radius, white glyph |
| Wordmark | **Geist 600**, ≈ 22px, `tracking-[-0.04em]`, `#111`. ≈ 7px gap after the mark |
| Links | **Figtree 400, ≈ 15px**, color `--text-secondary` `#52504C`. Hover: `--text-primary`. ≈ 20px between labels (`gap-5`, or `px-2.5` hit areas with no gap). Right-aligned, grouped with the CTA |
| Link set | Product links (Features, Pricing, …), then **Sign in** as a plain link, then the CTA. ≈ 20px from "Sign in" to the CTA |
| CTA | Primary button (§3.1), ≈ 38px tall, 12px radius. Label changes by page: "Try risk-free" on home, "Start free" on pricing. Rows: "Get started" → `/auth/signin`, or the signed-in state from `LandingCta` |
| Mobile (< `md`) | Not observed (the nav is client-rendered). Recommended: keep logo + CTA, put the links in a menu button that opens a full-width sheet styled like the cards |

---

## 5. Home hero

```
                          [ nav ]
           (dot grid fading out from center, very faint)

                 Finally, one place to            ← Garamond 400, #52504C
                   save your best ideas.|          ← Garamond italic 400, #111, typing caret

     Save anything, research millions of posts, schedule everywhere,    ← subtitle
        and run your whole store and email list in one place.

                     [ Try risk-free → ]

                [ Research | Sell | Save | Launch ]   ← segmented tabs above a product preview
```

### Layout

| Element | Value |
|---|---|
| Section | `relative overflow-x-clip text-center px-5 md:px-8`, `pt-[clamp(80px,12vh,128px)]`, `pb-[clamp(2.5rem,5vw,4rem)]` |
| Stack | h1 → `mb-6` (24px) → subtitle → `mb-5` (20px) → CTA row |
| CTA row | `flex flex-col sm:flex-row gap-2.5 sm:gap-3.5 items-center justify-center` (supports a second button) |
| Below the fold | Product preview starts `mt-[clamp(3.25rem,7vw,6rem)]`, `max-w-[1320px]`, 13px radius, big soft shadow `0 55px 150px -50px rgba(0,0,0,.95)` (lighter in light mode) |

### `h1`

| Property | Value |
|---|---|
| Font | EB Garamond 400 |
| Size | `clamp(2.4rem, 5vw, 4.1rem)` → 38.4px … **65.6px** |
| Line height | `1.05` |
| Letter spacing | `-0.01em` (from the heading rule; Tailwind `tracking-tight` loses) |
| Color | `--text-secondary` `#52504C` for the lead-in |
| Width | `max-w-[820px] mx-auto`, `text-wrap: balance` |

**Accent line.** The second line is a separate `display: grid` span, so it **always sits on its own line**. It is colored `--accent` (`#111`, darker than the lead-in) and set in *italic*. The contrast between the gray roman lead-in and the black italic line is the signature of this design.

**Typing rotation.** The accent phrase types and deletes through a list (e.g. "save your best ideas.", "publish original content.", …). To keep the layout from jumping, every phrase is rendered `invisible` in the same grid cell (`[grid-area:1/1]`). The cell then sizes to the longest phrase, and only the live phrase is visible on top. Caret:

```css
.caret { display:inline-block; width:3px; height:.85em; margin-left:.25rem; transform:translateY(.08em);
         border-radius:9999px; background: rgb(var(--accent)); animation: caret 1.05s steps(1) infinite; }
@keyframes caret { 0%,49% { opacity:1 } 50%,100% { opacity:0 } }
```

Accessibility: put the full sentence in an `sr-only` span and mark the animated copy `aria-hidden`. Under `prefers-reduced-motion`, show the first phrase statically.

### Subtitle

| Property | Value |
|---|---|
| Font | **Geist 400** (Eden uses Figtree here; Geist per Rows' type mapping) |
| Size | `clamp(0.98rem, 1.65vw, 1.28rem)` → 15.7px … **20.5px** |
| Line height | `1.375` (`leading-snug`) |
| Color | `--text-secondary`. **Key phrases** wrapped in `<span class="text-fg">` (`#111`) so they read as a skim line |
| Width | `max-w-[680px] mx-auto`, `text-balance`. Breaks to 2 lines on desktop |

### Segmented tabs (optional; switches the product preview)

Track: `inline-flex gap-0.5 rounded-[14px] border border-ink/8 bg-ink/[0.03] p-1 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,.04)]`.
Tab: `rounded-[10px] px-3 sm:px-5 py-1.5 text-[13.5px] font-medium tracking-[-0.01em]`. Active: `bg-ink/9 text-fg`. Idle: `text-ink/45 hover:text-ink/80`. Transition colors 300ms.

### Floating theme toggle (optional)

Bottom-right, fixed. A pill with sun and moon icon buttons; the active one sits in a light-gray circle. Card shadow.

---

## 6. Pricing page

### 6.1 Pricing hero

```
                              Pricing                    ← eyebrow
              Plans for curators,                        ← Garamond, gray + black italic
             creators, and teams
      Save ideas, articles, and videos from anywhere…    ← 3-line subtitle
```

| Element | Value |
|---|---|
| Section | `relative overflow-hidden px-6 md:px-8 pt-[clamp(5rem,10vw,8rem)] pb-[clamp(4rem,8vw,6rem)]` |
| Inner | `max-w-3xl` (768px) `mx-auto text-center` |
| Eyebrow | **Geist 500**, `0.82rem` (13px), `tracking-[-0.01em]`, `--accent` (#111), `mb-5`. Not uppercase |
| `h1` | Garamond 400, `clamp(2.65rem, 6vw, 4.7rem)` → **75px max**, line height **`0.98`** (tighter than home), `-0.01em`, `text-balance`, `--text-secondary` |
| Accent | The noun phrase is wrapped in `.text-accent` → black italic. Here it can wrap mid-phrase (no grid span) |
| Subtitle | `mt-6 max-w-2xl mx-auto text-balance`, `clamp(1rem, 1.7vw, 1.16rem)` (18.5px max), `leading-relaxed` **1.625** (airier than the home hero), `--text-secondary`. Geist 400 |
| Glow | A 900×480 radial white glow, centered at the top, `blur-2xl`. Barely visible on light |

### 6.2 Plans area

The body below the hero sits inside a frame: `border-t border-line` plus the corner dot patch (§3.3).

| Element | Value |
|---|---|
| Container | `max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 py-[clamp(3.5rem,7vw,5.5rem)] space-y-5` |
| Order | Billing toggle → plan group(s) → "Or start free" strip → Team card → Enterprise card → footnote |

**Billing toggle** (centered, `pb-1`):

- Track: `inline-flex gap-1 rounded-full border border-ink/10 bg-ink/[0.04] p-1`, shadow `inset 0 1px 0 rgba(255,255,255,.04), 0 2px 10px rgba(0,0,0,.35)` (in light mode the screenshot shows a soft drop shadow, so use `0 2px 10px rgba(0,0,0,.08)`).
- Option: `rounded-full px-4 py-1.5 text-[0.85rem] capitalize`. Idle: `border border-transparent text-fg-2 hover:text-fg`. Active: `border-ink/16 bg-ink/10 text-fg`.
- Savings badge inside the active option: `ml-2 rounded-full bg-accent/12 px-1.5 py-0.5 text-[0.68rem]` (Geist). Text like "Save up to 17%". `capitalize` turns it into "Save Up To 17%".
- Default is **annual**.

**Plan group panel** (Eden has two: "Curator plans" with 2 cards and "Creator plans" with 3 cards. Rows can use a single group):

- Panel: `rounded-[24px] border border-line p-4 sm:p-5 lg:p-6`, bg `ink/[0.015]` (a hair darker than the page). The highlighted group adds `radial-gradient(circle at 70% 0%, rgba(255,255,255,.05), transparent 38%)`.
- Header row: `mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1`.
  - Left: eyebrow (Geist 500, `0.82rem`, `-0.01em`; `--text-muted` on a secondary group, `--accent` on the main one), then `h2` Garamond 400 `1.45rem` (23px) `mt-1`.
  - Right: description, Figtree `0.82rem` `leading-snug` `max-w-md` `--text-secondary`, bottom-aligned with the h2.
- Grid: `grid items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3`.

**Plan card**

```
┌──────────────────────────────┐   rounded 18px, 1px --border, bg white, p-6 (24px)
│ Pro                          │   h3 Garamond 400 1.3rem (21px)
│ For creators who treat…      │   mt-2, 0.875rem, leading-normal, fg-2, min-h-[3.25rem] (keeps prices aligned)
│                              │
│ $66 /month                   │   mt-5 · amount 2.15rem (34px) leading-none tabular-nums fg · "/month" 0.78rem fg-2 pb-1, gap-1, items-end
│ Billed $790/year             │   mt-1 0.74rem fg-3 tabular-nums min-h-5
│ [      Choose Pro  →       ] │   mt-4, full-width pill (primary on featured, secondary otherwise)
│ ──────────────────────────── │   mt-5 border-t --border-subtle pt-5
│ Everything in Starter        │   0.75rem font-medium fg-3 mb-1
│ ✓ Feature line               │   space-y-2.5 · flex items-start gap-2 · 0.875rem leading-normal fg-2 · check icon 14–16px fg
│ ✓ Feature line               │
└──────────────────────────────┘
```

- Card: `relative flex h-full flex-col rounded-[18px] border border-line bg-card p-6`. The feature `ul` is `flex-1`, so the cards in a row match in height.
- Card shadow, light mode: very soft. Use about `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -18px rgba(0,0,0,.12)` (≈ from screenshot). Eden's dark value is `0 2px 10px rgba(0,0,0,.35), 0 18px 40px -22px rgba(0,0,0,.55)`.
- Price numerals: Figtree 400 (Eden's prices are sans, not serif, despite their class names). The size jump (34px against 12px "/month") does the work, so don't bold them.
- Highlighted feature lines (`text-fg` instead of `fg-2`): a `<strong className="font-semibold">` or an underlined link (`underline decoration-accent/45 underline-offset-2 hover:decoration-accent`).
- A muted last line works as a "not included" note (`text-fg-3`).

**Featured ("Most popular") card**

- Same card, with a stronger border (`border-ink/35` → about `rgba(17,17,17,.35)`, mid-gray) and a deeper shadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 18px 45px -18px rgba(0,0,0,.25)`. The background stays white in light mode.
- Badge: `absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[0.68rem] font-medium`, dark gradient bg (same as the primary button), `text-page`, shadow `0 4px 14px -4px rgba(0,0,0,.5)`.
- Its CTA is the **primary** dark pill. Every other card uses the secondary pill.

**"Or start free" strip**

`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-[20px] border border-line bg-ink/[0.015] px-5 py-4`. Text `0.92rem leading-snug fg-2` with the lead phrase in `text-fg`. Secondary pill on the right (`shrink-0`).

**Team card** (optional)

`rounded-[24px] border border-ink/16 p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5`. Eyebrow + `h2` Garamond `1.35rem` + paragraph `0.86rem leading-snug max-w-2xl`. Right side: price `1.9rem` + `/month 0.78rem`, a trial note `0.74rem`, and a primary pill `px-5 py-2.5 text-[0.88rem]` with `→`.

**Enterprise card** (optional)

Same frame with `border-line`. `h2` Garamond `1.25rem`, paragraph `0.86rem`. Button: `rounded-full border border-line bg-card px-5 py-2.5 text-[0.88rem] font-medium` + `→`.

**Footnote**: `pt-1 text-center text-[0.8rem] text-fg-3`.

### 6.3 Further down the pricing page (not needed for the first pass)

Eden continues with testimonials, an interactive email-cost calculator, a full comparison table (sticky header row with a plan name, price and CTA per column; rows grouped under category headers; `—` for "not included", a check icon for included), a "what you can cancel" cost stack, and a closing CTA band. Add these later if needed.

---

## 7. Proportion cheat-sheet (desktop, ~1263–1440px viewport)

| Thing | Size |
|---|---|
| Nav height | ≈ 66px |
| Home `h1` | 65.6px / 1.05 |
| Pricing `h1` | 75px / 0.98 |
| Hero subtitle | 20.5px / 1.375 (home) · 18.5px / 1.625 (pricing) |
| Eyebrow | 13px |
| Section `h2` | 23px |
| Plan name `h3` | 21px |
| Price | 34px |
| Body / features | 14px / 1.5 |
| Small print | 12px |
| Card radius / padding | 18px / 24px |
| Group panel radius | 24px |
| Card grid gap | 14px |
| Hero CTA | ≈ 146 × 45px, radius 12px |
| Page max width (pricing) | 1240px |

**Weight scale is narrow on purpose.** Headings use 400, UI labels 500, inline emphasis 600, and nothing goes above that. Hierarchy comes from **size, serif against sans, gray against black, and roman against italic**, not from boldness.

## 8. Build checklist for Rows

1. Swap the fonts in `src/app/layout.tsx` (§1). Add the tokens to `src/app/globals.css` (§2). Add the global heading rule.
2. `src/components/site-nav.tsx`: logo (mark + "Rows" wordmark in Geist), links (Features, Pricing, Sign in), and a CTA that reuses the signed-in/out logic of `LandingCta`.
3. `src/app/page.tsx`: replace the current hero with §5. Accent phrases are Rows-specific (e.g. "show your best work.", "sync your GitHub.", "publish your profile."). Write your own copy; don't reuse Eden's.
4. `src/app/pricing/page.tsx`: §6.1 + §6.2 with Rows plans (names, prices and features are TBD: ask the product owner).
5. Shared `Button` component (primary/secondary × default/pill) per §3.1–3.2.
6. Check against the reference at 390px, 768px, 1263px and 1440px. Below `sm` the plan grid becomes one column and the group header stacks.
