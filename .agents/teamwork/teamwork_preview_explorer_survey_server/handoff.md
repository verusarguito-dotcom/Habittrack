# Handoff Report: Server & Sync Backend Specification Survey

**Agent:** teamwork_preview_explorer_survey_server  
**Assignment:** Survey Server & Sync Backend Specification (Fastify, Kysely, PostgreSQL, Auth, Sync Protocol)  
**Parent Agent ID:** 89318b56-d32e-4cac-9db8-3b1e78559fa0  
**Date:** 2026-09-29  
**Type:** Hard Handoff (Task Complete)  

---

## 1. Observation

1. **Repository Structure & Workspace State:**
   - Root `package.json` configures `npm workspaces` containing `packages/shared`, `apps/web`, and `apps/server`.
   - `packages/shared/package.json` contains `"dependencies": { "zod": "^3.24.2" }`.
   - Running `npm test` executed `vitest run` on `@vibehabit/shared`:
     ```
     Test Files  3 passed (3)
          Tests  52 passed (52)
       Duration  1.28s
     ```
   - Running `npm run typecheck` returned exit code 0 across all 3 workspaces.

2. **Server App State (`apps/server/`):**
   - `apps/server/package.json` contains:
     ```json
     {
       "name": "@vibehabit/server",
       "version": "0.1.0",
       "private": true,
       "type": "module",
       "scripts": {
         "typecheck": "tsc --noEmit",
         "lint": "tsc --noEmit",
         "build": "tsc --noEmit",
         "test:integration": "echo 'Integration test will run with docker compose test environment'"
       },
       "dependencies": {
         "@vibehabit/shared": "*"
       }
     }
     ```
   - `apps/server/src/index.ts` contains only a 7-line scaffolding stub:
     ```typescript
     import type { SyncRequest } from '@vibehabit/shared';
     export const SERVER_NAME = 'VibeHabit Sync Server';
     export type { SyncRequest };
     ```
   - Neither `fastify`, `@fastify/static`, `kysely`, nor `pg` are declared in `apps/server/package.json` or present in `package-lock.json`.
   - No subdirectories (`routes/`, `db/`, `services/`, `middleware/`) exist yet in `apps/server/src/`.

3. **Database Migration & Deployment Files:**
   - The directory `deploy/` does not exist in the repository (`directory D:\Informasi\WebHabit\deploy does not exist`).
   - No migration file `001_init.sql` exists anywhere in the repository.
   - `compose.test.yml` does not exist at root.

4. **Available Infrastructure Tools:**
   - Execution of `docker --version; podman --version` revealed:
     `docker` is not installed; `podman version 6.1.0` is installed on the host.
   - No local PostgreSQL service is currently running on port 5432.

5. **Shared Domain Contracts (`packages/shared/src/`):**
   - `packages/shared/src/types/base.ts`: Standard sync columns defined as `id` (UUID), `updated_at` (ISO string), `deleted_at` (ISO string | null), `device_id` (string), and `server_seq` (number | null).
   - `packages/shared/src/types/log.ts`: The date column is named `tanggal` (`tanggal: string; // YYYY-MM-DD local date`).
   - `packages/shared/src/schemas/sync.ts`: Defines `syncRequestSchema` (max 200 mutations), `syncResponseSchema`, and `syncMutationSchema`.
   - `packages/shared/src/logic/lww.ts`: Implements `compareLww(incoming, existing)` returning `1` (incoming wins), `-1` (incoming loses), or `0` (strictly identical timestamp and device_id).

---

## 2. Logic Chain

1. **Total Ordering & Global Sequence Requirement:**
   - *Observation:* ARCHITECTURE.md Section 6.1–6.3 and `syncRequestSchema` use a single scalar cursor `client_last_server_seq: number` and return `new_server_seq: number`.
   - *Reasoning:* If each of the 5 tables (`categories`, `habits`, `habit_schedules`, `logs`, `settings`) possessed independent identity sequences, sequence IDs would overlap across tables. A client tracking `client_last_server_seq` would miss changes in tables whose sequences started at 1 or lagged behind.
   - *Inference:* All 5 tables must share a single global PostgreSQL sequence: `CREATE SEQUENCE vibehabit_server_seq;` with `server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')`.
   - *Further Reasoning:* When an existing row is updated via a winning LWW mutation, its `server_seq` must advance so downstream clients pull the updated record. Using `DEFAULT nextval('...')` allows standard `UPDATE ... SET server_seq = nextval('vibehabit_server_seq')` without triggering PostgreSQL identity column restriction errors.

2. **Idempotency & Conflict Resolution Semantics:**
   - *Observation:* ORIGINAL_REQUEST.md R3 demands: replaying an identical batch must not create duplicate records and must not advance `server_seq`.
   - *Reasoning:* `compareLww(incoming, existing)` returns `0` when `updated_at` and `device_id` match.
   - *Inference:* When `compareLww === 0` (or `< 0`), the server must execute no SQL `UPDATE`, keeping `server_seq` untouched. The `mutation_id` must still be appended to `applied` so the client clears its outbox.

