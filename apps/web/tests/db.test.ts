import './setup.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VibeHabitDatabase, createDatabase } from '../src/db/database.js';
import {
  saveHabit,
  saveHabitLog,
  queryLogsByHabitAndDate,
  queryLogsByDate
} from '../src/db/operations.js';
import type { Habit, HabitLog } from '@vibehabit/shared';

describe('Client Dexie Database & Compound Indexes (T009)', () => {
  let db: VibeHabitDatabase;

  beforeEach(async () => {
    // Unique db name per test
    db = createDatabase(`test_vibehabit_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  it('initializes local database stores for all domain tables and outbox', () => {
    expect(db.categories).toBeDefined();
    expect(db.habits).toBeDefined();
    expect(db.habit_schedules).toBeDefined();
    expect(db.logs).toBeDefined();
    expect(db.settings).toBeDefined();
    expect(db.outbox).toBeDefined();
  });

  it('queries logs efficiently using compound index [habit_id+tanggal]', async () => {
    const habit: Habit = {
      id: 'habit-101',
      nama: 'Meditation',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };

    const log: HabitLog = {
      id: 'log-101',
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 1,
      selesai: true,
      updated_at: '2026-09-29T12:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };

    await saveHabit(db, habit, 'device-test-1');
    await saveHabitLog(db, log, 'device-test-1');

    const found = await queryLogsByHabitAndDate(db, habit.id, '2026-09-29');
    expect(found).toBeDefined();
    expect(found?.id).toBe(log.id);
    expect(found?.selesai).toBe(true);
    expect(found?.nilai).toBe(1);
  });

  it('returns undefined for compound query when record does not exist', async () => {
    const found = await queryLogsByHabitAndDate(db, 'non-existent-habit', '2026-01-01');
    expect(found).toBeUndefined();
  });

  it('queries all logs for a specific date using index tanggal', async () => {
    const habit1: Habit = {
      id: 'habit-a',
      nama: 'Habit A',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };
    const habit2: Habit = {
      id: 'habit-b',
      nama: 'Habit B',
      category_id: null,
      mode: 'quantitative',
      satuan: 'halaman',
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };

    const log1: HabitLog = {
      id: 'log-1',
      habit_id: habit1.id,
      tanggal: '2026-09-29',
      nilai: 1,
      selesai: true,
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };
    const log2: HabitLog = {
      id: 'log-2',
      habit_id: habit2.id,
      tanggal: '2026-09-29',
      nilai: 15,
      selesai: true,
      updated_at: '2026-09-29T11:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };
    const logOtherDate: HabitLog = {
      id: 'log-3',
      habit_id: habit1.id,
      tanggal: '2026-09-28',
      nilai: 1,
      selesai: true,
      updated_at: '2026-09-28T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-test-1'
    };

    await saveHabit(db, habit1, 'device-test-1');
    await saveHabit(db, habit2, 'device-test-1');
    await saveHabitLog(db, log1, 'device-test-1');
    await saveHabitLog(db, log2, 'device-test-1');
    await saveHabitLog(db, logOtherDate, 'device-test-1');

    const logsToday = await queryLogsByDate(db, '2026-09-29');
    expect(logsToday.length).toBe(2);
    const ids = logsToday.map((l) => l.id);
    expect(ids).toContain(log1.id);
    expect(ids).toContain(log2.id);
  });

  it('supports high volume log querying within sub-second execution (<0.3s)', async () => {
    const logs: HabitLog[] = [];
    for (let i = 1; i <= 2000; i++) {
      const day = (i % 28) + 1;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      logs.push({
        id: `perf-log-${i}`,
        habit_id: `habit-${i % 10}`,
        tanggal: `2026-09-${dayStr}`,
        nilai: i,
        selesai: true,
        updated_at: '2026-09-29T10:00:00.000Z',
        deleted_at: null,
        device_id: 'device-perf'
      });
    }

    await db.logs.bulkAdd(logs);

    const start = performance.now();
    const found = await queryLogsByDate(db, '2026-09-15');
    const elapsed = performance.now() - start;

    expect(found.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(300); // Must be < 0.3s (300ms)
  });

  it('enforces local unique constraint on [habit_id, tanggal] using LWW resolution', async () => {
    const logOlder: HabitLog = {
      id: 'log-v1',
      habit_id: 'habit-unique-test',
      tanggal: '2026-09-29',
      nilai: 5,
      selesai: false,
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-1'
    };
    const logNewer: HabitLog = {
      id: 'log-v2',
      habit_id: 'habit-unique-test',
      tanggal: '2026-09-29',
      nilai: 10,
      selesai: true,
      updated_at: '2026-09-29T10:05:00.000Z',
      deleted_at: null,
      device_id: 'device-1'
    };

    await saveHabitLog(db, logOlder, 'device-1');
    await saveHabitLog(db, logNewer, 'device-1');

    const logsForDate = await queryLogsByDate(db, '2026-09-29');
    expect(logsForDate.length).toBe(1);
    expect(logsForDate[0]!.nilai).toBe(10);
    expect(logsForDate[0]!.selesai).toBe(true);
  });
});
