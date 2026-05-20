# Validation Plan: Sandbox Lifecycle E2E Scenario Migration

Generated from: `specs/2026-05-20_sandbox-lifecycle-e2e-migration/spec.md`
Test Spec: `specs/2026-05-20_sandbox-lifecycle-e2e-migration/tests.md`

## Overview

**Feature**: Migrate sandbox lifecycle E2E coverage into NemoClaw's layered scenario framework with domain suites, stable assertion IDs, and parity metadata.

**Available Tools**: Bash, Vitest, tsx, Git, scenario runner scripts, suite runner scripts, mocked shell command fixtures.

## Coverage Summary

- Happy Paths: 6 scenarios
- Sad Paths: 7 scenarios
- Total: 13 scenarios

---

## Phase 1: Legacy Assertion Inventory and Parity Classification - Validation Scenarios

### Scenario 1.1: Scoped legacy assertions are fully classified [STATUS: pending]
**Type**: Happy Path

**Given**: The four scoped legacy scripts are present in the generated assertion inventory.
**When**: The parity-map validator reads `test/e2e/docs/parity-map.yaml`.
**Then**: Every scoped assertion is classified as mapped, deferred, or retired with required metadata.

**Validation Steps**:
1. **Setup**: Bash: ensure dependencies are installed with `npm install` if needed.
2. **Execute**: Vitest: run `npx vitest run test/e2e/scenario-framework-tests/e2e-parity-map.test.ts`.
3. **Verify**: Bash/Git: inspect failures, if any, for uncategorized scoped assertions.

**Tools Required**: Bash, Vitest.

### Scenario 1.2: Invalid scoped parity metadata fails validation [STATUS: pending]
**Type**: Sad Path

**Given**: A scoped lifecycle assertion is deferred without owner or runner/secret requirement in a temporary fixture or targeted unit test.
**When**: The parity-map validation logic runs against that fixture.
**Then**: Validation fails with an actionable metadata error.

**Validation Steps**:
1. **Setup**: Vitest fixture: create or use an existing invalid parity-map fixture.
2. **Execute**: Vitest: run the metadata validation test.
3. **Verify**: Vitest: assert the error names the missing field and script.

**Tools Required**: Vitest.

## Phase 2: Sandbox Lifecycle Primitive Library - Validation Scenarios

### Scenario 2.1: Helper library validates lifecycle operations with mocked commands [STATUS: pending]
**Type**: Happy Path

**Given**: A temporary `E2E_CONTEXT_DIR/context.env` and mock `nemoclaw`/`openshell` commands return expected list, status, logs, exec, gateway, and snapshot outputs.
**When**: Helper-level tests source `validation_suites/lib/sandbox_lifecycle.sh` under `set -euo pipefail`.
**Then**: Helper assertions pass and emit stable `PASS: validation.sandbox_*` IDs.

**Validation Steps**:
1. **Setup**: Bash/Vitest: create temp context and prepend mock binaries to `PATH`.
2. **Execute**: Vitest: run `npx vitest run test/e2e/scenario-framework-tests/e2e-lib-helpers.test.ts`.
3. **Verify**: Vitest: assert stable IDs and exit code 0.

**Tools Required**: Bash, Vitest.

### Scenario 2.2: Missing context key fails without leaking secrets [STATUS: pending]
**Type**: Sad Path

**Given**: A temporary `context.env` missing a required sandbox or gateway key and containing a fake secret value.
**When**: `sandbox_lifecycle_load_context` runs.
**Then**: The helper exits non-zero, reports the missing key, and does not print the fake secret.

**Validation Steps**:
1. **Setup**: Bash/Vitest: create incomplete context fixture.
2. **Execute**: Bash: source the helper and call `sandbox_lifecycle_load_context`.
3. **Verify**: Vitest: assert non-zero exit, missing-key text, and no secret string.

**Tools Required**: Bash, Vitest.

### Scenario 2.3: Hung command is bounded by timeout [STATUS: pending]
**Type**: Sad Path

**Given**: A mock command sleeps longer than the lifecycle helper timeout.
**When**: `sandbox_lifecycle_run_with_timeout` executes the command.
**Then**: The helper fails within the configured/default bound and reports a timeout.

**Validation Steps**:
1. **Setup**: Bash/Vitest: create mock sleep command.
2. **Execute**: Bash: invoke the timeout helper.
3. **Verify**: Vitest: measure elapsed time and assert timeout output.

**Tools Required**: Bash, Vitest.

## Phase 3: Lifecycle Suite Integration - Validation Scenarios

### Scenario 3.1: Domain suites replace smoke aliases and resolve plan-only [STATUS: pending]
**Type**: Happy Path

**Given**: `suites.yaml` defines sandbox lifecycle, operations, and snapshot suites with domain scripts.
**When**: The scenario resolver runs `run-scenario.sh ubuntu-repo-cloud-openclaw --plan-only`.
**Then**: Plan-only resolution succeeds and includes valid suite steps without executing live Docker/OpenShell operations.

**Validation Steps**:
1. **Setup**: Bash: ensure scenario files are present.
2. **Execute**: Bash: run `test/e2e/runtime/run-scenario.sh ubuntu-repo-cloud-openclaw --plan-only`.
3. **Verify**: Bash/Vitest: confirm exit 0 and expected suite IDs.

**Tools Required**: Bash, scenario runner.

### Scenario 3.2: Unsupported scenarios do not receive Docker-dependent lifecycle suites [STATUS: pending]
**Type**: Sad Path

