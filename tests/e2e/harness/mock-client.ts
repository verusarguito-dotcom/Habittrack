import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  SyncChange,
  SyncMutation,
  SyncRequest,
  SyncTable,
  SyncableRecord
} from '@vibehabit/shared';
import { compareLww, doesIncomingWinLww } from '@vibehabit/shared';
import type { MockServer } from './mock-server.js';
import { generateDeterministicUuid, generateDeterministicTimestamp } from './deterministic-generators.js';

export type UiSyncState =
  | 'Tersinkron'
  | `Menunggu sinkron (${number})`
  | 'Server tidak terjangkau (Tailscale aktif?)'
  | 'Jam perangkat tidak akurat (>5 menit)';

export interface OutboxItem {
  id: string;
  table: SyncTable;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  record: SyncableRecord;
  predecessor_ids: string[];
  created_at: string;
}

export interface StorageEstimate {
  quota: number;
  usage: number;
}

export class MockClient {
  public readonly deviceId: string;
  public readonly authToken: string;
  public clientLastServerSeq = 0;
  public clockOffsetMs = 0;
  public isOnline = true;

  // Local Dexie tables
  public categories = new Map<string, Category>();
  public habits = new Map<string, Habit>();
  public habitSchedules = new Map<string, HabitSchedule>();
  public logs = new Map<string, HabitLog>();
  public settings = new Map<string, Setting>();
  public outbox: OutboxItem[] = [];

  // Persistent storage state
  public isStoragePersisted = false;
  public storageEstimate: StorageEstimate = {
    quota: 10 * 1024 * 1024 * 1024, // 10 GB
    usage: 1024 * 1024 // 1 MB
  };

  // Sync state machine & retry backoff
  public syncState: UiSyncState = 'Tersinkron';
  public retryAttempt = 0;

  constructor(deviceId: string, authToken = 'token-device-01-secret') {
    this.deviceId = deviceId;
    this.authToken = authToken;
  }

  public getClientTime(): string {
    return new Date(Date.now() + this.clockOffsetMs).toISOString();
  }

  public setClockOffset(offsetMs: number): void {
    this.clockOffsetMs = offsetMs;
  }

  /**
   * Storage persistence registration simulation (R4)
   */
  public async registerStoragePersistence(): Promise<boolean> {
    this.isStoragePersisted = true;
    return this.isStoragePersisted;
  }

  public async getStorageEstimate(): Promise<StorageEstimate> {
    return this.storageEstimate;
  }

  /**
   * Update UI sync state based on pending mutations and connection
   */
  public updateUiSyncState(stateOverride?: UiSyncState): void {
    if (stateOverride) {
      this.syncState = stateOverride;
      return;
    }
    const pendingCount = this.outbox.length;
    if (pendingCount > 0) {
      this.syncState = `Menunggu sinkron (${pendingCount})`;
    } else {
      this.syncState = 'Tersinkron';
    }
  }

  /**
   * Calculate exponential backoff with jitter (2s–60s) (R5)
   */
  public calculateBackoffMs(attempt: number, randomJitterRatio = 0.1): number {
    const baseMs = 2000;
    const maxMs = 60000;
    const expMs = Math.min(maxMs, baseMs * Math.pow(2, attempt));
    const jitter = expMs * randomJitterRatio;
    return Math.floor(expMs + jitter);
  }

  /**
   * Local Reactive CRUD Operations (R4)
   */
  public saveCategory(category: Category): void {
    this.categories.set(category.id, category);
    this.enqueueOutbox('categories', category.id, 'insert', category);
  }

  public saveHabit(habit: Habit): void {
    this.habits.set(habit.id, habit);
    this.enqueueOutbox('habits', habit.id, 'insert', habit);
  }

  public saveHabitSchedule(schedule: HabitSchedule): void {
    this.habitSchedules.set(schedule.id, schedule);
    this.enqueueOutbox('habit_schedules', schedule.id, 'insert', schedule);
  }

  public saveHabitLog(log: HabitLog): void {
    // Enforce UNIQUE(habit_id, tanggal) in local client store
    for (const [id, existing] of this.logs.entries()) {
      if (id !== log.id && existing.habit_id === log.habit_id && existing.tanggal === log.tanggal) {
        if (compareLww(log, existing) > 0) {
          this.logs.delete(id);
        } else {
          return;
        }
      }
    }
    this.logs.set(log.id, log);
    this.enqueueOutbox('logs', log.id, 'insert', log);
  }

