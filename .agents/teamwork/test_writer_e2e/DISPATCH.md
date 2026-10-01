# Dispatch Assignment: E2E Testing Track (Tiers 1–4 Test Suite & Harness)

## Assigned Agent
- Role: E2E Test Suite Engineer
- Archetype: teamwork_preview_test_writer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\test_writer_e2e\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

## Objective
Author the requirement-driven, opaque-box E2E test suite according to `TEST_INFRA.md` and `ORIGINAL_REQUEST.md`:
1. Read `D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY).
2. Read `TEST_INFRA.md`, `PROJECT.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`.
3. Design and implement the test harness in `tests/e2e/`:
   - Harness for testing sync requests, LWW conflict resolution, clock skew, idempotency, pagination, and outbox batching.
4. Implement the 4 tiers of test cases in Vitest:
   - **Tier 1 (Feature Coverage)**: ≥5 tests per feature covering all features in `TEST_INFRA.md`.
   - **Tier 2 (Boundary & Corner Cases)**: ≥5 tests per feature covering limits, clock skew (>5 min vs <=5 min), empty batches, max batch limits (200 mutations, 500 rows pagination), etc.
   - **Tier 3 (Cross-Feature Combinations)**: Pairwise tests testing concurrent edits, deletes, tombstone cascades, multi-entity batches.
   - **Tier 4 (Real-World Application Scenarios)**:
     * Two offline devices modifying the same habit concurrently and syncing deterministically.
     * Permanent habit deletion offline cascading tombstones to schedules and logs.
     * Rapid multi-edit coalescing into single payload and intermediate outbox cleanup.
     * Clock skew rejection with 409 `CLOCK_SKEW` returning `server_time`.
     * Pagination across multiple pages with `has_more: true` until exhausted.
5. Create and publish `TEST_READY.md` at project root with full coverage matrix and test runner instructions.
6. Verify all test files compile cleanly: `npm run typecheck`.
7. Write `handoff.md` and `progress.md` in your working directory and notify the parent orchestrator.

## Integrity Warning
DO NOT CHEAT. All test implementations must be genuine tests with real assertions verifying real logic.

## 2026-09-29T14:38:00Z
You are test_writer_e2e, a Test Writer subagent in the VibeHabit project.
Your identity and assignment:
- Role: E2E Test Suite Engineer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\test_writer_e2e\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

Instructions:
1. Read D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md (MANDATORY).
2. Read your assignment in D:\Informasi\WebHabit\.agents\teamwork\test_writer_e2e\DISPATCH.md.
3. Read TEST_INFRA.md at D:\Informasi\WebHabit\TEST_INFRA.md and PROJECT.md at D:\Informasi\WebHabit\PROJECT.md.
4. Implement the test harness and test suites in tests/e2e/ following the 4 tiers:
   - tests/e2e/harness/ (sync test harness, mock server/client, deterministic data generators)
   - tests/e2e/tier1-feature/ (>=5 tests per feature covering all features in TEST_INFRA.md)
   - tests/e2e/tier2-boundary/ (>=5 tests per feature covering boundary and edge cases)
   - tests/e2e/tier3-combination/ (pairwise cross-feature tests)
   - tests/e2e/tier4-scenarios/ (real-world application scenarios: 2 offline devices, replays, network drop, clock skew)
5. Create and publish TEST_READY.md at D:\Informasi\WebHabit\TEST_READY.md with full coverage summary and test runner command.
6. Run verification:
   - npm run typecheck
   Ensure all tests compile cleanly with 0 typecheck errors.
7. Write your handoff to D:\Informasi\WebHabit\.agents\teamwork\test_writer_e2e\handoff.md and send a completion message to your parent.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All test implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

