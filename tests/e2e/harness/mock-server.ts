import crypto from 'node:crypto';
import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  SyncChange,
  SyncRejectedItem,
  SyncRequest,
  SyncResponse,
  SyncTable,
  SyncableRecord
} from '@vibehabit/shared';
import { compareLww, syncRequestSchema } from '@vibehabit/shared';

export interface ServerConfig {
  databaseUrl: string;
  deviceTokens: Record<string, string>; // device_id -> token SHA256 hex digest
  port?: number;
  host?: string;
}

export function validateServerConfig(config: Partial<ServerConfig>): ServerConfig {
  if (!config.databaseUrl || !config.databaseUrl.trim()) {
    throw new Error('CONFIG_ERROR: DATABASE_URL is required and must not be empty');
  }
  if (!config.databaseUrl.startsWith('postgres://') && !config.databaseUrl.startsWith('postgresql://')) {
    throw new Error('CONFIG_ERROR: DATABASE_URL must be a valid PostgreSQL connection string');
  }
  if (!config.deviceTokens || Object.keys(config.deviceTokens).length === 0) {
    throw new Error('CONFIG_ERROR: DEVICE_TOKENS must contain at least one valid device entry');
  }
  const host = config.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    throw new Error('CONFIG_ERROR: Server must strictly bind to 127.0.0.1');
  }
  return {
    databaseUrl: config.databaseUrl,
    deviceTokens: config.deviceTokens,
    port: config.port ?? 3001,
    host
  };
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

export class MockServer {
  public readonly config: ServerConfig;
  private globalServerSeq = 0;
  private serverTimeOffsetMs = 0;
  private advisoryLockHeld = false;
  private simulatedDown = false;

  // Database tables
  public categories = new Map<string, Category & { server_seq: number }>();
  public habits = new Map<string, Habit & { server_seq: number }>();
  public habitSchedules = new Map<string, HabitSchedule & { server_seq: number }>();
  public logs = new Map<string, HabitLog & { server_seq: number }>();
  public settings = new Map<string, Setting & { server_seq: number }>();

  // Transaction history for auditing and idempotency verification
  public syncRequestHistory: Array<{ request: SyncRequest; response: HttpResponse<any> }> = [];

  constructor(configOverrides: Partial<ServerConfig> = {}) {
    const defaultTokens: Record<string, string> = {
      'device-test-01': crypto.createHash('sha256').update('token-device-01-secret').digest('hex'),
      'device-test-02': crypto.createHash('sha256').update('token-device-02-secret').digest('hex')
    };

    this.config = validateServerConfig({
      databaseUrl: configOverrides.databaseUrl ?? 'postgresql://vibehabit:vibehabit@127.0.0.1:5432/vibehabit_test',
      deviceTokens: configOverrides.deviceTokens ?? defaultTokens,
      port: configOverrides.port ?? 3001,
      host: configOverrides.host ?? '127.0.0.1'
    });
  }

  public setServerDown(down: boolean): void {
    this.simulatedDown = down;
  }

  public isServerDown(): boolean {
    return this.simulatedDown;
  }

  public setServerTimeOffset(offsetMs: number): void {
    this.serverTimeOffsetMs = offsetMs;
  }

  public getServerTime(): Date {
    return new Date(Date.now() + this.serverTimeOffsetMs);
  }

  public getServerTimeIso(): string {
    return this.getServerTime().toISOString();
  }

  public getGlobalServerSeq(): number {
    return this.globalServerSeq;
  }

  /**
   * Bearer Authentication middleware verification using constant-time comparison
   */
  public verifyBearerAuth(authHeader?: string): { authorized: boolean; deviceId?: string } {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authorized: false };
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return { authorized: false };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const encoder = new TextEncoder();
    const tokenBuffer = encoder.encode(tokenHash);

