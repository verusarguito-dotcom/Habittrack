import './setup.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VibeHabitDatabase, createDatabase } from '../src/db/database.js';
import {
  saveHabit,
  saveCategory,
  saveHabitSchedule,
  saveHabitLog,
  saveSetting,
  deleteHabitCascading
} from '../src/db/operations.js';
import {
  observeHabits,
  observeHabit,
  observeLogsForDate,
  observeLogsForDateRange,
  observeLogsForHabitAndDate,
  observeHabitSchedules,
  observeCategories,
  observeSetting,
  observeOutboxCount
} from '../src/db/hooks.js';
import type { Habit, HabitLog, HabitSchedule, Category, Setting } from '@vibehabit/shared';

describe('Reactive Query Helpers & Observables (T009)', () => {
  let db: VibeHabitDatabase;

  beforeEach(async () => {
    db = createDatabase(`test_hooks_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  function waitForNext<T>(observable: { subscribe: (cb: (val: T) => void) => { unsubscribe: () => void } }): Promise<T> {
    return new Promise<T>((resolve) => {
      const sub = observable.subscribe((val) => {
        sub.unsubscribe();
        resolve(val);
      });
    });
  }

  it('observes habits list reactively as habits are added and soft-deleted', async () => {
    const habitsObservable = observeHabits(db);
    const initial = await waitForNext(habitsObservable);
    expect(initial).toEqual([]);

    const habit: Habit = {
      id: 'h-reactive-1',
      nama: 'Morning Stretch',
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

    const updated = await waitForNext(habitsObservable);
    expect(updated.length).toBe(1);
    expect(updated[0]!.nama).toBe('Morning Stretch');

    await deleteHabitCascading(db, habit.id, 'dev-1');
    const afterDelete = await waitForNext(habitsObservable);
    expect(afterDelete.length).toBe(0);
  });

  it('observes a single habit by id', async () => {
    const habit: Habit = {
      id: 'h-single',
      nama: 'Read Book',
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

    const observed = await waitForNext(observeHabit(db, habit.id));
    expect(observed).toBeDefined();
    expect(observed?.nama).toBe('Read Book');
  });

  it('observes logs for a specific date and date range reactively', async () => {
    const log: HabitLog = {
      id: 'log-r1',
      habit_id: 'h-r1',
      tanggal: '2026-09-29',
      nilai: 1,
      selesai: true,
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };

    const dateObservable = observeLogsForDate(db, '2026-09-29');
    const rangeObservable = observeLogsForDateRange(db, '2026-09-01', '2026-09-30');

    await saveHabitLog(db, log, 'dev-1');

    const dateLogs = await waitForNext(dateObservable);
    expect(dateLogs.length).toBe(1);
    expect(dateLogs[0]!.id).toBe('log-r1');

    const rangeLogs = await waitForNext(rangeObservable);
    expect(rangeLogs.length).toBe(1);
    expect(rangeLogs[0]!.tanggal).toBe('2026-09-29');

    const singleLogObs = observeLogsForHabitAndDate(db, 'h-r1', '2026-09-29');
    const foundLog = await waitForNext(singleLogObs);
    expect(foundLog?.selesai).toBe(true);
  });

  it('observes categories, schedules, settings, and outbox count', async () => {
    const cat: Category = {
      id: 'cat-r1',
      nama: 'Fokus',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    await saveCategory(db, cat, 'dev-1');
    const cats = await waitForNext(observeCategories(db));
    expect(cats.length).toBe(1);
    expect(cats[0]!.nama).toBe('Fokus');

    const sch: HabitSchedule = {
      id: 'sch-r1',
      habit_id: 'h-r1',
      tipe_frekuensi: 'daily',
      hari_terjadwal: null,
      jumlah_per_minggu: null,
      target: 1,
      effective_from: '2026-09-01',
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    await saveHabitSchedule(db, sch, 'dev-1');
    const schedules = await waitForNext(observeHabitSchedules(db, 'h-r1'));
    expect(schedules.length).toBe(1);

    const setting: Setting = {
      id: 'set-r1',
      jam_mulai_hari: '05:00',
      theme: 'light',
      device_token_hash: null,
      updated_at: '2026-09-01T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    await saveSetting(db, setting, 'dev-1');
    const observedSetting = await waitForNext(observeSetting(db));
    expect(observedSetting?.jam_mulai_hari).toBe('05:00');

    const outboxCount = await waitForNext(observeOutboxCount(db));
    expect(outboxCount).toBeGreaterThanOrEqual(3);
  });
});
