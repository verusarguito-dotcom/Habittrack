import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createHabitLog,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 11: Dexie Schema & Compound Indexes', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('initializes local database stores for all domain tables and outbox', () => {
    expect(harness.clientA.categories).toBeDefined();
    expect(harness.clientA.habits).toBeDefined();
    expect(harness.clientA.habitSchedules).toBeDefined();
    expect(harness.clientA.logs).toBeDefined();
    expect(harness.clientA.settings).toBeDefined();
    expect(harness.clientA.outbox).toBeDefined();
  });

  it('queries logs efficiently using compound index [habit_id+tanggal]', () => {
    const habit = createHabit({ nama: 'Journaling' });
    const log = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 1,
      selesai: true
    });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitLog(log);

    const found = harness.clientA.queryLogsByHabitAndDate(habit.id, '2026-09-29');
    expect(found).toBeDefined();
    expect(found?.id).toBe(log.id);
    expect(found?.selesai).toBe(true);
  });

  it('returns undefined for compound query when record does not exist', () => {
    const habit = createHabit();
    const found = harness.clientA.queryLogsByHabitAndDate(habit.id, '2026-01-01');
    expect(found).toBeUndefined();
  });

  it('queries all logs for a specific date using index tanggal', () => {
    const habit1 = createHabit({ nama: 'Habit 1' });
    const habit2 = createHabit({ nama: 'Habit 2' });

    const log1 = createHabitLog({ habit_id: habit1.id, tanggal: '2026-09-29' });
    const log2 = createHabitLog({ habit_id: habit2.id, tanggal: '2026-09-29' });
    const logOtherDate = createHabitLog({ habit_id: habit1.id, tanggal: '2026-09-28' });

    harness.clientA.saveHabitLog(log1);
    harness.clientA.saveHabitLog(log2);
    harness.clientA.saveHabitLog(logOtherDate);

    const logsToday = harness.clientA.queryLogsByDate('2026-09-29');
    expect(logsToday.length).toBe(2);
    const ids = logsToday.map((l) => l.id);
    expect(ids).toContain(log1.id);
    expect(ids).toContain(log2.id);
  });

  it('supports high volume log querying within sub-second execution', () => {
    const habit = createHabit();
    // Simulate populating 1,000 logs
    for (let i = 1; i <= 1000; i++) {
      const day = (i % 28) + 1;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const log = createHabitLog({
        habit_id: habit.id,
        tanggal: `2026-09-${dayStr}`,
        nilai: i
      });
      harness.clientA.logs.set(log.id, log);
    }

    const start = performance.now();
    const found = harness.clientA.queryLogsByDate('2026-09-15');
    const elapsed = performance.now() - start;

    expect(found.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(300); // Must be < 0.3s (300ms)
  });
});
