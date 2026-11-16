# 0002. Read job postings from a link through Apify

Date: 2026-11-16 · Status: Accepted · Linear: CAI-87

## Context

The mock interview prototype (CAI-36) is built from the text of a job posting that the candidate pastes. The owner wants to paste a link instead: the page reads the posting, drops what is not about the job (mission, vision, values, benefits, legal text) and uses the rest as the interviewer's context.

A job page has to be loaded the way a browser loads it. Some boards answer plain HTTP in full (Lever, Greenhouse, Gupy), some only show text after their scripts run (Ashby), and some turn bots away. A Vercel function cannot run a headless browser. AGENTS.md section 4 says a new vendor needs an ADR.

## Decision

- Read the page with **Apify**, using its **RAG Web Browser** Actor (`apify/rag-web-browser`): one link in, one page of Markdown out. It is called through Apify's REST API with `fetch` (`run-sync-get-dataset-items`), so there is no new package. The token is `APIFY_TOKEN`, server only.
- Plain HTTP first, about 8 s. If the page comes back with no text, or the site turned plain HTTP away (401, 403, 429, 5xx), run once more in a real browser, 20 to 40 s. Either way the Actor charges about a quarter of a cent a page (per page fetched plus per GB of memory at start), so the difference is time, not money. Measured on 16 Nov 2026 with Greenhouse, Lever, Gupy, Ashby and LinkedIn pages.
- Claude (the small interview model) keeps the role, the responsibilities, the requirements, the nice-to-haves and the tools, and leaves out mission, vision, values, benefits, salary and legal text. It also says whether the page is one specific posting. The answer is a zod-validated structure, and the page text is untrusted data inside tags.
- A page that did not load (HTTP 400 or more), that redirected to a list or a search, or that the model does not call a single posting is reported as "no posting found". Without this a redirect can quietly give the interview another job: an expired LinkedIn link redirected to a search page whose first result was a different company's posting, with a full description.
- Only the link goes to Apify. The résumé, the candidate's words and the transcript do not.

## Consequences

- Easier: a candidate pastes a link, and the interviewer works from the requirements instead of from marketing text.
- Cost and abuse: each link costs Apify and Claude money, and the prototype has no login, so anyone who can open the page can spend it. A rate limit is a separate issue.
- Limits: pages that need a login and bot-protected sites can still fail, and the candidate then pastes the text. A public LinkedIn job page answered plain HTTP in full when tested (16 Nov 2026), with lists of similar jobs around it that the model must ignore, but LinkedIn can change that at any time. Apify has site-specific Actors for LinkedIn and others. They are paid and break often, so they are not used for now.
- Privacy: Apify is a third party that receives the pasted link. A link is not personal data in itself, but it can carry tracking parameters. It is listed here as AGENTS.md section 6 requires.
- Agents must not call Apify from anywhere except `src/features/interview-prototype/apify.ts`, and must not add another scraper without a new ADR.
