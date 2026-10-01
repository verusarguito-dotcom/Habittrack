import type {
  SyncRequest,
  SyncResponse,
  SyncTable,
  SyncableRecord
} from '@vibehabit/shared';
import { doesIncomingWinLww } from '@vibehabit/shared';
import type { VibeHabitDatabase } from '../db/database.js';
import type { HabitLog } from '@vibehabit/shared';
import { coalesceOutbox } from './outbox.js';
import { SyncStateMachine, type UiSyncState } from './state.js';

export interface SyncTransport {
  send(request: SyncRequest, token: string): Promise<{ status: number; body: any }>;
}

export class FetchSyncTransport implements SyncTransport {
  constructor(private apiBaseUrl = '/api/v1') {}

  async send(request: SyncRequest, token: string): Promise<{ status: number; body: any }> {
    const url = `${this.apiBaseUrl}/sync`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(request)
    });

    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }
}

export interface SyncEngineOptions {
  db: VibeHabitDatabase;
  deviceId: string;
  authToken: string | (() => string | Promise<string>);
  apiBaseUrl?: string;
  transport?: SyncTransport;
  getTimeOffsetMs?: () => number;
  onStateChange?: (state: UiSyncState) => void;
  initialServerSeq?: number;
}

export interface SyncResult {
  success: boolean;
  loops: number;
  error?: string;
}

export class SyncEngine {
  private db: VibeHabitDatabase;
  private deviceId: string;
  private authToken: string | (() => string | Promise<string>);
  private transport: SyncTransport;
  private getTimeOffsetMs?: () => number;
  private lastServerSeq = 0;
  private retryAttempt = 0;
  private stateMachine: SyncStateMachine;

  constructor(options: SyncEngineOptions) {
    this.db = options.db;
    this.deviceId = options.deviceId;
    this.authToken = options.authToken;
    this.transport = options.transport ?? new FetchSyncTransport(options.apiBaseUrl ?? '/api/v1');
    this.getTimeOffsetMs = options.getTimeOffsetMs;
    this.lastServerSeq = options.initialServerSeq ?? 0;
    this.stateMachine = new SyncStateMachine(0);

    if (options.onStateChange) {
      this.stateMachine.subscribe(options.onStateChange);
    }
  }

  public getSyncState(): UiSyncState {
    return this.stateMachine.getState();
  }

  public getRetryAttempt(): number {
    return this.retryAttempt;
  }

  public getLastServerSeq(): number {
    return this.lastServerSeq;
  }

  public setLastServerSeq(seq: number): void {
    this.lastServerSeq = seq;
  }

  public getClientTime(): string {
    const offset = this.getTimeOffsetMs ? this.getTimeOffsetMs() : 0;
    return new Date(Date.now() + offset).toISOString();
  }

  private async getResolvedAuthToken(): Promise<string> {
    if (typeof this.authToken === 'function') {
      return await this.authToken();
    }
    return this.authToken;
  }

  public async updateStateFromOutbox(): Promise<void> {
    const count = await this.db.outbox.count();
    this.stateMachine.update(count);
  }

