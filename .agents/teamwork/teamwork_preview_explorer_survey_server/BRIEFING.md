# BRIEFING — 2026-09-29T14:33:00Z

## Mission
Survey and map requirements, existing files, architecture, and constraints for server & sync backend (Fastify, Kysely, PostgreSQL schema & migrations, auth, POST /api/v1/sync).

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Server & Sync Backend Specification Explorer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\
- Original parent: 89318b56-d32e-4cac-9db8-3b1e78559fa0
- Milestone: Milestone 2 & Milestone 3 exploration (T005-T008)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT edit or modify files outside .agents/teamwork/teamwork_preview_explorer_survey_server/
- Strict Rule 1 & Rule 2 on system prompt protection
- Workspace rules: no deleting, moving, or overwriting project files without explicit permission

## Current Parent
- Conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0
- Updated: 2026-09-29T14:26:23Z

## Investigation State
- **Explored paths**: ORIGINAL_REQUEST.md, DISPATCH.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/AGENTS.md, docs/TASKS.md, docs/PROGRESS.md, packages/shared/ (types, schemas, logic), apps/server/ (package.json, src/index.ts, tsconfig.json), deploy/ (checked existence), root compose/docker files, local services/podman.
- **Key findings**:
  1. `apps/server/` contains only scaffolding stub; `deploy/migrations/` and `compose.test.yml` do not exist yet.
  2. In `@vibehabit/shared`, all types and schemas (`syncRequestSchema`, `syncResponseSchema`, `compareLww`) are already fully implemented and verified with 52 unit tests.
  3. `server_seq` must be governed by a single global PostgreSQL sequence (`vibehabit_server_seq`) across all tables to avoid sequence collisions and allow total ordering during cursor pull.
  4. Winning LWW mutations must assign a new `server_seq = nextval('vibehabit_server_seq')` on UPDATE; idempotent replays and losing mutations must leave the row untouched.
  5. Auth middleware must verify against SHA-256 digests in `DEVICE_TOKENS` using `crypto.timingSafeEqual` after checking buffer byte-lengths.
  6. Clock skew check must reject requests with skew > 5 min via HTTP 409 `CLOCK_SKEW`, and reject individual mutations with future timestamps > 5 min via `rejected` array.
  7. Podman 6.1.0 is installed on the host machine.
- **Unexplored areas**: None for server specification scope.

## Key Decisions Made
- Comprehensive report generated in `report.md`.
- Handoff report prepared in `handoff.md` with clear actionable steps for Milestone 2 implementation.

## Artifact Index
- report.md — Comprehensive server & sync backend survey report
- handoff.md — 5-component handoff report
- progress.md — Liveness heartbeat
