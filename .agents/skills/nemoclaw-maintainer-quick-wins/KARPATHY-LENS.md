# Karpathy Review Lens

Applied to candidates that survive the judgment chain. Adapted from `andrej-karpathy-skills:karpathy-guidelines`. Same four checks, applied to someone else's code (PR mode) or our own (issue mode / salvage mode).

## 1. Hidden assumption scan

**Instruction:** Read the diff line-by-line. List every assumption the contributor made that **isn't stated** in the body or comments.

For each assumption, do one of:

- **Prove it safe** by grep/read of the other side of the boundary. Note the verification in conversation but don't dump into the PR comment.
- **Flag as a gap** if you can't prove it safe. Gap goes into the draft PR comment.

**Common assumption types:**

- "Assumes X exists" (file, env var, config key) — grep for the reader/creator
- "Assumes X is already validated/sanitized" — trace the input
- "Assumes this runs before/after Y" — check ordering in caller
- "Assumes no concurrent access" — check locking
- "Assumes default value is safe" — read the factory/constructor

**Live example (PR #2290):**

- Assumption: `$HOME` is not itself a symlink. Flagged to contributor as a limitation to document.
- Assumption: `lstatSync` check + subsequent `mkdirSync` is atomic. Proved unsafe (TOCTOU), documented as accepted tradeoff.
- Assumption: `shellQuote` is imported. Verified via `grep -n "shellQuote" src/lib/config-io.ts`. Safe.

## 2. Simplicity check

**Instruction:** Is there a smaller version that does the same thing? Count lines that **don't trace to the stated objective**.

**Flag:**

- Speculative flexibility / config knobs for no current user
- Error handling for impossible cases
- Premature abstractions
- New classes/utilities where a plain function would do
- Renaming done opportunistically
- Dead code added "for future use"

**Reminder:** The repo CLAUDE.md says: "No features beyond what was asked." Hold PRs to the same bar the contributor is held to.

**Live example (PR #1954):**

- `Math.min(token.length - 4, 20)` caps asterisks at 20. Description says "rest replaced with asterisks." Deviation from description is unexplained — either remove the cap or comment why. Flagged.

## 3. Surgical-changes check

**Instruction:** Scan for drive-by improvements **within in-scope files** — lines that don't trace to the stated objective but aren't in tangential files.

**Flag:**

- Formatting changes adjacent to the real edit
- Comment rewrites
- Variable renames not required by the fix
- "While I was here" deletions of code not referenced by the fix
- Whitespace-only diffs

**Distinction from scope check:**

- The Scope-Lens check catches *files* that don't belong.
- The Karpathy surgical check catches *lines within scope files* that don't belong.

## 4. Goal-driven verification

**Instruction:** Translate the PR/issue objective into a test-shaped verifiable goal. Example transformations:

| Stated objective | Verifiable goal |
|------------------|-----------------|
| "Add validation" | "A test with invalid input fails before this PR and passes after" |
| "Fix crash when X" | "A test reproducing X fails before, passes after" |
| "Redact token in URL" | "A test asserts the URL contains `****` after redaction and full token without" |

Then check: does such a test **actually exist** in the PR?

- If yes: verifiable. ✓
- If no: that becomes a required new test. Route it to tier 1 as a `missing-test`.

**Live example (PR #1954):**
Stated: "Redact the gateway auth token in dashboard URLs printed to stdout."
Verifiable goal: `expect(buildControlUiUrls("abcdefghij", 18789, true)[0]).toMatch(/#token=abcd\*+$/)`.
Existing tests: 7 in `dashboard.test.ts`, none cover `forDisplay=true`. Missing-test → tier-1 required → coverage-first failure → `BLOCK`.

## Output format

Per candidate surviving the judgment chain:

| Lens | Finding |
|------|---------|
| Hidden assumption | (file:line): ... |
| Simpler | ... |
| Surgical | ... |
| Verifiable goal | test exists / missing test: ... |

Feed the `missing-test` column directly into tier 1 testing as a required new test.

## Interaction with salvage

In salvage mode (we're writing the fix locally, not reviewing someone else's), the Karpathy lens applies to **our own diff** before calling it done. This is the cleanest form of the skill — self-review.

Rules are stricter in salvage mode because we control the outcome:

- Any missing-test goes in immediately, not as a "suggest for follow-up"
- Any hidden assumption gets a comment or a test
- Drive-by improvements are a firing offense — if we're salvaging, salvage only
