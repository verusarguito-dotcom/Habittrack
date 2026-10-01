# Shared Contracts & Test Infrastructure Survey Report

**Project**: VibeHabit (Local-First PWA Habit Tracker & Sync Service)  
**Surveyed Workspaces**: Monorepo Root, `packages/shared`, `apps/server`, `apps/web`  
**Date**: 2026-09-29  
**Surveyor Agent**: `teamwork_preview_explorer_survey_infra`  

---

## 1. Executive Summary

This survey report provides a comprehensive gap analysis and architectural blueprint across the VibeHabit monorepo for Milestone 2 (`apps/server`) and Milestone 3 (`apps/web`), focusing specifically on shared contracts, database migrations, container infrastructure, testing runners, and npm verification scripts.

### Key Discoveries:
1. **Milestone 1 Core Domain Logic is Robust**: `packages/shared` has complete domain types, Zod schemas, pure date arithmetic, RFC 4122 UUID v5 generator, LWW conflict comparator, and streak/success ratio calculators. All 52 unit tests pass 100% in Vitest.
2. **Host Container Runtime Reality**: Docker CLI (`docker`) is **not installed / not in PATH** on the Windows development host. However, **Podman 6.1.0 is installed**, but no Podman machine is initialized (`podman machine list` is empty) and the socket is inactive. Initializing the Podman machine (`podman machine init && podman machine start`) is necessary to run containerized PostgreSQL for integration testing.
3. **Missing Server & Web Implementations**: Both `apps/server` and `apps/web` are skeletal stubs containing only placeholder `src/index.ts` files and dependency on `@vibehabit/shared`.
4. **Integration Test Runner Stub**: `npm run test:integration` currently outputs `echo 'Integration test will run with docker compose test environment'`.
5. **Contract Gaps**: Minor gaps exist in `packages/shared`, notably the absence of an explicit typed contract for the `409 CLOCK_SKEW` response, loose typing of `record` in `syncChangeSchema`, and absence of a client Outbox schema.

---

## 2. Shared Domain Models, Zod Schemas & Contracts (`packages/shared/`)

### 2.1 Current Implementation State

The `packages/shared` workspace is well-structured and fully aligned with PRD 8.1 and ARCHITECTURE 5.

| Module | Files | Status | Test Coverage |
| :--- | :--- | :---: | :--- |
| **Domain Types** | `types/base.ts`, `category.ts`, `habit.ts`, `schedule.ts`, `log.ts`, `setting.ts`, `sync.ts` | Complete | Typechecked across monorepo |
| **Zod Schemas** | `schemas/base.ts`, `category.ts`, `habit.ts`, `schedule.ts`, `log.ts`, `setting.ts`, `sync.ts` | Complete | Tested (15 schema tests) |
| **Pure Logic** | `logic/uuid.ts`, `lww.ts`, `date.ts`, `schedule.ts`, `streak.ts`, `ratio.ts` | Complete | Tested (37 logic tests) |

#### Standard Column Compliance:
Every domain entity (`Category`, `Habit`, `HabitSchedule`, `HabitLog`, `Setting`) extends `BaseSyncableEntity`:
- `id`: string (UUID)
- `updated_at`: string (ISO 8601 timestamp)
- `deleted_at`: string | null (ISO 8601 timestamp for tombstone soft-deletion)
- `device_id`: string (identifying originating client)
- `server_seq?: number | null` (assigned monotonically by server on winning mutation)

#### Sync Request / Response Protocol:
- **`SyncRequest`**:
  - `protocol_version`: `number` (validated >= 1, defaults to 1)
  - `device_id`: `string` (UUID v4)
  - `client_time`: `string` (ISO 8601 timestamp)
  - `client_last_server_seq`: `number` (non-negative integer)
  - `mutations`: `SyncMutation[]` (max 200 items per request, table enum: `categories`, `habits`, `habit_schedules`, `logs`, `settings`)
- **`SyncResponse`**:
  - `server_time`: `string` (ISO 8601 timestamp)
  - `applied`: `string[]` (list of mutation IDs applied or safely discarded by LWW)
  - `rejected`: `SyncRejectedItem[]` (`mutation_id`, `reason`)
  - `changes`: `SyncChange[]` (`table`, `record` with `server_seq`)
  - `new_server_seq`: `number`
  - `has_more`: `boolean`

---

### 2.2 Contract & Schema Gaps Identified

