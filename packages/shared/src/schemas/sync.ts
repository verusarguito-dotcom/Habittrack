import { z } from 'zod';
import { uuidSchema, isoTimestampSchema, isoDateTimeStringSchema, syncTableSchema } from './base.js';
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

export const syncMutationSchema = z.discriminatedUnion('table', [
  z.object({
    mutation_id: uuidSchema.or(z.string().min(1)),
    table: z.literal('categories'),
    record: categorySchema
  }),
  z.object({
    mutation_id: uuidSchema.or(z.string().min(1)),
    table: z.literal('habits'),
    record: habitSchema
  }),
  z.object({
    mutation_id: uuidSchema.or(z.string().min(1)),
    table: z.literal('habit_schedules'),
    record: habitScheduleSchema
  }),
  z.object({
    mutation_id: uuidSchema.or(z.string().min(1)),
    table: z.literal('logs'),
    record: habitLogSchema
  }),
  z.object({
    mutation_id: uuidSchema.or(z.string().min(1)),
    table: z.literal('settings'),
    record: settingSchema
  })
]);

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

export const clockSkewErrorResponseSchema = z.object({
  error: z.literal('CLOCK_SKEW'),
  message: z.string(),
  server_time: isoDateTimeStringSchema
});

export const outboxActionSchema = z.enum(['insert', 'update', 'delete']);

export const outboxEntrySchema = z.object({
  id: uuidSchema,
  table: syncTableSchema,
  record_id: z.string().min(1),
  action: outboxActionSchema,
  payload: z.record(z.unknown()),
  created_at: isoDateTimeStringSchema
});

export type ClockSkewErrorResponseSchema = z.infer<typeof clockSkewErrorResponseSchema>;
export type OutboxActionSchema = z.infer<typeof outboxActionSchema>;
export type OutboxEntrySchema = z.infer<typeof outboxEntrySchema>;
