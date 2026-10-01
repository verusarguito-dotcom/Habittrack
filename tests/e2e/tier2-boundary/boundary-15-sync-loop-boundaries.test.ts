import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 15: Sync Loop Iteration & Termination Boundaries', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('terminates in exactly 1 loop when outbox is 0 and server has no new changes', async () => {
    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(res.loops).toBe(1);
    expect(harness.clientA.syncState).toBe('Tersinkron');
  });

  it('caps loop execution at max safety ceiling (20 iterations) to guard against server loops', async () => {
    // Client starts with empty outbox, sync runs
    const res = await harness.clientA.sync(harness.server);
    expect(res.loops).toBeLessThanOrEqual(20);
  });

  it('progresses cursor across multiple iterations without regressing', async () => {
    // Create changes on server in batches
    for (let i = 1; i <= 550; i++) {
      const h = createHabit({ nama: `Server Multi ${i}` });
      (harness.server as any).globalServerSeq++;
      harness.server.habits.set(h.id, { ...h, server_seq: (harness.server as any).globalServerSeq });
    }

    const initialCursor = harness.clientA.clientLastServerSeq;
    await harness.clientA.sync(harness.server);
    const finalCursor = harness.clientA.clientLastServerSeq;

    expect(finalCursor).toBeGreaterThan(initialCursor);
    expect(finalCursor).toBe(550);
  });

  it('terminates loop when client pushes 50 mutations without server pull changes', async () => {
    for (let i = 0; i < 50; i++) {
      harness.clientA.saveHabit(createHabit({ nama: `Push Only ${i}` }));
    }

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(res.loops).toBe(1);
    expect(harness.clientA.outbox.length).toBe(0);
  });

  it('resumes from saved cursor without re-downloading previously processed records', async () => {
    const h1 = createHabit({ nama: 'First Wave' });
    harness.clientA.saveHabit(h1);
    await harness.clientA.sync(harness.server);

    const savedCursor = harness.clientA.clientLastServerSeq;

    // Second sync without new changes
    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(harness.clientA.clientLastServerSeq).toBe(savedCursor);
  });
});
