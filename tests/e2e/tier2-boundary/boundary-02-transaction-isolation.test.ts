import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createSyncRequest,
  createMutation,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 02: Transaction Isolation & Partial Abort', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('handles empty mutations array without modifying global sequence', () => {
    const initialSeq = harness.server.getGlobalServerSeq();
    const req = createSyncRequest([]);

    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);
    expect(res.status).toBe(200);
    expect(harness.server.getGlobalServerSeq()).toBe(initialSeq);
  });

  it('ensures rollback on validation failure restores server sequence exactly', () => {
    const habit = createHabit({ nama: 'Stable Habit' });
    harness.clientA.saveHabit(habit);
    return harness.clientA.sync(harness.server).then(() => {
      const stableSeq = harness.server.getGlobalServerSeq();

      const invalidReq = {
        protocol_version: 1,
        device_id: harness.clientA.deviceId,
        client_time: new Date().toISOString(),
        client_last_server_seq: 0,
        mutations: [
          {
            mutation_id: 'bad-mut',
            table: 'unknown_table',
            record: {}
          }
        ]
      };

      const res = harness.server.handleSync(invalidReq, `Bearer ${harness.clientA.authToken}`);
      expect(res.status).toBe(400);
      expect(harness.server.getGlobalServerSeq()).toBe(stableSeq);
    });
  });

  it('preserves database integrity when transaction is called with extreme number of mutations', () => {
    const mutations = [];
    for (let i = 0; i < 200; i++) {
      const h = createHabit({ nama: `Bulk ${i}` });
      mutations.push(createMutation('habits', h, `mut-${i}`));
    }

    const req = createSyncRequest(mutations);
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(200);
    expect((res.body as any).applied.length).toBe(200);
    expect(harness.server.habits.size).toBe(200);
  });

  it('rejects batch exceeding max 200 mutations constraint', () => {
    const mutations = [];
    for (let i = 0; i < 201; i++) {
      const h = createHabit({ nama: `Excess ${i}` });
      mutations.push(createMutation('habits', h, `mut-excess-${i}`));
    }

    const req = createSyncRequest(mutations);
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('VALIDATION_ERROR');
  });

  it('executes subsequent isolated transactions without residual state leakage', async () => {
    const h1 = createHabit({ nama: 'Isolated 1' });
    harness.clientA.saveHabit(h1);
    await harness.clientA.sync(harness.server);

    const h2 = createHabit({ nama: 'Isolated 2' });
    harness.clientB.saveHabit(h2);
    await harness.clientB.sync(harness.server);

    expect(harness.server.habits.has(h1.id)).toBe(true);
    expect(harness.server.habits.has(h2.id)).toBe(true);
  });
});
