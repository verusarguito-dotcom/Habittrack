import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';

// Configure node-postgres type parsers
// OID 1082 = DATE: return raw string (YYYY-MM-DD) instead of local Date object
pg.types.setTypeParser(1082, (val: string) => val);
// OID 20 = INT8/BIGINT: return JavaScript number for server_seq
pg.types.setTypeParser(20, (val: string) => parseInt(val, 10));
// OID 1184 = TIMESTAMPTZ: return standard ISO 8601 string instead of Date object
pg.types.setTypeParser(1184, (val: string) => new Date(val).toISOString());
// OID 1114 = TIMESTAMP: return standard ISO 8601 string instead of Date object
pg.types.setTypeParser(1114, (val: string) => new Date(val.endsWith('Z') ? val : val + 'Z').toISOString());
// OID 1700 = NUMERIC: return float number instead of string
pg.types.setTypeParser(1700, (val: string) => (val === null ? null : parseFloat(val)));

let defaultDb: Kysely<Database> | null = null;
let defaultPool: pg.Pool | null = null;

export interface DbClientOptions {
  connectionString: string;
  max?: number;
  ssl?: boolean | object;
}

export function createDb(optionsOrUrl: string | DbClientOptions): { db: Kysely<Database>; pool: pg.Pool } {
  const connectionString = typeof optionsOrUrl === 'string' ? optionsOrUrl : optionsOrUrl.connectionString;
  const max = typeof optionsOrUrl === 'object' ? optionsOrUrl.max ?? 10 : 10;
  const ssl = typeof optionsOrUrl === 'object' ? optionsOrUrl.ssl : undefined;

  const pool = new pg.Pool({
    connectionString,
    max,
    ssl
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool
    })
  });

  return { db, pool };
}

export function initDb(connectionString: string): Kysely<Database> {
  if (defaultDb) {
    return defaultDb;
  }
  const client = createDb(connectionString);
  defaultDb = client.db;
  defaultPool = client.pool;
  return defaultDb;
}

export function getDb(): Kysely<Database> {
  if (!defaultDb) {
    throw new Error('Database client has not been initialized. Call initDb() first.');
  }
  return defaultDb;
}

export async function closeDb(): Promise<void> {
  if (defaultDb) {
    await defaultDb.destroy();
    defaultDb = null;
  }
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
}

export * from './types.js';
