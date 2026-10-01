import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createMutation,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 09: Replay Extremes & Duplicate Delivery', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('tolerates triple replay of the same batch without side effects', () => {
    const habit = createHabit({ nama: 'Triple Replay Habit' });
    const mut = createMutation('habits', habit, 'mut-triple');
    const req = createSyncRequest([mut]);

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const seq1 = harness.server.getGlobalServerSeq();

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const seq2 = harness.server.getGlobalServerSeq();

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const seq3 = harness.server.getGlobalServerSeq();

    expect(seq2).toBe(seq1);
    expect(seq3).toBe(seq1);
    expect(harness.server.habits.size).toBe(1);
  });

  it('safely handles empty batch replay', () => {
    const req = createSyncRequest([]);
    const res1 = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const res2 = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('safely handles replaying an older batch after a newer batch has already been applied', () => {
    const habitId = '00000000-0000-4000-8000-000000000077';
    const oldHabit = createHabit({
      id: habitId,
      nama: 'Old State',
      updated_at: new Date(Date.now() - 60000).toISOString()
    });
    const newHabit = createHabit({
      id: habitId,
      nama: 'New State',
      updated_at: new Date().toISOString()
    });

    const mutOld = createMutation('habits', oldHabit, 'm-old');
    const mutNew = createMutation('habits', newHabit, 'm-new');

    // First apply newer
    harness.server.handleSync(createSyncRequest([mutNew]), `Bearer ${harness.clientA.authToken}`);
    const seqNew = harness.server.getGlobalServerSeq();

    // Replay older
    const resReplayOld = harness.server.handleSync(createSyncRequest([mutOld]), `Bearer ${harness.clientA.authToken}`);

    expect(resReplayOld.status).toBe(200);
    expect(harness.server.getGlobalServerSeq()).toBe(seqNew); // Seq unchanged
    expect(harness.server.habits.get(habitId)?.nama).toBe('New State'); // New state preserved
  });

  it('replaying an identical tombstone retains deleted_at value', () => {
    const habit = createHabit({ nama: 'Tombstone Replay' });
    const now = new Date().toISOString();
    const deletedHabit = { ...habit, deleted_at: now, updated_at: now };
    const mut = createMutation('habits', deletedHabit, 'm-tomb');

    harness.server.handleSync(createSyncRequest([mut]), `Bearer ${harness.clientA.authToken}`);
    harness.server.handleSync(createSyncRequest([mut]), `Bearer ${harness.clientA.authToken}`);

    expect(harness.server.habits.get(habit.id)?.deleted_at).toBe(now);
  });

  it('clears client outbox cleanly when replayed response returns applied array', async () => {
    const habit = createHabit({ nama: 'Outbox Replay Drain' });
    harness.clientA.saveHabit(habit);

    await harness.clientA.sync(harness.server);
    expect(harness.clientA.outbox.length).toBe(0);

    // Syncing again with empty outbox produces 0 errors
    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(harness.clientA.outbox.length).toBe(0);
  });
});
