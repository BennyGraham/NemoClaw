# Lessons Learned — Live-Run Findings

Each entry is a concrete finding from running the workflow. Read this first when invoking the skill; it encodes tradeoffs that a cold spec couldn't predict.

## First live run

**Candidates picked:** 3 PRs (mode D, top 3 from a 147-PR pool).
**Time to verdict:** ~90 minutes of conversation for all three.
**Outcomes:** 1 APPROVE + RFR, 1 BLOCK + salvage offer, 1 CLOSE-AS-SUPERSEDED. Then a 4th added → SEQUENCE.

### Finding 1 — Same-fix-already-merged detection is mandatory

**What happened:** A 1-line Dockerfile fix ranked in the top 10 because labels looked good and diff was tiny. Turned out the same fix had already shipped as a sibling PR merged that same day. Wasted ~15 min of review before catching it.

**Fix to bake in:** Before the judgment chain, for every candidate PR, search merged PRs in the last 14 days. Match on:

- Title token overlap ≥70%, OR
- Same linked issue number in body

```bash
gh pr list --repo <owner>/<repo> --state merged --search "merged:>=$(date -v-14d +%Y-%m-%d)" \
  --json number,title,body,mergedAt
```

If hit: verdict `CLOSE-AS-SUPERSEDED`, skip all further tiers.

### Finding 2 — GraphQL 502 on heavy fields in bulk queries

**What happened:** `gh pr list ... --json ...statusCheckRollup,mergeStateStatus,files` 502'd repeatedly. Dropping those fields made it work.

**Fix to bake in:** Two-pass fetch.

- Pass 1 (bulk, lightweight): `number,title,author,labels,createdAt,additions,deletions,isDraft`
- Pass 2 (per-finalist, heavy): `body,mergeStateStatus,statusCheckRollup,files,reviewDecision`

Don't combine. Don't retry the heavy bulk query more than once.

### Finding 3 — Worktree `npm install` can hit semver bugs

**What happened:** `npm install` in `/tmp/<repo>-pr-<PR>` threw `Invalid Version:` from a wasm-binding dedupe. Fresh install from cache was corrupted. Also: `prepare` script runs `npm install --omit=dev` which skips vitest.

**Fix to bake in:** Skip per-worktree install. Symlink `node_modules` from the main checkout:

```bash
rm -rf /tmp/<repo>-pr-<PR>/node_modules
ln -s <main-checkout>/node_modules /tmp/<repo>-pr-<PR>/node_modules
```

Works when lockfile is close to identical. If the PR changed `package-lock.json`, try `<INSTALLING_FLAG>=1 npm install --include=dev --no-audit --no-fund --ignore-scripts` once, fall back to symlink.

### Finding 4 — Tier 2 routing list is too narrow

**What happened:** A PR modified credential directory handling. Not in tier-2 routing list, so tier 2 was skipped. Got away with it because tests were thorough and Karpathy surfaced no gaps, but a less-tested PR at this level would slip through.

**Fix to bake in:** Extend tier 2 triggers to include any path that reads/writes under `~/.<your-tool>`. Specifically: `config-io.ts`, `safe-dir.ts`, `onboard-session.ts`, `registry.ts`, `usage-notice.ts`.

Better long-term: derive tier 2 from `RISKY-AREAS.md` (or equivalent) directly instead of a hardcoded list.

### Finding 5 — Baseline diff on failures is not optional

**What happened:** Tier 1 full suite reported 15 failures in `test/install-preflight.test.ts`. Looked like regressions. Ran the same file on `origin/main` — 15 failures reproduced. Pre-existing infra (curl-pipe tests fail with exit 127 in restricted shells).

**Fix to bake in:** When tier-1 total failures > 0, automatically create a second worktree at `origin/main` and re-run the failing test files. Any tests that fail on main too are pre-existing, not regressions. Report them separately from actual regressions.

### Finding 6 — Unchecked `[ ]` test-plan boxes are a risk signal

**What happened:** A PR's body had:

