# Project Orchestration Plan: VibeHabit Backend Sync & Local-First Client Engine

## Goal
Deliver complete, high-quality, production-ready backend synchronization service and client local-first database engine adhering strictly to documentation and acceptance criteria.

## Phase 0: Survey
- Spawn 3 parallel Explorers:
  1. Explorer 1 (Server & Schema Domain): Survey `apps/server`, `deploy/migrations`, Kysely, fastify setup, `POST /api/v1/sync` specifications in docs.
  2. Explorer 2 (Client & Sync Domain): Survey `apps/web/src/db`, `apps/web/src/sync`, Dexie setup, outbox, mutation coalescing, LWW merge, sync state machine.
  3. Explorer 3 (Shared Contracts & Test Infrastructure): Survey `packages/shared`, domain models, test runner setup, PostgreSQL docker compose (`compose.test.yml`), existing tests and linting.
- Aggregate survey reports into Feature Inventory, Architecture, Interface Contracts, and Milestones in `PROJECT.md`.

## Phase 1: Dual Track Decomposition
- E2E Testing Track:
  - Formulate `TEST_INFRA.md`.
  - Design Tiers 1-4 opaque-box test suites (Category-Partition, BVA, Pairwise, Real-world).
  - Produce `TEST_READY.md`.
- Implementation Track:
  - Milestone 2: Server Database Schema, Fastify Server, Auth Middleware, and Atomic Sync Endpoint.
  - Milestone 3: Client Local Database (Dexie), Reactive Hooks, Outbox Mutation Queue, and Sync Engine.

## Phase 2: Implementation & Verification Loop
- For each milestone:
  - Dispatch Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Forensic Auditor -> Gate.
  - Require strict verification: typecheck, lint, unit tests, integration tests.

## Phase 3: Final Integration & Hardening
- Run full E2E test suite against implementation.
- Adversarial coverage hardening (Tier 5) with Challengers and Workers.
- Final forensic audit across all deliverables.

## Phase 4: Project Acceptance & Sentinel Handoff
- Verify all checklist items in `ORIGINAL_REQUEST.md`.
- Update `docs/TASKS.md` and `docs/PROGRESS.md`.
- Send final completion report with verified evidence to Sentinel.
