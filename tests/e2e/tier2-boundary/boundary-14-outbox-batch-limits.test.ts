import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 14: Outbox Batch Limits & Coalescing Extremes', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('splits outbox into 200-mutation batches when queue contains >200 mutations', async () => {
    // Generate 250 distinct habits
    for (let i = 0; i < 250; i++) {
      harness.clientA.saveHabit(createHabit({ nama: `Habit Batch ${i}` }));
    }

    expect(harness.clientA.outbox.length).toBe(250);

    // Sync loop will push first 200, then remaining 50
    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);
    expect(res.loops).toBeGreaterThanOrEqual(2);
    expect(harness.clientA.outbox.length).toBe(0);
    expect(harness.server.habits.size).toBe(250);
  });

  it('coalesces 50 rapid modifications of a single habit into 1 single mutation', () => {
    const habit = createHabit({ nama: 'Init Name' });
    harness.clientA.saveHabit(habit);

    for (let i = 1; i <= 50; i++) {
      harness.clientA.saveHabit({
        ...habit,
        nama: `Edited Name ${i}`,
        updated_at: new Date(Date.now() + i * 100).toISOString()
      });
    }

    expect(harness.clientA.outbox.length).toBe(51);

    const { mutations, outboxItemMap } = harness.clientA.coalesceOutbox();
    expect(mutations.length).toBe(1);
    expect((mutations[0]!.record as any).nama).toBe('Edited Name 50');

    // All 51 outbox rows tracked
    const covered = outboxItemMap.get(mutations[0]!.mutation_id);
    expect(covered?.length).toBe(51);
  });

  it('returns empty array when outbox is completely empty', () => {
    harness.clientA.outbox = [];
    const { mutations, outboxItemMap } = harness.clientA.coalesceOutbox();
    expect(mutations.length).toBe(0);
    expect(outboxItemMap.size).toBe(0);
  });

  it('coalesces interleaved updates across multiple entities accurately', () => {
    const h1 = createHabit({ nama: 'Habit 1 V1' });
    const h2 = createHabit({ nama: 'Habit 2 V1' });

    harness.clientA.saveHabit(h1);
    harness.clientA.saveHabit(h2);
    harness.clientA.saveHabit({ ...h1, nama: 'Habit 1 V2' });
    harness.clientA.saveHabit({ ...h2, nama: 'Habit 2 V2' });

    const { mutations } = harness.clientA.coalesceOutbox();
    expect(mutations.length).toBe(2);

    const m1 = mutations.find((m) => (m.record as any).id === h1.id);
    const m2 = mutations.find((m) => (m.record as any).id === h2.id);

    expect((m1!.record as any).nama).toBe('Habit 1 V2');
    expect((m2!.record as any).nama).toBe('Habit 2 V2');
  });

  it('clears outbox completely upon batch push completion', async () => {
    for (let i = 0; i < 20; i++) {
      harness.clientA.saveHabit(createHabit({ nama: `H ${i}` }));
    }

    await harness.clientA.sync(harness.server);
    expect(harness.clientA.outbox.length).toBe(0);
  });
});
