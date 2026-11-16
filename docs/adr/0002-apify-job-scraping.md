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

## Update: the link is read when it is entered (CAI-89, 16 Nov 2026)

- The form reads the link as soon as the "Job posting URL" field holds a complete one (on paste, or after a pause in typing), not when the interview starts, so the person sees at once whether it worked. The read is a Server Action (`read-job.ts`) used by the interview page; the separate route for it is gone. The decision above is unchanged.
- Cost: a read now happens even if no interview follows. The form reads one link at a time, never reads the same link twice in a visit, and reads nothing while the person is typing. Next.js sends Server Actions one at a time, so a read that was started for a link the person has since replaced delays the next one. There is still no rate limit, and the page still has no login.

## Update: the Actor's own server instead of a run per link (CAI-94, 16 Nov 2026)

- Each read used to start an Actor run (`run-sync-get-dataset-items`), and the run starts a container first. A plain read of a static Lever page took **8.1 s** of run time for a page that loads in about 1 s, and a link took 12 to 15 s from paste to green check (Ashby 24 s).
- The Actor also runs as a server that is always up. The app now calls it directly: `GET https://rag-web-browser.apify.actor/search` with the link as the `query`, `maxResults=1`, `outputFormats=markdown` and `scrapingTool` (`raw-http`, then `browser-playwright` as before). The token is still a Bearer header and never part of the address. The answer has the same items as before. Only the way of calling it changed; the vendor, the Actor and what is sent are the same.
- Cost: the server is multi-tenant and bills per page read (US$ 0.00228 on the free tier), with no start event, so a read costs a little less than before.
- The function now logs how long each read took and how long the model took (milliseconds, status, text length and tokens), never the link or the text, so the next speed-up is aimed at what is slow.

## Update: waking the Actor's server when the page opens (CAI-95, 16 Nov 2026)

- After hours without use, the first reads on the current build were slow even though warm reads take 1 to 4 s for the page: LinkedIn's plain read took 7 s, Lever's plain read hung until its 15 s limit, and Ashby's browser read came back with 26 characters, so Ashby was reported as "no posting found".
- When the interview page opens it now asks the server, without waiting, to read a fixed public page (`https://example.com/`) both ways, plain and in a browser. It is a Server Action that answers at once and does the reads after the response (`after()`): Next.js sends Server Actions one at a time, so a warm-up that held the line would delay a link pasted right after the page opens. The reads are in `apify.ts` (`warmUp`), the only file that talks to Apify.
- Nothing about the person or the job is sent: only the fixed address, with the same token header. A warm-up that fails is ignored and logged as a number and a kind of failure.
- Cost: two page reads, about US$ 0.0046 on the free tier, at most once every 4 minutes per server instance. The page has no login, so anyone who opens it can start one; the limit keeps that bounded but is per instance, not global.
