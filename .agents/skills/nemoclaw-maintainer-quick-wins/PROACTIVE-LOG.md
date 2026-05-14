# Proactive Status Log

Parking lot for innovative / principal-engineer-grade ideas that surfaced while working on something else. These are **not** the minimum fix for any open ticket — they are follow-ups, refactors, substrate moves, or "while we're here" improvements that would otherwise bloat the active PR.

## How to use

- **While working a ticket:** if an idea is bigger than the minimum fix, drop it here. Do not expand scope of the active PR.
- **When idle / looking for proactive work:** pull the highest value/effort ratio item. Graduate it into a real issue + PR.
- **When picked up:** move the entry to a "Graduated" section at the bottom with a link to the issue/PR.
- **Stale after 60 days:** re-evaluate. If still valuable, keep. If not, delete.

## Entry format

```text
### [short title]
- **Origin:** session date / ticket that spawned it
- **Effort:** S (<2h) / M (half-day) / L (multi-day)
- **Value:** low / med / high
- **Pitch:** one line on why this matters
- **Notes:** optional — constraints, risks, file pointers
```

---

## Entries

### Transactional onboard / saga pattern for sandbox creation

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** L
- **Value:** high
- **Pitch:** `createSandbox` in `src/lib/onboard.ts:3298+` has 8 phases and no rollback. Any mid-flight failure (port conflict, gateway handshake, forward start) leaves inconsistent state split across openshell + local registry — "ghost sandbox" bugs are the symptom, not the root. A try/finally saga would close this entire class of bugs, not one instance.
- **Notes:** #2174 only needs a narrow `openshell sandbox destroy` on one failure path. The proactive version is a generalized rollback registry that every phase pushes an inverse onto.

