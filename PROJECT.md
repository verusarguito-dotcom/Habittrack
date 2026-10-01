# Project: VibeHabit Sync Engine & Local-First Architecture

## Architecture
- **Monorepo Structure**: `npm workspaces` with `packages/shared` (types, Zod schemas, LWW pure logic), `apps/server` (Fastify sync service, Kysely, PostgreSQL), and `apps/web` (React 19 PWA, Dexie IndexedDB, sync engine).
- **Global Sequence Architecture**: A single global PostgreSQL sequence `CREATE SEQUENCE vibehabit_server_seq;` shared by all 5 domain tables (`categories`, `habits`, `habit_schedules`, `logs`, `settings`) ensures monotonic ordering without cursor collisions across tables.
- **Concurrency & Transaction Safety**: Transaction-level advisory lock `pg_advisory_xact_lock(hashtext('vibehabit_sync'))` serializes push/pull batches.
- **Conflict Resolution**: Deterministic Last-Write-Wins (LWW) via `(updated_at, device_id)` comparisons. Both server and client use `@vibehabit/shared/logic/lww.ts`.
- **Clock Skew & Protection**: Request-level skew > 5 min returns HTTP 409 `CLOCK_SKEW` with `server_time`. Individual mutations with `updated_at > server_time + 5 min` are rejected to prevent future timestamp attacks.
- **Client High-Performance DB**: Dexie IndexedDB with compound indexes `[habit_id+tanggal]` and `tanggal` on `logs` to ensure <0.3s response across 35,000 records.
- **Outbox Coalescing**: Outbox mutations grouped per entity record to dispatch only the latest state, with predecessor ID tracking for atomic cleanup upon confirmation.
- **Dual Track Quality**: Parallel implementation and opaque-box E2E testing tracks, culminating in a 100% E2E test pass and adversarial coverage hardening.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | M2-F1 | PostgreSQL SQL migration `deploy/migrations/001_init.sql` for 5 domain tables | M2 | Survey / R1 |
| 2 | M2-F2 | Standard sync columns (`id`, `updated_at`, `deleted_at`, `device_id`, global shared `server_seq`) | M2 | Survey / R1 |
| 3 | M2-F3 | Enforce `CONSTRAINT uq_logs_habit_tanggal UNIQUE(habit_id, tanggal)` on logs table | M2 | Survey / R1 |
| 4 | M2-F4 | Kysely query client and typed `Database` schema in `apps/server/src/db/` | M2 | Survey / R1 |
| 5 | M2-F5 | Containerized PostgreSQL configuration (`compose.test.yml`) and migration runner | M2 | Survey / R1 |
| 6 | M2-F6 | Fastify server bootstrap with Zod fail-fast environment validation, bound to `127.0.0.1:3001` | M2 | Survey / R2 |
| 7 | M2-F7 | Bearer auth middleware using `crypto.timingSafeEqual` on SHA-256 digests against `DEVICE_TOKENS` | M2 | Survey / R2 |
| 8 | M2-F8 | Health check route `GET /api/v1/health` returning status and timestamp | M2 | Survey / R2 |
| 9 | M2-F9 | Static asset serving integration for PWA via `@fastify/static` | M2 | Survey / R2 |
| 10 | M2-F10 | Atomic sync execution in a single transaction guarded by `pg_advisory_xact_lock` | M2 | Survey / R3 |
| 11 | M2-F11 | Clock skew validation (>5 min -> 409 `CLOCK_SKEW`) and future timestamp rejection | M2 | Survey / R3 |
| 12 | M2-F12 | Last-Write-Wins (LWW) mutation processing via `compareLww` updating `server_seq` only on win | M2 | Survey / R3 |
| 13 | M2-F13 | Strict idempotency: identical batch replay produces zero changes and retains `server_seq` | M2 | Survey / R3 |
| 14 | M2-F14 | Topological mutation ordering (`categories` ➔ `habits` ➔ `habit_schedules` ➔ `logs` ➔ `settings`) | M2 | Survey / R3 |
| 15 | M2-F15 | Pull query pagination: `server_seq > client_last_server_seq`, max 500 rows, `has_more` flag | M2 | Survey / R3 |
| 16 | M3-F1 | Dexie database initialization in `apps/web/src/db/database.ts` with compound indexes | M3 | Survey / R4 |
| 17 | M3-F2 | Storage persistence registration (`navigator.storage.persist()`) and quota tracking | M3 | Survey / R4 |
| 18 | M3-F3 | Reactive CRUD operations and `liveQuery` hooks for domain entities | M3 | Survey / R4 |
| 19 | M3-F4 | Cascading tombstone deletion for habits, schedules, and logs within single Dexie transaction | M3 | Survey / R4 |
| 20 | M3-F5 | Persistent `outbox` mutation table in Dexie | M3 | Survey / R5 |
| 21 | M3-F6 | Outbox batch coalescing per record with predecessor ID mapping | M3 | Survey / R5 |
| 22 | M3-F7 | Iterative pull/push sync engine loop continuing until `has_more == false && outbox == 0` | M3 | Survey / R5 |
| 23 | M3-F8 | Local LWW merge logic preserving uncommitted local outbox mutations | M3 | Survey / R5 |
| 24 | M3-F9 | Outbox cleanup on server `applied` confirmation or permanent `rejected` | M3 | Survey / R5 |
| 25 | M3-F10 | Exponential backoff scheduler (2s–60s) with jitter and UI sync state machine | M3 | Survey / R5 |
| 26 | SH-F1 | Shared sync schemas refinement: `ClockSkewErrorResponse` and typed record validation | M1 | Survey / Infra |
| 27 | E2E-F1 | Requirement-driven E2E test runner and mock server/client harness | E2E | Survey / Infra |
| 28 | E2E-F2 | Tier 1 Feature coverage tests (≥5 per feature) | E2E | Test Track |
| 29 | E2E-F3 | Tier 2 Boundary & corner case tests (≥5 per feature) | E2E | Test Track |
| 30 | E2E-F4 | Tier 3 Cross-feature combination tests (pairwise) | E2E | Test Track |
| 31 | E2E-F5 | Tier 4 Real-world application workload scenarios (two offline devices, replays, network drop) | E2E | Test Track |
| 32 | E2E-F6 | Tier 5 Adversarial coverage hardening | Final | Test Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Shared Schema Refinements | Refine `packages/shared` contracts (`ClockSkewErrorResponse`, `syncChangeSchema`) | none | IN_PROGRESS |
| M2 | Server Sync Service & Database | Migration `001_init.sql`, Kysely client, Fastify bootstrap, auth middleware, sync endpoint (`apps/server`) | M1 | PLANNED |
| M3 | Client Local DB & Sync Engine | Dexie schema, persistent storage, CRUD helpers, outbox queue, sync orchestrator, UI states (`apps/web`) | M1 | PLANNED |
| E2E | E2E Testing Suite (Tiers 1–4) | Requirement-driven opaque-box test harness & test suite (Tiers 1–4) ➔ `TEST_READY.md` | M1 | PLANNED |
| Final | Final Integration & Hardening | 100% E2E test pass + Tier 5 adversarial coverage hardening | M2, M3, E2E | PLANNED |

