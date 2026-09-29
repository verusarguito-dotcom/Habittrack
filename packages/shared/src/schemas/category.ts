import { z } from 'zod';
import { baseSyncableEntitySchema } from './base.js';

export const categorySchema = baseSyncableEntitySchema.extend({
  nama: z.string().trim().min(1, 'Category name cannot be empty')
});

export type CategoryInput = z.input<typeof categorySchema>;
export type CategoryOutput = z.output<typeof categorySchema>;