  public saveSetting(setting: Setting): void {
    this.settings.set(setting.id, setting);
    this.enqueueOutbox('settings', setting.id, 'insert', setting);
  }

  /**
   * Cascading tombstone deletion within single Dexie transaction (R4)
   */
  public deleteHabitCascading(habitId: string, timestamp?: string): void {
    const now = timestamp ?? generateDeterministicTimestamp();

    // 1. Mark habit deleted
    const habit = this.habits.get(habitId);
    if (habit) {
      const deletedHabit: Habit = {
        ...habit,
        deleted_at: now,
        updated_at: now,
        device_id: this.deviceId
      };
      this.habits.set(habitId, deletedHabit);
      this.enqueueOutbox('habits', habitId, 'delete', deletedHabit);
    }

    // 2. Cascade delete all schedules for this habit
    for (const schedule of this.habitSchedules.values()) {
      if (schedule.habit_id === habitId && !schedule.deleted_at) {
        const deletedSchedule: HabitSchedule = {
          ...schedule,
          deleted_at: now,
          updated_at: now,
          device_id: this.deviceId
        };
        this.habitSchedules.set(schedule.id, deletedSchedule);
        this.enqueueOutbox('habit_schedules', schedule.id, 'delete', deletedSchedule);
      }
    }

    // 3. Cascade delete all logs for this habit
    for (const log of this.logs.values()) {
      if (log.habit_id === habitId && !log.deleted_at) {
        const deletedLog: HabitLog = {
          ...log,
          deleted_at: now,
          updated_at: now,
          device_id: this.deviceId
        };
        this.logs.set(log.id, deletedLog);
        this.enqueueOutbox('logs', log.id, 'delete', deletedLog);
      }
    }
  }

  /**
   * Compound index query simulation: [habit_id+tanggal]
   */
  public queryLogsByHabitAndDate(habitId: string, tanggal: string): HabitLog | undefined {
    for (const log of this.logs.values()) {
      if (log.habit_id === habitId && log.tanggal === tanggal && !log.deleted_at) {
        return log;
      }
    }
    return undefined;
  }

  /**
   * Date index query simulation: tanggal
   */
  public queryLogsByDate(tanggal: string): HabitLog[] {
    const results: HabitLog[] = [];
    for (const log of this.logs.values()) {
      if (log.tanggal === tanggal && !log.deleted_at) {
        results.push(log);
      }
    }
    return results;
  }

  /**
   * Outbox mutation management
   */
  private enqueueOutbox(
    table: SyncTable,
    recordId: string,
    action: 'insert' | 'update' | 'delete',
    record: SyncableRecord
  ): void {
    const item: OutboxItem = {
      id: generateDeterministicUuid('out00000'),
      table,
      record_id: recordId,
      action,
      record,
      predecessor_ids: [],
      created_at: generateDeterministicTimestamp()
    };
    this.outbox.push(item);
    this.updateUiSyncState();
  }

  /**
   * Outbox batch coalescing: merges pending mutations per record into single payload (R5)
   */
  public coalesceOutbox(): { mutations: SyncMutation[]; outboxItemMap: Map<string, string[]> } {
    const grouped = new Map<string, OutboxItem[]>();

    for (const item of this.outbox) {
      const key = `${item.table}:${item.record_id}`;
      const group = grouped.get(key) ?? [];
      group.push(item);
      grouped.set(key, group);
    }

    const coalescedMutations: SyncMutation[] = [];
    const outboxItemMap = new Map<string, string[]>(); // mutation_id -> all covered outbox item ids

    for (const [, items] of grouped.entries()) {
      // Latest item in the group represents the coalesced record
      const latestItem = items[items.length - 1]!;
      const mutationId = generateDeterministicUuid('mut00000');
      const allOutboxIds = items.flatMap((i) => [i.id, ...i.predecessor_ids]);

      coalescedMutations.push({
        mutation_id: mutationId,
        table: latestItem.table,
        record: latestItem.record
      });

      outboxItemMap.set(mutationId, allOutboxIds);
    }

    return { mutations: coalescedMutations, outboxItemMap };
  }

