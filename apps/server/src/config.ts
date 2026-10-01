import { z } from 'zod';
import path from 'node:path';

export interface ServerConfig {
  databaseUrl: string;
  deviceTokens: Record<string, string>;
  port: number;
  host: string;
  nodeEnv: string;
  staticDistPath: string;
}

export function parseDeviceTokens(raw: unknown): Record<string, string> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  if (typeof raw !== 'string') {
    return {};
  }
  const result: Record<string, string> = {};
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const colonIdx = entry.indexOf(':');
    if (colonIdx <= 0 || colonIdx === entry.length - 1) {
      throw new Error(`CONFIG_ERROR: Malformed DEVICE_TOKENS entry: "${entry}". Must be in format <device_id>:<token_hash>`);
    }
    const deviceId = entry.slice(0, colonIdx).trim();
    const tokenHash = entry.slice(colonIdx + 1).trim();
    if (!deviceId || !tokenHash) {
      throw new Error(`CONFIG_ERROR: Malformed DEVICE_TOKENS entry: "${entry}". Must be in format <device_id>:<token_hash>`);
    }
    result[deviceId] = tokenHash;
  }
  return result;
}

export const serverConfigSchema = z.object({
  databaseUrl: z.string({ required_error: 'CONFIG_ERROR: DATABASE_URL is required and must not be empty' })
    .trim()
    .min(1, 'CONFIG_ERROR: DATABASE_URL is required and must not be empty')
    .refine((val) => val.startsWith('postgres://') || val.startsWith('postgresql://'), {
      message: 'CONFIG_ERROR: DATABASE_URL must be a valid PostgreSQL connection string'
    }),
  deviceTokens: z.record(z.string().min(1), z.string().min(1))
    .refine((tokens) => Object.keys(tokens).length > 0, {
      message: 'CONFIG_ERROR: DEVICE_TOKENS must contain at least one valid device entry'
    }),
  host: z.string().default('127.0.0.1').refine((h) => h === '127.0.0.1', {
    message: 'CONFIG_ERROR: Server must strictly bind to 127.0.0.1'
  }),
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  nodeEnv: z.string().default(process.env.NODE_ENV || 'development'),
  staticDistPath: z.string().default(() => path.resolve(process.cwd(), 'apps/web/dist'))
});

export interface RawServerConfigInput {
  databaseUrl?: string;
  DATABASE_URL?: string;
  deviceTokens?: Record<string, string> | string;
  DEVICE_TOKENS?: string;
  host?: string;
  HOST?: string;
  port?: number | string;
  PORT?: string;
  nodeEnv?: string;
  NODE_ENV?: string;
  staticDistPath?: string;
  STATIC_DIST_PATH?: string;
}

export function validateServerConfig(raw: RawServerConfigInput): ServerConfig {
  const prepared = {
    ...raw,
    databaseUrl: raw.databaseUrl ?? raw.DATABASE_URL,
    deviceTokens: typeof raw.deviceTokens === 'object' && raw.deviceTokens !== null
      ? raw.deviceTokens
      : parseDeviceTokens(raw.deviceTokens ?? raw.DEVICE_TOKENS),
    host: raw.host ?? raw.HOST ?? '127.0.0.1',
    port: raw.port ?? raw.PORT ?? 3001,
    nodeEnv: raw.nodeEnv ?? raw.NODE_ENV ?? process.env.NODE_ENV ?? 'development',
    staticDistPath: raw.staticDistPath ?? raw.STATIC_DIST_PATH ?? path.resolve(process.cwd(), 'apps/web/dist')
  };

  const parsed = serverConfigSchema.safeParse(prepared);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(firstIssue?.message || 'CONFIG_ERROR: Invalid server configuration');
  }

  return parsed.data;
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return validateServerConfig({
    DATABASE_URL: env.DATABASE_URL,
    DEVICE_TOKENS: env.DEVICE_TOKENS,
    HOST: env.HOST,
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
    STATIC_DIST_PATH: env.STATIC_DIST_PATH
  });
}
