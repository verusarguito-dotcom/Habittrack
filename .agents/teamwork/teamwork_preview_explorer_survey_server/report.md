# Server & Sync Backend Specification Survey Report
**Project:** VibeHabit (Personal Habit Tracker & Analytics)  
**Agent:** teamwork_preview_explorer_survey_server  
**Date:** 2026-09-29  
**Status:** Complete  

---

## 1. Executive Summary

This report delivers an exhaustive architectural survey and specification mapping for the VibeHabit backend synchronization service (`apps/server`), database migrations (`deploy/migrations/`), and related testing infrastructure.

Milestone 1 (`packages/shared`) was successfully completed with 52/52 Vitest unit tests passing, establishing the foundational data models, Zod validation schemas, deterministic UUID v5 generation, and pure Last-Write-Wins (LWW) conflict logic. 

Milestone 2 (`apps/server`, tasks **T005–T008**) requires bootstrapping a secure, lightweight Fastify backend backed by PostgreSQL via Kysely. Currently, `apps/server/` contains only a minimal 7-line scaffolding stub, `deploy/` does not yet exist, and no PostgreSQL migrations or Docker/Podman compose configurations have been created. This survey establishes the precise blueprint required for implementation, uncovering several critical architectural considerations—notably regarding global sequence ordering, timestamp parsing, and advisory locking.

---

## 2. Current State vs. Required State Matrix

| Subsystem / Feature | Required State (PRD / ARCH / Tasks) | Current Repository State | Gap & Required Implementation |
| :--- | :--- | :--- | :--- |
| **Dependencies** (`apps/server/package.json`) | `fastify`, `@fastify/static`, `kysely`, `pg`, `@types/pg`, `zod` | Only `@vibehabit/shared: "*"` is listed | Add approved dependencies to `apps/server/package.json` per ARCHITECTURE.md Section 2. |
| **Database Migrations** | `deploy/migrations/001_init.sql` for all domain tables (`categories`, `habits`, `habit_schedules`, `logs`, `settings`) | Directory `deploy/` does not exist | Create `deploy/migrations/001_init.sql` containing full DDL with sequence, indexes, and constraints. |
| **Kysely DB Client & Types** | `apps/server/src/db/`: typed Kysely schema `Database`, connection pooling, transaction helpers | Directory does not exist | Create `types.ts` and `client.ts` with strict Kysely interfaces and date type parsers. |
| **Config & Environment Validation** | `apps/server/src/config.ts`: Zod schema validating `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL`, `DEVICE_TOKENS`, `TRUST_PROXY` with fail-fast | File does not exist | Implement `config.ts` with strict Zod validation that terminates process on invalid env. |
| **Auth Middleware** | `apps/server/src/middleware/auth.ts`: Bearer token check via SHA-256 hash comparison using `crypto.timingSafeEqual` | Directory does not exist | Implement constant-time Bearer authentication middleware. |
| **Health Check Route** | `GET /api/v1/health` returning `{ status: 'ok', timestamp: '...' }` | Route does not exist | Implement `routes/health.ts` bound to Fastify. |
| **Atomic Sync Endpoint** | `POST /api/v1/sync`: transaction guarded by `pg_advisory_xact_lock(hashtext('vibehabit_sync'))`, clock skew rejection, LWW mutation resolution, cursor pull query (500 row limit) | Route does not exist | Implement `routes/sync.ts` and `services/sync.ts` orchestrating two-way sync. |
| **Server Bootstrap** | `apps/server/src/index.ts`: Fastify app instantiation, static plugin, route registration, listener on `127.0.0.1:3001` | Only contains scaffolding stub | Implement production-ready server bootstrap and graceful shutdown. |
| **Test Environment** | `compose.test.yml` at project root with containerized PostgreSQL (e.g. `postgres:16-alpine`) | File does not exist | Create `compose.test.yml` for local dev/integration testing. |
| **Integration Test Suite** | Vitest integration test suite testing concurrent offline conflicts, replay idempotency, clock skew, and pagination | No test files in `apps/server/` | Implement integration test suite verifying DoD criteria against PostgreSQL. |

---

## 3. Database Schema & Migration Specification (`001_init.sql`)