#### Gap 1: Explicit Clock Skew Error Contract (P1)
- **Requirement** (PRD 8.2 & ARCHITECTURE 6.2): When `client_time` deviates from server time by > 5 minutes, the server must reject incoming mutations with HTTP status `409 CLOCK_SKEW` and return `server_time`.
- **Current State**: Neither `types/sync.ts` nor `schemas/sync.ts` defines an explicit response type or Zod schema for this error.
- **Recommended Addition**:
  ```typescript
  export interface ClockSkewErrorResponse {
    error: 'CLOCK_SKEW';
    message: string;
    server_time: string;
  }
  
  export const clockSkewErrorResponseSchema = z.object({
    error: z.literal('CLOCK_SKEW'),
    message: z.string(),
    server_time: isoTimestampSchema
  });
  ```

#### Gap 2: Schema Precision for `syncChangeSchema` (P2)
- **Current State**: In `packages/shared/src/schemas/sync.ts`:
  ```typescript
  export const syncChangeSchema = z.object({
    table: syncTableSchema,
    record: z.record(z.unknown())
  });
  ```
- **Risk**: Parsing a server response using `syncResponseSchema` strips type safety from `record`, treating it as `Record<string, unknown>` instead of typed domain records with `server_seq`.
- **Recommended Refinement**:
  ```typescript
  export const syncChangeRecordSchema = syncRecordSchema.and(
    z.object({ server_seq: z.number().int().nonnegative() })
  );
  export const syncChangeSchema = z.object({
    table: syncTableSchema,
    record: syncChangeRecordSchema
  });
  ```

#### Gap 3: Client Outbox Queue Contract (P1 for Milestone 3)
- **Requirement** (ARCHITECTURE 6.4): Client maintains an IndexedDB outbox queue with coalescing per record.
- **Missing Contract**:
  ```typescript
  export interface OutboxEntry {
    mutation_id: string;
    table: SyncTable;
    record_id: string;
    record: SyncableRecord;
    created_at: string;
    retry_count: number;
    last_error?: string | null;
  }
  ```

---

## 3. Database Schema & Migration Specification

### 3.1 Migration File: `deploy/migrations/001_init.sql`
In accordance with `ORIGINAL_REQUEST.md` R1 and `docs/ARCHITECTURE.md` Section 5, the initial migration must create all 5 domain tables with standard columns, identity sequences, and integrity constraints.

```sql
-- Migration: 001_init.sql
-- Description: Initialize core VibeHabit domain tables with identity server_seq and LWW columns

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    device_id VARCHAR(128) NOT NULL,
    server_seq BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_categories_server_seq ON categories (server_seq);

-- 2. habits
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('checklist', 'quantitative')),
    satuan VARCHAR(50) DEFAULT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_date DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    device_id VARCHAR(128) NOT NULL,
    server_seq BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_habits_server_seq ON habits (server_seq);
CREATE INDEX IF NOT EXISTS idx_habits_category_id ON habits (category_id);

-- 3. habit_schedules
CREATE TABLE IF NOT EXISTS habit_schedules (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tipe_frekuensi VARCHAR(20) NOT NULL CHECK (tipe_frekuensi IN ('daily', 'specific_days', 'x_per_week')),
    hari_terjadwal INTEGER[] DEFAULT NULL,
    jumlah_per_minggu INTEGER DEFAULT NULL,
    target DOUBLE PRECISION DEFAULT NULL,
    effective_from DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    device_id VARCHAR(128) NOT NULL,
    server_seq BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_server_seq ON habit_schedules (server_seq);
CREATE INDEX IF NOT EXISTS idx_habit_schedules_habit_effective ON habit_schedules (habit_id, effective_from);

-- 4. logs
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    nilai DOUBLE PRECISION DEFAULT NULL,
    selesai BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    device_id VARCHAR(128) NOT NULL,
    server_seq BIGINT GENERATED ALWAYS AS IDENTITY,
    CONSTRAINT uq_logs_habit_date UNIQUE (habit_id, tanggal)
);
CREATE INDEX IF NOT EXISTS idx_logs_server_seq ON logs (server_seq);
CREATE INDEX IF NOT EXISTS idx_logs_habit_date ON logs (habit_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_logs_tanggal ON logs (tanggal);

-- 5. settings
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY,
    jam_mulai_hari VARCHAR(5) NOT NULL DEFAULT '00:00',
    theme VARCHAR(10) NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    device_token_hash VARCHAR(255) DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    device_id VARCHAR(128) NOT NULL,
    server_seq BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_settings_server_seq ON settings (server_seq);
```

