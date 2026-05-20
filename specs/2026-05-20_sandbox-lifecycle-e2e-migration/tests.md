# Test Specification: Sandbox Lifecycle E2E Scenario Migration

Generated from: `specs/2026-05-20_sandbox-lifecycle-e2e-migration/spec.md`

## Test Strategy

Use existing E2E scenario framework tests and shell helper tests. Prefer mocked command binaries, temporary `context.env`, dry-run execution, and plan-only scenario resolution. Do not require live Docker/OpenShell for unit or framework tests.

### Phase 1: Legacy Assertion Inventory and Parity Classification - Test Guide

**Existing Tests to Modify:**
- `test/e2e/scenario-framework-tests/e2e-legacy-assertion-inventory.test.ts`
  - Verify the scoped legacy scripts remain represented in the generated inventory.
- `test/e2e/scenario-framework-tests/e2e-parity-map.test.ts`
  - Verify every scoped assertion is mapped, deferred, or retired.
- `test/e2e/scenario-framework-tests/e2e-coverage-report.test.ts`
  - Verify sandbox lifecycle domains appear in coverage output.

**New Tests to Create:**
1. `test_should_classify_all_scoped_sandbox_lifecycle_assertions`
   - **Input**: `parity-map.yaml` entries for the four scoped legacy scripts.
   - **Expected**: No scoped assertion is uncategorized; mapped entries have IDs; deferred entries have owner/requirements; retired entries have reviewer/date.
   - **Covers**: Phase 1 acceptance criteria.
2. `test_should_use_validation_namespace_for_mapped_lifecycle_assertions`
   - **Input**: Mapped IDs for lifecycle, operations, and snapshot assertions.
   - **Expected**: IDs start with `validation.sandbox_lifecycle.`, `validation.sandbox_operations.`, or `validation.sandbox_snapshot.`.
   - **Covers**: Stable assertion ID requirements.

**Test Implementation Notes:**
- Keep assertions data-driven from the real parity map.
- Treat install/onboard assertions as retired or owned by setup/onboarding coverage, not lifecycle validation.

### Phase 2: Sandbox Lifecycle Primitive Library - Test Guide

**Existing Tests to Modify:**
- `test/e2e/scenario-framework-tests/e2e-lib-helpers.test.ts`
  - Add shell helper tests for `validation_suites/lib/sandbox_lifecycle.sh`.
- `test/e2e/scenario-framework-tests/e2e-context-helper.test.ts`
  - Reuse context fixture conventions for required key checks.

**New Tests to Create:**
1. `test_should_load_context_from_e2e_context_dir`
   - **Input**: Temporary `E2E_CONTEXT_DIR/context.env` with required sandbox/gateway keys.
   - **Expected**: `sandbox_lifecycle_load_context` succeeds through the existing `runtime/lib/context.sh` helper and exports expected values.
   - **Covers**: Context-first requirement and reuse of existing context conventions.
2. `test_should_fail_when_required_context_key_missing`
   - **Input**: Context missing sandbox name or gateway URL.
   - **Expected**: Helper exits non-zero with a stable failure message and no secret values.
   - **Covers**: Required-key validation and redaction.
3. `test_should_emit_stable_pass_and_fail_ids`
   - **Input**: Calls to pass/fail helpers.
   - **Expected**: Output contains `PASS: validation...` or `FAIL: validation...`.
   - **Covers**: Stable assertion ID emission.
4. `test_should_apply_timeout_to_command_execution`
   - **Input**: Mock command that sleeps beyond the helper timeout.
   - **Expected**: Helper exits non-zero within bounded time.
   - **Covers**: #2562 hang mitigation.
5. `test_should_validate_list_status_logs_exec_with_mocked_commands`
   - **Input**: Mock `nemoclaw`/`openshell` binaries returning expected output.
   - **Expected**: List, status, logs, and exec assertions pass and emit operation IDs.
   - **Covers**: Core sandbox operations assertions.
6. `test_should_validate_snapshot_marker_round_trip_with_mocked_commands`
   - **Input**: Mock snapshot create/list/restore command sequence.
   - **Expected**: Snapshot assertions emit marker/create/list/restore IDs.
   - **Covers**: Snapshot primitive behavior.

**Test Implementation Notes:**
- Use a temp `PATH` containing mock binaries.
- Run helper tests under `bash -euo pipefail` and `E2E_DRY_RUN=1` where appropriate.
- Assert failure output snippets are bounded and redacted.

### Phase 3: Lifecycle Suite Integration - Test Guide

**Existing Tests to Modify:**
- `test/e2e/scenario-framework-tests/e2e-suite-runner.test.ts`
  - Validate new suite scripts resolve and can run in dry-run/mocked mode.
