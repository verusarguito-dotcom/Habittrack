import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 15: Iterative Sync Loop & LWW Merge', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('runs sync loop iteratively until has_more is false and outbox is drained', async () => {
    // Populate server with 600 habits to force multiple pagination pages (>500)
    for (let i = 1; i <= 600; i++) {
      const h = createHabit({ nama: `Server Habit ${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(res.loops).toBeGreaterThanOrEqual(2); // At least 2 iterations for 600 items
    expect(harness.clientA.habits.size).toBe(600);
    expect(harness.clientA.outbox.length).toBe(0);
  });

  it('protects local uncommitted outbox mutations against older server changes during merge', async () => {
    const habitId = '00000000-0000-4000-8000-000000000033';

    // Server has an older version
    const serverHabit = createHabit({
      id: habitId,
      nama: 'Server Version 1',
      updated_at: '2026-09-29T10:00:00.000Z',
      server_seq: 10
    });
    harness.server.habits.set(habitId, serverHabit as any);

    // Client has a newer local uncommitted edit
    const clientHabit = createHabit({
      id: habitId,
      nama: 'Client Newer Edit',
      updated_at: '2026-09-29T10:05:00.000Z'
    });
    harness.clientA.saveHabit(clientHabit);

    // Simulate incoming server change merge
    harness.clientA.mergeIncomingChanges([
      { table: 'habits', record: serverHabit as any }
    ]);

    // Local record must NOT be overwritten by older server record
    expect(harness.clientA.habits.get(habitId)?.nama).toBe('Client Newer Edit');
  });

  it('overwrites local record when server record is strictly newer', () => {
    const habitId = '00000000-0000-4000-8000-000000000034';
    const localHabit = createHabit({
      id: habitId,
      nama: 'Local Older',
      updated_at: '2026-09-29T09:00:00.000Z'
    });
    harness.clientA.habits.set(habitId, localHabit);

    const newerServerHabit = createHabit({
      id: habitId,
      nama: 'Server Newer Winner',
      updated_at: '2026-09-29T11:00:00.000Z',
      server_seq: 15
    });

    harness.clientA.mergeIncomingChanges([
      { table: 'habits', record: newerServerHabit as any }
    ]);

    expect(harness.clientA.habits.get(habitId)?.nama).toBe('Server Newer Winner');
  });

  it('updates client_last_server_seq upon successful batch processing', async () => {
    const habit = createHabit({ nama: 'Seq Test Habit' });
    harness.clientA.saveHabit(habit);

    expect(harness.clientA.clientLastServerSeq).toBe(0);
    await harness.clientA.sync(harness.server);
    expect(harness.clientA.clientLastServerSeq).toBeGreaterThan(0);
  });

  it('transitions UI sync state to Tersinkron upon clean loop completion', async () => {
    const habit = createHabit({ nama: 'State Test Habit' });
    harness.clientA.saveHabit(habit);

    expect(harness.clientA.syncState).toMatch(/Menunggu sinkron/);
    await harness.clientA.sync(harness.server);
    expect(harness.clientA.syncState).toBe('Tersinkron');
  });
});
