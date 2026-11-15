# 0001. One issue, one branch, one PR

Date: 2026-11-15 · Status: Accepted · Linear: CAI-58 (MVP-48)

## Context

On 13–14 Nov 2026 the repository collected 23 branches and 20 PRs in two days. Several coding agents built the same feature (the Phase 1 profile) in parallel with incompatible schemas, some PRs targeted other feature branches instead of `main`, branch names did not link to Linear, and nothing deleted branches after merge. Untangling it took a full triage (MVP-02) and two PRs had to be closed unmerged.

## Decision

- Linear is the only task list. Each issue maps to exactly one branch and one PR against `main`.
- The PR title starts with the issue ID and the description says `Closes CAI-XX`.
- One agent per issue; at most two issues in progress, and only one of them may change the database schema.
- Large issues are split into sub-issues before coding.
- `main` is protected: PR required, CI (`ci`) must pass, squash merge only, force pushes and deletion blocked, head branches deleted after merge.
- The rules live in `AGENTS.md`; `CLAUDE.md` imports it so every agent reads the same file.

## Consequences

- Work is serialized on purpose. Throughput is limited by review, not by how many agents can run at once.
- A PR that does not follow the rules is closed, not fixed up.
- GitHub settings must be applied by the repository owner; the coding-agent sessions cannot change them.