    for (const [deviceId, validHash] of Object.entries(this.config.deviceTokens)) {
      const validBuffer = encoder.encode(validHash);
      if (tokenBuffer.length === validBuffer.length && crypto.timingSafeEqual(tokenBuffer, validBuffer)) {
        return { authorized: true, deviceId };
      }
    }

    return { authorized: false };
  }

  /**
   * Health Check: GET /api/v1/health
   */
  public handleHealthCheck(): HttpResponse<{ status: string; timestamp: string }> {
    if (this.simulatedDown) {
      return {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'service_unavailable', timestamp: this.getServerTimeIso() }
      };
    }
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        status: 'ok',
        timestamp: this.getServerTimeIso()
      }
    };
  }

  /**
   * Sync Endpoint: POST /api/v1/sync
   */
  public handleSync(
    rawPayload: unknown,
    authHeader?: string
  ): HttpResponse<SyncResponse | { error: string; message: string; server_time?: string; details?: any }> {
    if (this.simulatedDown) {
      return {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'SERVICE_UNAVAILABLE', message: 'Server is currently unreachable' }
      };
    }

    // 1. Auth check
    const authResult = this.verifyBearerAuth(authHeader);
    if (!authResult.authorized) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'UNAUTHORIZED', message: 'Invalid or missing Bearer token' }
      };
    }

    // 2. Validate payload schema
    const parseResult = syncRequestSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: 'VALIDATION_ERROR',
          message: 'Invalid sync request payload',
          details: parseResult.error.format()
        }
      };
    }

    const syncRequest = parseResult.data as SyncRequest;
    const serverTime = this.getServerTime();
    const serverTimeMs = serverTime.getTime();
    const serverTimeIso = serverTime.toISOString();
    const clientTimeMs = new Date(syncRequest.client_time).getTime();

    // 3. Acquire simulated transaction advisory lock
    if (this.advisoryLockHeld) {
      return {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'LOCK_CONTENTION', message: 'Sync lock currently held by concurrent transaction' }
      };
    }
    this.advisoryLockHeld = true;

    try {
      // 4. Request-level clock skew validation (> 5 minutes = 300,000 ms)
      const skewThresholdMs = 5 * 60 * 1000;
      if (Math.abs(clientTimeMs - serverTimeMs) > skewThresholdMs) {
        return {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
          body: {
            error: 'CLOCK_SKEW',
            message: `Client clock skew (${Math.abs(clientTimeMs - serverTimeMs)}ms) exceeds 5 minutes threshold`,
            server_time: serverTimeIso
          }
        };
      }
      // Snapshot state for atomic rollback on failure
      const snapshot = this.takeSnapshot();

      const applied: string[] = [];
      const rejected: SyncRejectedItem[] = [];

      // Sort mutations in topological order: categories -> habits -> habit_schedules -> logs -> settings
      const tableOrder: Record<SyncTable, number> = {
        categories: 1,
        habits: 2,
        habit_schedules: 3,
        logs: 4,
        settings: 5
      };

      const sortedMutations = [...syncRequest.mutations].sort(
        (a, b) => tableOrder[a.table] - tableOrder[b.table]
      );

      // Process mutations
      for (const mutation of sortedMutations) {
        const record = mutation.record;
        const updatedTimeMs = new Date(record.updated_at).getTime();

        // Reject individual mutation if updated_at is > 5 minutes in the future
        if (updatedTimeMs > serverTimeMs + skewThresholdMs) {
          rejected.push({
            mutation_id: mutation.mutation_id,
            reason: `Mutation updated_at is in the future (>5 minutes): ${record.updated_at}`
          });
          continue;
        }

        // LWW resolution against current table
        const applyResult = this.applyMutationLww(mutation.table, record);
        if (applyResult.status === 'error') {
          // Rollback entire batch
          this.restoreSnapshot(snapshot);
          return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'TRANSACTION_FAILED', message: applyResult.error ?? 'Unknown transaction error' }
          };
        }

        applied.push(mutation.mutation_id);
      }

      // 5. Pull query: select records where server_seq > client_last_server_seq, ordered by server_seq asc, max 500
      const pullResult = this.executePullQuery(syncRequest.client_last_server_seq, 500);

      const responseBody: SyncResponse = {
        server_time: serverTimeIso,
        applied,
        rejected,
        changes: pullResult.changes,
        new_server_seq: pullResult.new_server_seq,
        has_more: pullResult.has_more
      };

      const response: HttpResponse<SyncResponse> = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: responseBody
      };

      this.syncRequestHistory.push({ request: syncRequest, response });
      return response;
    } finally {
      this.advisoryLockHeld = false;
    }
  }

  private applyMutationLww(
    table: SyncTable,
    incoming: SyncableRecord
  ): { status: 'applied' | 'ignored' | 'error'; error?: string } {
    const tableMap = this.getTableMap(table);

    // Special uniqueness check for logs: UNIQUE(habit_id, tanggal)
    if (table === 'logs') {
      const incomingLog = incoming as HabitLog;
      for (const [id, existingLog] of this.logs.entries()) {
        if (id !== incomingLog.id && existingLog.habit_id === incomingLog.habit_id && existingLog.tanggal === incomingLog.tanggal) {
          // Conflict on unique constraint: resolve via LWW
          const cmp = compareLww(incomingLog, existingLog);
          if (cmp > 0) {
            this.logs.delete(id);
          } else {
            // Existing wins unique constraint conflict
            return { status: 'ignored' };
          }
        }
      }
    }

    const existing = tableMap.get(incoming.id);
    const comparison = compareLww(incoming, existing);

    if (comparison > 0) {
      // Incoming strictly wins LWW
      this.globalServerSeq += 1;
      const stored = {
        ...incoming,
        server_seq: this.globalServerSeq
      } as any;
      tableMap.set(incoming.id, stored);
      return { status: 'applied' };
    } else if (comparison === 0) {
      // Completely identical (idempotent replay): retain existing server_seq
      return { status: 'applied' };
    } else {
      // Incoming loses LWW: discard change on server, but report in applied so client clears outbox
      return { status: 'ignored' };
    }
  }

  private executePullQuery(
    sinceSeq: number,
    limit = 500
  ): { changes: SyncChange[]; new_server_seq: number; has_more: boolean } {
    const allRecords: Array<{ table: SyncTable; record: SyncableRecord & { server_seq: number } }> = [];

    const collect = (table: SyncTable, map: Map<string, SyncableRecord & { server_seq: number }>) => {
      for (const record of map.values()) {
        if (record.server_seq > sinceSeq) {
          allRecords.push({ table, record });
        }
      }
    };

    collect('categories', this.categories);
    collect('habits', this.habits);
    collect('habit_schedules', this.habitSchedules);
    collect('logs', this.logs);
    collect('settings', this.settings);

    // Sort strictly ascending by server_seq
    allRecords.sort((a, b) => a.record.server_seq - b.record.server_seq);

    const hasMore = allRecords.length > limit;
    const paginated = allRecords.slice(0, limit);

    const highestSeq =
      paginated.length > 0
        ? paginated[paginated.length - 1]!.record.server_seq
        : Math.max(sinceSeq, this.globalServerSeq);

    return {
      changes: paginated,
      new_server_seq: highestSeq,
      has_more: hasMore
    };
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

  private takeSnapshot() {
    return {
      globalSeq: this.globalServerSeq,
      categories: new Map(this.categories),
      habits: new Map(this.habits),
      habitSchedules: new Map(this.habitSchedules),
      logs: new Map(this.logs),
      settings: new Map(this.settings)
    };
  }

  private restoreSnapshot(snapshot: ReturnType<typeof this.takeSnapshot>) {
    this.globalServerSeq = snapshot.globalSeq;
    this.categories = snapshot.categories;
    this.habits = snapshot.habits;
    this.habitSchedules = snapshot.habitSchedules;
    this.logs = snapshot.logs;
    this.settings = snapshot.settings;
  }
}
