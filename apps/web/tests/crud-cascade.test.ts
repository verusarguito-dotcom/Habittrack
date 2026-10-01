import './setup.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VibeHabitDatabase, createDatabase } from '../src/db/database.js';
import {
  saveCategory,
  saveHabit,
  saveHabitSchedule,
  saveHabitLog,
  saveSetting,
  deleteHabitCascading,
  queryHabits,
  queryHabitSchedules,
  queryLogsByHabit,
  getSetting
} from '../src/db/operations.js';
import type { Habit, HabitSchedule, HabitLog, Category, Setting } from '@vibehabit/shared';

describe('Reactive CRUD Operations & Cascading Tombstones (T009)', () => {
  let db: VibeHabitDatabase;

  beforeEach(async () => {
    db = createDatabase(`test_cascade_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  it('enqueues insert mutation into outbox when new habit is saved', async () => {
    const habit: Habit = {
      id: 'habit-yoga',
      nama: 'Yoga',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };

    await saveHabit(db, habit, 'dev-1');

    const loaded = await db.habits.get('habit-yoga');
    expect(loaded).toBeDefined();
    expect(loaded?.nama).toBe('Yoga');

    const outboxItems = await db.outbox.toArray();
    expect(outboxItems.length).toBe(1);
    expect(outboxItems[0]!.action).toBe('insert');
    expect(outboxItems[0]!.table).toBe('habits');
    expect(outboxItems[0]!.record_id).toBe('habit-yoga');
  });

  it('cascades tombstone (deleted_at) to habit, schedules, and logs in a single Dexie transaction', async () => {
    const habit: Habit = {
      id: 'habit-deep',
      nama: 'Guitar',
      category_id: null,
      mode: 'quantitative',
      satuan: 'menit',
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const s1: HabitSchedule = {
      id: 'sched-1',
      habit_id: habit.id,
      tipe_frekuensi: 'daily',
      hari_terjadwal: null,
      jumlah_per_minggu: null,
      target: 20,
      effective_from: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const s2: HabitSchedule = {
      id: 'sched-2',
      habit_id: habit.id,
      tipe_frekuensi: 'daily',
      hari_terjadwal: null,
      jumlah_per_minggu: null,
      target: 30,
      effective_from: '2026-09-15',
      updated_at: '2026-09-15T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const log1: HabitLog = {
      id: 'log-1',
      habit_id: habit.id,
      tanggal: '2026-09-28',
      nilai: 20,
      selesai: true,
      updated_at: '2026-09-28T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const log2: HabitLog = {
      id: 'log-2',
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 30,
      selesai: true,
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };

    await saveHabit(db, habit, 'dev-1');
    await saveHabitSchedule(db, s1, 'dev-1');
    await saveHabitSchedule(db, s2, 'dev-1');
    await saveHabitLog(db, log1, 'dev-1');
    await saveHabitLog(db, log2, 'dev-1');

    // Clear outbox to specifically measure delete mutations
    await db.outbox.clear();

    const timestamp = '2026-09-30T12:00:00.000Z';
    await deleteHabitCascading(db, habit.id, 'dev-1', timestamp);

    // Habit record has tombstone
    const loadedHabit = await db.habits.get(habit.id);
    expect(loadedHabit?.deleted_at).toBe(timestamp);

    // All schedules have tombstone
    const sched1 = await db.habit_schedules.get(s1.id);
    const sched2 = await db.habit_schedules.get(s2.id);
    expect(sched1?.deleted_at).toBe(timestamp);
    expect(sched2?.deleted_at).toBe(timestamp);

    // All logs have tombstone
    const loadedLog1 = await db.logs.get(log1.id);
    const loadedLog2 = await db.logs.get(log2.id);
    expect(loadedLog1?.deleted_at).toBe(timestamp);
    expect(loadedLog2?.deleted_at).toBe(timestamp);

    // Query helpers filter out soft-deleted records
    const activeHabits = await queryHabits(db);
    expect(activeHabits.find((h) => h.id === habit.id)).toBeUndefined();

    const activeSchedules = await queryHabitSchedules(db, habit.id);
    expect(activeSchedules.length).toBe(0);

    const activeLogs = await queryLogsByHabit(db, habit.id);
    expect(activeLogs.length).toBe(0);

    // Outbox contains 5 delete mutations (1 habit + 2 schedules + 2 logs)
    const outboxItems = await db.outbox.toArray();
    expect(outboxItems.length).toBe(5);
    for (const item of outboxItems) {
      expect(item.action).toBe('delete');
      expect((item.record as any).deleted_at).toBe(timestamp);
    }
  });

  it('cascades deletion on habit with 0 schedules and 0 logs cleanly', async () => {
    const habit: Habit = {
      id: 'bare-habit',
      nama: 'Bare Habit',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };

    await saveHabit(db, habit, 'dev-1');
    await db.outbox.clear();

    await deleteHabitCascading(db, habit.id, 'dev-1');

    const loaded = await db.habits.get(habit.id);
    expect(loaded?.deleted_at).not.toBeNull();
    const outbox = await db.outbox.toArray();
    expect(outbox.length).toBe(1);
    expect(outbox[0]!.table).toBe('habits');
  });

  it('idempotently handles cascading deletion called twice on the same habit', async () => {
    const habit: Habit = {
      id: 'double-del',
      nama: 'Double Delete',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };

    await saveHabit(db, habit, 'dev-1');
    await db.outbox.clear();

    await deleteHabitCascading(db, habit.id, 'dev-1');
    const countAfterFirst = (await db.outbox.toArray()).length;
    expect(countAfterFirst).toBe(1);

    // Second call: should not enqueue duplicate outbox entries for already deleted records
    await deleteHabitCascading(db, habit.id, 'dev-1');
    const countAfterSecond = (await db.outbox.toArray()).length;
    expect(countAfterSecond).toBe(1);
  });

  it('saves and retrieves categories and settings', async () => {
    const cat: Category = {
      id: 'cat-1',
      nama: 'Kesehatan',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    await saveCategory(db, cat, 'dev-1');

    const loadedCat = await db.categories.get('cat-1');
    expect(loadedCat?.nama).toBe('Kesehatan');

    const setting: Setting = {
      id: 'setting-main',
      jam_mulai_hari: '04:00',
      theme: 'dark',
      device_token_hash: 'abc',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    await saveSetting(db, setting, 'dev-1');

    const loadedSetting = await getSetting(db);
    expect(loadedSetting?.jam_mulai_hari).toBe('04:00');
    expect(loadedSetting?.theme).toBe('dark');
  });
});
