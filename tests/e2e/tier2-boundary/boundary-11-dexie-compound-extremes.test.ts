import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createHabitLog,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 11: Dexie Compound Index Boundaries', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('handles boundary date queries (e.g. 1970-01-01 and 2099-12-31)', () => {
    const habit = createHabit();
    const logPast = createHabitLog({ habit_id: habit.id, tanggal: '1970-01-01' });
    const logFuture = createHabitLog({ habit_id: habit.id, tanggal: '2099-12-31' });

    harness.clientA.saveHabitLog(logPast);
    harness.clientA.saveHabitLog(logFuture);

    expect(harness.clientA.queryLogsByHabitAndDate(habit.id, '1970-01-01')?.id).toBe(logPast.id);
    expect(harness.clientA.queryLogsByHabitAndDate(habit.id, '2099-12-31')?.id).toBe(logFuture.id);
  });

  it('prevents duplicate log entries on (habit_id, tanggal) in local client store via LWW', () => {
    const habit = createHabit();
    const log1 = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 5,
      updated_at: '2026-09-29T10:00:00.000Z'
    });
    const log2 = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 10,
      updated_at: '2026-09-29T10:05:00.000Z'
    });

    harness.clientA.saveHabitLog(log1);
    harness.clientA.saveHabitLog(log2);

    const logsForDate = harness.clientA.queryLogsByDate('2026-09-29');
    expect(logsForDate.length).toBe(1);
    expect(logsForDate[0]!.nilai).toBe(10);
  });

  it('ignores deleted logs when executing compound index queries', () => {
    const habit = createHabit();
    const log = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabitLog(log);
    expect(harness.clientA.queryLogsByHabitAndDate(habit.id, '2026-09-29')).toBeDefined();

    // Mark log deleted
    harness.clientA.logs.set(log.id, { ...log, deleted_at: new Date().toISOString() });
    expect(harness.clientA.queryLogsByHabitAndDate(habit.id, '2026-09-29')).toBeUndefined();
  });

  it('handles query on non-existent habit ID returning undefined without error', () => {
    const nonExistentId = '00000000-0000-4000-8000-999999999999';
    expect(harness.clientA.queryLogsByHabitAndDate(nonExistentId, '2026-09-29')).toBeUndefined();
  });

  it('indexes multiple logs across different habits on the same date correctly', () => {
    const h1 = createHabit({ nama: 'Habit 1' });
    const h2 = createHabit({ nama: 'Habit 2' });
    const h3 = createHabit({ nama: 'Habit 3' });

    const l1 = createHabitLog({ habit_id: h1.id, tanggal: '2026-09-29' });
    const l2 = createHabitLog({ habit_id: h2.id, tanggal: '2026-09-29' });
    const l3 = createHabitLog({ habit_id: h3.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabitLog(l1);
    harness.clientA.saveHabitLog(l2);
    harness.clientA.saveHabitLog(l3);

    const logs = harness.clientA.queryLogsByDate('2026-09-29');
    expect(logs.length).toBe(3);
  });
});
