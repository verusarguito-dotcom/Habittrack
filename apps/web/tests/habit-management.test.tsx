import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';
import { HabitCard } from '../src/components/habits/HabitCard.js';
import { HabitFormModal } from '../src/components/habits/HabitFormModal.js';
import { DeleteConfirmationModal } from '../src/components/habits/DeleteConfirmationModal.js';
import { createDatabase, type VibeHabitDatabase } from '../src/db/database.js';
import {
  saveHabit,
  saveHabitSchedule,
  saveHabitLog,
  deleteHabitCascading,
  queryHabits,
  queryHabitSchedules,
  queryLogsByHabit
} from '../src/db/operations.js';
import type { Habit, HabitSchedule, Category } from '@vibehabit/shared';
import { generateLogId } from '@vibehabit/shared';

describe('Habit Management UI Components & Workflows (T013)', () => {
  let db: VibeHabitDatabase;

  beforeEach(() => {
    db = createDatabase(`test_manage_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('HabitCard Component', () => {
    const mockHabit: Habit = {
      id: 'h-card-01',
      nama: 'Meditasi Pagi',
      category_id: 'cat-01',
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
      device_id: 'dev-01'
    };

    const mockSchedule: HabitSchedule = {
      id: 'sch-01',
      habit_id: 'h-card-01',
      tipe_frekuensi: 'specific_days',
      hari_terjadwal: [1, 3, 5],
      jumlah_per_minggu: null,
      target: 1,
      effective_from: '2026-09-01',
      updated_at: '2026-09-01T00:00:00Z',
      deleted_at: null,
      device_id: 'dev-01'
    };

    it('renders habit title, category, and schedule details', () => {
      const html = renderToStaticMarkup(
        <HabitCard
          habit={mockHabit}
          schedule={mockSchedule}
          categoryName="Pikiran & Mental"
          streakDays={10}
          onEdit={vi.fn()}
          onToggleArchive={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(html).toContain('Meditasi Pagi');
      expect(html).toContain('Pikiran &amp; Mental');
      expect(html).toContain('Sen, Rab, Jum');
      expect(html).toContain('Checklist');
      expect(html).toContain('10 hr');
    });

    it('renders archived habit styling when archived is true', () => {
      const archivedHabit: Habit = {
        ...mockHabit,
        archived: true
      };

      const html = renderToStaticMarkup(
        <HabitCard
          habit={archivedHabit}
          schedule={mockSchedule}
          categoryName="Pikiran & Mental"
          streakDays={0}
          onEdit={vi.fn()}
          onToggleArchive={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(html).toContain('line-through');
      expect(html).toContain('opacity-70');
    });
  });

  describe('HabitFormModal Component', () => {
    const mockCategories: Category[] = [
      {
        id: 'cat-01',
        nama: 'Kesehatan',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      },
      {
        id: 'cat-02',
        nama: 'Karir',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      }
    ];

    it('renders create modal with required fields', () => {
      const html = renderToStaticMarkup(
        <HabitFormModal
          isOpen={true}
          categories={mockCategories}
          todayDate="2026-09-24"
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(html).toContain('Tambah Kebiasaan Baru');
      expect(html).toContain('Nama Habit');
      expect(html).toContain('Kategori');
      expect(html).toContain('Mode Target');
      expect(html).toContain('Frekuensi Ritual');
      expect(html).toContain('Simpan Ritual');
    });

    it('renders edit modal pre-filled with existing habit details', () => {
      const habitToEdit: Habit = {
        id: 'h-edit-01',
        nama: 'Latihan Pushup',
        category_id: 'cat-01',
        mode: 'quantitative',
        satuan: 'kali',
        archived: false,
        created_date: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <HabitFormModal
          isOpen={true}
          habitToEdit={habitToEdit}
          categories={mockCategories}
          todayDate="2026-09-24"
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      expect(html).toContain('Ubah Kebiasaan');
      expect(html).toContain('Latihan Pushup');
    });
  });

  describe('Versioned Schedule Preservation (PRD 7.5 & 8.1)', () => {
    it('creates versioned schedule on frequency edit without mutating past schedule', async () => {
      const habitId = 'h-ver-01';
      const habit: Habit = {
        id: habitId,
        nama: 'Belajar Coding',
        category_id: null,
        mode: 'quantitative',
        satuan: 'menit',
        archived: false,
        created_date: '2026-08-01',
        updated_at: '2026-08-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      // Initial Schedule (effective from 2026-08-01): 30 minutes daily
      const initialSchedule: HabitSchedule = {
        id: 'sch-ver-01',
        habit_id: habitId,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 30,
        effective_from: '2026-08-01',
        updated_at: '2026-08-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      await saveHabit(db, habit, 'dev-01');
      await saveHabitSchedule(db, initialSchedule, 'dev-01');

      // Schedule modification on 2026-09-24: increases target to 60 minutes
      const newSchedule: HabitSchedule = {
        id: 'sch-ver-02',
        habit_id: habitId,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 60,
        effective_from: '2026-09-24',
        updated_at: '2026-09-24T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };
      await saveHabitSchedule(db, newSchedule, 'dev-01');

      // Both schedules exist in Dexie
      const schedules = await queryHabitSchedules(db, habitId);
      expect(schedules.length).toBe(2);

      const augSched = schedules.find((s) => s.effective_from === '2026-08-01');
      expect(augSched?.target).toBe(30);

      const septSched = schedules.find((s) => s.effective_from === '2026-09-24');
      expect(septSched?.target).toBe(60);
    });
  });

  describe('DeleteConfirmationModal & Cascading Delete', () => {
    it('renders delete dialog with total log count and streak loss warning', () => {
      const habit: Habit = {
        id: 'h-del-01',
        nama: 'Minum Kopi Hitam',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-08-01',
        updated_at: '2026-08-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <DeleteConfirmationModal
          isOpen={true}
          habit={habit}
          totalLogsCount={45}
          streakDays={12}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Hapus “Minum Kopi Hitam”?');
      expect(html).toContain('45 log riwayat');
      expect(html).toContain('Streak 12 hari akan dihapus');
      expect(html).toContain('Hapus Permanen');
    });

    it('executes cascading delete in a single atomic Dexie transaction', async () => {
      const habitId = 'h-cascade-test';
      const deviceId = 'dev-cascade';

      // 1. Create habit
      await saveHabit(
        db,
        {
          id: habitId,
          nama: 'Jogging Pagi',
          category_id: null,
          mode: 'checklist',
          satuan: null,
          archived: false,
          created_date: '2026-09-01',
          updated_at: '2026-09-01T00:00:00Z',
          deleted_at: null,
          device_id: deviceId
        },
        deviceId
      );

      // 2. Create schedule
      await saveHabitSchedule(
        db,
        {
          id: 'sch-cascade-01',
          habit_id: habitId,
          tipe_frekuensi: 'daily',
          hari_terjadwal: null,
          jumlah_per_minggu: null,
          target: 1,
          effective_from: '2026-09-01',
          updated_at: '2026-09-01T00:00:00Z',
          deleted_at: null,
          device_id: deviceId
        },
        deviceId
      );

      // 3. Create logs
      for (let i = 1; i <= 5; i++) {
        const dateStr = `2026-09-0${i}`;
        await saveHabitLog(
          db,
          {
            id: generateLogId(habitId, dateStr),
            habit_id: habitId,
            tanggal: dateStr,
            nilai: null,
            selesai: true,
            updated_at: '2026-09-01T00:00:00Z',
            deleted_at: null,
            device_id: deviceId
          },
          deviceId
        );
      }

      // Verify records exist before cascade
      expect((await queryHabits(db, true)).length).toBe(1);
      expect((await queryHabitSchedules(db, habitId)).length).toBe(1);
      expect((await queryLogsByHabit(db, habitId)).length).toBe(5);

      // Execute cascading delete
      await deleteHabitCascading(db, habitId, deviceId);

      // Verify all entities have deleted_at tombstone
      const activeHabits = await queryHabits(db, true);
      expect(activeHabits.length).toBe(0); // Soft-deleted

      const activeSchedules = await queryHabitSchedules(db, habitId);
      expect(activeSchedules.length).toBe(0);

      const activeLogs = await queryLogsByHabit(db, habitId);
      expect(activeLogs.length).toBe(0);

      // Raw records in Dexie have deleted_at set
      const rawHabit = await db.habits.get(habitId);
      expect(rawHabit?.deleted_at).toBeDefined();

      const rawSchedules = await db.habit_schedules.where('habit_id').equals(habitId).toArray();
      expect(rawSchedules.every((s) => s.deleted_at !== null)).toBe(true);

      const rawLogs = await db.logs.where('habit_id').equals(habitId).toArray();
      expect(rawLogs.every((l) => l.deleted_at !== null)).toBe(true);

      // Outbox contains 'delete' mutations for habit, schedule, and all logs
      const outbox = await db.outbox.toArray();
      const deleteMutations = outbox.filter((o) => o.action === 'delete');
      expect(deleteMutations.length).toBe(7); // 1 habit + 1 schedule + 5 logs
    });
  });

  describe('Form Handling & Category Integrity', () => {
    it('preserves null category_id when editing uncategorized habit', () => {
      const mockCategories: Category[] = [
        {
          id: 'cat-kesehatan',
          nama: 'Kesehatan',
          updated_at: '2026-09-01T00:00:00Z',
          deleted_at: null,
          device_id: 'dev-01'
        }
      ];

      const uncategorizedHabit: Habit = {
        id: 'h-uncat-01',
        nama: 'Ritual Tanpa Kategori',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const html = renderToStaticMarkup(
        <HabitFormModal
          isOpen={true}
          habitToEdit={uncategorizedHabit}
          categories={mockCategories}
          todayDate="2026-09-24"
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      );

      // Value of select should be empty string (matching <option value="">Tanpa Kategori (Umum)</option>)
      // and NOT selected with cat-kesehatan
      expect(html).toContain('<option value="" selected="">Tanpa Kategori (Umum)</option>');
    });

    it('isolates habit schedules when multiple habits exist in database', async () => {
      const h1: Habit = {
        id: 'h-iso-01',
        nama: 'Minum 2L Air',
        category_id: null,
        mode: 'quantitative',
        satuan: 'ml',
        archived: false,
        created_date: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };
      const s1: HabitSchedule = {
        id: 's-iso-01',
        habit_id: 'h-iso-01',
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 2000,
        effective_from: '2026-09-01',
        updated_at: '2026-09-01T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      const h2: Habit = {
        id: 'h-iso-02',
        nama: 'Meditasi',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-10',
        updated_at: '2026-09-10T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };
      const s2: HabitSchedule = {
        id: 's-iso-02',
        habit_id: 'h-iso-02',
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-10',
        updated_at: '2026-09-10T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-01'
      };

      await saveHabit(db, h1, 'dev-01');
      await saveHabitSchedule(db, s1, 'dev-01');
      await saveHabit(db, h2, 'dev-01');
      await saveHabitSchedule(db, s2, 'dev-01');

      const allSchedules = await db.habit_schedules.filter((s) => !s.deleted_at).toArray();
      const h1Scheds = allSchedules.filter((s) => s.habit_id === h1.id);
      expect(h1Scheds.length).toBe(1);
      expect(h1Scheds[0]?.target).toBe(2000);

      const h2Scheds = allSchedules.filter((s) => s.habit_id === h2.id);
      expect(h2Scheds.length).toBe(1);
      expect(h2Scheds[0]?.target).toBe(1);
    });
  });
});
