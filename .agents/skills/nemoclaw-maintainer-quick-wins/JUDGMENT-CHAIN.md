# Judgment Chain — two-lens review

Run per candidate, fail-fast. A failure here skips Karpathy + testing and routes to the appropriate outcome.

This chain encodes two complementary review lenses that surface different classes of problem:

- **Scope & Coverage Lens** — Is the PR doing one thing, and is the risky path tested? Catches grab-bag PRs, scope drift, and untested behavior changes on critical code.
- **Substrate Sequencing Lens** — Is the PR the right *size* and shape? Catches PRs that should be split into substrate-first, then-fix steps (extract helper → test → land fix on top).

The labels "Scope Lens" and "Sequencing Lens" are how this skill refers to them. Each team will recognize their own version of these two reviewer archetypes.

## 1. Scope check (Scope Lens)

**Question:** Does the PR have one clear objective, or is it a grab-bag?

**Red flags:**

- Unrelated config churn (editor settings, tsconfig tweaks)
- Drive-by refactors in files tangential to the stated fix
- Tool-setting diffs bundled with a behavior fix
- Multiple "bonus" fixes in the body

**Outcome:** Grab-bag → `RESHAPE`. Ask the author to revert the extraneous changes to main and keep one objective.

**Reference example:** A PR stated "reject symlinks on `~/.nemoclaw`" but also migrated 8 call sites across two packages and did a `process.env.HOME` cleanup. Routed to `SEQUENCE` (see check 4).

## 2. Intent preservation

**Question:** Does the diff match what the contributor / linked issue described?

**Red flags:**

- Semantic drift (body says "fix X", diff changes Y)
- Test plan checklist items unchecked `[ ]` for behavior claims
- Linked issue's acceptance criteria not addressed

**Outcome:** Semantic drift → stop, flag, ask. Don't proceed to coverage/size checks; the reshape decision depends on what the author actually meant.

## 3. Coverage-first framing (Scope Lens)

**Question:** Are the risky code paths covered by some test, in this PR or pre-existing?

**Risky paths** come from `.agents/skills/nemoclaw-maintainer-day/RISKY-AREAS.md` (or the equivalent risky-paths registry in your repo):

- Installer / bootstrap shell (`install.sh`, `setup.sh`, `scripts/*.sh`)
- Onboarding / host glue (`src/lib/onboard.ts`, CLI launcher)
- Sandbox / policy / SSRF (security-critical paths)
- Workflow / enforcement (`.github/workflows/`, prek hooks, DCO)
- Credentials / inference / network (credential helpers, inference routing, approval flows)

**Extended set** — credential-adjacent paths like `src/lib/config-io.ts`, `src/lib/safe-dir.ts` — anything that reads/writes under `~/.<your-tool>`.

**Outcome:** Risky path touched with no test → `BLOCK` regardless of how clean the diff looks. The underlying principle: **automated behavioral verification is just testing.** If the behavior isn't tested, the team can't tell whether a future refactor broke it.

**Reference example:** A PR touched `src/lib/agent-onboard.ts` (risky: onboarding). Zero tests added for the new behavior even though sibling tests for the same function existed. Verdict: `BLOCK`.

## 4. Substrate-first slicing (Sequencing Lens)

**Question:** Is the PR the right *size*?

**Principle:** Extract helper → add tests for current behavior → land fix on top. One file cluster per pass.

**Red flags:**

- A "fix" that's actually a redesign
- New utility + migration of many call sites in one PR
- Cross-package changes without a clear split

**Outcome:** Too big / multi-step disguised as single → `SEQUENCE`. Propose the split explicitly.

**Reference example:** A PR was right-intent / wrong-shape. Proposed split:

1. PR 1: add `safe-dir.ts` + unit tests (for both packages)
2. PR 2: migrate 7 non-`config-io` call sites
3. PR 3 (optional): orthogonal `process.env.HOME → os.homedir()` cleanup

## Output format

Per candidate, produce a pass/fail table:

| Check | Result | Notes |
|-------|--------|-------|
| Scope | ✅ / ❌ | — |
| Intent | ✅ / ❌ | — |
| Coverage | ✅ / ❌ | risky paths: ... tests: ... |
| Size / Sequencing | ✅ / ❌ | lines, files, split proposal if needed |

Then the routing decision (APPROVE-path / RESHAPE / BLOCK / SEQUENCE) and whether to proceed to the Karpathy lens.

## Note on the team's review philosophy

The two-lens framing here encodes the consensus the team has formed about what makes a mergeable PR — scope discipline + size discipline. Each team will have its own variant. If your repo maintains a written log of review principles (decisions made over time about what's blocking vs. nit, what's risky-area, what's an acceptable scope), this skill should treat that log as the source of truth and adapt the lens questions to match.

## New verdicts added post-spec

- `CLOSE-AS-SUPERSEDED` — added after a PR turned out to already be fixed in a sibling merged PR. The same-fix-check step runs *before* the judgment chain to catch this early.
