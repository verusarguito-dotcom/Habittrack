import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createMutation,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 09: Idempotent Batch Replay', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('guarantees identical response when replaying identical batch', () => {
    const habit = createHabit({ nama: 'Idempotent Habit' });
    const mut = createMutation('habits', habit, 'mut-idempotent-01');
    const req = createSyncRequest([mut]);

    const res1 = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const res2 = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect((res1.body as any).applied).toEqual(['mut-idempotent-01']);
    expect((res2.body as any).applied).toEqual(['mut-idempotent-01']);
  });

  it('does not advance server_seq when identical batch is replayed', () => {
    const habit = createHabit({ nama: 'Seq Protection Habit' });
    const mut = createMutation('habits', habit, 'mut-seq-01');
    const req = createSyncRequest([mut]);

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const seqAfterFirst = harness.server.getGlobalServerSeq();

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const seqAfterReplay = harness.server.getGlobalServerSeq();

    expect(seqAfterReplay).toBe(seqAfterFirst);
  });

  it('does not duplicate rows on replayed insertions', () => {
    const habit = createHabit({ nama: 'Unique In Store Habit' });
    const mut = createMutation('habits', habit, 'mut-unique-01');
    const req = createSyncRequest([mut]);

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const allMatches = Array.from(harness.server.habits.values()).filter((h) => h.id === habit.id);
    expect(allMatches.length).toBe(1);
  });

  it('preserves tombstone state on replaying soft-deleted records', () => {
    const habit = createHabit({ nama: 'To Be Deleted' });
    const delTime = new Date().toISOString();
    const habitDeleted = {
      ...habit,
      deleted_at: delTime,
      updated_at: delTime
    };

    const mut = createMutation('habits', habitDeleted, 'mut-del-01');
    const req = createSyncRequest([mut]);

    harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    const resReplay = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(resReplay.status).toBe(200);
    expect(harness.server.habits.get(habit.id)?.deleted_at).toBe(delTime);
  });

  it('allows client to safely clear outbox even on duplicate delivery confirmation', async () => {
    const habit = createHabit({ nama: 'Network Retried Habit' });
    harness.clientA.saveHabit(habit);

    // First sync
    await harness.clientA.sync(harness.server);
    expect(harness.clientA.outbox.length).toBe(0);

    // Second sync immediately with empty outbox
    const secondSync = await harness.clientA.sync(harness.server);
    expect(secondSync.success).toBe(true);
    expect(harness.clientA.outbox.length).toBe(0);
  });
});