- `test/e2e/scenario-framework-tests/e2e-scenario-resolver.test.ts`
  - Validate plan-only scenario resolution remains stable.
- `test/e2e/scenario-framework-tests/e2e-scenario-schema.test.ts`
  - Validate suite definitions and step schema.

**New Tests to Create:**
1. `test_should_define_domain_specific_lifecycle_suites`
   - **Input**: `test/e2e/validation_suites/suites.yaml`.
   - **Expected**: `sandbox-lifecycle` and `sandbox-operations` no longer reuse smoke anchors and reference domain scripts; destructive restore checks live in the opt-in `snapshot-lifecycle` suite.
   - **Covers**: Placeholder replacement and destructive-suite isolation.
2. `test_should_resolve_plan_only_for_ubuntu_repo_cloud_openclaw`
   - **Input**: `run-scenario.sh ubuntu-repo-cloud-openclaw --plan-only`.
   - **Expected**: Exit 0; lifecycle suite plan is visible where attached.
   - **Covers**: Plan-only preservation.
3. `test_should_not_attach_docker_lifecycle_suites_to_macos_or_negative_scenarios`
   - **Input**: Scenario YAML.
   - **Expected**: Unsupported scenarios do not include Docker/OpenShell-dependent lifecycle suites.
   - **Covers**: Scenario-aware requirements.

**Test Implementation Notes:**
- Prefer resolver tests over live execution.
- Assert `snapshot-lifecycle` is not attached to shared/default scenarios.

### Phase 4: Parity Map and Coverage Report Visibility - Test Guide

**Existing Tests to Modify:**
- `test/e2e/scenario-framework-tests/e2e-parity-map.test.ts`
- `test/e2e/scenario-framework-tests/e2e-coverage-report.test.ts`
- `test/e2e/scenario-framework-tests/e2e-metadata-final-hygiene.test.ts`

**New Tests to Create:**
1. `test_should_include_required_metadata_for_deferred_and_retired_lifecycle_entries`
   - **Input**: Scoped parity-map entries.
   - **Expected**: Deferred entries include owner and runner/secret requirement when applicable; retired entries include reviewer and approved date.
   - **Covers**: Metadata requirements.
2. `test_should_report_scoped_lifecycle_parity_at_or_above_100_percent`
   - **Input**: Coverage report generator output.
   - **Expected**: Scoped lifecycle bucket/domain shows all assertions accounted for by mapped/deferred/retired status.
   - **Covers**: Legacy parity validation.

**Test Implementation Notes:**
- Reuse existing coverage-report command rather than adding a parallel reporter.
- Keep the test scoped to the four legacy scripts named in the spec.

### Phase 5: PR-Open and Integration Verification - Test Guide

**Existing Tests to Run:**
- `npx vitest run test/e2e/scenario-framework-tests/e2e-suite-runner.test.ts`
- `npx vitest run test/e2e/scenario-framework-tests/e2e-scenario-resolver.test.ts`
- `npx vitest run test/e2e/scenario-framework-tests/e2e-parity-map.test.ts`
- `npx vitest run test/e2e/scenario-framework-tests/e2e-coverage-report.test.ts`

**New Tests to Create:**
1. `test_should_run_lifecycle_suites_with_mocked_context`
   - **Input**: Temporary context plus mock command binaries.
   - **Expected**: `run-suites.sh sandbox-lifecycle sandbox-operations` exits 0 and emits stable IDs.
   - **Covers**: Local integration validation.
2. `test_should_run_snapshot_lifecycle_suite_only_in_dry_run_or_isolated_context`
   - **Input**: `E2E_DRY_RUN=1` or explicit isolated context fixture.
   - **Expected**: `snapshot-lifecycle` suite exits 0 without touching shared state.
   - **Covers**: Snapshot safety.

**Test Implementation Notes:**
- PR CI proof can be documented in the PR body; it does not need a separate automated test.
- Live Docker/OpenShell validation remains optional unless an isolated prepared context exists.

### Phase 6: Clean the House - Test Guide

**Existing Checks to Run:**
- `npx prek run --all-files` or targeted equivalent when full hooks are too expensive.
- `git status --short` for intentional files only.

**New Tests to Create:**
1. `test_should_not_commit_temporary_e2e_debug_files`
   - **Input**: Final diff file list.
   - **Expected**: No temp logs, ad-hoc scripts, or generated debug artifacts are committed.
   - **Covers**: Cleanup acceptance criteria.

**Test Implementation Notes:**
- Prefer existing hygiene tests if they already flag temporary files.
- Update `test/e2e/docs/README.md` only if suite conventions change.