### 3.2 Kysely Database Interface Definition
To provide strict compile-time type safety across all queries in `apps/server/src/db/`:

```typescript
import type { Generated, ColumnType } from 'kysely';

export interface CategoryTable {
  id: string;
  nama: string;
  updated_at: string;
  deleted_at: string | null;
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
  updated_at: string;
  deleted_at: string | null;
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
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  server_seq: Generated<number>;
}

export interface HabitLogTable {
  id: string;
  habit_id: string;
  tanggal: string;
  nilai: number | null;
  selesai: boolean;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  server_seq: Generated<number>;
}

export interface SettingTable {
  id: string;
  jam_mulai_hari: string;
  theme: 'light' | 'dark' | 'system';
  device_token_hash: string | null;
  updated_at: string;
  deleted_at: string | null;
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

---

## 4. Host Environment & Docker / Podman Status

### 4.1 Probe Results on Dev Host
During this survey, command probes were executed on the development machine (Windows PowerShell):

| Probe Command | Result | Diagnosis |
| :--- | :--- | :--- |
| `docker --version` | `The term 'docker' is not recognized` | Docker Desktop is not installed or not in system `PATH`. |
| `podman --version` | `podman version 6.1.0` | Podman CLI 6.1.0 is installed. |
| `podman machine list` | Table headers only (0 machines) | No Podman Linux VM has been created yet. |
| `podman ps` | `Error: unable to connect to Podman socket...` | Podman service is stopped; requires active VM. |
| `psql --version` | `The term 'psql' is not recognized` | Native PostgreSQL client is not in system `PATH`. |
| `Get-Service *postgres*`| No service returned | No native Windows PostgreSQL service running. |

### 4.2 Actionable Recommendations for Container Setup
Because `AGENTS.md` Definition of Done item 6 explicitly mandates:
> *"Untuk perubahan sync: wajib ada integration test dengan PostgreSQL asli (menggunakan Docker di dev machine) untuk skenario dua perangkat offline (PRD 11.1 poin 4)..."*

The developer or implementer must enable the container environment via Podman:
1. Initialize the Podman virtual machine:
   ```powershell
   podman machine init
   podman machine start
   ```
2. Verify Podman socket connectivity:
   ```powershell
   podman ps
   ```
3. Run containerized PostgreSQL:
   ```powershell
   podman compose -f compose.test.yml up -d
   ```

---

## 5. Test Infrastructure Architecture & Runner Design

### 5.1 `compose.test.yml` Specification
To be placed in the project root:

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:16-alpine
    container_name: vibehabit-postgres-test
    environment:
      POSTGRES_DB: vibehabit_test
      POSTGRES_USER: vibehabit_user
      POSTGRES_PASSWORD: vibehabit_test_password
    ports:
      - "127.0.0.1:5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibehabit_user -d vibehabit_test"]
      interval: 2s
      timeout: 3s
      retries: 15
    tmpfs:
      - /var/lib/postgresql/data
```
*Key Decisions*:
- Locked image `postgres:16-alpine` (ARCHITECTURE 2).
- Bound strictly to `127.0.0.1:5433` (ARCHITECTURE 4 rule 1; avoids port 5432 conflicts).
- Uses `tmpfs` for in-memory database storage during testing (high IOPS, zero disk residue, fast teardown).

### 5.2 Migration Runner for Integration Tests
A dedicated migration runner module `apps/server/src/db/migrate.ts`:
- Reads `deploy/migrations/*.sql` in alphanumeric order.
- Creates an internal `_migrations` tracking table: `id SERIAL PRIMARY KEY, name VARCHAR NOT NULL, executed_at TIMESTAMPTZ DEFAULT NOW()`.
- Executes pending migrations within an atomic transaction.
- Can be invoked directly via CLI (`npm run db:migrate`) or programmatically in Vitest global setup / `beforeAll`.

### 5.3 Test Suite Matrix & Scenarios

