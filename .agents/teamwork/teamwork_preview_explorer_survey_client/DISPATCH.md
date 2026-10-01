# Dispatch Assignment: Survey Client Local-First DB & Sync Engine

## Assigned Agent
- Role: Client Local DB & Sync Engine Specification Explorer
- Archetype: teamwork_preview_explorer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

## Objective
Survey and map the requirements, architecture, existing files, and constraints for the client local-first database engine and sync orchestrator:
1. Read `D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md` (Mandatory).
2. Examine `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/AGENTS.md`, `docs/TASKS.md`, `docs/PROGRESS.md`.
3. Inspect `apps/web/` current state, existing package.json, source files, `apps/web/src/db/`, and `apps/web/src/sync/`.
4. Enumerate all required features: Dexie database schema matching domain models, compound indexes `[habit_id+date]` and `date` on logs for <0.3s query performance across 35,000 logs, `navigator.storage.persist()` registration, reactive hooks/helpers, cascading tombstone deletion for habits/schedules/logs in a single Dexie transaction.
5. Enumerate client sync engine specifications: persistent `outbox` mutation table, batch coalescing, iterative pull/push sync loop until `has_more == false`, local LWW merge preserving uncommitted outbox changes, clearing outbox items on applied/rejected, retry with exponential backoff, and UI state machine (`Tersinkron`, `Menunggu sinkron (n)`, `Server tidak terjangkau (Tailscale aktif?)`, `Jam perangkat tidak akurat (>5 menit)`).
6. Document all dependencies, interface contracts, and architectural constraints.
7. Write a comprehensive survey report to `D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\report.md` and complete handoff in `handoff.md`.

## 2026-09-29T14:26:24Z
You are teamwork_preview_explorer_survey_client, an Explorer subagent in the VibeHabit project.
Your identity and assignment:
- Role: Client Local DB & Sync Engine Specification Explorer
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

Instructions:
1. First read D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md (MANDATORY).
2. Read your assignment in D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\DISPATCH.md.
3. Read project reference docs: docs/PRD.md, docs/ARCHITECTURE.md, docs/AGENTS.md, docs/TASKS.md, docs/PROGRESS.md.
4. Thoroughly investigate apps/web/, particularly apps/web/src/db/ and apps/web/src/sync/, and related files.
5. Survey the current state vs required state for:
   - Client local-first database engine with Dexie (IndexedDB): schema matching domain models, compound indexes [habit_id+date] and date on logs for <0.3s query performance across 35,000 logs.
   - Storage persistence registration (navigator.storage.persist()).
   - Reactive query hooks and CRUD helpers.
   - Cascading tombstone deletion for habits, schedules, and logs within a single Dexie transaction.
   - Persistent outbox mutation table in Dexie.
   - Batch coalescing logic for pending outbox mutations.
   - Iterative pull/push sync engine loop until has_more == false.
   - Local LWW merge logic preserving uncommitted local outbox edits.
   - Outbox cleanup on applied/rejected.
   - Retry with exponential backoff and UI state machine (Tersinkron, Menunggu sinkron (n), Server tidak terjangkau (Tailscale aktif?), Jam perangkat tidak akurat (>5 menit)).
6. Write a detailed analysis report to D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\report.md.
7. Write your self-contained handoff in D:\Informasi\WebHabit\.agents\teamwork\teamwork_preview_explorer_survey_client\handoff.md, update progress.md, and send a completion message to your parent.