### 3.1 The Global Sequence Architecture (`server_seq`)
**Crucial Architectural Finding:**
In ARCHITECTURE.md Section 6.1–6.3, the client transmits a single scalar cursor `client_last_server_seq: number`, and the server returns a single scalar cursor `new_server_seq: number`.
If each of the 5 tables (`categories`, `habits`, `habit_schedules`, `logs`, `settings`) possessed an independent `GENERATED ALWAYS AS IDENTITY` sequence starting at 1:
1. `server_seq` values would collide across tables (e.g., category ID X has seq 1, habit ID Y has seq 1).
2. If client receives changes up to seq 2, next pull requests `WHERE server_seq > 2`. Any records in other tables assigned seq 1 or 2 would be permanently missed.
3. Furthermore, when an existing record is updated via a winning LWW mutation, its `server_seq` must advance. PostgreSQL prohibits updating a `GENERATED ALWAYS AS IDENTITY` column unless `OVERRIDING SYSTEM VALUE` is specified.

**Solution:**
Create a single shared database sequence:
```sql
CREATE SEQUENCE IF NOT EXISTS vibehabit_server_seq START WITH 1 INCREMENT BY 1;
```
Each table defines `server_seq` as:
```sql
server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
```
- On **INSERT**: automatically receives `nextval('vibehabit_server_seq')`.
- On **UPDATE** (winning LWW): explicitly sets `server_seq = nextval('vibehabit_server_seq')`.
- On **NO-OP** (idempotent replay or losing LWW): row is not touched, so `server_seq` does not advance.

### 3.2 Complete DDL Specification

```sql
-- deploy/migrations/001_init.sql
-- VibeHabit Database Initial Schema Migration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Global sequence for monotonic cursor tracking across all tables
CREATE SEQUENCE IF NOT EXISTS vibehabit_server_seq START WITH 1 INCREMENT BY 1;

-- 1. categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    nama TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(64) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);
CREATE INDEX IF NOT EXISTS idx_categories_server_seq ON categories(server_seq);

-- 2. habits
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY,
    nama TEXT NOT NULL,
    category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL,
    mode VARCHAR(32) NOT NULL CHECK (mode IN ('checklist', 'quantitative')),
    satuan VARCHAR(64) NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(64) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);
CREATE INDEX IF NOT EXISTS idx_habits_server_seq ON habits(server_seq);
CREATE INDEX IF NOT EXISTS idx_habits_category_id ON habits(category_id);

-- 3. habit_schedules
CREATE TABLE IF NOT EXISTS habit_schedules (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tipe_frekuensi VARCHAR(32) NOT NULL CHECK (tipe_frekuensi IN ('daily', 'specific_days', 'x_per_week')),
    hari_terjadwal INTEGER[] NULL,
    jumlah_per_minggu INTEGER NULL,
    target DOUBLE PRECISION NULL,
    effective_from VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(64) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_server_seq ON habit_schedules(server_seq);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_habit_id ON habit_schedules(habit_id);

-- 4. logs
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tanggal VARCHAR(10) NOT NULL, -- YYYY-MM-DD local date
    nilai DOUBLE PRECISION NULL,
    selesai BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(64) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq'),
    CONSTRAINT uq_logs_habit_tanggal UNIQUE (habit_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_logs_server_seq ON logs(server_seq);
CREATE INDEX IF NOT EXISTS idx_logs_habit_tanggal ON logs(habit_id, tanggal);

-- 5. settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY,
    jam_mulai_hari VARCHAR(5) NOT NULL DEFAULT '00:00',
    theme VARCHAR(16) NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    device_token_hash VARCHAR(128) NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ NULL,
    device_id VARCHAR(64) NOT NULL,
    server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')
);
CREATE INDEX IF NOT EXISTS idx_settings_server_seq ON settings(server_seq);
```

### 3.3 Foreign Key & Sync Order Considerations
In an offline-first system, mutations arrive in client-ordered arrays. If mutations in a single batch contain a new category and a new habit referencing that category, processing them out of order could trigger foreign key violation errors.
**Rule:** During sync mutation processing, the server must process incoming mutations in topological order:
`categories` ➔ `habits` ➔ `habit_schedules` ➔ `logs` ➔ `settings`.