| Test Target | Runner / File | Scope / Cases |
| :--- | :--- | :--- |
| **Unit: Domain Utils** | `packages/shared/tests/domain-utils.test.ts` | RFC 4122 UUID v5, LWW comparator, date arithmetic, day-start offsets (20 tests). |
| **Unit: Domain Schemas** | `packages/shared/tests/schemas.test.ts` | Validation of all 5 domain models, Zod defaults, sync payloads (15 tests). |
| **Unit: Streak & Ratio** | `packages/shared/tests/calculations.test.ts` | Daily, specific days, x-per-week, partial quantitative, past edits, schedule tiers (17 tests). |
| **Integration: Auth & Health** | `apps/server/tests/health-auth.test.ts` | Healthcheck 200, missing token 401, timing-safe SHA-256 token verification. |
| **Integration: Clock Skew** | `apps/server/tests/clock-skew.test.ts` | Clock skew > 5m returns 409 CLOCK_SKEW; future timestamp rejection per mutation. |
| **Integration: Two Offline Devices** | `apps/server/tests/offline-sync-conflict.test.ts` | Two offline devices concurrently edit and delete identical records; LWW convergence without duplicate rows. |
| **Integration: Idempotency** | `apps/server/tests/idempotency.test.ts` | Replaying identical mutation batch produces identical response, does not advance `server_seq`. |
| **Integration: Advisory Lock Concurrency**| `apps/server/tests/concurrency.test.ts` | Parallel sync push requests serialize via `pg_advisory_xact_lock(hashtext('vibehabit_sync'))`. |
| **Integration: Cursor Pagination** | `apps/server/tests/pagination.test.ts` | Pull query with > 500 records limits to 500 with `has_more: true`. |

---

## 6. Dependency & Configuration Gap Analysis

### 6.1 Monorepo Root
- **`package.json`**:
  - Current scripts:
    ```json
    "typecheck": "npm run --workspaces --if-present typecheck",
    "lint": "npm run --workspaces --if-present lint",
    "build": "npm run --workspaces --if-present build",
    "test": "vitest run",
    "test:unit": "npm run --workspace=@vibehabit/shared test:unit",
    "test:integration": "npm run --workspace=@vibehabit/server test:integration"
    ```
  - Required addition for test container management:
    ```json
    "test:container:up": "podman compose -f compose.test.yml up -d",
    "test:container:down": "podman compose -f compose.test.yml down"
    ```

### 6.2 Workspace `@vibehabit/server` (`apps/server`)
- **Current `package.json` Dependencies**:
  - `dependencies`: `{"@vibehabit/shared": "*"}`
  - `devDependencies`: None
- **Required Dependencies** (Pre-approved in `ARCHITECTURE.md` Section 2):
  - `fastify`: Fastify framework
  - `@fastify/static`: Static file delivery for PWA
  - `kysely`: Type-safe query builder
  - `pg`: PostgreSQL client
  - `dotenv`: Environment configuration loader
  - Dev dependencies:
    - `@types/pg`: TypeScript types for `pg`
    - `@types/node`: Node.js runtime types

### 6.3 Workspace `@vibehabit/web` (`apps/web`)
- **Current `package.json` Dependencies**:
  - `dependencies`: `{"@vibehabit/shared": "*"}`
  - `devDependencies`: None
- **Future Dependencies for Milestones 3–5** (Pre-approved in `ARCHITECTURE.md` Section 2):
  - `react`, `react-dom`, `dexie`, `dexie-react-hooks`, `recharts`
  - Dev dependencies: `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `tailwindcss`

---

## 7. Next Steps for Implementation Agents

1. **For Agent building Server Infrastructure (T005 & T006)**:
   - Create `compose.test.yml` at root with Postgres 16-alpine on port 5433.
   - Create `deploy/migrations/001_init.sql` matching the SQL specification in Section 3.1.
   - Provide `apps/server/src/db/migrate.ts` and `apps/server/src/db/client.ts`.
   - Install approved dependencies for `@vibehabit/server`.
   - Implement Fastify bootstrap in `apps/server/src/app.ts` and `apps/server/src/config.ts`.
2. **For Agent implementing Sync & Integration Tests (T007 & T008)**:
   - Implement `POST /api/v1/sync` in `apps/server/src/routes/sync.ts` with advisory lock, LWW resolution, clock skew verification, and cursor pull.
   - Replace placeholder `test:integration` script in `@vibehabit/server` with Vitest integration test execution against `compose.test.yml`.
3. **For Agent building Client Local-First Database (T009 & T010)**:
   - Implement Dexie schema in `apps/web/src/db/` with `[habit_id+date]` compound indexes.
   - Implement Outbox coalescing and sync loop in `apps/web/src/sync/`.
