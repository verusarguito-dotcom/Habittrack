import { z } from 'zod';
import { baseSyncableEntitySchema, uuidSchema, isoDateStringSchema } from './base.js';

export const habitModeSchema = z.enum(['checklist', 'quantitative']);

export const habitSchema = baseSyncableEntitySchema.extend({
  nama: z.string().trim().min(1, 'Habit name cannot be empty'),
  category_id: uuidSchema.nullable(),
  mode: habitModeSchema,
  satuan: z.string().trim().nullable(),
  archived: z.boolean().default(false),
  created_date: isoDateStringSchema
});

export type HabitInput = z.input<typeof habitSchema>;
export type HabitOutput = z.output<typeof habitSchema>;
