import './setup.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VibeHabitDatabase, createDatabase } from '../src/db/database.js';
import { saveHabit, saveHabitLog } from '../src/db/operations.js';
import { SyncEngine, type SyncTransport } from '../src/sync/engine.js';
import type {
  Habit,
  HabitLog,
  SyncRequest,
  SyncResponse
} from '@vibehabit/shared';

describe('Iterative Sync Engine & Local LWW Merge (T010)', () => {
  let db: VibeHabitDatabase;

  beforeEach(async () => {
    db = createDatabase(`test_sync_engine_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  it('runs sync loop iteratively pulling paginated data until has_more is false', async () => {
    let callCount = 0;
    // Mock transport delivering 2 pages of changes
    const transport: SyncTransport = {
      send: async (request: SyncRequest): Promise<{ status: number; body: any }> => {
        callCount++;
        if (callCount === 1) {
          const res: SyncResponse = {
            server_time: '2026-09-29T12:00:00.000Z',
            applied: request.mutations.map((m) => m.mutation_id),
            rejected: [],
            changes: [
              {
                table: 'habits',
                record: {
                  id: 'h-server-1',
                  nama: 'Server Habit 1',
                  category_id: null,
                  mode: 'checklist',
                  satuan: null,
                  archived: false,
                  created_date: '2026-09-01',
                  updated_at: '2026-09-29T10:00:00.000Z',
                  deleted_at: null,
                  device_id: 'dev-server',
                  server_seq: 10
                }
              }
            ],
            new_server_seq: 10,
            has_more: true
          };
          return { status: 200, body: res };
        } else {
          const res: SyncResponse = {
            server_time: '2026-09-29T12:00:01.000Z',
            applied: request.mutations.map((m) => m.mutation_id),
            rejected: [],
            changes: [
              {
                table: 'habits',
                record: {
                  id: 'h-server-2',
                  nama: 'Server Habit 2',
                  category_id: null,
                  mode: 'checklist',
                  satuan: null,
                  archived: false,
                  created_date: '2026-09-01',
                  updated_at: '2026-09-29T10:05:00.000Z',
                  deleted_at: null,
                  device_id: 'dev-server',
                  server_seq: 20
                }
              }
            ],
            new_server_seq: 20,
            has_more: false
          };
          return { status: 200, body: res };
        }
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const res = await engine.sync();
    expect(res.success).toBe(true);
    expect(res.loops).toBe(2);
    expect(callCount).toBe(2);
    expect(engine.getLastServerSeq()).toBe(20);

    const h1 = await db.habits.get('h-server-1');
    const h2 = await db.habits.get('h-server-2');
    expect(h1).toBeDefined();
    expect(h2).toBeDefined();
  });

  it('protects local uncommitted outbox mutations against older server changes during merge', async () => {
    const habitId = '00000000-0000-4000-8000-000000000033';

    // Client has a newer local uncommitted edit
    const clientHabit: Habit = {
      id: habitId,
      nama: 'Client Newer Edit',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:05:00.000Z',
      deleted_at: null,
      device_id: 'dev-client-1'
    };
    await saveHabit(db, clientHabit, 'dev-client-1');

    // Server sends an older version
    const transport: SyncTransport = {
      send: async (): Promise<{ status: number; body: any }> => {
        const res: SyncResponse = {
          server_time: '2026-09-29T12:00:00.000Z',
          applied: [], // Not applied yet
          rejected: [],
          changes: [
            {
              table: 'habits',
              record: {
                id: habitId,
                nama: 'Server Version 1',
                category_id: null,
                mode: 'checklist',
                satuan: null,
                archived: false,
                created_date: '2026-09-01',
                updated_at: '2026-09-29T10:00:00.000Z', // older
                deleted_at: null,
                device_id: 'dev-server',
                server_seq: 10
              }
            }
          ],
          new_server_seq: 10,
          has_more: false
        };
        return { status: 200, body: res };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    await engine.sync();

    // Local record must NOT be overwritten by older server record
    const saved = await db.habits.get(habitId);
    expect(saved?.nama).toBe('Client Newer Edit');
  });

  it('overwrites local record when server record strictly wins LWW', async () => {
    const habitId = '00000000-0000-4000-8000-000000000044';

    // Local has older version (already synced / no outbox)
    const localHabit: Habit = {
      id: habitId,
      nama: 'Client Old',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T08:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-client-1'
    };
    await db.habits.put(localHabit);

    const transport: SyncTransport = {
      send: async (): Promise<{ status: number; body: any }> => {
        const res: SyncResponse = {
          server_time: '2026-09-29T12:00:00.000Z',
          applied: [],
          rejected: [],
          changes: [
            {
              table: 'habits',
              record: {
                id: habitId,
                nama: 'Server Strictly Newer',
                category_id: null,
                mode: 'checklist',
                satuan: null,
                archived: false,
                created_date: '2026-09-01',
                updated_at: '2026-09-29T11:00:00.000Z', // newer
                deleted_at: null,
                device_id: 'dev-server',
                server_seq: 15
              }
            }
          ],
          new_server_seq: 15,
          has_more: false
        };
        return { status: 200, body: res };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    await engine.sync();

    const saved = await db.habits.get(habitId);
    expect(saved?.nama).toBe('Server Strictly Newer');
  });

  it('clears confirmed outbox mutations and updates UI state to Tersinkron', async () => {
    const habit: Habit = {
      id: 'h-outbox-clear',
      nama: 'Step 1',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-client-1'
    };
    await saveHabit(db, habit, 'dev-client-1');
    expect(await db.outbox.count()).toBe(1);

    const transport: SyncTransport = {
      send: async (req): Promise<{ status: number; body: any }> => {
        const res: SyncResponse = {
          server_time: '2026-09-29T12:00:00.000Z',
          applied: req.mutations.map((m) => m.mutation_id),
          rejected: [],
          changes: [],
          new_server_seq: 5,
          has_more: false
        };
        return { status: 200, body: res };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const result = await engine.sync();
    expect(result.success).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getSyncState()).toBe('Tersinkron');
  });

  it('handles clock skew 409 error by setting state to "Jam perangkat tidak akurat (>5 menit)"', async () => {
    const transport: SyncTransport = {
      send: async (): Promise<{ status: number; body: any }> => {
        return {
          status: 409,
          body: { error: 'CLOCK_SKEW', message: 'Client clock skewed', server_time: new Date().toISOString() }
        };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const result = await engine.sync();
    expect(result.success).toBe(false);
    expect(result.error).toBe('CLOCK_SKEW');
    expect(engine.getSyncState()).toBe('Jam perangkat tidak akurat (>5 menit)');
  });

  it('handles server down / unreachable by setting state to "Server tidak terjangkau (Tailscale aktif?)"', async () => {
    const transport: SyncTransport = {
      send: async (): Promise<{ status: number; body: any }> => {
        return { status: 503, body: { error: 'SERVICE_UNAVAILABLE' } };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const result = await engine.sync();
    expect(result.success).toBe(false);
    expect(result.error).toBe('SERVER_UNREACHABLE');
    expect(engine.getSyncState()).toBe('Server tidak terjangkau (Tailscale aktif?)');
    expect(engine.getRetryAttempt()).toBe(1);
  });

  it('records server_seq on local Dexie records when server echoes applied changes', async () => {
    const habitId = 'h-server-seq-test';
    const habit: Habit = {
      id: habitId,
      nama: 'Testing Server Seq',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-client-1'
    };
    await saveHabit(db, habit, 'dev-client-1');

    const transport: SyncTransport = {
      send: async (req): Promise<{ status: number; body: any }> => {
        const res: SyncResponse = {
          server_time: '2026-09-29T12:00:00.000Z',
          applied: req.mutations.map((m) => m.mutation_id),
          rejected: [],
          changes: [
            {
              table: 'habits',
              record: {
                ...habit,
                server_seq: 77
              }
            }
          ],
          new_server_seq: 77,
          has_more: false
        };
        return { status: 200, body: res };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const result = await engine.sync();
    expect(result.success).toBe(true);

    const savedHabit = await db.habits.get(habitId);
    expect(savedHabit?.server_seq).toBe(77);
  });

  it('safely handles concurrent sync() calls by deduplicating overlapping executions', async () => {
    let sendCalls = 0;
    const transport: SyncTransport = {
      send: async (): Promise<{ status: number; body: any }> => {
        sendCalls++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          status: 200,
          body: {
            server_time: '2026-09-29T12:00:00.000Z',
            applied: [],
            rejected: [],
            changes: [],
            new_server_seq: 1,
            has_more: false
          }
        };
      }
    };

    const engine = new SyncEngine({
      db,
      deviceId: 'dev-client-1',
      authToken: 'token-secret',
      transport
    });

    const [res1, res2] = await Promise.all([engine.sync(), engine.sync()]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(sendCalls).toBe(1); // Only 1 request was sent concurrently!
  });
});
