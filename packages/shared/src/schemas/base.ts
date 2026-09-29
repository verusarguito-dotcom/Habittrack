import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format');

export const isoTimestampSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Must be a valid ISO 8601 date string'
});

export const baseSyncableEntitySchema = z.object({
  id: uuidSchema,
  updated_at: isoTimestampSchema,
  deleted_at: isoTimestampSchema.nullable(),
  device_id: z.string().min(1),
  server_seq: z.number().int().nonnegative().optional().nullable()
});

export const syncTableSchema = z.enum([
  'categories',
  'habits',
  'habit_schedules',
  'logs',
  'settings'
]);
