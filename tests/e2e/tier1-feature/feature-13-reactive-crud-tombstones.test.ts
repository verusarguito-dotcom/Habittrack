import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createHabitSchedule,
  createHabitLog,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 13: Reactive CRUD & Cascading Tombstones', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('enqueues insert mutation into outbox when new habit is created', () => {
    const habit = createHabit({ nama: 'Yoga' });
    harness.clientA.saveHabit(habit);

    expect(harness.clientA.habits.has(habit.id)).toBe(true);
    expect(harness.clientA.outbox.length).toBe(1);
    expect(harness.clientA.outbox[0]!.action).toBe('insert');
    expect(harness.clientA.outbox[0]!.record_id).toBe(habit.id);
  });

  it('cascades tombstone (deleted_at) to habit record when habit is deleted', () => {
    const habit = createHabit({ nama: 'Old Habit' });
    harness.clientA.saveHabit(habit);

    harness.clientA.deleteHabitCascading(habit.id);

    const localHabit = harness.clientA.habits.get(habit.id);
    expect(localHabit?.deleted_at).toBeDefined();
    expect(localHabit?.deleted_at).not.toBeNull();
  });

  it('cascades tombstone to all schedules associated with deleted habit', () => {
    const habit = createHabit({ nama: 'Guitar Practice' });
    const s1 = createHabitSchedule({ habit_id: habit.id, target: 15 });
    const s2 = createHabitSchedule({ habit_id: habit.id, target: 30 });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitSchedule(s1);
    harness.clientA.saveHabitSchedule(s2);

    harness.clientA.deleteHabitCascading(habit.id);

    expect(harness.clientA.habitSchedules.get(s1.id)?.deleted_at).not.toBeNull();
    expect(harness.clientA.habitSchedules.get(s2.id)?.deleted_at).not.toBeNull();
  });

  it('cascades tombstone to all logs associated with deleted habit', () => {
    const habit = createHabit({ nama: 'Coding Habit' });
    const log1 = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-28' });
    const log2 = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitLog(log1);
    harness.clientA.saveHabitLog(log2);

    harness.clientA.deleteHabitCascading(habit.id);

    expect(harness.clientA.logs.get(log1.id)?.deleted_at).not.toBeNull();
    expect(harness.clientA.logs.get(log2.id)?.deleted_at).not.toBeNull();
  });

  it('enqueues tombstones for habit, schedules, and logs within a single atomic batch in outbox', () => {
    const habit = createHabit();
    const sch = createHabitSchedule({ habit_id: habit.id });
    const log = createHabitLog({ habit_id: habit.id });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitSchedule(sch);
    harness.clientA.saveHabitLog(log);
    harness.clientA.outbox = []; // Clear initial inserts for clarity

    harness.clientA.deleteHabitCascading(habit.id);

    // Should have 3 deletion mutations in outbox: habit, schedule, log
    expect(harness.clientA.outbox.length).toBe(3);
    const tables = harness.clientA.outbox.map((o) => o.table);
    expect(tables).toContain('habits');
    expect(tables).toContain('habit_schedules');
    expect(tables).toContain('logs');
  });
});