3. **Transaction Boundary & Concurrency Serialization:**
   - *Observation:* ARCHITECTURE.md Section 6.2 Step 3 specifies `pg_advisory_xact_lock(hashtext('vibehabit_sync'))`.
   - *Reasoning:* Concurrent requests from multiple devices must not interleave sequence generation and commits.
   - *Inference:* The advisory lock must be obtained immediately upon opening the database transaction. Because transaction-level advisory locks automatically release at commit/rollback, no manual lock cleanup is required.

4. **Clock Skew & Future Timestamp Hardening:**
   - *Observation:* ORIGINAL_REQUEST.md R3 and ARCHITECTURE.md 6.2 specify rejecting mutations if `client_time` differs by > 5 min from `server_time` (HTTP 409 `CLOCK_SKEW`), while rejecting individual mutations whose `updated_at` is > 5 min in the future.
   - *Reasoning:* A client with an incorrect system clock could otherwise inject future timestamps that permanently win LWW comparisons.
   - *Inference:* Validate request-level skew first: if skew > 5 min and mutations exist, respond with 409 `CLOCK_SKEW` returning `server_time`. For requests within tolerance, inspect each mutation's `updated_at`: if > 5 min in the future, push to `rejected` with reason `"Future timestamp detected (>5 min)"` and proceed with remaining valid mutations.

5. **Constant-Time Authentication:**
   - *Observation:* ARCHITECTURE.md Section 7.2 specifies `DEVICE_TOKENS` stores `device_name:sha256hex` pairs and demands constant-time comparison via `crypto.timingSafeEqual`.
   - *Reasoning:* Direct string comparison is vulnerable to timing attacks. Furthermore, calling `crypto.timingSafeEqual` with unequal buffer lengths throws a runtime exception.
   - *Inference:* The middleware must compute `crypto.createHash('sha256').update(incomingToken).digest()` (32 bytes), verify configured candidate hash buffers are also 32 bytes, and only then evaluate `timingSafeEqual`.

---

## 3. Caveats

1. **PostgreSQL Runtime on Dev Environment:**
   - `podman` version 6.1.0 is installed, but no VM/machine is currently started. Running `npm run test:integration` against a live container will require starting Podman machine (`podman machine start`) or launching a local PostgreSQL instance. A fallback mock/in-memory PostgreSQL adapter or integration runner check should be considered for environments where containers cannot immediately run.
2. **Column Naming Alignment:**
   - In PRD 8.1 and `@vibehabit/shared/src/types/log.ts`, the log date column is `tanggal`. In ORIGINAL_REQUEST.md R1, the text refers to `UNIQUE(habit_id, date) on logs`. The SQL constraint in `001_init.sql` must strictly be `CONSTRAINT uq_logs_habit_tanggal UNIQUE (habit_id, tanggal)` to match the domain model.
3. **No Code Written Outside Working Directory:**
   - Per Explorer archetype instructions and AGENTS.md guardrails, no production code or dependencies were added during this survey. All proposed file additions are documented in `report.md`.

---

## 4. Conclusion

The specification for Milestone 2 (`apps/server`, tasks T005–T008) is fully analyzed, unambiguous, and ready for immediate implementation.

Key deliverables mapped and designed:
1. **Migration `deploy/migrations/001_init.sql`**: Full DDL covering 5 domain tables, shared `vibehabit_server_seq` sequence, `UNIQUE(habit_id, tanggal)`, and `server_seq` index on all tables.
2. **Kysely DB Client & Types (`apps/server/src/db/`)**: Typed `Database` schema matching `@vibehabit/shared` models, pg connection pool, and transaction helper.
3. **Fastify Server (`apps/server/src/config.ts`, `server.ts`, `index.ts`)**: Zod environment fail-fast validation, bind to `127.0.0.1:3001`, health check route `GET /api/v1/health`.
4. **Auth Middleware (`apps/server/src/middleware/auth.ts`)**: Constant-time Bearer token verification using `crypto.timingSafeEqual` against SHA-256 digests.
5. **Sync Engine (`POST /api/v1/sync`)**: Transaction with `pg_advisory_xact_lock`, clock skew validation, topological mutation processing (`categories` ➔ `habits` ➔ `schedules` ➔ `logs` ➔ `settings`), LWW conflict resolution, idempotency, and 500-record cursor pagination.
6. **Testing (`compose.test.yml`, Vitest integration suite)**: Comprehensive test matrix for concurrent offline sync, idempotency replays, clock skew rejection, and pagination.

---

## 5. Verification Method

1. **Verify Documentation & Report Artifacts:**
   - Inspect report: `view_file` on `D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\report.md`.
   - Inspect briefing: `view_file` on `D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\BRIEFING.md`.
   - Inspect progress: `view_file` on `D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\progress.md`.

2. **Verify Repository Baseline:**
   - Run typecheck: `npm run typecheck` (verifies 0 errors).
   - Run unit tests: `npm test` (verifies 52/52 tests pass in `@vibehabit/shared`).

3. **Invalidation Conditions:**
   - Changes to `@vibehabit/shared` sync schemas or domain types without updating the survey specifications.
   - Introducing independent per-table sequences that break global monotonic ordering.
