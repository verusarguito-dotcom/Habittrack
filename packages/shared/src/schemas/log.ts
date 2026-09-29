import { z } from 'zod';
import { baseSyncableEntitySchema, uuidSchema, isoDateStringSchema } from './base.js';

export const habitLogSchema = baseSyncableEntitySchema.extend({
  habit_id: uuidSchema,
  tanggal: isoDateStringSchema,
  nilai: z.number().nonnegative().nullable().default(null),
  selesai: z.boolean().default(false)
});

export type HabitLogInput = z.input<typeof habitLogSchema>;
export type HabitLogOutput = z.output<typeof habitLogSchema>;
