# Dispatch Assignment: Milestone 1 Contract Refinements (`packages/shared`)

## Assigned Agent
- Role: Shared Contracts Worker
- Archetype: teamwork_preview_worker
- Working directory: D:\Informasi\WebHabit\.agents\teamwork\worker_milestone_1\
- Parent conversation ID: 89318b56-d32e-4cac-9db8-3b1e78559fa0

## Objective
Implement the contract refinements in `packages/shared` as specified in the survey reports and `PROJECT.md`:
1. Read `D:\Informasi\WebHabit\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY).
2. Read `PROJECT.md` and `docs/ARCHITECTURE.md`.
3. In `packages/shared/src/types/sync.ts`:
   - Define and export `ClockSkewErrorResponse`:
     ```typescript
     export interface ClockSkewErrorResponse {
       error: 'CLOCK_SKEW';
       message: string;
       server_time: string; // ISO 8601
     }
     ```
   - Define and export `OutboxEntry`:
     ```typescript
     export interface OutboxEntry {
       id: string; // UUID
       table: SyncTable;
       record_id: string;
       action: 'insert' | 'update' | 'delete';
       payload: Record<string, unknown>;
       created_at: string; // ISO 8601
     }
     ```
4. In `packages/shared/src/schemas/sync.ts`:
   - Define and export `clockSkewErrorResponseSchema`:
     ```typescript
     export const clockSkewErrorResponseSchema = z.object({
       error: z.literal('CLOCK_SKEW'),
       message: z.string(),
       server_time: isoDateTimeStringSchema
     });
     ```
   - Define and export `outboxEntrySchema`.
5. In `packages/shared/src/index.ts`:
   - Export all newly added schemas and types.
6. Run verification commands:
   - `npm run typecheck`
   - `npm test`
   Ensure 100% of tests pass and 0 typecheck errors.
7. Write `handoff.md` and `progress.md` in your working directory and notify the parent orchestrator.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
