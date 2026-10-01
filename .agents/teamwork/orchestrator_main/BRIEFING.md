# BRIEFING — 2026-09-29T14:24:47Z

## Mission
Orchestrate and deliver the complete backend synchronization service (Fastify, Kysely, PostgreSQL) and client local-first database engine (Dexie IndexedDB, outbox mutation queue, sync orchestrator) for VibeHabit per ORIGINAL_REQUEST.md and project documentation.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\orchestrator_main\
- Original parent: sentinel
- Original parent conversation ID: 847223ec-4d97-4c0f-8ff7-d3b0932340d6

## 🔒 My Workflow
- **Pattern**: Project Pattern (Top-Level Project Orchestrator)
- **Scope document**: D:\Informasi\WebHabit\PROJECT.md
1. **Survey & Decompose**:
   - Step 0: Spawn 3 Explorers in parallel to survey the codebase, architecture, contracts, and requirements.
   - Synthesize survey findings into PROJECT.md (Architecture, Feature Inventory, Milestones, Interface Contracts, Code Layout).
   - Spawn E2E Testing Orchestrator for independent opaque-box requirement-driven testing track.
   - Decompose implementation into cohesive milestones:
     * Milestone 2 (Backend Sync Service: migrations, Kysely client, Fastify server, auth middleware, sync endpoint).
     * Milestone 3 (Client Local Database & Sync Engine: Dexie schema, persistent storage, outbox, sync orchestrator, UI states).
     * Final Milestone: Pass 100% E2E tests and adversarial coverage hardening.
2. **Dispatch & Execute**:
   - Delegate implementation milestones to sub-orchestrators or run iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor -> Gate).
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical; auditor is NEVER skippable)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: Project Orchestrator must redesign on failure (cannot escalate further)
4. **Succession**:
   - Self-succeed at 16 spawns. Write handoff.md, kill timers, invoke_subagent with orchestrator archetype passing parent ID.
- **Work items**:
  1. Survey & Architecture Mapping [in-progress]
  2. PROJECT.md & TEST_INFRA.md initialization [pending]
  3. Milestone 2 Implementation (Backend Sync) [pending]
  4. Milestone 3 Implementation (Client DB & Sync) [pending]
  5. E2E Test Suite & Integration Verification [pending]
  6. Final Hardening & DoD Gate [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Step 0 - Survey via 3 parallel Explorers

## 🔒 Key Constraints
- DISPATCH-ONLY orchestrator: NEVER write, modify, or create source code files directly.
- NEVER run build/test commands directly — delegate to workers.
- NEVER investigate or explore problem at code level directly — dispatch Explorers.
- Write ONLY metadata (.md) files in .agents/teamwork/ (and PROJECT.md at root).
- Respect D:\ workspace rules: DILARANG KERAS menghapus, memindahkan, atau menimpa berkas tanpa izin pengguna.
- Forensic Auditor is a BINARY VETO — violation means unconditional failure.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Always include path to ORIGINAL_REQUEST.md in subagent dispatches.

## Current Parent
- Conversation ID: 847223ec-4d97-4c0f-8ff7-d3b0932340d6
- Updated: 2026-09-29T14:24:47Z

## Key Decisions Made
- Selected Project Pattern with dual track (Implementation + E2E Testing).
- Top-level survey initiates with 3 parallel Explorers surveying server, client/sync, and testing/docker infra.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_server | teamwork_preview_explorer | Survey Server & Sync Backend | completed | 6fbb3508-b535-4ad2-9d17-3165094b2ef7 |
| explorer_survey_client | teamwork_preview_explorer | Survey Client Local DB & Sync Engine | completed | 26b83267-6c39-41ba-aeb7-c39e80117b70 |
| explorer_survey_infra | teamwork_preview_explorer | Survey Shared Contracts & Test Infra | completed | e216666a-ab73-4ac3-8af6-34a2c6e826be |
| worker_milestone_1 | teamwork_preview_worker | Milestone 1 Shared Schema Refinement | completed | 232391ab-b336-4d4a-94a7-4baa2dcfea2d |
| test_writer_e2e | teamwork_preview_test_writer | E2E Testing Track (Tiers 1-4) | in-progress | 9b853cfb-f425-40c8-9f38-053260e4f9a3 |
| reviewer_m1_1 | teamwork_preview_reviewer | Review Milestone 1 Contracts | in-progress | e73c8586-12cd-410f-96ad-8948f21e29d3 |
| reviewer_m1_2 | teamwork_preview_reviewer | Review Milestone 1 Contracts | in-progress | 2ab7ce88-24d8-4a93-93da-18cb2bd225fd |
| challenger_m1_1 | teamwork_preview_challenger | Challenge Milestone 1 Edge Cases | in-progress | a49ebb4c-2dd6-44b7-9e26-ec5c035cc14a |
| challenger_m1_2 | teamwork_preview_challenger | Challenge Milestone 1 Stress | in-progress | cf24dad4-b9e7-4c08-b117-a46543088b93 |
| auditor_m1 | teamwork_preview_auditor | Forensic Integrity Audit M1 | in-progress | e4ba836d-6936-4bcb-8a5b-adcb787ae321 |

## Succession Status
- Succession required: no
- Spawn count: 10 / 16
- Pending subagents: 6
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 89318b56-d32e-4cac-9db8-3b1e78559fa0/task-20
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run manage_task(Action="list") — re-create if missing

## Artifact Index
- D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md — Original User Request
- D:\Informasi\WebHabit\.agents\teamwork\orchestrator_main\DISPATCH.md — Dispatch log
- D:\Informasi\WebHabit\.agents\teamwork\orchestrator_main\BRIEFING.md — Persistent working memory