---

## 4. Kysely Database Client & Types (`apps/server/src/db/`)

### 4.1 Type Definitions (`types.ts`)
Map domain models from `@vibehabit/shared` directly to Kysely table interfaces:
```typescript
import type { ColumnType, Generated } from 'kysely';

export interface CategoryTable {
  id: string; // UUID
  nama: string;
  updated_at: ColumnType<Date, string | Date, string | Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export interface HabitTable {
  id: string;
  nama: string;
  category_id: string | null;
  mode: 'checklist' | 'quantitative';
  satuan: string | null;
  archived: boolean;
  created_date: string;
  updated_at: ColumnType<Date, string | Date, string | Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export interface HabitScheduleTable {
  id: string;
  habit_id: string;
  tipe_frekuensi: 'daily' | 'specific_days' | 'x_per_week';
  hari_terjadwal: number[] | null;
  jumlah_per_minggu: number | null;
  target: number | null;
  effective_from: string;
  updated_at: ColumnType<Date, string | Date, string | Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export interface HabitLogTable {
  id: string;
  habit_id: string;
  tanggal: string;
  nilai: number | null;
  selesai: boolean;
  updated_at: ColumnType<Date, string | Date, string | Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export interface SettingTable {
  id: string;
  jam_mulai_hari: string;
  theme: 'light' | 'dark' | 'system';
  device_token_hash: string | null;
  updated_at: ColumnType<Date, string | Date, string | Date>;
  deleted_at: ColumnType<Date | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export interface Database {
  categories: CategoryTable;
  habits: HabitTable;
  habit_schedules: HabitScheduleTable;
  logs: HabitLogTable;
  settings: SettingTable;
}
```

### 4.2 Type Parsing for Dates and Timestamps
- `pg` driver parses `TIMESTAMPTZ` (OID 1184) into JS `Date`. In Fastify JSON serialization, `Date` becomes standard ISO 8601 string, satisfying `isoTimestampSchema`.
- `pg` driver parsing `DATE` (OID 1082): By storing `tanggal`, `created_date`, and `effective_from` as `VARCHAR(10)` (or using `pg.types.setTypeParser(1082, v => v)`), timezone shifting is eliminated, strictly preserving `"YYYY-MM-DD"`.

---

## 5. Fastify Server Configuration (`apps/server/src/config.ts`, `server.ts`)

### 5.1 Environment Validation (`config.ts`)
Uses Zod for runtime verification. Exits process immediately with exit code 1 if `DATABASE_URL` or `DEVICE_TOKENS` are missing or malformed:
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DEVICE_TOKENS: z.string().min(1, 'DEVICE_TOKENS is required'),
  TRUST_PROXY: z.coerce.boolean().default(true)
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ FATAL: Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
```

### 5.2 Server Binding and Health Route
- **Host & Port:** In development and testing, bind strictly to `127.0.0.1:3001`. Never expose to `0.0.0.0` outside containers.
- **Health Check Route:** `GET /api/v1/health`
  - Response: `{ status: "ok", timestamp: new Date().toISOString() }`
  - Does not require Bearer token authentication.

---

## 6. Bearer Token Authentication Middleware (`auth.ts`)

### 6.1 Token Storage & Format
`DEVICE_TOKENS` contains comma-separated pairs of device names and hex-encoded SHA-256 digests:
`DEVICE_TOKENS="laptop:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855,phone:3890a88..."`

### 6.2 Verification Logic
1. Extract `Authorization` header: Must begin with `Bearer <token>`. Return `401 Unauthorized` if missing.
2. Hash the incoming plaintext token using SHA-256:
   ```typescript
   const incomingHash = crypto.createHash('sha256').update(rawToken).digest();
   ```
3. Parse configured hashes into 32-byte buffers:
   ```typescript
   const validBuffers = configuredTokens.map(t => Buffer.from(t.hashHex, 'hex'));
   ```
4. Perform constant-time comparison using `crypto.timingSafeEqual`:
   ```typescript
   let matchDevice: string | null = null;
   for (const item of parsedTokens) {
     if (item.buffer.length === 32 && crypto.timingSafeEqual(incomingHash, item.buffer)) {
       matchDevice = item.name;
       break;
     }
   }
   if (!matchDevice) {
     return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid device token' });
   }
   ```
   *Note:* Ensure both buffers have length 32 prior to calling `timingSafeEqual` to avoid length-mismatch runtime exceptions.

---

## 7. Atomic Two-Way Sync Endpoint `POST /api/v1/sync`

### 7.1 Complete Processing Flow

```
[ Incoming Request ]
        │
        ▼
