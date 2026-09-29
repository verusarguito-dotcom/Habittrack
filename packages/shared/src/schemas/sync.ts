import { z } from 'zod';
import { uuidSchema, isoTimestampSchema, syncTableSchema } from './base.js';
import { categorySchema } from './category.js';
import { habitSchema } from './habit.js';
import { habitScheduleSchema } from './schedule.js';
import { habitLogSchema } from './log.js';
import { settingSchema } from './setting.js';

export const syncRecordSchema = z.union([
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema,
  settingSchema
]);

export const syncMutationSchema = z.object({
  mutation_id: uuidSchema.or(z.string().min(1)),
  table: syncTableSchema,
  record: syncRecordSchema
});

export const syncRequestSchema = z.object({
  protocol_version: z.number().int().positive().default(1),
  device_id: z.string().min(1),
  client_time: isoTimestampSchema,
  client_last_server_seq: z.number().int().nonnegative(),
  mutations: z.array(syncMutationSchema).max(200)
});

export const syncRejectedItemSchema = z.object({
  mutation_id: z.string().min(1),
  reason: z.string()
});

export const syncChangeSchema = z.object({
  table: syncTableSchema,
  record: z.record(z.unknown())
});

export const syncResponseSchema = z.object({
  server_time: isoTimestampSchema,
  applied: z.array(z.string()),
  rejected: z.array(syncRejectedItemSchema),
  changes: z.array(syncChangeSchema),
  new_server_seq: z.number().int().nonnegative(),
  has_more: z.boolean()
});

export type SyncRequestInput = z.input<typeof syncRequestSchema>;
export type SyncRequestOutput = z.output<typeof syncRequestSchema>;
export type SyncResponseInput = z.input<typeof syncResponseSchema>;
export type SyncResponseOutput = z.output<typeof syncResponseSchema>;
