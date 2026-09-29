import { z } from 'zod';
import { baseSyncableEntitySchema } from './base.js';

export const appThemeSchema = z.enum(['light', 'dark', 'system']);

export const dayStartHourSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be in HH:mm 24-hour format (e.g. 00:00, 04:00)');

export const settingSchema = baseSyncableEntitySchema.extend({
  jam_mulai_hari: dayStartHourSchema.default('00:00'),
  theme: appThemeSchema.default('system'),
  device_token_hash: z.string().nullable().optional()
});

export type SettingInput = z.input<typeof settingSchema>;
export type SettingOutput = z.output<typeof settingSchema>;