1. Bearer Token Auth Hook (timingSafeEqual) ──(Invalid)──► 401 Unauthorized
        │ (Valid)
        ▼
2. Protocol Version Check (protocol_version === 1) ──(Mismatch)──► 426 Upgrade Required
        │ (Valid)
        ▼
3. Clock Skew Check (|client_time - server_time| > 5 min)
        │
        ├─ If mutations exist ──► 409 Conflict (CLOCK_SKEW, returns server_time)
        │
        ▼ (Within 5 min, or pull-only)
4. BEGIN DATABASE TRANSACTION
        │
        ▼
5. Acquire pg_advisory_xact_lock(hashtext('vibehabit_sync'))
        │
        ▼
6. Process Mutations in Topological Order (categories ➔ habits ➔ schedules ➔ logs ➔ settings)
        │
        ├─ Per-Mutation Check: updated_at > server_time + 5 min?
        │     └─ Yes ──► Add to rejected[], continue
        │
        ├─ Fetch existing record by id: (updated_at, device_id, server_seq)
        │
        ├─ compareLww(incoming, existing):
        │     ├─ > 0 (Wins or New): INSERT/UPDATE with server_seq = nextval(...); add to applied[]
        │     ├─ == 0 (Idempotent Replay): DO NOT TOUCH ROW; add to applied[]
        │     └─ < 0 (Loses): DO NOT TOUCH ROW; add to applied[]
        │
        ▼
7. Execute Pull Query:
   UNION ALL across all 5 tables WHERE server_seq > client_last_server_seq
   ORDER BY server_seq ASC LIMIT 501
        │
        ├─ Determine has_more = rows.length > 500
        ├─ Take first 500 rows for changes[]
        └─ Determine new_server_seq = last_row.server_seq || client_last_server_seq
        │
        ▼
8. COMMIT TRANSACTION
        │
        ▼
[ Return 200 OK with SyncResponse JSON ]
```

### 7.2 Pull Pagination Implementation
```sql
SELECT 'categories' AS table_name, id, nama, NULL AS category_id, NULL AS mode, NULL AS satuan, 
       FALSE AS archived, NULL AS created_date, NULL AS habit_id, NULL AS tipe_frekuensi, 
       NULL AS hari_terjadwal, NULL AS jumlah_per_minggu, NULL AS target, NULL AS effective_from, 
       NULL AS tanggal, NULL AS nilai, FALSE AS selesai, NULL AS jam_mulai_hari, NULL AS theme, 
       NULL AS device_token_hash, updated_at, deleted_at, device_id, server_seq
FROM categories WHERE server_seq > $1
UNION ALL
SELECT 'habits' AS table_name, id, nama, category_id, mode, satuan, archived, created_date,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, FALSE, NULL, NULL, NULL,
       updated_at, deleted_at, device_id, server_seq
FROM habits WHERE server_seq > $1
-- (repeat for habit_schedules, logs, settings)
ORDER BY server_seq ASC
LIMIT 501;
```
Or execute individual table queries with `WHERE server_seq > $1 ORDER BY server_seq ASC LIMIT 501` within the transaction and merge-sort in memory.

---

## 8. Dev & Test Environment Specification (`compose.test.yml`)

### 8.1 Compose File Configuration
```yaml
# compose.test.yml
services:
  test-db:
    image: postgres:16-alpine
    container_name: vibehabit-test-db
    environment:
      POSTGRES_DB: vibehabit_test
      POSTGRES_USER: vibehabit_test
      POSTGRES_PASSWORD: vibehabit_test_password
    ports:
      - "127.0.0.1:54329:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibehabit_test -d vibehabit_test"]
      interval: 2s
      timeout: 3s
      retries: 15
