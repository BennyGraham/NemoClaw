# Tiered Testing

Only run tiers after judgment chain + Karpathy lens survive. Stop at the first tier that fails.

## Tier 0 — Setup (once per candidate)

**Goal:** isolated workspace that doesn't touch the active branch.

```bash
# Fetch PR into a local branch
git fetch origin pull/<PR>/head:pr-<PR>-review

# Create worktree
git worktree add /tmp/nc-pr-<PR> pr-<PR>-review

# Install deps — see the fallback path below
```

### Node modules fallback (learned 2026-04-23)

`npm install` inside a worktree can hit a semver resolution bug ("Invalid Version: " from `@rolldown/binding-wasm32-wasi` or similar). When the lockfile is close to identical to the main checkout, symlink `node_modules` instead:

```bash
# REPO_ROOT = your main checkout (e.g. the absolute path of the repo where you ran this skill)
rm -rf /tmp/nc-pr-<PR>/node_modules
ln -s "$REPO_ROOT/node_modules" /tmp/nc-pr-<PR>/node_modules
```

This works when the PR didn't change `package-lock.json`. If it did, try `NEMOCLAW_INSTALLING=1 npm install --include=dev --no-audit --no-fund --ignore-scripts` first; if that fails with the semver bug, fall back to symlink and note the limitation in the tier 1 report.

Also create a **main worktree for baseline comparison** when total failures > 0:

```bash
git worktree add /tmp/nc-main origin/main
ln -s "$REPO_ROOT/node_modules" /tmp/nc-main/node_modules
```

### Cleanup (after run)

```bash
git worktree remove /tmp/nc-pr-<PR>
git worktree remove /tmp/nc-main
git branch -D pr-<PR>-review
```

## Tier 1 — Static + unit (local, seconds)

Run in this order:

1. **Targeted tests first** — the specific `*.test.ts` files covering the changed source:

   ```bash
   cd /tmp/nc-pr-<PR>
   node_modules/.bin/vitest run --project cli src/lib/<file>.test.ts
   ```

   (Don't use `npx vitest` — it fetches a fresh vitest from the npx cache which can't resolve `vitest/config`. Always use `node_modules/.bin/vitest`.)

2. **CLI typecheck:**

   ```bash
   node_modules/.bin/tsc -p tsconfig.cli.json
   ```

3. **Plugin build:**

   ```bash
   cd nemoclaw && node_modules/.bin/tsc -p tsconfig.json && cd ..
   ```

4. **Missing-test injection** — if Karpathy flagged a missing test, write it, confirm it **fails on main** and **passes on the PR branch**. Fail-on-both or pass-on-both → the stated objective is wrong → flag and stop.

5. **Full CLI suite** (only if targeted pass):

   ```bash
   node_modules/.bin/vitest run --project cli
   ```

6. **Baseline diff on failures** — if total failures > 0:

   ```bash
   cd /tmp/nc-main && node_modules/.bin/vitest run --project cli <failing-test-file>
   ```

   If the same tests fail on main, flag as pre-existing infra, not regression.

7. **Lint + format on changed files only:**

   ```bash
   node_modules/.bin/eslint <changed-files>
   node_modules/.bin/prettier --check <changed-files>
   ```

   Note: repo's `format:check` only covers `bin/`, `scripts/`, `test/` — files in `src/` may show drift that isn't a PR regression. Report but don't block.

## Tier 2 — Local integration (local Docker, minutes)

Triggered when the diff touches any of:

- `nemoclaw/src/blueprint/` — sandbox orchestration
- `nemoclaw-blueprint/policies/` — egress policy YAML
- `src/lib/runner.ts` — sandbox runner
- `src/lib/inference.ts` — inference routing
- `src/lib/credentials.ts` — credential helpers
- `src/lib/onboard.ts` — onboard orchestration
- **Expanded (learned 2026-04-23):** any `src/lib/*` that reads/writes under `~/.nemoclaw` — `config-io.ts`, `safe-dir.ts`, `onboard-session.ts`, `registry.ts`

### What to run

Spin a local OpenClaw sandbox via the blueprint in Docker, exercise the affected code path. Use existing integration harnesses where present; don't invent new ones for a single review.

For policy/egress changes: replay recorded blocked-request fixtures if present. Skip to tier 3 only if no local fixture exists.

## Tier 3 — Brev E2E (cloud, 18–20 min, costs real money)

**Only run if both:**

- (a) touches risky areas per `RISKY-AREAS.md`, AND
- (b) no pre-existing E2E covers the touched path

**Interactive gate (mandatory unless `--confirm-brev off` explicitly):**

Report finalists with one-line justifications, wait for confirmation:

```text
Finalists for Brev E2E ($$ gated):
- #NNNN: <reason>
- #NNNN: <reason>
Proceed?
```

**Test suite auto-selection from diff:**

- credential: changes under `src/lib/credentials*`, `src/lib/config-io.ts`, `onboard*`
- telegram: changes under `*telegram*`, messaging channel config
- messaging: changes under `*slack*`, `*discord*`, `*whatsapp*`, `nemoclaw-blueprint/policies/`
- full: changes under `nemoclaw/src/blueprint/runner.ts`, blueprint lifecycle
- all: changes spanning 3+ of the above

**Cloud-runner image state:** pre-baked image not yet available. Cold-boot penalty paid on every tier-3 run. When the team's container-image-publishing plan lands, swap it in — see `LESSONS-LEARNED.md` improvement backlog.

## Routing decision tree

```text
Did diff touch tier-2 paths?
├── No  → run tier 1 only, stop there
└── Yes → run tier 1, then tier 2
         │
         Did diff touch RISKY-AREAS paths?
         ├── No  → stop after tier 2
         └── Yes → check if pre-existing E2E covers the path
                   ├── Yes → stop after tier 2
                   └── No  → gate on user, then tier 3
```

## Report format

Per candidate:

| Check | Result | Detail |
|-------|--------|--------|
| PR's own tests | ✅/❌ (N/M pass) | file:test-name |
| Typecheck | ✅/❌ | exit code |
| Full suite | ✅/❌ no regressions | X passed, Y failed |
| Baseline on main | N/A / ✅ / ❌ | same failures reproduce? |
| Lint | ✅ / ⚠️ / ❌ | scoped to changed files |
| Format | ✅ / ⚠️ pre-existing | noted drift outside PR scope |
| Tier 2 | skipped / ✅ / ❌ | what was exercised |
| Tier 3 | skipped / ✅ / ❌ | suite selected, cost |
