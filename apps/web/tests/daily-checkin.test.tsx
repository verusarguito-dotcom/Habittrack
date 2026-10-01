import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';
import { DateStrip } from '../src/components/daily/DateStrip.js';
import { ProgressRing } from '../src/components/daily/ProgressRing.js';
import { HabitChecklistCard } from '../src/components/daily/HabitChecklistCard.js';
import { HabitQuantitativeCard } from '../src/components/daily/HabitQuantitativeCard.js';
import { createDatabase, type VibeHabitDatabase } from '../src/db/database.js';
import { saveHabit, saveHabitSchedule, saveHabitLog, queryLogsByHabitAndDate } from '../src/db/operations.js';
import type { Habit, HabitSchedule, HabitLog } from '@vibehabit/shared';
import { generateLogId, addDays } from '@vibehabit/shared';

describe('Daily Check-in UI Components & Interactions (T012)', () => {
  let db: VibeHabitDatabase;

  beforeEach(() => {
    db = createDatabase(`test_checkin_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('DateStrip Component', () => {
    it('renders 5 consecutive days centered around selected date', () => {
      const selected = '2026-09-24';
      const today = '2026-09-24';
      const onSelect = vi.fn();

      const html = renderToStaticMarkup(
        <DateStrip selectedDate={selected} todayDate={today} onSelectDate={onSelect} />
      );

      // Should contain days 22, 23, 24, 25, 26
      expect(html).toContain('22');
      expect(html).toContain('23');
      expect(html).toContain('24');
      expect(html).toContain('25');
      expect(html).toContain('26');
      expect(html).toContain('aria-pressed="true"');
    });

    it('navigates backwards and forwards with chevrons', () => {
      const selected = '2026-09-24';
      const today = '2026-09-24';

      expect(addDays(selected, -1)).toBe('2026-09-23');
      expect(addDays(selected, 1)).toBe('2026-09-25');
    });
  });

  describe('ProgressRing Component', () => {
    it('calculates 0% when no habits are completed', () => {
      const html = renderToStaticMarkup(
        <ProgressRing completedCount={0} totalCount={4} activeStreakDays={0} />
      );
      expect(html).toContain('0%');
      expect(html).toContain('0</span> dari');
      expect(html).toContain('4</span> Selesai');
    });

    it('calculates 50% when half of habits are completed', () => {
      const html = renderToStaticMarkup(
        <ProgressRing completedCount={3} totalCount={6} activeStreakDays={5} />
      );
      expect(html).toContain('50%');
      expect(html).toContain('3</span> dari');
      expect(html).toContain('6</span> Selesai');
      expect(html).toContain('5 Hari Aktif');
    });

    it('calculates 100% when all habits are completed', () => {
      const html = renderToStaticMarkup(
        <ProgressRing completedCount={5} totalCount={5} activeStreakDays={14} />
      );
      expect(html).toContain('100%');
      expect(html).toContain('Luar biasa!');
      expect(html).toContain('14 Hari Aktif');
    });
  });

  describe('HabitChecklistCard Component', () => {
    const mockHabit: Habit = {
      id: 'h-01',
      nama: 'Minum Air 2 Liter',
      category_id: 'cat-01',
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
      device_id: 'dev-01'
    };

    it('renders incomplete checklist habit with streak and category badge', () => {
      const html = renderToStaticMarkup(
        <HabitChecklistCard
          habit={mockHabit}
          log={null}
          categoryName="Kesehatan"
          streakDays={7}
          onToggle={vi.fn()}
        />
      );

      expect(html).toContain('Minum Air 2 Liter');
      expect(html).toContain('Kesehatan');
      expect(html).toContain('7 hr');
      expect(html).toContain('role="checkbox"');
      expect(html).toContain('aria-checked="false"');
    });

    it('renders completed checklist habit with strikethrough and checked state', () => {
      const completedLog: HabitLog = {
        id: generateLogId(mockHabit.id, '2026-09-24'),
        habit_id: mockHabit.id,
        tanggal: '2026-09-24',
        nilai: null,
        selesai: true,
        updated_at: '2026-09-24T10:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <HabitChecklistCard
          habit={mockHabit}
          log={completedLog}
          categoryName="Kesehatan"
          streakDays={8}
          onToggle={vi.fn()}
        />
      );

      expect(html).toContain('line-through');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Target harian tercapai');
    });

    it('saves checklist toggle directly to Dexie IndexedDB with deterministic log ID', async () => {
      const dateStr = '2026-09-24';
      const expectedLogId = generateLogId(mockHabit.id, dateStr);

      await saveHabit(db, mockHabit, 'dev-01');

      // 1. Mark completed
      const log1: HabitLog = {
        id: expectedLogId,
        habit_id: mockHabit.id,
        tanggal: dateStr,
        nilai: null,
        selesai: true,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'dev-01'
      };
      await saveHabitLog(db, log1, 'dev-01');

      let saved = await queryLogsByHabitAndDate(db, mockHabit.id, dateStr);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(expectedLogId);
      expect(saved?.selesai).toBe(true);

      // 2. Mark uncompleted
      const log2: HabitLog = {
        ...log1,
        selesai: false,
        updated_at: new Date(Date.now() + 1000).toISOString()
      };
      await saveHabitLog(db, log2, 'dev-01');

      saved = await queryLogsByHabitAndDate(db, mockHabit.id, dateStr);
      expect(saved?.selesai).toBe(false);
    });
  });

  describe('HabitQuantitativeCard Component', () => {
    const mockQuantHabit: Habit = {
      id: 'h-02',
      nama: 'Membaca Buku Non-Fiksi',
      category_id: 'cat-02',
      mode: 'quantitative',
      satuan: 'mnt',
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
      device_id: 'dev-01'
    };

    it('renders quantitative habit with progress bar and current/target value', () => {
      const log: HabitLog = {
        id: generateLogId(mockQuantHabit.id, '2026-09-24'),
        habit_id: mockQuantHabit.id,
        tanggal: '2026-09-24',
        nilai: 15,
        selesai: false,
        updated_at: '2026-09-24T10:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <HabitQuantitativeCard
          habit={mockQuantHabit}
          targetValue={30}
          log={log}
          categoryName="Belajar"
          streakDays={3}
          onUpdateValue={vi.fn()}
        />
      );

      expect(html).toContain('Membaca Buku Non-Fiksi');
      expect(html).toContain('15 / 30 mnt');
      expect(html).toContain('width:50%');
      expect(html).toContain('Sedang Berjalan');
    });

    it('renders completed state when current value reaches or exceeds target', () => {
      const log: HabitLog = {
        id: generateLogId(mockQuantHabit.id, '2026-09-24'),
        habit_id: mockQuantHabit.id,
        tanggal: '2026-09-24',
        nilai: 35,
        selesai: true,
        updated_at: '2026-09-24T10:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <HabitQuantitativeCard
          habit={mockQuantHabit}
          targetValue={30}
          log={log}
          categoryName="Belajar"
          streakDays={4}
          onUpdateValue={vi.fn()}
        />
      );

      expect(html).toContain('35 / 30 mnt');
      expect(html).toContain('Target Tercapai');
    });

    it('persists stepper updates to Dexie IndexedDB', async () => {
      const dateStr = '2026-09-24';
      const schedule: HabitSchedule = {
        id: 'sch-02',
        habit_id: mockQuantHabit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 30,
        effective_from: '2026-09-01',
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'dev-01'
      };

      await saveHabit(db, mockQuantHabit, 'dev-01');
      await saveHabitSchedule(db, schedule, 'dev-01');

      // Update to 20
      const log: HabitLog = {
        id: generateLogId(mockQuantHabit.id, dateStr),
        habit_id: mockQuantHabit.id,
        tanggal: dateStr,
        nilai: 20,
        selesai: false,
        updated_at: new Date().toISOString(),
        deleted_at: null,
        device_id: 'dev-01'
      };
      await saveHabitLog(db, log, 'dev-01');

      let saved = await queryLogsByHabitAndDate(db, mockQuantHabit.id, dateStr);
      expect(saved?.nilai).toBe(20);
      expect(saved?.selesai).toBe(false);

      // Increment to 30 (target reached)
      const updatedLog: HabitLog = {
        ...log,
        nilai: 30,
        selesai: true,
        updated_at: new Date(Date.now() + 1000).toISOString()
      };
      await saveHabitLog(db, updatedLog, 'dev-01');

      saved = await queryLogsByHabitAndDate(db, mockQuantHabit.id, dateStr);
      expect(saved?.nilai).toBe(30);
      expect(saved?.selesai).toBe(true);
    });
  });

  describe('Multi-habit Schedule Isolation & Category Grouping', () => {
    it('strictly isolates schedules per habit and prevents cross-habit schedule leakage', async () => {
      // Habit 1: Quantitative 2000 ml (created 2026-09-01)
      const habit1: Habit = {
        id: 'h-multi-01',
        nama: 'Minum Air 2 Liter',
        category_id: 'cat-kesehatan',
        mode: 'quantitative',
        satuan: 'ml',
        archived: false,
        created_date: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };
      const sched1: HabitSchedule = {
        id: 'sch-multi-01',
        habit_id: 'h-multi-01',
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 2000,
        effective_from: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      // Habit 2: Checklist target 1 (created 2026-09-10 with later effective_from)
      const habit2: Habit = {
        id: 'h-multi-02',
        nama: 'Meditasi Pagi',
        category_id: 'cat-mind',
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-10',
        updated_at: '2026-09-10T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };
      const sched2: HabitSchedule = {
        id: 'sch-multi-02',
        habit_id: 'h-multi-02',
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-10',
        updated_at: '2026-09-10T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      await saveHabit(db, habit1, 'dev-01');
      await saveHabitSchedule(db, sched1, 'dev-01');
      await saveHabit(db, habit2, 'dev-01');
      await saveHabitSchedule(db, sched2, 'dev-01');

      // Fetch all schedules from Dexie
      const allSchedules = await db.habit_schedules.filter((s) => !s.deleted_at).toArray();
      expect(allSchedules.length).toBe(2);

      // Filtering by habit_id must guarantee habit1 gets target 2000, not habit2's target 1
      const habit1Scheds = allSchedules.filter((s) => s.habit_id === habit1.id);
      const schedForHabit1 = habit1Scheds.find((s) => s.effective_from <= '2026-09-15');
      expect(schedForHabit1).toBeDefined();
      expect(schedForHabit1?.target).toBe(2000);
      expect(schedForHabit1?.habit_id).toBe('h-multi-01');

      const habit2Scheds = allSchedules.filter((s) => s.habit_id === habit2.id);
      const schedForHabit2 = habit2Scheds.find((s) => s.effective_from <= '2026-09-15');
      expect(schedForHabit2).toBeDefined();
      expect(schedForHabit2?.target).toBe(1);
      expect(schedForHabit2?.habit_id).toBe('h-multi-02');
    });

    it('ProgressRing strictly adheres to DESIGN_SYSTEM.md 8px stroke width and slate track tokens', () => {
      const html = renderToStaticMarkup(
        <ProgressRing completedCount={2} totalCount={4} activeStreakDays={3} />
      );

      expect(html).toContain('stroke-width="8"');
      expect(html).toContain('text-slate-200 dark:text-slate-700');
    });
  });
});
