import { z } from 'zod';
import { isoTimestampSchema } from './base.js';
import { categorySchema } from './category.js';
import { habitSchema } from './habit.js';
import { habitScheduleSchema } from './schedule.js';
import { habitLogSchema } from './log.js';
import { settingSchema } from './setting.js';

export const backupDataSchema = z.object({
  version: z.number().int().min(1),
  exported_at: isoTimestampSchema,
  app_version: z.string().optional(),
  device_id: z.string().optional(),
  data: z.object({
    categories: z.array(categorySchema).default([]),
    habits: z.array(habitSchema).default([]),
    habit_schedules: z.array(habitScheduleSchema).default([]),
    logs: z.array(habitLogSchema).default([]),
    settings: z.array(settingSchema).optional().default([])
  })
});

export type BackupDataInput = z.input<typeof backupDataSchema>;
export type BackupDataOutput = z.output<typeof backupDataSchema>;