### Generalize port allocation as a registry, not singletons

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** M
- **Value:** med-high
- **Pitch:** `src/lib/ports.ts` exports singletons (`DASHBOARD_PORT`, `GATEWAY_PORT`, `VLLM_PORT`, `OLLAMA_PORT`, `OLLAMA_PROXY_PORT`). Multi-sandbox world makes each of these an N-sandbox collision. Dashboard is the first to bite — gateway and ollama are next. One `PortAllocator` with per-sandbox reservations fixes all of them at once.
- **Notes:** Depends on registry having per-sandbox port fields (which #2174 adds for dashboard). Would expand to gateway/ollama later.

### `listForwards()` typed helper

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** S
- **Value:** low-med
- **Pitch:** Inline `openshell forward list` parsing at `src/lib/onboard.ts:6044` (and probably elsewhere — grep). Ad-hoc whitespace-splitting per call site is brittle and untested. Single typed helper `listForwards(): Forward[]` with column-parse tests is a clean 30-line cleanup.
- **Notes:** Pure refactor, no behavior change. Good warm-up task.

### `CHAT_UI_URL` as derived value, not stored env var

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** M
- **Value:** med
- **Pitch:** `CHAT_UI_URL` is read via `process.env` in 8+ places across `onboard.ts` and `dashboard.ts`. It's really a function of `(sandboxName, chosenPort, hostname)`. Consolidate into one `resolveDashboardUrl(sandbox)` that reads the registry, with env-var precedence at one seam. Kills a class of "which CHAT_UI_URL wins" confusion.
- **Notes:** Second time this has caused friction (first was #1925, now #2174). Pattern: storage-vs-derivation confusion.

### Build Mode E (issue-first scoring) for quick-wins skill

- **Origin:** 2026-04-24, self-referential (this skill's SKILL.md says "not built yet")
- **Effort:** S
- **Value:** med
- **Pitch:** The skill already supports `--mode E` but scoring is unspecified. Today's session scored 4 issues by hand. Formalize: `ease × impact × staleness` with label-based ease signals (`good first issue`, `help wanted`, `has-repro-steps`) and impact signals (`priority: high`, `security`, `blocks-N-tests`). Mirrors Mode D shape.
- **Notes:** Natural-language scoring was fine for 4 issues; doesn't scale. Would want to add an `ISSUE-MODE.md` adjacent to `JUDGMENT-CHAIN.md`.

### Verify #1178 is same silent-steal class as #2174

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** S (investigation)
- **Value:** med (closes another ticket if true)
- **Pitch:** Caroline-xuan's intermittent Brev dashboard-unhealthy (#1178) was filed during v0.0.20 (silent-steal era). May be a stale symptom already closed by v0.0.21 guard + whatever #2174's fix ships. After #2174 lands, re-ask for repro logs; may be auto-closed.
- **Notes:** Low priority on its own, but cheap to check and closes a ticket.

### Coordinate #2100 (E2E dashboard reachability) with port auto-alloc

- **Origin:** 2026-04-24, #2174 deep dive
- **Effort:** S (comment on #2100)
- **Value:** med
- **Pitch:** If #2174 ships port auto-alloc, #2100's E2E test can't hardcode `18789` — it must read `dashboardPort` from registry or `nemoclaw <name> status`. Post a comment on #2100 or in the #2174 PR description so evantakahashi knows before they write the script.
- **Notes:** Small coordination cost now avoids a post-merge regression of the E2E.

### Fix captureForwardList exit-status check in dashboard recovery

- **Origin:** 2026-04-24, #2398 review
- **Effort:** S (1-line fix + test)
- **Value:** low-med
- **Pitch:** `src/nemoclaw.ts:287-290` — `captureOpenshell` always returns `{status, output}`, so `fwdResult ? fwdResult.output : null` never catches failures. Non-zero exits leak CLI noise into `verifyForward` which parses it as column rows. Flagged 3× by CodeRabbit on PR #2398, deferred to keep scope minimum.
- **Notes:** Fix: `return fwdResult && fwdResult.status === 0 ? fwdResult.output : null;`. Only fires on recovery path.

### Integration test for two-sandbox onboard flow (#2174 follow-up)

- **Origin:** 2026-04-24, #2174 implementation
- **Effort:** M (requires real openshell or invasive module mocking)
- **Value:** med
- **Pitch:** #2174's fix is covered by unit tests at the decision layer (picker, flag parsing, display). The end-to-end "two onboards back-to-back + mid-flight failure rolls back openshell" assertion isn't in the unit suite because `ensureDashboardForward` pulls in `runOpenshell`/`runCaptureOpenshell` from a CJS require that resists vitest mocking. Best landed as either (a) an E2E test on Brev or (b) a refactor that makes the openshell runner injectable.
- **Notes:** If (b), pairs nicely with the "`listForwards()` typed helper" entry above — both are part of the "make openshell calls seamable" theme.

### Cache subshell init in scripts/install.sh

- **Origin:** 2026-04-24, install-preflight flake investigation
- **Effort:** S (~30 LOC)
- **Value:** med (helps real installs too, not just the test)
- **Pitch:** `scripts/install.sh` runs `resolve_installer_version()` and `NEMOCLAW_SOURCE_ROOT="$(resolve_repo_root)"` at source time — each is a subshell, and `resolve_installer_version` can fork `git describe --tags`. On busy CI runners or local workstations with parallel installers, these fork/exec calls serialize on macOS and add real latency. This is the root cause of the install-preflight vitest flake we just patched with a per-test 15s timeout. Caching the resolved values at first call (`: "${_NEMOCLAW_VERSION_CACHE:=$(resolve_installer_version)}"`) would cut ~5 subprocess spawns per install invocation and let us drop the special-case test timeout.
- **Notes:** Applies to production installer behavior, not just tests. Low risk — the resolved values don't change within a single script invocation.

### Thread WSL/platform hints into recovery buildChain call

- **Origin:** 2026-04-24, #2398 review
- **Effort:** S (thread two params)
- **Value:** med (platform-specific regression risk)
- **Pitch:** `src/nemoclaw.ts:371` passes only `{chatUiUrl, port}` to `buildChain`, dropping `isWsl`/`wslHostAddress`. On WSL after a sandbox crash, recovery rebuilds a loopback-only forward target — same bug class as #2342 which this PR otherwise fixes. Flagged by CodeRabbit, deferred from #2398 to keep scope minimum.
- **Notes:** Mirror the hint derivation in `onboard.ts:6511-6513` (`printDashboard`) so recovery and onboard use the same resolved chain.

---

## Graduated

(empty — items move here with a link once picked up)
