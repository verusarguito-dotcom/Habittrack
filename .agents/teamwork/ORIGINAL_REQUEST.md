# Original User Request

## Initial Request — 2026-09-29T14:23:57Z

Implement the complete backend synchronization service (Fastify, Kysely, PostgreSQL) and client local-first database engine (Dexie IndexedDB, outbox mutation queue, sync orchestrator) for VibeHabit, enabling robust two-way offline-first synchronization between PWA devices and self-hosted VPS via Tailscale.

Working directory: D:\Informasi\WebHabit\
Integrity mode: development

## Reference Documentation (Single Source of Truth)
- `docs/PRD.md`: Business rules 7.1–7.5, data model 8.1, sync protocol 8.2, test criteria 11.1–11.2.
- `docs/AGENTS.md`: 10 Strict Guardrails, Definition of Done, Conventional Commits.
- `docs/ARCHITECTURE.md`: Sections 2, 3, 4, 5, 6, 7, 10 (Fastify + Kysely + PostgreSQL, Dexie, advisory locks, LWW resolution, clock skew check, `POST /api/v1/sync`).
- `docs/TASKS.md`: Milestone 2 (T005–T008) and Milestone 3 (T009–T010).
- `docs/PROGRESS.md`: Append-only progress log.

## Requirements

### R1. Server Database Schema & Migrations (`apps/server`)
- Create SQL migration `deploy/migrations/001_init.sql` for all domain tables: `categories`, `habits`, `habit_schedules`, `logs`, `settings`.
- Ensure standard columns on all tables: `id` (UUID), `updated_at` (TIMESTAMPTZ), `deleted_at` (TIMESTAMPTZ, nullable for soft deletes/tombstones), `device_id` (VARCHAR), and `server_seq` (BIGINT GENERATED ALWAYS AS IDENTITY, indexed).
- Enforce `UNIQUE(habit_id, date)` on `logs`.
- Configure Kysely query client in `apps/server/src/db/` with strict TypeScript types derived from domain models.
- Provide `compose.test.yml` for running local containerized PostgreSQL during development and testing on the dev laptop.

### R2. Fastify Server & Security Middleware (`apps/server`)
- Bootstrap Fastify server in `apps/server/src/` with environment validation via Zod (`config.ts`), failing fast if `DATABASE_URL` or `DEVICE_TOKENS` are invalid.
- Implement Bearer authentication middleware in `apps/server/src/middleware/auth.ts` verifying incoming device tokens against SHA-256 hashes in `DEVICE_TOKENS` using constant-time comparison (`crypto.timingSafeEqual`).
- Provide health check route `GET /api/v1/health` returning server status and timestamp.
- Bind server strictly to `127.0.0.1:3001` (never expose 0.0.0.0 outside containers).

### R3. Atomic Two-Way Sync Endpoint `POST /api/v1/sync` (`apps/server`)
- Implement `POST /api/v1/sync` executing within a single database transaction guarded by `pg_advisory_xact_lock(hashtext('vibehabit_sync'))`.
- Validate clock skew: reject mutations if `client_time` differs by > 5 minutes from `server_time` (`409 CLOCK_SKEW`), while still permitting pull queries. Reject individual mutations whose `updated_at` is > 5 minutes in the future.
- Apply Last-Write-Wins (LWW) resolution: compare `(updated_at, device_id)` strictly against existing records. Winning mutations update the row and receive a new `server_seq`. Losing mutations are discarded on server but reported in `applied` so client outbox clears.
- Guarantee strict idempotency: replaying an identical batch must not create duplicate records and must not advance `server_seq`.
- Pull query: return records where `server_seq > client_last_server_seq` ordered ascending, limited to 500 rows per batch, with boolean `has_more`.

### R4. Client Local-First Database & Reactive Storage (`apps/web/src/db`)
- Initialize Dexie (IndexedDB) database in `apps/web/src/db/` with schemas matching domain models and compound indexes `[habit_id+date]` and `date` on `logs` for <0.3s query performance across 35,000 logs.
- Automatically register and verify `navigator.storage.persist()` on client startup.
- Implement reactive query hooks and helper functions for CRUD operations.
- Ensure permanent habit deletions cascade tombstone generation for the habit, all its schedules, and all its logs within a single Dexie transaction.

### R5. Client Outbox Queue & Sync Engine (`apps/web/src/sync`)
- Implement persistent `outbox` mutation table in Dexie.
- Batch coalescing: merge pending mutations per entity record so only the latest state is dispatched to the server.
- Implement sync loop: iteratively pull and push until `has_more == false`.
- Local LWW merge: apply incoming server changes to Dexie only if they strictly win over existing local records (protecting uncommitted local outbox edits).
- Clear outbox items only when confirmed in server's `applied` or permanently rejected arrays.
- Automatic retry with exponential backoff on network failure, with distinct UI state machine reporting:
  * `Tersinkron`
  * `Menunggu sinkron (n)`
  * `Server tidak terjangkau (Tailscale aktif?)`
  * `Jam perangkat tidak akurat (>5 menit)`

## Acceptance Criteria

### Automated Testing & Type Safety
- [ ] `npm run typecheck` (`tsc --noEmit`) passes with 0 errors across all workspaces (`packages/shared`, `apps/server`, `apps/web`).
- [ ] `npm run lint` passes without errors or warnings.
- [ ] `npm test` passes 100% across unit test suites.
- [ ] `npm run test:integration` passes 100% in Vitest using local PostgreSQL container (`compose.test.yml`).

### Functional Sync & Offline Scenarios
- [ ] Two offline devices modifying the same record (edit/delete/log) sync concurrently: zero data loss, zero duplicate records, deterministic identical state on both sides.
- [ ] Replaying the identical mutation batch twice causes zero changes and does not advance `server_seq`.
- [ ] Mutations with clock skew > 5 minutes are rejected with `409 CLOCK_SKEW` returning `server_time`.
- [ ] Pull requests with more than 500 records correctly paginate using `has_more: true` until exhausted.
- [ ] Fastify server fails fast on startup when environment variables are missing or malformed.
- [ ] Client outbox coalesces multiple edits to the same entity into a single payload.
- [ ] Client detects network offline vs server unreachable (Tailscale down) accurately.

### Project Hygiene & Documentation
- [ ] `docs/TASKS.md` updated with T005, T006, T007, T008, T009, T010 marked `done`.
- [ ] `docs/PROGRESS.md` updated with comprehensive audit and implementation entries.
- [ ] Zero unapproved dependencies added to `package.json`.
- [ ] Git commits adhere to Conventional Commits format (`feat(server): ...`, `feat(sync): ...`, `feat(web): ...`).