  /**
   * Iterative sync pull/push loop until has_more == false and outbox is drained (PRD §8.2 & ARCHITECTURE §6.4).
   */
  public async sync(): Promise<SyncResult> {
    let loops = 0;
    const maxLoops = 20;
    const token = await this.getResolvedAuthToken();

    while (loops < maxLoops) {
      loops++;

      // 1. Read and coalesce all outbox items
      const allOutbox = await this.db.outbox.toArray();
      const { mutations, outboxItemMap } = coalesceOutbox(allOutbox);

      // Max 200 mutations per request batch
      const batchMutations = mutations.slice(0, 200);

      const request: SyncRequest = {
        protocol_version: 1,
        device_id: this.deviceId,
        client_time: this.getClientTime(),
        client_last_server_seq: this.lastServerSeq,
        mutations: batchMutations
      };

      // 2. Dispatch to server transport
      let response: { status: number; body: any };
      try {
        response = await this.transport.send(request, token);
      } catch {
        this.retryAttempt++;
        this.stateMachine.setError('SERVER_UNREACHABLE');
        return { success: false, loops, error: 'SERVER_UNREACHABLE' };
      }

      if (response.status === 401) {
        this.stateMachine.setError('UNAUTHORIZED');
        return { success: false, loops, error: 'UNAUTHORIZED' };
      }

      if (response.status === 409) {
        this.stateMachine.setError('CLOCK_SKEW');
        return { success: false, loops, error: 'CLOCK_SKEW' };
      }

      if (response.status >= 500 || response.status === 503) {
        this.retryAttempt++;
        this.stateMachine.setError('SERVER_UNREACHABLE');
        return { success: false, loops, error: 'SERVER_UNREACHABLE' };
      }

      if (response.status !== 200) {
        return { success: false, loops, error: `HTTP_${response.status}` };
      }

      const syncResponse = response.body as SyncResponse;

      // 3. Collect outbox item IDs to clear from server confirmation
      const confirmedMutationIds = new Set([
        ...syncResponse.applied,
        ...syncResponse.rejected.map((r) => r.mutation_id)
      ]);

      const outboxIdsToDelete: string[] = [];
      for (const [mutationId, outboxIds] of outboxItemMap.entries()) {
        if (confirmedMutationIds.has(mutationId)) {
          outboxIdsToDelete.push(...outboxIds);
        }
      }

      // 4. Dexie transaction: clear confirmed outbox entries and merge incoming changes with Local LWW
      await this.db.transaction(
        'rw',
        [
          this.db.categories,
          this.db.habits,
          this.db.habit_schedules,
          this.db.logs,
          this.db.settings,
          this.db.outbox
        ],
        async () => {
          if (outboxIdsToDelete.length > 0) {
            await this.db.outbox.bulkDelete(outboxIdsToDelete);
          }

          // Read remaining uncommitted local outbox entries
          const remainingOutbox = await this.db.outbox.toArray();

          for (const change of syncResponse.changes) {
            const { table, record } = change;
            const pendingForRecord = remainingOutbox.filter(
              (o) => o.table === table && o.record_id === record.id
            );

            if (pendingForRecord.length > 0) {
              // Compare server record against latest uncommitted local mutation
              const latestLocal = pendingForRecord[pendingForRecord.length - 1]!.record;
              if (doesIncomingWinLww(record, latestLocal)) {
                await this.applyRecordToTable(table, record);
              }
              // If local wins, preserve uncommitted local record
            } else {
              // No pending mutation: apply if server change strictly wins over local
              const existingLocal = await this.getRecordFromTable(table, record.id);
              if (doesIncomingWinLww(record, existingLocal)) {
                await this.applyRecordToTable(table, record);
              }
            }
          }
        }
      );

      // 5. Update cursor
      this.lastServerSeq = syncResponse.new_server_seq;

      // 6. Reset retry backoff upon success
      this.retryAttempt = 0;
      this.stateMachine.clearError();

      // 7. Check if loop should terminate
      const remainingCount = await this.db.outbox.count();
      if (!syncResponse.has_more && remainingCount === 0) {
        this.stateMachine.update(0);
        return { success: true, loops };
      }
    }

    const remainingCount = await this.db.outbox.count();
    this.stateMachine.update(remainingCount);
    return { success: true, loops };
  }

  private async getRecordFromTable(
    table: SyncTable,
    id: string
  ): Promise<SyncableRecord | undefined> {
    switch (table) {
      case 'categories':
        return await this.db.categories.get(id);
      case 'habits':
        return await this.db.habits.get(id);
      case 'habit_schedules':
        return await this.db.habit_schedules.get(id);
      case 'logs':
        return await this.db.logs.get(id);
      case 'settings':
        return await this.db.settings.get(id);
    }
  }

  private async applyRecordToTable(
    table: SyncTable,
    record: SyncableRecord
  ): Promise<void> {
    switch (table) {
      case 'categories':
        await this.db.categories.put(record as any);
        break;
      case 'habits':
        await this.db.habits.put(record as any);
        break;
      case 'habit_schedules':
        await this.db.habit_schedules.put(record as any);
        break;
      case 'logs': {
        const log = record as HabitLog;
        // Verify no conflicting log with different ID on [habit_id+tanggal]
        const existingByDate = await this.db.logs
          .where('[habit_id+tanggal]')
          .equals([log.habit_id, log.tanggal])
          .first();

        if (existingByDate && existingByDate.id !== log.id) {
          if (doesIncomingWinLww(log, existingByDate)) {
            await this.db.logs.delete(existingByDate.id);
            await this.db.logs.put(log);
          }
        } else {
          await this.db.logs.put(log);
        }
        break;
      }
      case 'settings':
        await this.db.settings.put(record as any);
        break;
    }
  }
}