```text
- [x] npm run build:cli — compiles cleanly
- [ ] Manual: nemoclaw onboard shows redacted token
- [ ] Manual: full token still retrievable
```

Two unchecked items for behavior claims, on a risky-area path. That's a coverage-lens failure surfaceable from the body alone.

**Fix to bake in:** Parse the PR body for `[ ]` patterns. If any unchecked test-plan item AND the PR touches a risky-area path → auto-flag for coverage review, before even reading the diff. Counts as evidence for the Coverage check 3 verdict.

### Finding 7 — New verdict: `CLOSE-AS-SUPERSEDED`

Not in the original spec. Needed because same-fix-already-merged is a real category that isn't BLOCK (PR isn't wrong) or RESHAPE (there's nothing to reshape). Now in the verdict table.

### Finding 8 — New verdict: `SEQUENCE` is load-bearing

**What happened:** A PR was right-intent / wrong-shape: a new utility + migration of 8 call sites + a bonus cleanup, all in one PR. Not a BLOCK (not broken). Not a RESHAPE (can't just revert one file). The correct response is "split this into 3 PRs."

**Fix to bake in:** When routing to SEQUENCE, the draft comment **must propose a concrete split**. Template:

```text
Agree with the intent. Asking to split this before merge:
1. PR 1: <substrate — new utility + tests>
2. PR 2: <migration — call sites in bounded cluster>
3. PR 3 (optional): <orthogonal cleanup>
```

Without the proposed split, the SEQUENCE verdict isn't actionable.

### Finding 9 — Status ledger needs clickable links

**Maintainer feedback:** "add links to all these" — referring to the ledger and every PR mention.

**Fix to bake in:** Every PR number in every output (ledger, findings tables, draft comments, workflow summaries) renders as `[#NNNN](url)`. Never use bare `#NNNN`.

### Finding 10 — RFR format is different from the draft PR comment

**Maintainer feedback:** First RFR attempt included line counts, test counts, CI status. Correction: "brief but impactful."

**Rule:**

- Draft PR comment (to the author): ≤30 lines, includes specifics (verdict, blockers, suggestions, test details) because the author needs actionable context.
- RFR (to peer reviewers in chat / Slack): 2 lines total, impact-first, NO engineering details. Reviewers click through to the PR for details.

Different audiences, different density.

### Finding 11 — "Merge now" vs "fix first" must be unambiguous

**Maintainer feedback:** Draft comment combined "LGTM" with "two minor follow-ups (non-blocking)." Author can't tell whether to merge or address the notes first.

**Rule:** Pick one of two shapes. Don't mix.

- **APPROVE, merge-as-is:** no listed follow-ups in the comment. File any genuinely-useful thoughts as a follow-up issue instead.
- **REQUEST_CHANGES, fix first:** explicit list, no LGTM.

The ambiguous middle ("approve with concerns") creates round-trips and wastes the contributor's time.

---

## Improvement backlog (not yet baked in)

Flag these as TODO next time this skill runs:

- **Pre-baked CI runner image** — Cuts tier 3 wall time from ~18 min to ~3 min when it lands. Blocks on the team's container-image-publishing plan.
- **Behavioral-test auto-selection** — the previous skill iteration's e2e auto-selection logic is referenced but not present. Useful for tier 3 auto-suite-pick.
- **Weight tuning for mode D** — first-run weights (`w1=2, w2=1.5, ...`) produced reasonable rankings but an obsolete PR landed at score 4.85 in the top 10, proving label signal alone isn't enough. After the same-fix check is in, re-tune.
- **Auto-detect RESHAPE vs SEQUENCE** — currently both are made by eye. A rough heuristic: changed-files count > 5 AND new-file count > 0 → likely SEQUENCE. Changed-files includes unrelated areas → likely RESHAPE. Prototype and check against past judgments.
- **Posting-to-GitHub path** — when the maintainer authorizes, add a `--post` flag that uses the draft comment / RFR / close-as-superseded outputs. Currently everything stays local.
- **Issue mode (E) reactivation** — parked. Build `ISSUE-MODE.md` and re-enable for issue-first quick-wins when the team wants it.
