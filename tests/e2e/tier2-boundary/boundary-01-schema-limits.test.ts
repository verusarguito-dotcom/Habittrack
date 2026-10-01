import { describe, it, expect } from 'vitest';
import {
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema
} from '@vibehabit/shared';
import {
  createCategory,
  createHabit,
  createHabitSchedule,
  createHabitLog
} from '../harness/index.js';

describe('Tier 2 - Boundary 01: Schema Limits & Type Constraints', () => {
  it('rejects empty or whitespace-only category names', () => {
    const invalidCat = { ...createCategory(), nama: '   ' };
    const res = categorySchema.safeParse(invalidCat);
    expect(res.success).toBe(false);
  });

  it('rejects habit recurrence days outside the 1 to 7 range', () => {
    const invalidSch = {
      ...createHabitSchedule(),
      tipe_frekuensi: 'specific_days',
      hari_terjadwal: [0, 8] // 0 and 8 are outside 1..7
    };
    const res = habitScheduleSchema.safeParse(invalidSch);
    expect(res.success).toBe(false);
  });

  it('rejects negative target values in habit schedule', () => {
    const invalidSch = {
      ...createHabitSchedule(),
      target: -5
    };
    const res = habitScheduleSchema.safeParse(invalidSch);
    expect(res.success).toBe(false);
  });

  it('rejects invalid UUID formats across entities', () => {
    const invalidHabit = {
      ...createHabit(),
      id: 'not-a-valid-uuid-string'
    };
    const res = habitSchema.safeParse(invalidHabit);
    expect(res.success).toBe(false);
  });

  it('rejects non-conforming date strings for log tanggal', () => {
    const invalidLog = {
      ...createHabitLog(),
      tanggal: '29-09-2026' // Must be YYYY-MM-DD
    };
    const res = habitLogSchema.safeParse(invalidLog);
    expect(res.success).toBe(false);
  });
});
