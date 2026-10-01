import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { Kysely, PostgresDialect } from 'kysely';
import { buildApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import type { Database } from '../src/db/types.js';
import type {
  SyncRequest,
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting
} from '@vibehabit/shared';

describe('apps/server - Atomic Sync Endpoint POST /api/v1/sync', () => {
  const tokenPlain = 'secret-sync-device-token-12345678';
  const tokenHash = crypto.createHash('sha256').update(tokenPlain).digest('hex');

  const mockConfig: ServerConfig = {
    databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit_test',
    deviceTokens: {
      'device-test-01': tokenHash
    },
    host: '127.0.0.1',
    port: 3001,
    nodeEnv: 'test',
    staticDistPath: 'apps/web/dist'
  };

  const validAuthHeader = `Bearer ${tokenPlain}`;

  // Helper to create an in-memory mock PostgreSQL database for Kysely
  function createMockKyselyDb() {
    const categories = new Map<string, any>();
    const habits = new Map<string, any>();
    const habitSchedules = new Map<string, any>();
    const logs = new Map<string, any>();
    const settings = new Map<string, any>();
    const globalSeq = { current: 0 };
    const advisoryLockHeld = { value: false };

    const getTableMap = (sql: string): Map<string, any> | null => {
      if (sql.includes('"categories"')) return categories;
      if (sql.includes('"habits"')) return habits;
      if (sql.includes('"habit_schedules"')) return habitSchedules;
      if (sql.includes('"logs"')) return logs;
      if (sql.includes('"settings"')) return settings;
      return null;
    };

    const mockPool = {
      connect: async () => {
        return {
          query: async (sqlText: string, params: any[] = []) => {
            const sqlNormalized = sqlText.replace(/\s+/g, ' ').trim();

            // Transaction controls
            if (sqlNormalized.startsWith('begin') || sqlNormalized.startsWith('commit') || sqlNormalized.startsWith('rollback')) {
              return { rows: [] };
            }

            // Advisory Lock
            if (sqlNormalized.includes('pg_try_advisory_xact_lock')) {
              return { rows: [{ locked: !advisoryLockHeld.value }] };
            }

            // Sequence query
            if (sqlNormalized.includes('vibehabit_server_seq') && sqlNormalized.includes('last_value')) {
              return {
                rows: [
                  {
                    last_value: globalSeq.current,
                    is_called: globalSeq.current > 0
                  }
                ]
              };
            }

            // Delete from logs (uniqueness conflict resolution)
            if (sqlNormalized.startsWith('delete from "logs"') && sqlNormalized.includes('where "id" = $1')) {
              const id = params[0];
              logs.delete(id);
              return { rows: [] };
            }

            // Logs lookup by habit_id and tanggal
            if (
              sqlNormalized.includes('from "logs"') &&
              sqlNormalized.includes('"habit_id" = $1') &&
              sqlNormalized.includes('"tanggal" = $2')
            ) {
              const habitId = params[0];
              const tanggal = params[1];
              for (const record of logs.values()) {
                if (record.habit_id === habitId && record.tanggal === tanggal) {
                  return { rows: [{ ...record }] };
                }
              }
              return { rows: [] };
            }

            // Record lookup by ID
            if (sqlNormalized.startsWith('select') && sqlNormalized.includes('where "id" = $1')) {
              const tableMap = getTableMap(sqlNormalized);
              if (tableMap) {
                const id = params[0];
                const found = tableMap.get(id);
                return { rows: found ? [{ ...found }] : [] };
              }
              return { rows: [] };
            }

            // Insert into table
            if (sqlNormalized.startsWith('insert into')) {
              const tableMap = getTableMap(sqlNormalized);
              if (tableMap) {
                globalSeq.current++;
                const colMatch = sqlNormalized.match(/insert into "[^"]+"\s*\(([^)]+)\)\s*values/i);
                const record: any = { server_seq: globalSeq.current };
                if (colMatch) {
                  const columns = colMatch[1].split(',').map((c) => c.replace(/["\s]/g, ''));
                  let paramIdx = 0;
                  for (const col of columns) {
                    if (col === 'server_seq') {
                      continue;
                    }
                    record[col] = params[paramIdx++];
                  }
                }
                tableMap.set(record.id, record);
                return { rows: [] };
              }
            }

            // Update table
            if (sqlNormalized.startsWith('update')) {
              const tableMap = getTableMap(sqlNormalized);
              if (tableMap) {
                globalSeq.current++;
                const setMatches = [...sqlNormalized.matchAll(/"([^"]+)"\s*=\s*\$(\d+)/g)];
                const whereIdMatch = sqlNormalized.match(/where\s+"id"\s*=\s*\$(\d+)/i);
                if (whereIdMatch) {
                  const idParamIdx = parseInt(whereIdMatch[1], 10) - 1;
                  const id = params[idParamIdx];
                  const existing = tableMap.get(id) || { id };
                  for (const match of setMatches) {
                    const col = match[1];
                    const pIdx = parseInt(match[2], 10) - 1;
                    existing[col] = params[pIdx];
                  }
                  existing.server_seq = globalSeq.current;
                  tableMap.set(id, existing);
                }
                return { rows: [] };
              }
            }

            // Pull query: select * from <table> where "server_seq" > $1 order by "server_seq" asc limit $2
            if (
              sqlNormalized.startsWith('select * from') &&
              sqlNormalized.includes('where "server_seq" > $1')
            ) {
              const tableMap = getTableMap(sqlNormalized);
              if (tableMap) {
                const sinceSeq = params[0];
                const limit = params[1];
                const matching = Array.from(tableMap.values())
                  .filter((r) => r.server_seq > sinceSeq)
                  .sort((a, b) => a.server_seq - b.server_seq)
                  .slice(0, limit);
                return { rows: matching.map((r) => ({ ...r })) };
              }
              return { rows: [] };
            }

            return { rows: [] };
          },
          release: () => {}
        };
      }
    };

    const db = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: mockPool as any
      })
    });

    return {
      db,
      categories,
      habits,
      habitSchedules,
      logs,
      settings,
      globalSeq,
      advisoryLockHeld
    };
  }

  function createValidSyncRequest(mutations: any[] = [], overrides: Partial<SyncRequest> = {}): SyncRequest {
    return {
      protocol_version: 1,
      device_id: 'device-test-01',
      client_time: new Date().toISOString(),
      client_last_server_seq: 0,
      mutations,
      ...overrides
    };
  }

  // --- Section 1: Authentication & Authorization ---
  describe('Authentication & Authorization', () => {
    it('rejects missing Authorization header with 401 UNAUTHORIZED', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('UNAUTHORIZED');
      await app.close();
    });

    it('rejects invalid Bearer token with 401 UNAUTHORIZED', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: 'Bearer invalid-wrong-token' },
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('UNAUTHORIZED');
      await app.close();
    });

    it('rejects non-Bearer authorization scheme with 401 UNAUTHORIZED', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: `Basic ${tokenPlain}` },
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('UNAUTHORIZED');
      await app.close();
    });
  });

  // --- Section 2: Payload Validation ---
  describe('Payload Schema Validation', () => {
    it('returns 400 VALIDATION_ERROR on malformed request body', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: { invalid_field: 'not a sync request' }
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('VALIDATION_ERROR');
      await app.close();
    });

    it('returns 400 VALIDATION_ERROR when table is unrecognized', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const req = {
        protocol_version: 1,
        device_id: 'device-test-01',
        client_time: new Date().toISOString(),
        client_last_server_seq: 0,
        mutations: [
          {
            mutation_id: '11111111-1111-4111-a111-111111111111',
            table: 'unknown_table',
            record: {}
          }
        ]
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: req
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('VALIDATION_ERROR');
      await app.close();
    });

    it('returns 400 VALIDATION_ERROR when batch exceeds 200 mutations', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const mutations = [];
      for (let i = 0; i < 201; i++) {
        mutations.push({
          mutation_id: `mut-${i}`,
          table: 'categories',
          record: {
            id: '11111111-1111-4111-a111-111111111111',
            nama: `Cat ${i}`,
            updated_at: new Date().toISOString(),
            deleted_at: null,
            device_id: 'device-test-01'
          }
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest(mutations)
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('VALIDATION_ERROR');
      await app.close();
    });

    it('returns 400 VALIDATION_ERROR when mutation record structure violates target table schema', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      // Mismatched record: table declared as 'habits', but record lacks required fields (mode, created_date)
      const mismatchedHabitMutation = {
        mutation_id: '11111111-1111-4111-a111-111111111111',
        table: 'habits',
        record: {
          id: '22222222-2222-4222-a222-222222222222',
          nama: 'Mismatched Habit Lacking Mode',
          updated_at: new Date().toISOString(),
          deleted_at: null,
          device_id: 'device-test-01'
        }
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([mismatchedHabitMutation])
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('VALIDATION_ERROR');
      await app.close();
    });
  });

  // --- Section 3: Protocol Version ---
  describe('Protocol Version Verification', () => {
    it('returns 426 UPGRADE_REQUIRED when protocol_version is not 1', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { protocol_version: 2 })
      });

      expect(res.statusCode).toBe(426);
      expect(res.json().error).toBe('UPGRADE_REQUIRED');
      await app.close();
    });
  });

  // --- Section 4: Clock Skew Validation ---
  describe('Clock Skew & Future Timestamp Validation', () => {
    it('returns 409 CLOCK_SKEW when client_time is > 5 minutes in future', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const skewedFuture = new Date(Date.now() + 6 * 60 * 1000).toISOString(); // +6 min
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_time: skewedFuture })
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error).toBe('CLOCK_SKEW');
      expect(body.server_time).toBeDefined();
      expect(!isNaN(Date.parse(body.server_time))).toBe(true);
      await app.close();
    });

    it('returns 409 CLOCK_SKEW when client_time is > 5 minutes in past', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const skewedPast = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // -6 min
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_time: skewedPast })
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('CLOCK_SKEW');
      await app.close();
    });

    it('rejects individual mutation with updated_at > 5 minutes in future into rejected array', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const validNow = new Date().toISOString();
      const futureTime = new Date(Date.now() + 6 * 60 * 1000).toISOString(); // +6 min

      const validHabit: Habit = {
        id: '22222222-2222-4222-a222-222222222221',
        nama: 'Valid Habit',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: validNow,
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const futureHabit: Habit = {
        id: '22222222-2222-4222-a222-222222222222',
        nama: 'Future Habit Attack',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: futureTime,
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const mutations = [
        { mutation_id: 'mut-valid', table: 'habits' as const, record: validHabit },
        { mutation_id: 'mut-future', table: 'habits' as const, record: futureHabit }
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest(mutations)
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.applied).toContain('mut-valid');
      expect(body.applied).not.toContain('mut-future');
      expect(body.rejected.length).toBe(1);
      expect(body.rejected[0].mutation_id).toBe('mut-future');
      expect(body.rejected[0].reason).toMatch(/future/i);

      // Verify future habit was not persisted in database
      expect(mockDb.habits.has(futureHabit.id)).toBe(false);
      // Valid habit was persisted
      expect(mockDb.habits.has(validHabit.id)).toBe(true);
      await app.close();
    });
  });

  // --- Section 5: Concurrency & Advisory Lock Contention ---
  describe('Advisory Lock & Concurrency Contention', () => {
    it('returns 503 LOCK_CONTENTION when advisory lock cannot be acquired', async () => {
      const mockDb = createMockKyselyDb();
      mockDb.advisoryLockHeld.value = true;

      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('LOCK_CONTENTION');
      await app.close();
    });

    it('returns 503 LOCK_CONTENTION when isAdvisoryLockHeld option returns true', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({
        config: mockConfig,
        db: mockDb.db,
        isAdvisoryLockHeld: () => true
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('LOCK_CONTENTION');
      await app.close();
    });
  });

  // --- Section 6: Database Availability ---
  describe('Database Availability', () => {
    it('returns 503 SERVICE_UNAVAILABLE when db instance is not provided', async () => {
      const app = await buildApp({ config: mockConfig, db: undefined });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest()
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('SERVICE_UNAVAILABLE');
      await app.close();
    });
  });

  // --- Section 7: LWW Conflict Resolution & Monotonic Sequence ---
  describe('LWW Conflict Resolution & Idempotency', () => {
    it('inserts new records across all 5 tables and assigns monotonic server_seq', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const category: Category = {
        id: '11111111-1111-4111-a111-111111111111',
        nama: 'Kesehatan',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const habit: Habit = {
        id: '22222222-2222-4222-a222-222222222222',
        nama: 'Minum Air',
        category_id: category.id,
        mode: 'quantitative',
        satuan: 'ml',
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 1000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const schedule: HabitSchedule = {
        id: '33333333-3333-4333-a333-333333333333',
        habit_id: habit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 2000,
        effective_from: '2026-09-01',
        updated_at: new Date(baseTime + 2000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const log: HabitLog = {
        id: '44444444-4444-4444-a444-444444444444',
        habit_id: habit.id,
        tanggal: '2026-09-30',
        nilai: 2000,
        selesai: true,
        updated_at: new Date(baseTime + 3000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const setting: Setting = {
        id: '55555555-5555-4555-a555-555555555555',
        jam_mulai_hari: '04:00',
        theme: 'dark',
        updated_at: new Date(baseTime + 4000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const mutations = [
        { mutation_id: 'm-cat', table: 'categories' as const, record: category },
        { mutation_id: 'm-hab', table: 'habits' as const, record: habit },
        { mutation_id: 'm-sch', table: 'habit_schedules' as const, record: schedule },
        { mutation_id: 'm-log', table: 'logs' as const, record: log },
        { mutation_id: 'm-set', table: 'settings' as const, record: setting }
      ];

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest(mutations)
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.applied).toEqual(['m-cat', 'm-hab', 'm-sch', 'm-log', 'm-set']);
      expect(body.rejected).toEqual([]);
      expect(body.new_server_seq).toBe(5);

      // Verify all 5 records are persisted
      expect(mockDb.categories.get(category.id)?.nama).toBe('Kesehatan');
      expect(mockDb.habits.get(habit.id)?.nama).toBe('Minum Air');
      expect(mockDb.habitSchedules.get(schedule.id)?.target).toBe(2000);
      expect(mockDb.logs.get(log.id)?.nilai).toBe(2000);
      expect(mockDb.settings.get(setting.id)?.theme).toBe('dark');

      await app.close();
    });

    it('resolves LWW conflict in favor of strictly newer updated_at timestamp', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const habitId = '22222222-2222-4222-a222-222222222222';
      const habitV1: Habit = {
        id: habitId,
        nama: 'Version 1 Early',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      // 1. Apply V1
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm1', table: 'habits', record: habitV1 }])
      });
      expect(mockDb.habits.get(habitId)?.nama).toBe('Version 1 Early');
      expect(mockDb.globalSeq.current).toBe(1);

      // 2. Apply V2 with newer timestamp
      const habitV2: Habit = {
        ...habitV1,
        nama: 'Version 2 Later',
        updated_at: new Date(baseTime + 5000).toISOString(),
        device_id: 'device-test-02'
      };

      const resV2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm2', table: 'habits', record: habitV2 }])
      });

      expect(resV2.statusCode).toBe(200);
      expect(resV2.json().applied).toContain('m2');
      expect(mockDb.habits.get(habitId)?.nama).toBe('Version 2 Later');
      expect(mockDb.globalSeq.current).toBe(2);

      await app.close();
    });

    it('tie-breaks identical timestamps using lexicographical device_id', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const habitId = '22222222-2222-4222-a222-222222222222';
      const sameTime = new Date(baseTime).toISOString();

      const habitA: Habit = {
        id: habitId,
        nama: 'From Device 01',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: sameTime,
        deleted_at: null,
        device_id: 'device-01'
      };

      const habitB: Habit = {
        ...habitA,
        nama: 'From Device 02',
        device_id: 'device-02' // 'device-02' > 'device-01'
      };

      // Apply from device 01
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-a', table: 'habits', record: habitA }])
      });

      // Apply from device 02 with identical timestamp
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-b', table: 'habits', record: habitB }])
      });

      // Device 02 wins tie-break
      expect(mockDb.habits.get(habitId)?.nama).toBe('From Device 02');
      expect(mockDb.habits.get(habitId)?.device_id).toBe('device-02');

      await app.close();
    });

    it('guarantees idempotency on batch replay: does not advance server_seq or duplicate rows', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const habit: Habit = {
        id: '22222222-2222-4222-a222-222222222222',
        nama: 'Idempotent Habit',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      const req = createValidSyncRequest([{ mutation_id: 'm-idem', table: 'habits', record: habit }]);

      // First call
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: req
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().applied).toEqual(['m-idem']);
      const seqAfterFirst = mockDb.globalSeq.current;
      expect(seqAfterFirst).toBe(1);

      // Replay identical batch
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: req
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().applied).toEqual(['m-idem']);
      const seqAfterReplay = mockDb.globalSeq.current;

      // server_seq must NOT advance
      expect(seqAfterReplay).toBe(seqAfterFirst);
      expect(mockDb.habits.size).toBe(1);

      await app.close();
    });

    it('reports losing mutation in applied array while retaining newer server state', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const habitId = '22222222-2222-4222-a222-222222222222';
      const newerHabit: Habit = {
        id: habitId,
        nama: 'Newer Server Record',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 10000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      // Save newer state first
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-newer', table: 'habits', record: newerHabit }])
      });
      const initialSeq = mockDb.globalSeq.current;

      // Now send older mutation
      const olderHabit: Habit = {
        ...newerHabit,
        nama: 'Older Stale Record',
        updated_at: new Date(baseTime).toISOString(),
        device_id: 'device-test-02'
      };

      const resOlder = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-older', table: 'habits', record: olderHabit }])
      });

      expect(resOlder.statusCode).toBe(200);
      // Confirmed in applied to allow client outbox clearing
      expect(resOlder.json().applied).toContain('m-older');
      // Server retains newer record
      expect(mockDb.habits.get(habitId)?.nama).toBe('Newer Server Record');
      // Seq does not advance for losing mutation
      expect(mockDb.globalSeq.current).toBe(initialSeq);

      await app.close();
    });

    it('resolves UNIQUE(habit_id, tanggal) conflict on logs table via LWW when records have different IDs', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      const habitId = '22222222-2222-4222-a222-222222222222';
      const log1: HabitLog = {
        id: '44444444-4444-4444-a444-444444444441',
        habit_id: habitId,
        tanggal: '2026-09-30',
        nilai: 10,
        selesai: false,
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      // 1. Insert log1
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-log1', table: 'logs', record: log1 }])
      });
      expect(mockDb.logs.size).toBe(1);

      // 2. Incoming log2 has different ID, same (habit_id, tanggal), but later timestamp
      const log2: HabitLog = {
        id: '44444444-4444-4444-a444-444444444442',
        habit_id: habitId,
        tanggal: '2026-09-30',
        nilai: 20,
        selesai: true,
        updated_at: new Date(baseTime + 5000).toISOString(),
        deleted_at: null,
        device_id: 'device-test-02'
      };

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-log2', table: 'logs', record: log2 }])
      });

      expect(res2.statusCode).toBe(200);
      expect(res2.json().applied).toContain('m-log2');

      // The conflicting log1 was removed and log2 was stored
      expect(mockDb.logs.size).toBe(1);
      expect(mockDb.logs.has(log1.id)).toBe(false);
      expect(mockDb.logs.get(log2.id)?.nilai).toBe(20);

      await app.close();
    });
  });

  // --- Section 8: Pull Query & Cursor Pagination ---
  describe('Pull Query & Cursor Pagination', () => {
    it('pulls records where server_seq > client_last_server_seq sorted ascending', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const baseTime = Date.now() - 60000;
      // Create 3 habits
      const h1: Habit = {
        id: '22222222-2222-4222-a222-222222222201',
        nama: 'Habit 1',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };
      const h2: Habit = { ...h1, id: '22222222-2222-4222-a222-222222222202', nama: 'Habit 2' };
      const h3: Habit = { ...h1, id: '22222222-2222-4222-a222-222222222203', nama: 'Habit 3' };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([
          { mutation_id: 'm1', table: 'habits', record: h1 },
          { mutation_id: 'm2', table: 'habits', record: h2 },
          { mutation_id: 'm3', table: 'habits', record: h3 }
        ])
      });

      // Now query with client_last_server_seq = 2 (should pull only h3)
      const pullRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_last_server_seq: 2 })
      });

      expect(pullRes.statusCode).toBe(200);
      const body = pullRes.json();
      expect(body.changes.length).toBe(1);
      expect(body.changes[0].table).toBe('habits');
      expect(body.changes[0].record.id).toBe(h3.id);
      expect(body.new_server_seq).toBe(3);
      expect(body.has_more).toBe(false);

      await app.close();
    });

    it('caps pull results at 500 records and sets has_more to true when remaining rows exist', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      // Directly populate 505 habits in mockDb
      for (let i = 1; i <= 505; i++) {
        mockDb.globalSeq.current++;
        const id = `22222222-2222-4222-a222-${String(i).padStart(12, '0')}`;
        mockDb.habits.set(id, {
          id,
          nama: `Bulk Habit ${i}`,
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: '2026-09-30T10:00:00.000Z',
          deleted_at: null,
          device_id: 'device-test-01',
          server_seq: mockDb.globalSeq.current
        });
      }

      // Query page 1
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_last_server_seq: 0 })
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.changes.length).toBe(500);
      expect(body.has_more).toBe(true);
      expect(body.new_server_seq).toBe(500);

      // Query page 2
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_last_server_seq: 500 })
      });

      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.changes.length).toBe(5);
      expect(body2.has_more).toBe(false);
      expect(body2.new_server_seq).toBe(505);

      await app.close();
    });

    it('returns empty changes with has_more=false when client is fully up to date', async () => {
      const mockDb = createMockKyselyDb();
      mockDb.globalSeq.current = 10;

      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_last_server_seq: 10 })
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.changes.length).toBe(0);
      expect(body.has_more).toBe(false);
      expect(body.new_server_seq).toBe(10);

      await app.close();
    });

    it('guarantees record.server_seq is strictly numeric in pulled changes across all tables', async () => {
      const mockDb = createMockKyselyDb();
      const app = await buildApp({ config: mockConfig, db: mockDb.db });

      const category: Category = {
        id: '11111111-1111-4111-a111-111111111111',
        nama: 'Kategori Test',
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'device-test-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([{ mutation_id: 'm-cat', table: 'categories', record: category }])
      });

      const pullRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: validAuthHeader },
        payload: createValidSyncRequest([], { client_last_server_seq: 0 })
      });

      expect(pullRes.statusCode).toBe(200);
      const body = pullRes.json();
      expect(body.changes.length).toBe(1);
      expect(typeof body.changes[0].record.server_seq).toBe('number');
      expect(Number.isInteger(body.changes[0].record.server_seq)).toBe(true);

      await app.close();
    });
  });
});