**Given**: macOS or negative preflight scenarios lack a running Docker/OpenShell sandbox.
**When**: Scenario metadata and suite attachment are validated.
**Then**: Docker/OpenShell-dependent lifecycle suites are not attached to those scenarios.

**Validation Steps**:
1. **Setup**: Vitest: load `scenarios.yaml` and suite definitions.
2. **Execute**: Vitest: run scenario resolver/schema tests.
3. **Verify**: Vitest: assert unsupported scenarios exclude lifecycle suites.

**Tools Required**: Vitest.

### Scenario 3.3: Snapshot suite remains isolated or opt-in [STATUS: pending]
**Type**: Sad Path

**Given**: Snapshot restore can mutate sandbox state.
**When**: Suite attachment is inspected for shared/default scenarios.
**Then**: Destructive restore validation is isolated in `snapshot-lifecycle` and attached only to isolated contexts/runners or executable only in dry-run/mocked validation.

**Validation Steps**:
1. **Setup**: Vitest: load scenario suite attachments.
2. **Execute**: Vitest: run suite attachment safety test.
3. **Verify**: Vitest: assert `snapshot-lifecycle` is opt-in or explicitly isolated and default `snapshot` coverage remains non-destructive.

**Tools Required**: Vitest.

## Phase 4: Parity Map and Coverage Report Visibility - Validation Scenarios

### Scenario 4.1: Coverage report shows lifecycle parity accounted for [STATUS: pending]
**Type**: Happy Path

**Given**: Parity-map entries for scoped lifecycle scripts are updated.
**When**: Coverage report tests/generator run.
**Then**: The scoped lifecycle domain reports 100% or greater accounted coverage through mapped, deferred, and retired entries.

**Validation Steps**:
1. **Setup**: Bash: ensure generated inventory is current if required.
2. **Execute**: Vitest: run `npx vitest run test/e2e/scenario-framework-tests/e2e-coverage-report.test.ts`.
3. **Verify**: Vitest/output: confirm lifecycle domain visibility and no uncategorized scoped assertions.

**Tools Required**: Bash, Vitest.

### Scenario 4.2: Duplicate mapped IDs are rejected unless explicitly reusable [STATUS: pending]
**Type**: Sad Path

**Given**: A parity-map fixture contains duplicate stable assertion IDs for semantically different assertions.
**When**: Parity-map validation runs.
**Then**: Validation fails unless the entry is explicitly marked reusable according to existing conventions.

**Validation Steps**:
1. **Setup**: Vitest fixture: create duplicate ID case.
2. **Execute**: Vitest: run parity-map validation test.
3. **Verify**: Vitest: assert duplicate-ID failure.

**Tools Required**: Vitest.

## Phase 5: PR-Open and Integration Verification - Validation Scenarios

### Scenario 5.1: Targeted framework and suite tests pass locally or in PR CI [STATUS: pending]
**Type**: Happy Path

**Given**: Implementation changes are complete.
**When**: Targeted scenario framework tests and mocked suite execution run.
**Then**: All added/changed tests pass and the PR description records commands and evidence.

**Validation Steps**:
1. **Setup**: Bash: install dependencies and prepare mock context.
2. **Execute**: Bash: run targeted `npx vitest run ...` commands and dry-run/mocked suite execution.
3. **Verify**: GitHub/CI or local logs: confirm tests pass and PR body includes validation evidence.

**Tools Required**: Bash, Vitest, GitHub CLI optional.

### Scenario 5.2: Suite failure emits stable assertion ID [STATUS: pending]
**Type**: Sad Path

**Given**: A mocked lifecycle command returns failure.
**When**: `run-suites.sh sandbox-lifecycle` executes with the mocked context.
**Then**: The suite exits non-zero and output includes `FAIL: validation.sandbox_*.<behavior>`.

**Validation Steps**:
1. **Setup**: Bash/Vitest: create failing mock command and context.
2. **Execute**: Bash: run the suite runner.
3. **Verify**: Vitest/Bash: assert non-zero exit and stable failure ID.

**Tools Required**: Bash, Vitest.

## Phase 6: Clean the House - Validation Scenarios

### Scenario 6.1: Final diff is scoped and free of temporary artifacts [STATUS: pending]
**Type**: Happy Path

**Given**: The implementation is ready for review.
**When**: Hygiene checks and `git status --short` run.
**Then**: Only intended E2E migration files are modified; no temp scripts, logs, or generated debug files remain.

**Validation Steps**:
1. **Setup**: Bash: complete implementation cleanup.
2. **Execute**: Bash: run targeted lint/format/hygiene checks and `git status --short`.
3. **Verify**: Bash/Git: inspect file list for intentional scope only.

**Tools Required**: Bash, Git, prek optional.

## Summary

| Phase | Happy | Sad | Total | Passed | Failed | Pending |
|-------|-------|-----|-------|--------|--------|---------|
| Phase 1 | 1 | 1 | 2 | 0 | 0 | 2 |
| Phase 2 | 1 | 2 | 3 | 0 | 0 | 3 |
| Phase 3 | 1 | 2 | 3 | 0 | 0 | 3 |
| Phase 4 | 1 | 1 | 2 | 0 | 0 | 2 |
| Phase 5 | 1 | 1 | 2 | 0 | 0 | 2 |
| Phase 6 | 1 | 0 | 1 | 0 | 0 | 1 |
| **Total** | **6** | **7** | **13** | **0** | **0** | **13** |
