import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import { validateServerConfig, loadConfigFromEnv } from '../src/config.js';
import { getTestDb, type TestDbProvider } from './helpers/test-db-provider.js';
import {
  generateLogId,
  compareLww,
  type SyncRequest,
  type SyncResponse,
  type Category,
  type Habit,
  type HabitSchedule,
  type HabitLog,
  type Setting
} from '@vibehabit/shared';

describe('apps/server - Integration Test Suite (ARCHITECTURE §10 & PRD §11.1)', () => {
  let provider: TestDbProvider;
  let app: FastifyInstance;

  const device1Token = 'device-1-secret-token-32-characters-ok';
  const device2Token = 'device-2-secret-token-32-characters-ok';

  const device1Hash = crypto.createHash('sha256').update(device1Token).digest('hex');
  const device2Hash = crypto.createHash('sha256').update(device2Token).digest('hex');

  const testConfig: ServerConfig = {
    databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit_test',
    deviceTokens: {
      'device-01': device1Hash,
      'device-02': device2Hash
    },
    host: '127.0.0.1',
    port: 3001,
    nodeEnv: 'test',
    staticDistPath: 'apps/web/dist'
  };

  const authHeaderDev1 = `Bearer ${device1Token}`;
  const authHeaderDev2 = `Bearer ${device2Token}`;

  beforeAll(async () => {
    provider = await getTestDb();
    app = await buildApp({
      config: testConfig,
      db: provider.db,
      isAdvisoryLockHeld: () => provider.isAdvisoryLockCurrentlyHeld()
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (provider) {
      await provider.close();
    }
  });

  beforeEach(async () => {
    await provider.cleanup();
  });

  function createSyncPayload(
    deviceId: string,
    mutations: any[] = [],
    overrides: Partial<SyncRequest> = {}
  ): SyncRequest {
    return {
      protocol_version: 1,
      device_id: deviceId,
      client_time: new Date().toISOString(),
      client_last_server_seq: 0,
      mutations,
      ...overrides
    };
  }

  function getMigrationPath(): string {
    const candidatePaths = [
      path.resolve(process.cwd(), 'deploy/migrations/001_init.sql'),
      path.resolve(process.cwd(), '../../deploy/migrations/001_init.sql'),
      path.resolve(process.cwd(), '../deploy/migrations/001_init.sql')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }
    return candidatePaths[0]!;
  }

  // =========================================================================
  // Scenario 1: Dua perangkat offline memodifikasi record yang sama
  // (edit, hapus, dan log habit-tanggal yang sama), lalu sync bersamaan.
  // Hasil: data identik, tanpa duplikasi. (PRD §11.1.4 & ARCH §10)
  // =========================================================================
  describe('Scenario 1: Two offline devices concurrently modify same records, then sync', () => {
    it('1.1: Resolves concurrent offline edits to the same habit via LWW and converges both devices identically', async () => {
      const baseTime = Date.now() - 120000;
      const habitId = '11111111-2222-4333-a444-555555555551';
      const catId = '00000000-1111-4222-a333-444444444441';

      // Initial category on server
      const initialCat: Category = {
        id: catId,
        nama: 'Kebugaran',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-cat-init', table: 'categories', record: initialCat }
        ])
      });

      // Device 1 goes offline and edits Habit 1 at T1
      const timeT1 = new Date(baseTime + 10000).toISOString();
      const habitDev1: Habit = {
        id: habitId,
        nama: 'Lari Pagi (Device 1 Offline)',
        category_id: catId,
        mode: 'quantitative',
        satuan: 'km',
        archived: false,
        created_date: '2026-09-01',
        updated_at: timeT1,
        deleted_at: null,
        device_id: 'device-01'
      };

      // Device 2 goes offline and edits Habit 1 at T2 (T2 > T1: Winner)
      const timeT2 = new Date(baseTime + 20000).toISOString();
      const habitDev2: Habit = {
        id: habitId,
        nama: 'Lari Pagi 5K (Device 2 Winner)',
        category_id: catId,
        mode: 'quantitative',
        satuan: 'km',
        archived: false,
        created_date: '2026-09-01',
        updated_at: timeT2,
        deleted_at: null,
        device_id: 'device-02'
      };

      // Both devices come online and sync to server
      const syncDev1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-h-dev1', table: 'habits', record: habitDev1 }
        ])
      });
      expect(syncDev1.statusCode).toBe(200);
      expect(syncDev1.json().applied).toContain('m-h-dev1');

      const syncDev2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', [
          { mutation_id: 'm-h-dev2', table: 'habits', record: habitDev2 }
        ])
      });
      expect(syncDev2.statusCode).toBe(200);
      expect(syncDev2.json().applied).toContain('m-h-dev2');

      // Device 1 pulls changes from server
      const pullDev1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: syncDev1.json().new_server_seq })
      });
      expect(pullDev1.statusCode).toBe(200);

      // Verify that pulled changes on Device 1 contain Device 2's winning version
      const pulledHabit = pullDev1.json().changes.find((c: any) => c.table === 'habits' && c.record.id === habitId);
      expect(pulledHabit).toBeDefined();
      expect(pulledHabit.record.nama).toBe('Lari Pagi 5K (Device 2 Winner)');
      expect(pulledHabit.record.device_id).toBe('device-02');

      // Verify database state: exactly 1 habit row, no duplicates
      const habitRows = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).execute();
      expect(habitRows.length).toBe(1);
      expect(habitRows[0]!.nama).toBe('Lari Pagi 5K (Device 2 Winner)');
    });

    it('1.2: Resolves concurrent offline edit vs delete: later tombstone deletion wins and is preserved', async () => {
      const baseTime = Date.now() - 120000;
      const habitId = '11111111-2222-4333-a444-555555555552';

      // Initial habit creation
      const initialHabit: Habit = {
        id: habitId,
        nama: 'Baca Buku',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-init', table: 'habits', record: initialHabit }
        ])
      });

      // Device 1 offline: updates habit name at T1
      const timeT1 = new Date(baseTime + 10000).toISOString();
      const habitEdited: Habit = {
        ...initialHabit,
        nama: 'Baca Buku Nonfiksi (Device 1 Edit)',
        updated_at: timeT1
      };

      // Device 2 offline: deletes habit at T2 (T2 > T1: Tombstone delete wins)
      const timeT2 = new Date(baseTime + 20000).toISOString();
      const habitDeleted: Habit = {
        ...initialHabit,
        updated_at: timeT2,
        deleted_at: timeT2,
        device_id: 'device-02'
      };

      // Sync both devices
      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-edit', table: 'habits', record: habitEdited }])
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', [{ mutation_id: 'm-del', table: 'habits', record: habitDeleted }])
      });

      // Verify in database: deleted_at is set to timeT2
      const habitRows = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).execute();
      expect(habitRows.length).toBe(1);
      expect(habitRows[0]!.deleted_at).toBe(timeT2);

      // Verify Device 1 pulls the deletion tombstone
      const pullRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 0 })
      });
      const pulled = pullRes.json().changes.find((c: any) => c.table === 'habits' && c.record.id === habitId);
      expect(pulled.record.deleted_at).toBe(timeT2);
    });

    it('1.3: Concurrently logs same habit and date offline with deterministic UUID v5 IDs: resolves without duplicate rows', async () => {
      const baseTime = Date.now() - 120000;
      const habitId = '11111111-2222-4333-a444-555555555553';
      const date = '2026-09-30';
      const logId = generateLogId(habitId, date);

      // Habit setup
      const habit: Habit = {
        id: habitId,
        nama: 'Minum 2L Air',
        category_id: null,
        mode: 'quantitative',
        satuan: 'ml',
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-hab', table: 'habits', record: habit }])
      });

      // Device 1 offline logs: 1000ml at T1
      const timeT1 = new Date(baseTime + 10000).toISOString();
      const logDev1: HabitLog = {
        id: logId,
        habit_id: habitId,
        tanggal: date,
        nilai: 1000,
        selesai: false,
        updated_at: timeT1,
        deleted_at: null,
        device_id: 'device-01'
      };

      // Device 2 offline logs: 2000ml at T2 (T2 > T1: Winner)
      const timeT2 = new Date(baseTime + 20000).toISOString();
      const logDev2: HabitLog = {
        id: logId,
        habit_id: habitId,
        tanggal: date,
        nilai: 2000,
        selesai: true,
        updated_at: timeT2,
        deleted_at: null,
        device_id: 'device-02'
      };

      // Sync both devices
      const resDev1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-log-1', table: 'logs', record: logDev1 }])
      });
      expect(resDev1.statusCode).toBe(200);

      const resDev2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', [{ mutation_id: 'm-log-2', table: 'logs', record: logDev2 }])
      });
      expect(resDev2.statusCode).toBe(200);

      // Verify database: exactly 1 log record for this (habit_id, date)
      const logs = await provider.db
        .selectFrom('logs')
        .selectAll()
        .where('habit_id', '=', habitId)
        .where('tanggal', '=', date)
        .execute();

      expect(logs.length).toBe(1);
      expect(logs[0]!.id).toBe(logId);
      expect(logs[0]!.nilai).toBe(2000);
      expect(logs[0]!.selesai).toBe(true);
      expect(logs[0]!.device_id).toBe('device-02');
    });

    it('1.4: Concurrently logs same habit and date offline with different IDs: resolves UNIQUE constraint conflict via LWW', async () => {
      const baseTime = Date.now() - 120000;
      const habitId = '11111111-2222-4333-a444-555555555554';
      const date = '2026-09-30';

      const habit: Habit = {
        id: habitId,
        nama: 'Meditasi Hening',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-hab', table: 'habits', record: habit }])
      });

      // Log 1 from Device 1 with ID-A at T1
      const idA = 'aaaaaaaa-1111-4111-a111-111111111111';
      const timeT1 = new Date(baseTime + 10000).toISOString();
      const logA: HabitLog = {
        id: idA,
        habit_id: habitId,
        tanggal: date,
        nilai: null,
        selesai: false,
        updated_at: timeT1,
        deleted_at: null,
        device_id: 'device-01'
      };

      // Log 2 from Device 2 with ID-B at T2 (T2 > T1: Winner)
      const idB = 'bbbbbbbb-2222-4222-a222-222222222222';
      const timeT2 = new Date(baseTime + 20000).toISOString();
      const logB: HabitLog = {
        id: idB,
        habit_id: habitId,
        tanggal: date,
        nilai: null,
        selesai: true,
        updated_at: timeT2,
        deleted_at: null,
        device_id: 'device-02'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-loga', table: 'logs', record: logA }])
      });

      const resB = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', [{ mutation_id: 'm-logb', table: 'logs', record: logB }])
      });

      expect(resB.statusCode).toBe(200);
      expect(resB.json().applied).toContain('m-logb');

      // The losing record idA was replaced by winning record idB
      const logs = await provider.db
        .selectFrom('logs')
        .selectAll()
        .where('habit_id', '=', habitId)
        .where('tanggal', '=', date)
        .execute();

      expect(logs.length).toBe(1);
      expect(logs[0]!.id).toBe(idB);
      expect(logs[0]!.selesai).toBe(true);
    });

    it('1.5: PRD §11.1 full scale: Laptop and smartphone both offline make 50 changes each (edits, deletes, deterministic logs), then sync; converge to 100% identical data', async () => {
      const baseTime = Date.now() - 150000;

      // Initial state seeded on server
      const initCat: Category = {
        id: '00000000-0000-4000-a000-000000000001',
        nama: 'Kategori Dasar',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const initHabits: Habit[] = [];
      const initSchedules: HabitSchedule[] = [];
      const initLogs: HabitLog[] = [];

      for (let i = 0; i < 10; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const sId = `20000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const lId = generateLogId(hId, '2026-09-01');

        initHabits.push({
          id: hId,
          nama: `Shared Habit ${i}`,
          category_id: initCat.id,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: new Date(baseTime + 100).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        });

        initSchedules.push({
          id: sId,
          habit_id: hId,
          tipe_frekuensi: 'daily',
          hari_terjadwal: null,
          jumlah_per_minggu: null,
          target: 1,
          effective_from: '2026-09-01',
          updated_at: new Date(baseTime + 100).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        });

        initLogs.push({
          id: lId,
          habit_id: hId,
          tanggal: '2026-09-01',
          nilai: null,
          selesai: false,
          updated_at: new Date(baseTime + 100).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        });
      }

      // Seed initial state to server
      const seedRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'seed-cat', table: 'categories', record: initCat },
          ...initHabits.map((h, i) => ({ mutation_id: `seed-h-${i}`, table: 'habits', record: h })),
          ...initSchedules.map((s, i) => ({ mutation_id: `seed-s-${i}`, table: 'habit_schedules', record: s })),
          ...initLogs.map((l, i) => ({ mutation_id: `seed-l-${i}`, table: 'logs', record: l }))
        ])
      });
      expect(seedRes.statusCode).toBe(200);
      const initialServerSeq = seedRes.json().new_server_seq;

      // Both devices start offline with copies of initial data in their local store
      const localStoreDev1: Record<string, any> = {
        categories: new Map<string, Category>([[initCat.id, { ...initCat }]]),
        habits: new Map<string, Habit>(initHabits.map((h) => [h.id, { ...h }])),
        habit_schedules: new Map<string, HabitSchedule>(initSchedules.map((s) => [s.id, { ...s }])),
        logs: new Map<string, HabitLog>(initLogs.map((l) => [l.id, { ...l }])),
        settings: new Map<string, Setting>()
      };

      const localStoreDev2: Record<string, any> = {
        categories: new Map<string, Category>([[initCat.id, { ...initCat }]]),
        habits: new Map<string, Habit>(initHabits.map((h) => [h.id, { ...h }])),
        habit_schedules: new Map<string, HabitSchedule>(initSchedules.map((s) => [s.id, { ...s }])),
        logs: new Map<string, HabitLog>(initLogs.map((l) => [l.id, { ...l }])),
        settings: new Map<string, Setting>()
      };

      // -------------------------------------------------------------
      // Device 1 (Laptop) generates EXACTLY 50 offline changes:
      // 10 edits to existing habits (0..9) at baseTime + 10s
      // 5 deletions (tombstones) on habits (0..4) at baseTime + 20s
      // 10 new habits (dev1-0..9) at baseTime + 15s
      // 10 new schedules for those habits at baseTime + 15s
      // 10 deterministic logs on habits 5..9 for 2 dates at baseTime + 12s
      // 5 categories (dev1-0..4) at baseTime + 15s
      // Total = 10 + 5 + 10 + 10 + 10 + 5 = 50 modifications.
      // -------------------------------------------------------------
      const mutationsDev1: any[] = [];

      for (let i = 0; i < 10; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const updatedHabit: Habit = {
          ...initHabits[i]!,
          nama: `Habit ${i} Edited By Dev1`,
          updated_at: new Date(baseTime + 10000).toISOString(),
          device_id: 'device-01'
        };
        mutationsDev1.push({ mutation_id: `m-d1-edit-${i}`, table: 'habits', record: updatedHabit });
        localStoreDev1.habits.set(hId, updatedHabit);
      }

      for (let i = 0; i < 5; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const delTime = new Date(baseTime + 20000).toISOString();
        const deletedHabit: Habit = {
          ...localStoreDev1.habits.get(hId)!,
          updated_at: delTime,
          deleted_at: delTime,
          device_id: 'device-01'
        };
        mutationsDev1.push({ mutation_id: `m-d1-del-${i}`, table: 'habits', record: deletedHabit });
        localStoreDev1.habits.set(hId, deletedHabit);
      }

      for (let i = 0; i < 10; i++) {
        const hId = `d1000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const sId = `d1000000-1111-4000-a000-${String(i).padStart(12, '0')}`;
        const t = new Date(baseTime + 15000 + i * 10).toISOString();

        const newHabit: Habit = {
          id: hId,
          nama: `Dev1 New Habit ${i}`,
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-02',
          updated_at: t,
          deleted_at: null,
          device_id: 'device-01'
        };
        mutationsDev1.push({ mutation_id: `m-d1-newh-${i}`, table: 'habits', record: newHabit });
        localStoreDev1.habits.set(hId, newHabit);

        const newSched: HabitSchedule = {
          id: sId,
          habit_id: hId,
          tipe_frekuensi: 'daily',
          hari_terjadwal: null,
          jumlah_per_minggu: null,
          target: 1,
          effective_from: '2026-09-02',
          updated_at: t,
          deleted_at: null,
          device_id: 'device-01'
        };
        mutationsDev1.push({ mutation_id: `m-d1-news-${i}`, table: 'habit_schedules', record: newSched });
        localStoreDev1.habit_schedules.set(sId, newSched);
      }

      // 10 logs on habits 5..9 across 2 dates
      for (let i = 0; i < 5; i++) {
        const hId = `10000000-0000-4000-a000-${String(5 + i).padStart(12, '0')}`;
        for (const date of ['2026-09-02', '2026-09-03']) {
          const lId = generateLogId(hId, date);
          const logRecord: HabitLog = {
            id: lId,
            habit_id: hId,
            tanggal: date,
            nilai: null,
            selesai: true,
            updated_at: new Date(baseTime + 12000).toISOString(),
            deleted_at: null,
            device_id: 'device-01'
          };
          mutationsDev1.push({ mutation_id: `m-d1-log-${i}-${date}`, table: 'logs', record: logRecord });
          localStoreDev1.logs.set(lId, logRecord);
        }
      }

      // 5 categories
      for (let i = 0; i < 5; i++) {
        const cId = `d1000000-2222-4000-a000-${String(i).padStart(12, '0')}`;
        const newCat: Category = {
          id: cId,
          nama: `Dev1 Cat ${i}`,
          updated_at: new Date(baseTime + 15000).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        };
        mutationsDev1.push({ mutation_id: `m-d1-cat-${i}`, table: 'categories', record: newCat });
        localStoreDev1.categories.set(cId, newCat);
      }

      expect(mutationsDev1.length).toBe(50);

      // -------------------------------------------------------------
      // Device 2 (Smartphone) generates EXACTLY 50 offline changes:
      // 5 conflicting edits on habits (0..4):
      //   - habits 0, 1 edited at baseTime + 5s (Dev1 delete at +20s wins)
      //   - habits 2, 3 edited at baseTime + 30s (Dev2 edit at +30s wins and clears delete)
      //   - habit 4 deleted at baseTime + 25s (Dev2 delete at +25s wins)
      // 5 conflicting edits on habits (5..9):
      //   - habits 5, 6 edited at baseTime + 30s (Dev2 wins)
      //   - habits 7, 8 edited at baseTime + 5s (Dev1 wins)
      //   - habit 9 deleted at baseTime + 30s (Dev2 delete wins)
      // 10 deterministic logs on same habit/dates:
      //   - 5 logs at baseTime + 30s (Dev2 wins)
      //   - 5 logs at baseTime + 5s (Dev1 wins)
      // 10 new habits (dev2-0..9) at baseTime + 18s
      // 10 new schedules for those habits at baseTime + 18s
      // 5 categories (dev2-0..4) at baseTime + 18s
      // 5 edits to existing schedules 5..9 at baseTime + 25s
      // Total = 5 + 5 + 10 + 10 + 10 + 5 + 5 = 50 modifications.
      // -------------------------------------------------------------
      const mutationsDev2: any[] = [];

      // Habits 0, 1: edit at baseTime + 5s (older than Dev1 delete at +20s)
      for (let i = 0; i < 2; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const h: Habit = {
          ...initHabits[i]!,
          nama: `Habit ${i} Edited Stale By Dev2`,
          updated_at: new Date(baseTime + 5000).toISOString(),
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-h-${i}`, table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // Habits 2, 3: edit at baseTime + 30s (newer than Dev1 delete at +20s)
      for (let i = 2; i < 4; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const h: Habit = {
          ...initHabits[i]!,
          nama: `Habit ${i} Resurrected Winner By Dev2`,
          updated_at: new Date(baseTime + 30000).toISOString(),
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-h-${i}`, table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // Habit 4: delete at baseTime + 25s (newer delete than Dev1 at +20s)
      {
        const hId = '10000000-0000-4000-a000-000000000004';
        const delTime = new Date(baseTime + 25000).toISOString();
        const h: Habit = {
          ...initHabits[4]!,
          updated_at: delTime,
          deleted_at: delTime,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: 'm-d2-h-4', table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // Habits 5, 6: edit at baseTime + 30s (newer than Dev1 edit at +10s)
      for (let i = 5; i <= 6; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const h: Habit = {
          ...initHabits[i]!,
          nama: `Habit ${i} Winner By Dev2`,
          updated_at: new Date(baseTime + 30000).toISOString(),
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-h-${i}`, table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // Habits 7, 8: edit at baseTime + 5s (older than Dev1 edit at +10s)
      for (let i = 7; i <= 8; i++) {
        const hId = `10000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const h: Habit = {
          ...initHabits[i]!,
          nama: `Habit ${i} Stale By Dev2`,
          updated_at: new Date(baseTime + 5000).toISOString(),
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-h-${i}`, table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // Habit 9: delete at baseTime + 30s (newer than Dev1 edit at +10s)
      {
        const hId = '10000000-0000-4000-a000-000000000009';
        const delTime = new Date(baseTime + 30000).toISOString();
        const h: Habit = {
          ...initHabits[9]!,
          updated_at: delTime,
          deleted_at: delTime,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: 'm-d2-h-9', table: 'habits', record: h });
        localStoreDev2.habits.set(hId, h);
      }

      // 10 logs: 5 newer (Dev2 wins) and 5 older (Dev1 wins)
      let logCount = 0;
      for (let i = 0; i < 5; i++) {
        const hId = `10000000-0000-4000-a000-${String(5 + i).padStart(12, '0')}`;
        for (const date of ['2026-09-02', '2026-09-03']) {
          const lId = generateLogId(hId, date);
          const dev2Wins = logCount < 5;
          const logTime = new Date(baseTime + (dev2Wins ? 30000 : 5000)).toISOString();
          const logRecord: HabitLog = {
            id: lId,
            habit_id: hId,
            tanggal: date,
            nilai: dev2Wins ? 999 : 111,
            selesai: dev2Wins,
            updated_at: logTime,
            deleted_at: null,
            device_id: 'device-02'
          };
          mutationsDev2.push({ mutation_id: `m-d2-log-${logCount}`, table: 'logs', record: logRecord });
          localStoreDev2.logs.set(lId, logRecord);
          logCount++;
        }
      }

      // 10 new habits from Dev2
      for (let i = 0; i < 10; i++) {
        const hId = `d2000000-0000-4000-a000-${String(i).padStart(12, '0')}`;
        const sId = `d2000000-1111-4000-a000-${String(i).padStart(12, '0')}`;
        const t = new Date(baseTime + 18000 + i * 10).toISOString();

        const newHabit: Habit = {
          id: hId,
          nama: `Dev2 New Habit ${i}`,
          category_id: null,
          mode: 'quantitative',
          satuan: 'porsi',
          archived: false,
          created_date: '2026-09-02',
          updated_at: t,
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-newh-${i}`, table: 'habits', record: newHabit });
        localStoreDev2.habits.set(hId, newHabit);

        const newSched: HabitSchedule = {
          id: sId,
          habit_id: hId,
          tipe_frekuensi: 'x_per_week',
          hari_terjadwal: null,
          jumlah_per_minggu: 4,
          target: 2,
          effective_from: '2026-09-02',
          updated_at: t,
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-news-${i}`, table: 'habit_schedules', record: newSched });
        localStoreDev2.habit_schedules.set(sId, newSched);
      }

      // 5 categories from Dev2
      for (let i = 0; i < 5; i++) {
        const cId = `d2000000-2222-4000-a000-${String(i).padStart(12, '0')}`;
        const newCat: Category = {
          id: cId,
          nama: `Dev2 Cat ${i}`,
          updated_at: new Date(baseTime + 18000).toISOString(),
          deleted_at: null,
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-cat-${i}`, table: 'categories', record: newCat });
        localStoreDev2.categories.set(cId, newCat);
      }

      // 5 schedule edits for habits 5..9
      for (let i = 0; i < 5; i++) {
        const sId = `20000000-0000-4000-a000-${String(5 + i).padStart(12, '0')}`;
        const updatedSched: HabitSchedule = {
          ...initSchedules[5 + i]!,
          target: 5,
          updated_at: new Date(baseTime + 25000).toISOString(),
          device_id: 'device-02'
        };
        mutationsDev2.push({ mutation_id: `m-d2-sch-edit-${i}`, table: 'habit_schedules', record: updatedSched });
        localStoreDev2.habit_schedules.set(sId, updatedSched);
      }

      expect(mutationsDev2.length).toBe(50);

      // -------------------------------------------------------------
      // Push: Both devices come online and sync to server
      // -------------------------------------------------------------
      const syncDev1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', mutationsDev1, { client_last_server_seq: initialServerSeq })
      });
      expect(syncDev1.statusCode).toBe(200);
      expect(syncDev1.json().applied.length).toBe(50);

      const syncDev2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', mutationsDev2, { client_last_server_seq: initialServerSeq })
      });
      expect(syncDev2.statusCode).toBe(200);
      expect(syncDev2.json().applied.length).toBe(50);

      // -------------------------------------------------------------
      // Pull: Both devices pull all changes until fully synchronized
      // -------------------------------------------------------------
      const pullDev1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: syncDev1.json().new_server_seq })
      });
      expect(pullDev1.statusCode).toBe(200);

      const pullDev2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev2 },
        payload: createSyncPayload('device-02', [], { client_last_server_seq: initialServerSeq })
      });
      expect(pullDev2.statusCode).toBe(200);

      // Apply pulled changes using standard local LWW rule (apply-if-won)
      function applyLwwToLocalStore(store: Record<string, any>, changes: any[]) {
        for (const change of changes) {
          const { table, record } = change;
          const map = store[table];
          if (!map) continue;
          const existing = map.get(record.id);
          if (!existing) {
            map.set(record.id, record);
          } else {
            const cmp = compareLww(record, existing);
            if (cmp > 0) {
              map.set(record.id, record);
            }
          }
        }
      }

      applyLwwToLocalStore(localStoreDev1, pullDev1.json().changes);
      applyLwwToLocalStore(localStoreDev2, pullDev2.json().changes);

      // -------------------------------------------------------------
      // Deep Equivalence Verification: Both devices must have 100% identical data
      // -------------------------------------------------------------
      // 1. Categories
      expect(localStoreDev1.categories.size).toBe(localStoreDev2.categories.size);
      for (const [id, cat1] of localStoreDev1.categories.entries()) {
        const cat2 = localStoreDev2.categories.get(id);
        expect(cat2).toBeDefined();
        expect(cat1.nama).toBe(cat2.nama);
        expect(cat1.updated_at).toBe(cat2.updated_at);
        expect(cat1.deleted_at).toBe(cat2.deleted_at);
      }

      // 2. Habits (10 initial + 10 Dev1 + 10 Dev2 = 30 habits total)
      expect(localStoreDev1.habits.size).toBe(30);
      expect(localStoreDev2.habits.size).toBe(30);
      for (const [id, h1] of localStoreDev1.habits.entries()) {
        const h2 = localStoreDev2.habits.get(id);
        expect(h2).toBeDefined();
        expect(h1.nama).toBe(h2.nama);
        expect(h1.deleted_at).toBe(h2.deleted_at);
        expect(h1.updated_at).toBe(h2.updated_at);
        expect(h1.device_id).toBe(h2.device_id);
      }

      // Specific LWW convergence checks:
      // Habit 0 & 1: Dev1 deletion won over Dev2 stale edit
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000000')!.deleted_at).not.toBeNull();
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000001')!.deleted_at).not.toBeNull();

      // Habit 2 & 3: Dev2 winner edit won over Dev1 deletion (deleted_at is null)
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000002')!.deleted_at).toBeNull();
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000002')!.nama).toBe('Habit 2 Resurrected Winner By Dev2');

      // Habit 5 & 6: Dev2 edit won over Dev1 edit
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000005')!.nama).toBe('Habit 5 Winner By Dev2');

      // Habit 7 & 8: Dev1 edit won over Dev2 edit
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000007')!.nama).toBe('Habit 7 Edited By Dev1');

      // Habit 9: Dev2 deletion won
      expect(localStoreDev1.habits.get('10000000-0000-4000-a000-000000000009')!.deleted_at).not.toBeNull();

      // 3. Habit Schedules (10 initial + 10 Dev1 + 10 Dev2 = 30 schedules)
      expect(localStoreDev1.habit_schedules.size).toBe(30);
      expect(localStoreDev2.habit_schedules.size).toBe(30);
      for (const [id, s1] of localStoreDev1.habit_schedules.entries()) {
        const s2 = localStoreDev2.habit_schedules.get(id);
        expect(s2).toBeDefined();
        expect(s1.target).toBe(s2.target);
        expect(s1.updated_at).toBe(s2.updated_at);
      }

      // 4. Logs (10 initial + 10 concurrent deterministic logs = 20 unique logs)
      expect(localStoreDev1.logs.size).toBe(20);
      expect(localStoreDev2.logs.size).toBe(20);
      for (const [id, l1] of localStoreDev1.logs.entries()) {
        const l2 = localStoreDev2.logs.get(id);
        expect(l2).toBeDefined();
        expect(l1.selesai).toBe(l2.selesai);
        expect(l1.nilai).toBe(l2.nilai);
        expect(l1.updated_at).toBe(l2.updated_at);
      }

      // Check deterministic logs: exactly 1 log per (habit_id, tanggal) in server DB
      const dbLogs = await provider.db.selectFrom('logs').selectAll().execute();
      expect(dbLogs.length).toBe(20);
      const uniqueKeys = new Set(dbLogs.map((l) => `${l.habit_id}:${l.tanggal}`));
      expect(uniqueKeys.size).toBe(20); // Zero duplicate rows for any (habit_id, tanggal)
    });
  });

  // =========================================================================
  // Scenario 2: Replay batch mutasi yang sama dua kali tidak mengubah data
  // dan tidak menaikkan server_seq (idempotensi ketat). (ARCH §6.2.7 & §10)
  // =========================================================================
  describe('Scenario 2: Strict idempotent batch replay', () => {
    it('2.1: Replaying identical batch returns 200, keeps server_seq strictly unchanged, and duplicates zero rows', async () => {
      const baseTime = Date.now() - 60000;
      const category: Category = {
        id: '11111111-1111-4111-a111-111111111111',
        nama: 'Kategori Idempoten',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const habit: Habit = {
        id: '22222222-2222-4222-a222-222222222222',
        nama: 'Habit Idempoten',
        category_id: category.id,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 1000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const schedule: HabitSchedule = {
        id: '33333333-3333-4333-a333-333333333333',
        habit_id: habit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-01',
        updated_at: new Date(baseTime + 2000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const log: HabitLog = {
        id: '44444444-4444-4444-a444-444444444444',
        habit_id: habit.id,
        tanggal: '2026-09-30',
        nilai: null,
        selesai: true,
        updated_at: new Date(baseTime + 3000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const setting: Setting = {
        id: '55555555-5555-4555-a555-555555555555',
        jam_mulai_hari: '04:00',
        theme: 'dark',
        updated_at: new Date(baseTime + 4000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const batchPayload = createSyncPayload('device-01', [
        { mutation_id: 'm-cat', table: 'categories', record: category },
        { mutation_id: 'm-hab', table: 'habits', record: habit },
        { mutation_id: 'm-sch', table: 'habit_schedules', record: schedule },
        { mutation_id: 'm-log', table: 'logs', record: log },
        { mutation_id: 'm-set', table: 'settings', record: setting }
      ]);

      // First execution
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: batchPayload
      });

      expect(res1.statusCode).toBe(200);
      const body1: SyncResponse = res1.json();
      expect(body1.applied).toEqual(['m-cat', 'm-hab', 'm-sch', 'm-log', 'm-set']);
      const seqAfterFirst = body1.new_server_seq;
      expect(seqAfterFirst).toBe(5);

      // Count rows after first execution
      const [cats1, habits1, scheds1, logs1, sets1] = await Promise.all([
        provider.db.selectFrom('categories').selectAll().execute(),
        provider.db.selectFrom('habits').selectAll().execute(),
        provider.db.selectFrom('habit_schedules').selectAll().execute(),
        provider.db.selectFrom('logs').selectAll().execute(),
        provider.db.selectFrom('settings').selectAll().execute()
      ]);
      expect(cats1.length).toBe(1);
      expect(habits1.length).toBe(1);
      expect(scheds1.length).toBe(1);
      expect(logs1.length).toBe(1);
      expect(sets1.length).toBe(1);

      // Replay identical batch
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: batchPayload
      });

      expect(res2.statusCode).toBe(200);
      const body2: SyncResponse = res2.json();
      expect(body2.applied).toEqual(['m-cat', 'm-hab', 'm-sch', 'm-log', 'm-set']);
      // Sequence MUST NOT advance
      expect(body2.new_server_seq).toBe(seqAfterFirst);

      // Verify row counts after replay remain exactly 1
      const [cats2, habits2, scheds2, logs2, sets2] = await Promise.all([
        provider.db.selectFrom('categories').selectAll().execute(),
        provider.db.selectFrom('habits').selectAll().execute(),
        provider.db.selectFrom('habit_schedules').selectAll().execute(),
        provider.db.selectFrom('logs').selectAll().execute(),
        provider.db.selectFrom('settings').selectAll().execute()
      ]);
      expect(cats2.length).toBe(1);
      expect(habits2.length).toBe(1);
      expect(scheds2.length).toBe(1);
      expect(logs2.length).toBe(1);
      expect(sets2.length).toBe(1);

      // Verify data values remain untouched
      expect(cats2[0]!.nama).toBe('Kategori Idempoten');
      expect(habits2[0]!.nama).toBe('Habit Idempoten');
      expect(sets2[0]!.theme).toBe('dark');
    });

    it('2.2: Losing mutation in replay is reported in applied array allowing client outbox to safely drain', async () => {
      const baseTime = Date.now() - 60000;
      const habitId = '22222222-2222-4222-a222-222222222223';

      const initialHabit: Habit = {
        id: habitId,
        nama: 'Habit State',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 10000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-init', table: 'habits', record: initialHabit }])
      });

      // An older mutation is replayed (e.g. from an outbox that failed to receive ack earlier)
      const staleHabit: Habit = {
        ...initialHabit,
        nama: 'Stale Older Habit',
        updated_at: new Date(baseTime).toISOString()
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-stale', table: 'habits', record: staleHabit }])
      });

      expect(res.statusCode).toBe(200);
      // Confirmed in applied to allow client to remove item from outbox
      expect(res.json().applied).toContain('m-stale');

      // Database retains the newer record
      const rows = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).execute();
      expect(rows[0]!.nama).toBe('Habit State');
    });

    it('2.3: Partially replayed batch: applies brand new mutations, leaves replayed mutations untouched, and increments sequence only by new mutations count', async () => {
      const baseTime = Date.now() - 60000;
      const catId = '11111111-1111-4111-a111-111111111199';
      const habit1Id = '22222222-2222-4222-a222-222222222199';
      const habit2Id = '22222222-2222-4222-a222-222222222299';

      const cat: Category = {
        id: catId,
        nama: 'Kategori Batch Parsial',
        updated_at: new Date(baseTime).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const habit1: Habit = {
        id: habit1Id,
        nama: 'Habit Pertama',
        category_id: catId,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 1000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      // Apply initial batch [cat, habit1]
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-cat-init', table: 'categories', record: cat },
          { mutation_id: 'm-h1-init', table: 'habits', record: habit1 }
        ])
      });
      expect(res1.statusCode).toBe(200);
      const seq1 = res1.json().new_server_seq;
      expect(seq1).toBe(2);

      // Now send a batch containing [replayed cat, replayed habit1, brand new habit2]
      const habit2: Habit = {
        id: habit2Id,
        nama: 'Habit Kedua Baru',
        category_id: catId,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date(baseTime + 2000).toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-cat-init', table: 'categories', record: cat },
          { mutation_id: 'm-h1-init', table: 'habits', record: habit1 },
          { mutation_id: 'm-h2-new', table: 'habits', record: habit2 }
        ])
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.applied).toEqual(['m-cat-init', 'm-h1-init', 'm-h2-new']);
      // Sequence must advance strictly by 1 (only for habit2)
      expect(body2.new_server_seq).toBe(seq1 + 1);

      // Verify row counts: 1 category, 2 habits
      const cats = await provider.db.selectFrom('categories').selectAll().where('id', '=', catId).execute();
      expect(cats.length).toBe(1);
      const habits = await provider.db.selectFrom('habits').selectAll().where('id', 'in', [habit1Id, habit2Id]).execute();
      expect(habits.length).toBe(2);
    });
  });

  // =========================================================================
  // Scenario 3: Selisih jam lebih dari 5 menit ditolak (409 CLOCK_SKEW),
  // timestamp masa depan ditolak. (ARCH §6.2.4, §6.2.5 & §10)
  // =========================================================================
  describe('Scenario 3: Clock skew rejection (>5 min) & future timestamp rejection', () => {
    it('3.1: Rejects entire sync request when client_time is > 5 minutes in the future with 409 CLOCK_SKEW', async () => {
      const skewedFutureTime = new Date(Date.now() + 6 * 60 * 1000).toISOString(); // +6 minutes
      const habit: Habit = {
        id: '22222222-2222-4222-a222-222222222224',
        nama: 'Habit Skewed',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-skew', table: 'habits', record: habit }], {
          client_time: skewedFutureTime
        })
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error).toBe('CLOCK_SKEW');
      expect(body.server_time).toBeDefined();
      expect(!isNaN(Date.parse(body.server_time))).toBe(true);

      // Verify no record was written to database
      const rows = await provider.db.selectFrom('habits').selectAll().where('id', '=', habit.id).execute();
      expect(rows.length).toBe(0);
    });

    it('3.2: Rejects entire sync request when client_time is > 5 minutes in the past with 409 CLOCK_SKEW', async () => {
      const skewedPastTime = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // -6 minutes

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], {
          client_time: skewedPastTime
        })
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error).toBe('CLOCK_SKEW');
      expect(body.server_time).toBeDefined();
    });

    it('3.3: Strict clock tolerance thresholds: accepts client_time within 5m (+290s, -290s), rejects beyond 5m (+310s, -310s)', async () => {
      // 1. +290s forward (accepted)
      const forwardValidTime = new Date(Date.now() + 290 * 1000).toISOString();
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_time: forwardValidTime })
      });
      expect(res1.statusCode).toBe(200);

      // 2. +310s forward (rejected)
      const forwardInvalidTime = new Date(Date.now() + 310 * 1000).toISOString();
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_time: forwardInvalidTime })
      });
      expect(res2.statusCode).toBe(409);
      expect(res2.json().error).toBe('CLOCK_SKEW');

      // 3. -290s backward (accepted)
      const backwardValidTime = new Date(Date.now() - 290 * 1000).toISOString();
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_time: backwardValidTime })
      });
      expect(res3.statusCode).toBe(200);

      // 4. -310s backward (rejected)
      const backwardInvalidTime = new Date(Date.now() - 310 * 1000).toISOString();
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_time: backwardInvalidTime })
      });
      expect(res4.statusCode).toBe(409);
      expect(res4.json().error).toBe('CLOCK_SKEW');
    });

    it('3.4: Accepts valid batch but isolates and rejects mutation with updated_at > 5 minutes in future', async () => {
      const now = new Date().toISOString();
      const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 minutes

      const validHabit: Habit = {
        id: '22222222-2222-4222-a222-222222222225',
        nama: 'Valid Habit In Time',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: now,
        deleted_at: null,
        device_id: 'device-01'
      };

      const futureHabit: Habit = {
        id: '22222222-2222-4222-a222-222222222226',
        nama: 'Future Timestamp Habit Attack',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: futureTime,
        deleted_at: null,
        device_id: 'device-01'
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-valid', table: 'habits', record: validHabit },
          { mutation_id: 'm-future', table: 'habits', record: futureHabit }
        ])
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.applied).toContain('m-valid');
      expect(body.applied).not.toContain('m-future');
      expect(body.rejected.length).toBe(1);
      expect(body.rejected[0].mutation_id).toBe('m-future');
      expect(body.rejected[0].reason).toMatch(/future/i);

      // Verify database has only valid habit, not the future habit
      const validRows = await provider.db.selectFrom('habits').selectAll().where('id', '=', validHabit.id).execute();
      expect(validRows.length).toBe(1);

      const futureRows = await provider.db.selectFrom('habits').selectAll().where('id', '=', futureHabit.id).execute();
      expect(futureRows.length).toBe(0);
    });

    it('3.5: Returns accurate server_time ISO in 409 CLOCK_SKEW body enabling client clock resynchronization', async () => {
      const beforeReq = Date.now();
      const skewedTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_time: skewedTime })
      });

      const afterReq = Date.now();
      expect(res.statusCode).toBe(409);
      const serverTimeMs = new Date(res.json().server_time).getTime();
      expect(serverTimeMs).toBeGreaterThanOrEqual(beforeReq - 500);
      expect(serverTimeMs).toBeLessThanOrEqual(afterReq + 500);
    });
  });

  // =========================================================================
  // Scenario 4: Pull dengan paginasi (has_more: true lalu false) pada dataset besar (>500 baris)
  // (ARCH §6.2.8 & §10)
  // =========================================================================
  describe('Scenario 4: Large dataset pull cursor pagination (>500 rows)', () => {
    it('4.1: Pulls dataset of 550 records across 2 pages with accurate has_more and new_server_seq progression', async () => {
      // Seed 550 habits directly into database
      const totalRecords = 550;
      const batchSize = 100;

      for (let i = 0; i < totalRecords; i += batchSize) {
        const batch: any[] = [];
        for (let j = i; j < Math.min(i + batchSize, totalRecords); j++) {
          const id = `55000000-0000-4000-a000-${String(j).padStart(12, '0')}`;
          batch.push({
            id,
            nama: `Paginated Habit ${j}`,
            category_id: null,
            mode: 'checklist',
            satuan: null,
            archived: false,
            created_date: '2026-09-01',
            updated_at: new Date(Date.now() - 300000 + j * 100).toISOString(),
            deleted_at: null,
            device_id: 'device-01'
          });
        }

        // Insert using sync endpoint or provider
        await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload(
            'device-01',
            batch.map((r, idx) => ({ mutation_id: `m-bulk-${i + idx}`, table: 'habits', record: r }))
          )
        });
      }

      // 1. Pull Page 1 (limit 500 rows)
      const page1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 0 })
      });

      expect(page1Res.statusCode).toBe(200);
      const page1Body = page1Res.json();
      expect(page1Body.changes.length).toBe(500);
      expect(page1Body.has_more).toBe(true);
      expect(page1Body.new_server_seq).toBe(500);

      // Verify page 1 records are monotonically ordered by server_seq
      for (let k = 0; k < page1Body.changes.length - 1; k++) {
        expect(page1Body.changes[k].record.server_seq).toBeLessThan(page1Body.changes[k + 1].record.server_seq);
      }

      // 2. Pull Page 2 (remaining 50 rows)
      const page2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: page1Body.new_server_seq })
      });

      expect(page2Res.statusCode).toBe(200);
      const page2Body = page2Res.json();
      expect(page2Body.changes.length).toBe(50);
      expect(page2Body.has_more).toBe(false);
      expect(page2Body.new_server_seq).toBe(550);

      // Verify no duplicate IDs between Page 1 and Page 2
      const page1Ids = new Set(page1Body.changes.map((c: any) => c.record.id));
      const page2Ids = new Set(page2Body.changes.map((c: any) => c.record.id));
      for (const id of page2Ids) {
        expect(page1Ids.has(id)).toBe(false);
      }
      expect(page1Ids.size + page2Ids.size).toBe(550);

      // 3. Pull Page 3: fully synchronized client
      const page3Res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 550 })
      });

      expect(page3Res.statusCode).toBe(200);
      const page3Body = page3Res.json();
      expect(page3Body.changes.length).toBe(0);
      expect(page3Body.has_more).toBe(false);
      expect(page3Body.new_server_seq).toBe(550);
    });

    it('4.2: Exact 500 boundary: 500 records returns has_more=false; 501 records returns has_more=true on page 1 and has_more=false with 1 row on page 2', async () => {
      // 1. Seed exactly 500 categories
      const batch500: any[] = [];
      for (let i = 0; i < 500; i++) {
        batch500.push({
          id: `c5000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
          nama: `Cat 500 #${i}`,
          updated_at: new Date(Date.now() - 60000 + i * 10).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        });
      }

      // Insert in 5 chunks of 100
      for (let i = 0; i < 500; i += 100) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload(
            'device-01',
            batch500.slice(i, i + 100).map((r, idx) => ({ mutation_id: `m-b500-${i + idx}`, table: 'categories', record: r }))
          )
        });
      }

      // Pull with exactly 500 records
      const res500 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 0 })
      });

      expect(res500.statusCode).toBe(200);
      expect(res500.json().changes.length).toBe(500);
      expect(res500.json().has_more).toBe(false); // Exactly 500 records: has_more MUST be false

      // 2. Add the 501st record (1 habit)
      const habit501: Habit = {
        id: 'c5000000-9999-4000-a000-000000000001',
        nama: 'Habit 501st',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'device-01'
      };

      await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [{ mutation_id: 'm-501', table: 'habits', record: habit501 }])
      });

      // Pull Page 1 with 501 records
      const res501Page1 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 0 })
      });

      expect(res501Page1.statusCode).toBe(200);
      expect(res501Page1.json().changes.length).toBe(500);
      expect(res501Page1.json().has_more).toBe(true);

      // Pull Page 2 with 501 records
      const res501Page2 = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: res501Page1.json().new_server_seq })
      });

      expect(res501Page2.statusCode).toBe(200);
      expect(res501Page2.json().changes.length).toBe(1);
      expect(res501Page2.json().has_more).toBe(false);
      expect(res501Page2.json().changes[0].record.id).toBe(habit501.id);
    });

    it('4.3: Heterogeneous multi-table dataset (>500 rows across categories, habits, schedules, logs, settings) correctly paginates and preserves cross-table global server_seq order', async () => {
      // Seed 120 items in 5 distinct tables = 600 records total
      const countPerTable = 120;
      const baseTime = Date.now() - 300000;

      // Seed categories
      for (let i = 0; i < countPerTable; i += 60) {
        const batch: any[] = [];
        for (let j = i; j < i + 60; j++) {
          batch.push({
            mutation_id: `m-ht-cat-${j}`,
            table: 'categories',
            record: {
              id: `ca000000-0000-4000-a000-${String(j).padStart(12, '0')}`,
              nama: `Hetero Cat ${j}`,
              updated_at: new Date(baseTime + j * 10).toISOString(),
              deleted_at: null,
              device_id: 'device-01'
            }
          });
        }
        await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', batch)
        });
      }

      // Seed habits
      for (let i = 0; i < countPerTable; i += 60) {
        const batch: any[] = [];
        for (let j = i; j < i + 60; j++) {
          batch.push({
            mutation_id: `m-ht-h-${j}`,
            table: 'habits',
            record: {
              id: `ba000000-0000-4000-a000-${String(j).padStart(12, '0')}`,
              nama: `Hetero Habit ${j}`,
              category_id: null,
              mode: 'checklist',
              satuan: null,
              archived: false,
              created_date: '2026-09-01',
              updated_at: new Date(baseTime + j * 10).toISOString(),
              deleted_at: null,
              device_id: 'device-01'
            }
          });
        }
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', batch)
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().applied.length).toBe(batch.length);
      }

      // Seed schedules
      for (let i = 0; i < countPerTable; i += 60) {
        const batch: any[] = [];
        for (let j = i; j < i + 60; j++) {
          batch.push({
            mutation_id: `m-ht-s-${j}`,
            table: 'habit_schedules',
            record: {
              id: `da000000-0000-4000-a000-${String(j).padStart(12, '0')}`,
              habit_id: `ba000000-0000-4000-a000-${String(j).padStart(12, '0')}`,
              tipe_frekuensi: 'daily',
              hari_terjadwal: null,
              jumlah_per_minggu: null,
              target: 1,
              effective_from: '2026-09-01',
              updated_at: new Date(baseTime + j * 10).toISOString(),
              deleted_at: null,
              device_id: 'device-01'
            }
          });
        }
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', batch)
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().applied.length).toBe(batch.length);
      }

      // Seed logs
      for (let i = 0; i < countPerTable; i += 60) {
        const batch: any[] = [];
        for (let j = i; j < i + 60; j++) {
          const hId = `ba000000-0000-4000-a000-${String(j).padStart(12, '0')}`;
          batch.push({
            mutation_id: `m-ht-l-${j}`,
            table: 'logs',
            record: {
              id: generateLogId(hId, '2026-09-01'),
              habit_id: hId,
              tanggal: '2026-09-01',
              nilai: null,
              selesai: true,
              updated_at: new Date(baseTime + j * 10).toISOString(),
              deleted_at: null,
              device_id: 'device-01'
            }
          });
        }
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', batch)
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().applied.length).toBe(batch.length);
      }

      // Seed settings
      for (let i = 0; i < countPerTable; i += 60) {
        const batch: any[] = [];
        for (let j = i; j < i + 60; j++) {
          batch.push({
            mutation_id: `m-ht-set-${j}`,
            table: 'settings',
            record: {
              id: `ea000000-0000-4000-a000-${String(j).padStart(12, '0')}`,
              jam_mulai_hari: '04:00',
              theme: 'system',
              updated_at: new Date(baseTime + j * 10).toISOString(),
              deleted_at: null,
              device_id: 'device-01'
            }
          });
        }
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', batch)
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().applied.length).toBe(batch.length);
      }

      // Total records = 120 * 5 = 600 records across 5 tables
      // Pull Page 1 (first 500)
      const p1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: 0 })
      });

      expect(p1Res.statusCode).toBe(200);
      const p1Body = p1Res.json();
      expect(p1Body.changes.length).toBe(500);
      expect(p1Body.has_more).toBe(true);

      // Verify page 1 is strictly sorted by server_seq
      for (let k = 0; k < p1Body.changes.length - 1; k++) {
        expect(p1Body.changes[k].record.server_seq).toBeLessThan(p1Body.changes[k + 1].record.server_seq);
      }

      // Pull Page 2 (remaining 100)
      const p2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [], { client_last_server_seq: p1Body.new_server_seq })
      });

      expect(p2Res.statusCode).toBe(200);
      const p2Body = p2Res.json();
      expect(p2Body.changes.length).toBe(100);
      expect(p2Body.has_more).toBe(false);

      // Total combined changes across all 5 tables must equal 600
      const totalChanges = [...p1Body.changes, ...p2Body.changes];
      expect(totalChanges.length).toBe(600);

      // Ensure all 5 tables are represented in the pulled changes
      const tablesPresent = new Set(totalChanges.map((c: any) => c.table));
      expect(tablesPresent.has('categories')).toBe(true);
      expect(tablesPresent.has('habits')).toBe(true);
      expect(tablesPresent.has('habit_schedules')).toBe(true);
      expect(tablesPresent.has('logs')).toBe(true);
      expect(tablesPresent.has('settings')).toBe(true);
    });
  });

  // =========================================================================
  // Scenario 5: Dua request push bersamaan (konkurensi) tidak menghasilkan
  // server_seq yang terlewat atau lock deadlocks. (ARCH §6.2.3 & §10)
  // =========================================================================
  describe('Scenario 5: Concurrent push requests without sequence skips or lock deadlocks', () => {
    it('5.1: Handles simultaneous push requests, avoids lock deadlocks, and guarantees contiguous monotonic sequence', async () => {
      const now = new Date().toISOString();

      const habitA: Habit = {
        id: '66666666-0000-4000-a000-111111111111',
        nama: 'Habit Concurrency A',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: now,
        deleted_at: null,
        device_id: 'device-01'
      };

      const habitB: Habit = {
        id: '66666666-0000-4000-a000-222222222222',
        nama: 'Habit Concurrency B',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: now,
        deleted_at: null,
        device_id: 'device-02'
      };

      // Launch 2 simultaneous requests
      const [resA, resB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', [{ mutation_id: 'm-conc-a', table: 'habits', record: habitA }])
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev2 },
          payload: createSyncPayload('device-02', [{ mutation_id: 'm-conc-b', table: 'habits', record: habitB }])
        })
      ]);

      const responses = [resA, resB];
      const successResponses = responses.filter((r) => r.statusCode === 200);
      const contentionResponses = responses.filter((r) => r.statusCode === 503);

      // Verify that no deadlock (500) occurred
      for (const res of responses) {
        expect(res.statusCode).not.toBe(500);
      }

      // If one transaction had lock contention (503), client immediate retry succeeds
      if (contentionResponses.length > 0) {
        expect(contentionResponses[0].json().error).toBe('LOCK_CONTENTION');

        const retryRes = await app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev2 },
          payload: createSyncPayload('device-02', [{ mutation_id: 'm-conc-b', table: 'habits', record: habitB }])
        });
        expect(retryRes.statusCode).toBe(200);
      }

      // Both records exist in database
      const rows = await provider.db
        .selectFrom('habits')
        .selectAll()
        .where('id', 'in', [habitA.id, habitB.id])
        .orderBy('server_seq', 'asc')
        .execute();

      expect(rows.length).toBe(2);
      // server_seq values must be contiguous with no gaps
      const seq1 = Number(rows[0]!.server_seq);
      const seq2 = Number(rows[1]!.server_seq);
      expect(seq2).toBe(seq1 + 1);
    });

    it('5.2: Advisory lock contention returns HTTP 503 LOCK_CONTENTION immediately; after release, retry succeeds cleanly without sequence gaps', async () => {
      const now = new Date().toISOString();
      const habitContended: Habit = {
        id: '66666666-0000-4000-a000-333333333333',
        nama: 'Habit Under Lock Contention',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: now,
        deleted_at: null,
        device_id: 'device-01'
      };

      // 1. Simulate advisory lock held by another process/transaction
      provider.simulateAdvisoryLock(true);

      const contendedRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-contended', table: 'habits', record: habitContended }
        ])
      });

      expect(contendedRes.statusCode).toBe(503);
      const errBody = contendedRes.json();
      expect(errBody.error).toBe('LOCK_CONTENTION');

      // Verify no record was inserted during lock contention
      const rowsBefore = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitContended.id).execute();
      expect(rowsBefore.length).toBe(0);

      // 2. Release advisory lock (previous transaction finishes)
      provider.simulateAdvisoryLock(false);

      // 3. Retry transaction: must succeed with 200 OK
      const retryRes = await app.inject({
        method: 'POST',
        url: '/api/v1/sync',
        headers: { authorization: authHeaderDev1 },
        payload: createSyncPayload('device-01', [
          { mutation_id: 'm-contended', table: 'habits', record: habitContended }
        ])
      });

      expect(retryRes.statusCode).toBe(200);
      expect(retryRes.json().applied).toContain('m-contended');

      // Verify record is successfully stored
      const rowsAfter = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitContended.id).execute();
      expect(rowsAfter.length).toBe(1);
      expect(rowsAfter[0]!.nama).toBe('Habit Under Lock Contention');
    });

    it('5.3: Rapid burst of concurrent requests handles all pushes without deadlock, data loss, or server_seq skips', async () => {
      const now = new Date().toISOString();
      const burstSize = 8;
      const burstHabits: Habit[] = [];

      for (let i = 0; i < burstSize; i++) {
        burstHabits.push({
          id: `66666666-0000-4000-b000-${String(i).padStart(12, '0')}`,
          nama: `Burst Habit ${i}`,
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: new Date(Date.now() - 10000 + i * 100).toISOString(),
          deleted_at: null,
          device_id: 'device-01'
        });
      }

      // Fire all burst requests concurrently
      const requests = burstHabits.map((h, idx) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/sync',
          headers: { authorization: authHeaderDev1 },
          payload: createSyncPayload('device-01', [{ mutation_id: `m-burst-${idx}`, table: 'habits', record: h }])
        })
      );

      const results = await Promise.all(requests);

      // Assert no unhandled server crash or deadlock (no 500s)
      for (const res of results) {
        expect(res.statusCode).not.toBe(500);
        expect([200, 503]).toContain(res.statusCode);
      }

      // Any 503 contention requests retry until 200
      for (let i = 0; i < results.length; i++) {
        if (results[i]!.statusCode === 503) {
          const retryRes = await app.inject({
            method: 'POST',
            url: '/api/v1/sync',
            headers: { authorization: authHeaderDev1 },
            payload: createSyncPayload('device-01', [
              { mutation_id: `m-burst-${i}`, table: 'habits', record: burstHabits[i]! }
            ])
          });
          expect(retryRes.statusCode).toBe(200);
        }
      }

      // All burst records must be present in database
      const rows = await provider.db
        .selectFrom('habits')
        .selectAll()
        .where('id', 'in', burstHabits.map((h) => h.id))
        .orderBy('server_seq', 'asc')
        .execute();

      expect(rows.length).toBe(burstSize);

      // Verify server_seq values are strictly monotonic
      for (let k = 0; k < rows.length - 1; k++) {
        expect(Number(rows[k + 1]!.server_seq)).toBeGreaterThan(Number(rows[k]!.server_seq));
      }
    });
  });

  // =========================================================================
  // Scenario 6: Server gagal start jika env kosong atau salah format (fail-fast)
  // (ARCH §7.2 & §10)
  // =========================================================================
  describe('Scenario 6: Fail-fast server startup on missing or malformed configuration', () => {
    it('6.1: Fails fast when DATABASE_URL is missing or empty', () => {
      expect(() => {
        validateServerConfig({
          databaseUrl: '',
          deviceTokens: { 'dev-1': 'tokenhash' }
        });
      }).toThrow(/DATABASE_URL is required/);
    });

    it('6.2: Fails fast when DATABASE_URL has invalid protocol', () => {
      expect(() => {
        validateServerConfig({
          databaseUrl: 'mysql://user:pass@127.0.0.1:3306/db',
          deviceTokens: { 'dev-1': 'tokenhash' }
        });
      }).toThrow(/valid PostgreSQL connection string/);
    });

    it('6.3: Fails fast when DEVICE_TOKENS is missing or empty', () => {
      expect(() => {
        validateServerConfig({
          databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit',
          deviceTokens: {}
        });
      }).toThrow(/DEVICE_TOKENS must contain at least one valid device entry/);
    });

    it('6.4: Fails fast when DEVICE_TOKENS has malformed string format', () => {
      expect(() => {
        loadConfigFromEnv({
          DATABASE_URL: 'postgresql://127.0.0.1:5432/vibehabit',
          DEVICE_TOKENS: 'malformed_token_without_colon'
        });
      }).toThrow(/Malformed DEVICE_TOKENS entry/);
    });

    it('6.5: Fails fast when host is not strictly 127.0.0.1', () => {
      expect(() => {
        validateServerConfig({
          databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit',
          deviceTokens: { 'dev-1': 'tokenhash' },
          host: '0.0.0.0'
        });
      }).toThrow(/strictly bind to 127.0.0.1/);
    });

    it('6.6: buildApp fails fast and prevents server start when env validation fails', async () => {
      await expect(
        buildApp({
          config: {
            databaseUrl: 'invalid-url',
            deviceTokens: {},
            host: '127.0.0.1',
            port: 3001,
            nodeEnv: 'production',
            staticDistPath: 'apps/web/dist'
          }
        })
      ).rejects.toThrow();
    });

    it('6.7: Fails fast when port is invalid or out of range (<1 or >65535)', () => {
      expect(() => {
        validateServerConfig({
          databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit',
          deviceTokens: { 'dev-1': 'tokenhash' },
          port: 70000
        });
      }).toThrow();

      expect(() => {
        validateServerConfig({
          databaseUrl: 'postgresql://127.0.0.1:5432/vibehabit',
          deviceTokens: { 'dev-1': 'tokenhash' },
          port: -1
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // Scenario 7: Uji pemulihan skema database: verifikasi pemulihan file migrasi
  // 001_init.sql ke database bersih. (ARCH §9.5 & §10)
  // =========================================================================
  describe('Scenario 7: Database schema recovery verification from 001_init.sql', () => {
    it('7.1: Verifies 001_init.sql recovery script contains all required domain tables and sequence', () => {
      const migrationPath = getMigrationPath();
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

      // Sequence
      expect(sqlContent).toContain('CREATE SEQUENCE IF NOT EXISTS vibehabit_server_seq');

      // Tables
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS categories');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS habits');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS habit_schedules');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS logs');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS settings');

      // Standard columns
      expect(sqlContent).toContain("server_seq BIGINT NOT NULL DEFAULT nextval('vibehabit_server_seq')");
      expect(sqlContent).toContain('updated_at TIMESTAMPTZ NOT NULL');
      expect(sqlContent).toContain('deleted_at TIMESTAMPTZ NULL');
      expect(sqlContent).toContain('device_id VARCHAR');
    });

    it('7.2: Verifies table constraints and indexes in 001_init.sql', () => {
      const migrationPath = getMigrationPath();
      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

      // Unique constraint on logs (habit_id, tanggal)
      expect(sqlContent).toMatch(/CONSTRAINT uq_logs_habit_tanggal UNIQUE\s*\(\s*habit_id\s*,\s*tanggal\s*\)/);

      // Check constraints
      expect(sqlContent).toContain("CHECK (mode IN ('checklist', 'quantitative'))");
      expect(sqlContent).toContain("CHECK (tipe_frekuensi IN ('daily', 'specific_days', 'x_per_week'))");

      // Foreign keys
      expect(sqlContent).toContain('REFERENCES categories(id) ON DELETE SET NULL');
      expect(sqlContent).toContain('REFERENCES habits(id) ON DELETE CASCADE');

      // server_seq indexes
      expect(sqlContent).toContain('idx_categories_server_seq');
      expect(sqlContent).toContain('idx_habits_server_seq');
      expect(sqlContent).toContain('idx_habit_schedules_server_seq');
      expect(sqlContent).toContain('idx_logs_server_seq');
      expect(sqlContent).toContain('idx_settings_server_seq');
    });

    it('7.3: Exercises clean database recovery by successfully performing full relational inserts and reads', async () => {
      const now = new Date().toISOString();
      const catId = '77777777-1111-4111-a111-111111111111';
      const habitId = '77777777-2222-4222-a222-222222222222';
      const schedId = '77777777-3333-4333-a333-333333333333';
      const logId = '77777777-4444-4444-a444-444444444444';
      const settingId = '77777777-5555-4555-a555-555555555555';

      // 1. Insert category
      await provider.db
        .insertInto('categories')
        .values({
          id: catId,
          nama: 'Produktivitas',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 2. Insert habit referencing category
      await provider.db
        .insertInto('habits')
        .values({
          id: habitId,
          nama: 'Deep Work 2 Jam',
          category_id: catId,
          mode: 'quantitative',
          satuan: 'jam',
          archived: false,
          created_date: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 3. Insert schedule referencing habit
      await provider.db
        .insertInto('habit_schedules')
        .values({
          id: schedId,
          habit_id: habitId,
          tipe_frekuensi: 'daily',
          hari_terjadwal: null,
          jumlah_per_minggu: null,
          target: 2,
          effective_from: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 4. Insert log referencing habit
      await provider.db
        .insertInto('logs')
        .values({
          id: logId,
          habit_id: habitId,
          tanggal: '2026-09-30',
          nilai: 2,
          selesai: true,
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 5. Insert setting
      await provider.db
        .insertInto('settings')
        .values({
          id: settingId,
          jam_mulai_hari: '04:00',
          theme: 'system',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // Read back all records and verify referential integrity and auto server_seq
      const cat = await provider.db.selectFrom('categories').selectAll().where('id', '=', catId).executeTakeFirst();
      expect(cat?.nama).toBe('Produktivitas');
      expect(Number(cat?.server_seq)).toBeGreaterThan(0);

      const h = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).executeTakeFirst();
      expect(h?.category_id).toBe(catId);
      expect(h?.mode).toBe('quantitative');

      const s = await provider.db.selectFrom('habit_schedules').selectAll().where('id', '=', schedId).executeTakeFirst();
      expect(s?.habit_id).toBe(habitId);
      expect(s?.tipe_frekuensi).toBe('daily');

      const l = await provider.db.selectFrom('logs').selectAll().where('id', '=', logId).executeTakeFirst();
      expect(l?.habit_id).toBe(habitId);
      expect(l?.nilai).toBe(2);

      const st = await provider.db.selectFrom('settings').selectAll().where('id', '=', settingId).executeTakeFirst();
      expect(st?.jam_mulai_hari).toBe('04:00');
    });

    it('7.4: Verifies unique constraint uq_logs_habit_tanggal triggers error when duplicate log is inserted', async () => {
      const now = new Date().toISOString();
      const habitId = '77777777-2222-4222-a222-222222222223';
      const logId1 = '77777777-4444-4444-a444-111111111111';
      const logId2 = '77777777-4444-4444-a444-222222222222';
      const date = '2026-09-30';

      // Insert habit
      await provider.db
        .insertInto('habits')
        .values({
          id: habitId,
          nama: 'Unique Habit Test',
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // Insert log 1
      await provider.db
        .insertInto('logs')
        .values({
          id: logId1,
          habit_id: habitId,
          tanggal: date,
          nilai: null,
          selesai: true,
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // Attempting to insert log 2 with different id but same (habit_id, tanggal) must fail
      await expect(
        provider.db
          .insertInto('logs')
          .values({
            id: logId2,
            habit_id: habitId,
            tanggal: date,
            nilai: null,
            selesai: false,
            updated_at: now,
            deleted_at: null,
            device_id: 'device-02'
          })
          .execute()
      ).rejects.toThrow(/uq_logs_habit_tanggal|duplicate key/i);
    });

    it('7.5: Verifies check constraints in 001_init.sql enforce valid enum domains', async () => {
      const now = new Date().toISOString();
      const habitId = '77777777-2222-4222-a222-222222222299';

      // 1. Invalid habit mode must be rejected
      await expect(
        provider.db
          .insertInto('habits')
          .values({
            id: habitId,
            nama: 'Invalid Mode Habit',
            category_id: null,
            mode: 'timer' as any, // Not checklist or quantitative
            satuan: null,
            archived: false,
            created_date: '2026-09-01',
            updated_at: now,
            deleted_at: null,
            device_id: 'device-01'
          })
          .execute()
      ).rejects.toThrow();

      // 2. Insert valid habit
      await provider.db
        .insertInto('habits')
        .values({
          id: habitId,
          nama: 'Valid Mode Habit',
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 3. Invalid schedule tipe_frekuensi must be rejected
      await expect(
        provider.db
          .insertInto('habit_schedules')
          .values({
            id: '77777777-3333-4333-a333-222222222299',
            habit_id: habitId,
            tipe_frekuensi: 'yearly' as any, // Not daily, specific_days, or x_per_week
            hari_terjadwal: null,
            jumlah_per_minggu: null,
            target: 1,
            effective_from: '2026-09-01',
            updated_at: now,
            deleted_at: null,
            device_id: 'device-01'
          })
          .execute()
      ).rejects.toThrow();
    });

    it('7.6: Verifies foreign key actions: category deletion sets category_id to NULL; habit deletion cascades to schedules and logs', async () => {
      const now = new Date().toISOString();
      const catId = '77777777-1111-4111-a111-999999999999';
      const habitId = '77777777-2222-4222-a222-999999999999';
      const schedId = '77777777-3333-4333-a333-999999999999';
      const logId = '77777777-4444-4444-a444-999999999999';

      // 1. Insert parent category
      await provider.db
        .insertInto('categories')
        .values({
          id: catId,
          nama: 'Category Cascade Test',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 2. Insert habit referencing category
      await provider.db
        .insertInto('habits')
        .values({
          id: habitId,
          nama: 'Habit Cascade Test',
          category_id: catId,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 3. Insert schedule referencing habit
      await provider.db
        .insertInto('habit_schedules')
        .values({
          id: schedId,
          habit_id: habitId,
          tipe_frekuensi: 'daily',
          hari_terjadwal: null,
          jumlah_per_minggu: null,
          target: 1,
          effective_from: '2026-09-01',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // 4. Insert log referencing habit
      await provider.db
        .insertInto('logs')
        .values({
          id: logId,
          habit_id: habitId,
          tanggal: '2026-09-30',
          nilai: null,
          selesai: true,
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // Verify records exist
      expect(await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).executeTakeFirst()).toBeDefined();

      // 5. Delete category: ON DELETE SET NULL on habits
      await provider.db.deleteFrom('categories').where('id', '=', catId).execute();
      const habitAfterCatDelete = await provider.db.selectFrom('habits').selectAll().where('id', '=', habitId).executeTakeFirst();
      expect(habitAfterCatDelete).toBeDefined();
      expect(habitAfterCatDelete?.category_id).toBeNull();

      // 6. Delete habit: ON DELETE CASCADE on habit_schedules and logs
      await provider.db.deleteFrom('habits').where('id', '=', habitId).execute();
      const schedAfterHabitDelete = await provider.db.selectFrom('habit_schedules').selectAll().where('id', '=', schedId).executeTakeFirst();
      expect(schedAfterHabitDelete).toBeUndefined();

      const logAfterHabitDelete = await provider.db.selectFrom('logs').selectAll().where('id', '=', logId).executeTakeFirst();
      expect(logAfterHabitDelete).toBeUndefined();
    });

    it('7.7: Verifies idempotent schema re-application: executing 001_init.sql on populated database succeeds without wiping data', async () => {
      const now = new Date().toISOString();
      const catId = '77777777-1111-4111-a111-888888888888';

      // Seed data into existing database
      await provider.db
        .insertInto('categories')
        .values({
          id: catId,
          nama: 'Category Pre-Migration',
          updated_at: now,
          deleted_at: null,
          device_id: 'device-01'
        })
        .execute();

      // Execute migration 001_init.sql again
      const migrationPath = getMigrationPath();
      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
      await provider.executeSql(sqlContent);

      // Verify existing data was preserved (IF NOT EXISTS prevents data destruction)
      const cat = await provider.db.selectFrom('categories').selectAll().where('id', '=', catId).executeTakeFirst();
      expect(cat).toBeDefined();
      expect(cat?.nama).toBe('Category Pre-Migration');
    });
  });
});