```

### 8.2 Vitest Integration Test Plan (`apps/server/tests/`)
1. **Concurrency & Conflict Test (PRD 11.1.4):**
   - Two simulated devices (Device A and Device B) generate mutations for the same habit while disconnected.
   - Device A modifies title at T1; Device B modifies title at T2 (T2 > T1).
   - Sync both devices in varying order.
   - Assert: Both devices converge to Device B's state; no duplicate records; `server_seq` correctly assigned.
2. **Strict Idempotency Test:**
   - Push batch of 5 mutations. Note `new_server_seq`.
   - Re-send exact same batch.
   - Assert: `applied` contains all mutation IDs; `server_seq` is NOT incremented; database records remain identical.
3. **Clock Skew Test:**
   - Send mutation with `client_time` 10 minutes in the past/future.
   - Assert: Returns `409 Conflict` with `CLOCK_SKEW` and `server_time`.
   - Send individual mutation with `updated_at` 10 minutes ahead of server time.
   - Assert: Specific mutation appears in `rejected` array with reason `"Future timestamp detected (>5 min)"`.
4. **Pagination Test:**
   - Populate database with 650 records.
   - Request sync with `client_last_server_seq: 0`.
   - Assert: Returns 500 records, `has_more: true`.
   - Request next batch with `client_last_server_seq = new_server_seq`.
   - Assert: Returns remaining 150 records, `has_more: false`.
5. **Config Fail-Fast Test:**
   - Launch server instance without `DATABASE_URL` or with invalid `DEVICE_TOKENS`.
   - Assert: Process exits immediately with error log.

---

## 9. Dependency Compliance & Guardrails (AGENTS.md)

Under AGENTS.md Larangan Keras #1:
*"Dilarang menambah, menghapus, atau mengubah versi dependensi tanpa konfirmasi eksplisit dari pengguna."*

All required backend libraries were explicitly defined in `ARCHITECTURE.md` Section 2:
- `fastify`: Fastify web framework.
- `@fastify/static`: Static asset serving for PWA.
- `kysely`: Type-safe SQL query builder.
- `pg`: Node PostgreSQL driver.
- `@types/pg`: TypeScript definitions for pg.
- `zod`: Schema validation (already part of repo).

No additional or unapproved libraries are required.

---

## 10. Recommended Implementation Sequence (Milestone 2: T005–T008)

To maintain strict alignment with DoD and AGENTS.md (one task per commit):

1. **Step 1 (T005 - Schema & Database Client):**
   - Create `deploy/migrations/001_init.sql`.
   - Add approved dependencies (`kysely`, `pg`, `@types/pg`) to `apps/server/package.json`.
   - Create `apps/server/src/db/types.ts` and `apps/server/src/db/client.ts`.
   - Create `compose.test.yml`.
   - Commit: `feat(db): implement postgres initial migration and kysely client`

2. **Step 2 (T006 - Fastify Bootstrap & Auth):**
   - Add `fastify`, `@fastify/static` to `apps/server/package.json`.
   - Implement `apps/server/src/config.ts` (Zod fail-fast).
   - Implement `apps/server/src/middleware/auth.ts` (timingSafeEqual).
   - Implement `apps/server/src/routes/health.ts`.
   - Implement `apps/server/src/server.ts` and `apps/server/src/index.ts`.
   - Commit: `feat(server): bootstrap fastify server with auth and health check`

3. **Step 3 (T007 - Atomic Sync Endpoint):**
   - Implement `apps/server/src/services/sync.ts` (advisory lock, clock skew, LWW, sequence assignment, pull pagination).
   - Implement `apps/server/src/routes/sync.ts` (`POST /api/v1/sync`).
   - Commit: `feat(sync): implement atomic two-way sync endpoint with lww`

4. **Step 4 (T008 - Integration Test Suite):**
   - Create `apps/server/tests/sync.test.ts` and `apps/server/tests/server.test.ts`.
   - Validate 100% pass rate in Vitest using containerized PostgreSQL.
   - Commit: `test(server): add comprehensive integration test suite for sync`