  /**
   * Merge incoming changes into Dexie using Local LWW (R5)
   */
  public mergeIncomingChanges(changes: SyncChange[]): void {
    for (const change of changes) {
      const tableMap = this.getTableMap(change.table);
      const localRecord = tableMap.get(change.record.id) as SyncableRecord | undefined;

      // Check if local has pending uncommitted outbox mutation for this record
      const pendingOutbox = this.outbox.filter(
        (o) => o.table === change.table && o.record_id === change.record.id
      );

      if (pendingOutbox.length > 0) {
        // Compare server change against latest pending local mutation
        const latestLocal = pendingOutbox[pendingOutbox.length - 1]!.record;
        if (doesIncomingWinLww(change.record, latestLocal)) {
          // Server change strictly wins over uncommitted local edit
          tableMap.set(change.record.id, change.record as any);
        }
        // If local wins, preserve local uncommitted record!
      } else {
        // No local pending mutation: apply if server record wins over existing local
        if (doesIncomingWinLww(change.record, localRecord)) {
          tableMap.set(change.record.id, change.record as any);
        }
      }
    }
  }

  /**
   * Iterative sync loop: pulls and pushes until has_more == false && outbox == 0 (R5)
   */
  public async sync(mockServer: MockServer): Promise<{ success: boolean; loops: number; error?: string }> {
    if (!this.isOnline) {
      this.updateUiSyncState('Server tidak terjangkau (Tailscale aktif?)');
      return { success: false, loops: 0, error: 'OFFLINE' };
    }

    let loops = 0;
    const maxLoops = 20;

    while (loops < maxLoops) {
      loops++;

      // 1. Coalesce outbox mutations (max 200 mutations per batch)
      const { mutations, outboxItemMap } = this.coalesceOutbox();
      const batchMutations = mutations.slice(0, 200);

      const request: SyncRequest = {
        protocol_version: 1,
        device_id: this.deviceId,
        client_time: this.getClientTime(),
        client_last_server_seq: this.clientLastServerSeq,
        mutations: batchMutations
      };

      // 2. Dispatch request to server
      const response = mockServer.handleSync(request, `Bearer ${this.authToken}`);

      if (response.status === 401) {
        this.updateUiSyncState();
        return { success: false, loops, error: 'UNAUTHORIZED' };
      }

      if (response.status === 409) {
        this.updateUiSyncState('Jam perangkat tidak akurat (>5 menit)');
        return { success: false, loops, error: 'CLOCK_SKEW' };
      }

      if (response.status >= 500 || response.status === 503) {
        this.retryAttempt++;
        this.updateUiSyncState('Server tidak terjangkau (Tailscale aktif?)');
        return { success: false, loops, error: 'SERVER_UNREACHABLE' };
      }

      if (response.status !== 200) {
        return { success: false, loops, error: `HTTP_${response.status}` };
      }

      const syncResponse = response.body as {
        server_time: string;
        applied: string[];
        rejected: Array<{ mutation_id: string; reason: string }>;
        changes: SyncChange[];
        new_server_seq: number;
        has_more: boolean;
      };

      // 3. Clear applied and permanently rejected mutations from outbox
      const confirmedMutationIds = new Set([
        ...syncResponse.applied,
        ...syncResponse.rejected.map((r) => r.mutation_id)
      ]);

      const clearedOutboxIds = new Set<string>();
      for (const [mutationId, outboxIds] of outboxItemMap.entries()) {
        if (confirmedMutationIds.has(mutationId)) {
          outboxIds.forEach((id) => clearedOutboxIds.add(id));
        }
      }

      this.outbox = this.outbox.filter((item) => !clearedOutboxIds.has(item.id));

      // 4. Merge incoming server changes
      this.mergeIncomingChanges(syncResponse.changes);

      // 5. Update cursor
      this.clientLastServerSeq = syncResponse.new_server_seq;

      // 6. Reset retry backoff upon success
      this.retryAttempt = 0;

      // 7. Check if loop should terminate
      if (!syncResponse.has_more && this.outbox.length === 0) {
        this.updateUiSyncState('Tersinkron');
        return { success: true, loops };
      }
    }

    this.updateUiSyncState();
    return { success: true, loops };
  }

  private getTableMap(table: SyncTable): Map<string, any> {
    switch (table) {
      case 'categories':
        return this.categories;
      case 'habits':
        return this.habits;
      case 'habit_schedules':
        return this.habitSchedules;
      case 'logs':
        return this.logs;
      case 'settings':
        return this.settings;
    }
  }
}
