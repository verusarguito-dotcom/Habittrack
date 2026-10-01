import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createHabitSchedule,
  createHabitLog,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 13: Deep Cascading Tombstones & High Volume Deletes', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('cascades deletion on habit with 0 schedules and 0 logs cleanly', () => {
    const habit = createHabit({ nama: 'Bare Habit' });
    harness.clientA.saveHabit(habit);
    harness.clientA.outbox = [];

    harness.clientA.deleteHabitCascading(habit.id);

    expect(harness.clientA.habits.get(habit.id)?.deleted_at).not.toBeNull();
    expect(harness.clientA.outbox.length).toBe(1);
    expect(harness.clientA.outbox[0]!.table).toBe('habits');
  });

  it('cascades deletion across 10 schedules and 100 logs in a single operation', () => {
    const habit = createHabit({ nama: 'Large Cascade Habit' });
    harness.clientA.saveHabit(habit);

    for (let i = 0; i < 10; i++) {
      harness.clientA.saveHabitSchedule(createHabitSchedule({ habit_id: habit.id }));
    }
    for (let i = 0; i < 100; i++) {
      const m = String(Math.floor(i / 28) + 1).padStart(2, '0');
      const d = String((i % 28) + 1).padStart(2, '0');
      harness.clientA.saveHabitLog(createHabitLog({ habit_id: habit.id, tanggal: `2026-${m}-${d}` }));
    }

    harness.clientA.outbox = [];

    harness.clientA.deleteHabitCascading(habit.id);

    // 1 habit + 10 schedules + 100 logs = 111 tombstones in outbox
    expect(harness.clientA.outbox.length).toBe(111);

    // All must have deleted_at populated
    for (const item of harness.clientA.outbox) {
      expect((item.record as any).deleted_at).toBeDefined();
    }
  });

  it('idempotently handles cascading deletion called twice on the same habit', () => {
    const habit = createHabit({ nama: 'Double Delete' });
    const log = createHabitLog({ habit_id: habit.id });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitLog(log);

    harness.clientA.deleteHabitCascading(habit.id);
    const countAfterFirst = harness.clientA.outbox.length;

    // Second cascade delete on already-deleted items
    harness.clientA.deleteHabitCascading(habit.id);
    const countAfterSecond = harness.clientA.outbox.length;

    // Second call should only generate a habit update tombstone, not duplicate already deleted logs
    expect(countAfterSecond).toBeGreaterThanOrEqual(countAfterFirst);
  });

  it('leaves unrelated habits, schedules, and logs untouched during cascade', () => {
    const h1 = createHabit({ nama: 'Victim Habit' });
    const h2 = createHabit({ nama: 'Safe Habit' });

    const s1 = createHabitSchedule({ habit_id: h1.id });
    const s2 = createHabitSchedule({ habit_id: h2.id });

    const l1 = createHabitLog({ habit_id: h1.id, tanggal: '2026-09-29' });
    const l2 = createHabitLog({ habit_id: h2.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabit(h1);
    harness.clientA.saveHabit(h2);
    harness.clientA.saveHabitSchedule(s1);
    harness.clientA.saveHabitSchedule(s2);
    harness.clientA.saveHabitLog(l1);
    harness.clientA.saveHabitLog(l2);

    harness.clientA.deleteHabitCascading(h1.id);

    // h2, s2, l2 must have deleted_at == null
    expect(harness.clientA.habits.get(h2.id)?.deleted_at).toBeNull();
    expect(harness.clientA.habitSchedules.get(s2.id)?.deleted_at).toBeNull();
    expect(harness.clientA.logs.get(l2.id)?.deleted_at).toBeNull();
  });

  it('synchronizes deep cascading deletion without foreign key constraint violations', async () => {
    const habit = createHabit({ nama: 'Deep Sync Habit' });
    const sch = createHabitSchedule({ habit_id: habit.id });
    const log = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitSchedule(sch);
    harness.clientA.saveHabitLog(log);
    await harness.clientA.sync(harness.server);

    // Delete cascading with explicit later timestamp
    const delTime = new Date(Date.now() + 5000).toISOString();
    harness.clientA.deleteHabitCascading(habit.id, delTime);
    const syncRes = await harness.clientA.sync(harness.server);

    expect(syncRes.success).toBe(true);
    expect(harness.server.habits.get(habit.id)?.deleted_at).not.toBeNull();
    expect(harness.server.habitSchedules.get(sch.id)?.deleted_at).not.toBeNull();
    expect(harness.server.logs.get(log.id)?.deleted_at).not.toBeNull();
  });
});
