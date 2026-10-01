import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 06: Atomic Transaction & Advisory Lock', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('serializes sync operations using transaction advisory lock', async () => {
    const habit = createHabit({ nama: 'Serial Habit' });
    harness.clientA.saveHabit(habit);

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    // Lock must be released after completion
    expect((harness.server as any).advisoryLockHeld).toBe(false);
  });

  it('rejects concurrent request when advisory lock is actively held', () => {
    // Manually simulate active lock hold
    (harness.server as any).advisoryLockHeld = true;

    const req = createSyncRequest();
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(503);
    expect((res.body as any).error).toBe('LOCK_CONTENTION');

    // Clean up
    (harness.server as any).advisoryLockHeld = false;
  });

  it('releases advisory lock immediately even if mutation validation fails', () => {
    const invalidReq = {
      protocol_version: 1,
      device_id: 'device-test-01',
      client_time: new Date().toISOString(),
      client_last_server_seq: 0,
      mutations: [
        {
          mutation_id: 'invalid-id-without-uuid',
          table: 'unknown_table', // invalid table enum
          record: {}
        }
      ]
    };

    const res = harness.server.handleSync(invalidReq, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(400);
    expect((harness.server as any).advisoryLockHeld).toBe(false);
  });

  it('releases advisory lock immediately on clock skew 409 rejection', () => {
    const skewedTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min
    const req = createSyncRequest([], { client_time: skewedTime });

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(409);
    expect((harness.server as any).advisoryLockHeld).toBe(false);
  });

  it('permits subsequent transaction after previous lock completes', async () => {
    const habit1 = createHabit({ nama: 'Transaction 1' });
    const habit2 = createHabit({ nama: 'Transaction 2' });

    harness.clientA.saveHabit(habit1);
    const res1 = await harness.clientA.sync(harness.server);
    expect(res1.success).toBe(true);

    harness.clientA.saveHabit(habit2);
    const res2 = await harness.clientA.sync(harness.server);
    expect(res2.success).toBe(true);

    expect(harness.server.habits.has(habit1.id)).toBe(true);
    expect(harness.server.habits.has(habit2.id)).toBe(true);
  });
});