## Interface Contracts

### Fastify ↔ Database (Kysely)
- Connection: PostgreSQL connection pool via `pg.Pool` with connection string from validated Zod env (`DATABASE_URL`).
- Sequence: `vibehabit_server_seq` (shared across all domain tables).
- Advisory Lock: `pg_advisory_xact_lock(hashtext('vibehabit_sync'))` at start of sync transaction.

### Client (Web PWA) ↔ Server (`POST /api/v1/sync`)
- Endpoint: `POST /api/v1/sync`
- Headers:
  * `Authorization: Bearer <device_token>`
  * `Content-Type: application/json`
- Request Payload (`SyncRequest`):
  ```typescript
  {
    client_last_server_seq: number;
    client_time: string; // ISO 8601
    device_id: string;   // UUID
    mutations: SyncMutation[]; // max 200
  }
  ```
- Response Payload (`SyncResponse`):
  ```typescript
  {
    new_server_seq: number;
    server_time: string; // ISO 8601
    applied: string[];   // Array of mutation_id
    rejected: SyncRejectedItem[];
    changes: SyncChange[]; // max 500
    has_more: boolean;
  }
  ```
- Error Responses:
  * `401 Unauthorized`: `{ error: 'UNAUTHORIZED', message: string }`
  * `409 Conflict (Clock Skew)`: `{ error: 'CLOCK_SKEW', message: string, server_time: string }`
  * `400 Bad Request`: `{ error: 'VALIDATION_ERROR', message: string, details: any }`

### Client Outbox ↔ Dexie
- `outbox` table in Dexie:
  ```typescript
  interface OutboxEntry {
    id: string; // UUID
    table: 'categories' | 'habits' | 'habit_schedules' | 'logs' | 'settings';
    record_id: string;
    action: 'insert' | 'update' | 'delete';
    payload: Record<string, unknown>;
    created_at: string;
  }
  ```

## Code Layout
```text
vibehabit/
├── deploy/
│   ├── migrations/
│   │   └── 001_init.sql
│   ├── Containerfile
│   └── podman-compose.yml
├── compose.test.yml
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/
│       │   └── logic/
│       └── tests/
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── server.ts
│   │   │   ├── index.ts
│   │   │   ├── db/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── migrate.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts
│   │   │   ├── routes/
│   │   │   │   ├── health.ts
│   │   │   │   └── sync.ts
│   │   │   └── services/
│   │   │       ├── sync.ts
│   │   │       └── auth.ts
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   └── web/
│       └── src/
│           ├── db/
│           │   ├── database.ts
│           │   ├── persistence.ts
│           │   ├── operations/
│           │   └── hooks/
│           └── sync/
│               ├── outbox.ts
│               ├── client.ts
│               ├── orchestrator.ts
│               ├── state.ts
│               └── backoff.ts
```
