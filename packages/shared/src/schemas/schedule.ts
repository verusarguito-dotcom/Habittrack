import { z } from 'zod';
import { baseSyncableEntitySchema, uuidSchema, isoDateStringSchema } from './base.js';

export const frequencyTypeSchema = z.enum(['daily', 'specific_days', 'x_per_week']);

export const habitScheduleSchema = baseSyncableEntitySchema.extend({
  habit_id: uuidSchema,
  tipe_frekuensi: frequencyTypeSchema,
  hari_terjadwal: z
    .array(z.number().int().min(1).max(7))
    .nullable()
    .default(null),
  jumlah_per_minggu: z.number().int().min(1).max(7).nullable().default(null),
  target: z.number().positive().nullable().default(null),
  effective_from: isoDateStringSchema
});

export type HabitScheduleInput = z.input<typeof habitScheduleSchema>;
export type HabitScheduleOutput = z.output<typeof habitScheduleSchema>;
