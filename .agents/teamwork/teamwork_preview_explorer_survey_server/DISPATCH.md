# Dispatch Assignment: Survey Server & Sync Backend

## Assigned Agent
- Role: Server & Sync Backend Specification Explorer
- Archetype: teamwork_preview_explorer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

## Objective
Survey and map the requirements, architecture, existing files, and constraints for the backend synchronization service:
1. Read `D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md` (Mandatory).
2. Examine `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/AGENTS.md`, `docs/TASKS.md`, `docs/PROGRESS.md`.
3. Inspect `apps/server/` current state, existing package.json, source files, and `deploy/migrations`.
4. Enumerate all required features, database schema specifications (tables, columns, types, indexes, unique constraints, server_seq identity), Fastify server configuration (Zod config, port 127.0.0.1:3001, health route), Bearer token authentication (SHA-256 timingSafeEqual), and atomic sync endpoint (`POST /api/v1/sync`: advisory locks, clock skew validation, LWW resolution, pagination with 500 row batch limit, idempotency).
5. Document all dependencies, interface contracts, error responses, and architectural constraints.
6. Write a comprehensive survey report to `D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_server\report.md` and complete handoff in `handoff.md`.
