import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 14: Outbox Mutation Queue & Batch Coalescing', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('coalesces multiple pending mutations for the same record into a single payload', () => {
    const habitId = '00000000-0000-4000-8000-000000000055';
    const v1 = createHabit({ id: habitId, nama: 'Name V1', updated_at: '2026-09-29T10:00:00.000Z' });
    const v2 = createHabit({ id: habitId, nama: 'Name V2', updated_at: '2026-09-29T10:01:00.000Z' });
    const v3 = createHabit({ id: habitId, nama: 'Name V3', updated_at: '2026-09-29T10:02:00.000Z' });

    harness.clientA.saveHabit(v1);
    harness.clientA.saveHabit(v2);
    harness.clientA.saveHabit(v3);

    expect(harness.clientA.outbox.length).toBe(3);

    const { mutations } = harness.clientA.coalesceOutbox();
    expect(mutations.length).toBe(1);
    expect((mutations[0]!.record as any).nama).toBe('Name V3');
  });

  it('tracks predecessor outbox IDs during coalescing', () => {
    const habit = createHabit();
    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabit({ ...habit, nama: 'Updated Once' });

    const { mutations, outboxItemMap } = harness.clientA.coalesceOutbox();
    const mutationId = mutations[0]!.mutation_id;
    const coveredIds = outboxItemMap.get(mutationId);

    expect(coveredIds).toBeDefined();
    expect(coveredIds?.length).toBe(2);
  });

  it('clears all intermediate and predecessor outbox records when server confirms coalesced mutation', async () => {
    const habit = createHabit({ nama: 'Step 1' });
    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabit({ ...habit, nama: 'Step 2' });
    harness.clientA.saveHabit({ ...habit, nama: 'Step 3 Final' });

    expect(harness.clientA.outbox.length).toBe(3);

    const res = await harness.clientA.sync(harness.server);
    expect(res.success).toBe(true);

    // All 3 outbox rows should be cleared
    expect(harness.clientA.outbox.length).toBe(0);
    expect(harness.server.habits.get(habit.id)?.nama).toBe('Step 3 Final');
  });

  it('maintains distinct mutations for different entities', () => {
    const h1 = createHabit({ nama: 'Habit 1' });
    const h2 = createHabit({ nama: 'Habit 2' });

    harness.clientA.saveHabit(h1);
    harness.clientA.saveHabit(h2);

    const { mutations } = harness.clientA.coalesceOutbox();
    expect(mutations.length).toBe(2);
  });

  it('preserves latest deletion mutation when record is created and then deleted', () => {
    const habit = createHabit({ nama: 'Transient Habit' });
    harness.clientA.saveHabit(habit);
    harness.clientA.deleteHabitCascading(habit.id);

    const { mutations } = harness.clientA.coalesceOutbox();
    const habitMut = mutations.find((m) => m.table === 'habits' && (m.record as any).id === habit.id);

    expect(habitMut).toBeDefined();
    expect((habitMut!.record as any).deleted_at).not.toBeNull();
  });
});
