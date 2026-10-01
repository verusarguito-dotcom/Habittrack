# E2E Test Infra: VibeHabit Sync Engine & Local-First Client

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md`, `docs/PRD.md`, and `docs/ARCHITECTURE.md`.
- No reliance on internal implementation details; exercises endpoints and client databases as an end user would.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Scenarios.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Database Migrations & Schema | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Kysely Client & Transactions | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Fastify Env Config & Fail-fast | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | Bearer Auth & Constant-time check | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Health Check Route | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Atomic Transaction & Advisory Lock | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | Clock Skew & Future Timestamp Rejection | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 8 | LWW Conflict Resolution & Monotonic Seq | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 9 | Idempotent Batch Replay | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 10 | Pull Query Cursor Pagination (500 row limit) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 11 | Dexie Schema & Compound Indexes | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 12 | Persistent Storage Registration | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 13 | Reactive CRUD & Cascading Tombstones | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 14 | Outbox Mutation Queue & Batch Coalescing | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 15 | Iterative Sync Loop & LWW Merge | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 16 | Network Resilience, Backoff & UI State Machine | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |

## Test Architecture
- Test Runner: Vitest v2.1.9 across packages and test workspaces.
- Test Scenarios Directory: `tests/e2e/` and workspace test suites (`apps/server/tests/`, `apps/web/tests/`).
- Mocking Strategy: In-memory PostgreSQL mock / test container adapter for backend, `fake-indexeddb` for client Dexie engine.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Two offline devices modify the same habit concurrently, then sync: deterministic LWW resolution, zero data loss, identical state | F6, F8, F9, F11, F14, F15 | High |
| 2 | Permanent habit deletion offline cascades tombstones to 10 schedules and 500 logs; sync propagates deletions without foreign key error | F1, F6, F8, F13, F14, F15 | High |
| 3 | Rapid multi-edit coalescing: 50 edits to single habit coalesced into 1 mutation; intermediate outbox rows cleared on server confirm | F8, F9, F14, F15 | Medium |
| 4 | Offline network toggle & Tailscale unreachable: device accurately reports `Server tidak terjangkau (Tailscale aktif?)` then auto-resumes | F4, F15, F16 | Medium |
| 5 | Clock skew attack: device with clock +10 min sends mutations; server rejects with 409 `CLOCK_SKEW` returning server_time; client adjusts state | F7, F15, F16 | Medium |
| 6 | Large dataset pagination: server generates 1200 changes; client pulls across 3 pages (500, 500, 200) until `has_more == false` | F8, F10, F15 | High |

## Coverage Thresholds
- Tier 1 (Feature Coverage): ≥5 per feature (~80 tests).
- Tier 2 (Boundary & Corner Cases): ≥5 per feature (~80 tests).
- Tier 3 (Cross-Feature Combinations): ≥16 pairwise tests.
- Tier 4 (Real-World Application Scenarios): ≥6 realistic application scenarios.
- Total Target: ≥182 E2E and functional test cases.
