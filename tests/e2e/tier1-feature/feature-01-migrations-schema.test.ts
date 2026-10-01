import { describe, it, expect } from 'vitest';
import {
  createCategory,
  createHabit,
  createHabitSchedule,
  createHabitLog,
  createSetting
} from '../harness/index.js';
import {
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema,
  settingSchema
} from '@vibehabit/shared';

describe('Tier 1 - Feature 01: Database Migrations & Schema', () => {
  it('validates Category schema with standard sync columns (id, updated_at, deleted_at, device_id, server_seq)', () => {
    const category = createCategory({
      nama: 'Produktif',
      device_id: 'device-mobile-01'
    });
    const parsed = categorySchema.safeParse(category);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(parsed.data.deleted_at).toBeNull();
      expect(parsed.data.device_id).toBe('device-mobile-01');
    }
  });

  it('validates Habit schema with foreign key relation to category and standard sync columns', () => {
    const category = createCategory({ nama: 'Olahraga' });
    const habit = createHabit({
      nama: 'Push Up',
      category_id: category.id,
      mode: 'quantitative',
      satuan: 'reps'
    });
    const parsed = habitSchema.safeParse(habit);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.category_id).toBe(category.id);
      expect(parsed.data.mode).toBe('quantitative');
      expect(parsed.data.satuan).toBe('reps');
    }
  });

  it('validates HabitSchedule schema with frequency types and recurrence constraints', () => {
    const habit = createHabit({ nama: 'Membaca Buku' });
    const schedule = createHabitSchedule({
      habit_id: habit.id,
      tipe_frekuensi: 'specific_days',
      hari_terjadwal: [1, 3, 5],
      target: 20
    });
    const parsed = habitScheduleSchema.safeParse(schedule);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.habit_id).toBe(habit.id);
      expect(parsed.data.hari_terjadwal).toEqual([1, 3, 5]);
      expect(parsed.data.target).toBe(20);
    }
  });

  it('validates HabitLog schema enforcing required ISO date and completion state', () => {
    const habit = createHabit({ nama: 'Minum 2L Air' });
    const log = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 2000,
      selesai: true
    });
    const parsed = habitLogSchema.safeParse(log);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tanggal).toBe('2026-09-29');
      expect(parsed.data.selesai).toBe(true);
    }
  });

  it('validates Setting schema with default values for day start hour and theme', () => {
    const setting = createSetting({
      jam_mulai_hari: '04:00',
      theme: 'dark'
    });
    const parsed = settingSchema.safeParse(setting);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.jam_mulai_hari).toBe('04:00');
      expect(parsed.data.theme).toBe('dark');
    }
  });
});
