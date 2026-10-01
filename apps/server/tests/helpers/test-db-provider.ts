import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from '../../src/db/types.js';
import { createDb } from '../../src/db/index.js';

export interface TestDbProvider {
  db: Kysely<Database>;
  isRealPostgres: boolean;
  pool?: pg.Pool;
  cleanup: () => Promise<void>;
  close: () => Promise<void>;
  getTableRows: (table: 'categories' | 'habits' | 'habit_schedules' | 'logs' | 'settings') => any[];
  getSequenceValue: () => Promise<number>;
  simulateAdvisoryLock: (held: boolean) => void;
  isAdvisoryLockCurrentlyHeld: () => boolean;
  executeSql: (sqlText: string) => Promise<void>;
}

export async function checkRealPostgres(url: string): Promise<boolean> {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 1000
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => {});
    return false;
  }
}

export function createHarnessDbProvider(): TestDbProvider {
  const categories = new Map<string, any>();
  const habits = new Map<string, any>();
  const habitSchedules = new Map<string, any>();
  const logs = new Map<string, any>();
  const settings = new Map<string, any>();
  const globalSeq = { current: 0 };
  const advisoryLockState = { held: false, holdingConnId: null as number | null };
  let nextConnId = 1;

  const getTableMap = (sqlText: string): Map<string, any> | null => {
    if (sqlText.includes('"categories"')) return categories;
    if (sqlText.includes('"habits"')) return habits;
    if (sqlText.includes('"habit_schedules"')) return habitSchedules;
    if (sqlText.includes('"logs"')) return logs;
    if (sqlText.includes('"settings"')) return settings;
    return null;
  };

  const mockPool = {
    connect: async () => {
      const connId = nextConnId++;
      return {
        query: async (sqlText: string, params: any[] = []) => {
          const sqlNormalized = sqlText.replace(/\s+/g, ' ').trim();

          // SELECT 1 (Health check query)
          if (sqlNormalized === 'SELECT 1' || sqlNormalized === 'select 1') {
            return { rows: [{ '?column?': 1 }] };
          }

          // Transaction controls
          if (sqlNormalized.startsWith('begin')) {
            return { rows: [] };
          }

          if (sqlNormalized.startsWith('commit') || sqlNormalized.startsWith('rollback')) {
            if (advisoryLockState.holdingConnId === connId) {
              advisoryLockState.held = false;
              advisoryLockState.holdingConnId = null;
            }
            return { rows: [] };
          }

          // Advisory lock acquisition
          if (sqlNormalized.includes('pg_try_advisory_xact_lock')) {
            if (advisoryLockState.held && advisoryLockState.holdingConnId !== connId) {
              return { rows: [{ locked: false }] };
            }
            advisoryLockState.held = true;
            advisoryLockState.holdingConnId = connId;
            return { rows: [{ locked: true }] };
          }

          // Sequence query: pg_sequences catalog view or fallback
          if (sqlNormalized.includes('vibehabit_server_seq')) {
            if (sqlNormalized.includes('last_value')) {
              return {
                rows: [
                  {
                    last_value: globalSeq.current,
                    is_called: globalSeq.current > 0
                  }
                ]
              };
            }
            if (sqlNormalized.includes('RESTART WITH') || sqlNormalized.includes('restart with')) {
              globalSeq.current = 0;
              return { rows: [] };
            }
          }

          // DDL statements: CREATE SEQUENCE, CREATE TABLE, CREATE INDEX, ALTER SEQUENCE
          if (
            sqlNormalized.startsWith('create sequence') ||
            sqlNormalized.startsWith('create table') ||
            sqlNormalized.startsWith('create index') ||
            sqlNormalized.startsWith('drop') ||
            sqlNormalized.startsWith('alter')
          ) {
            if (sqlNormalized.includes('restart with') || sqlNormalized.includes('RESTART WITH')) {
              globalSeq.current = 0;
            }
            return { rows: [] };
          }

          // Delete from tables
          if (sqlNormalized.startsWith('delete from')) {
            const tableMap = getTableMap(sqlNormalized);
            if (tableMap) {
              const whereIdMatch = sqlNormalized.match(/where\s+"id"\s*=\s*\$(\d+)/i);
              if (whereIdMatch) {
                const idParamIdx = parseInt(whereIdMatch[1], 10) - 1;
                const id = params[idParamIdx];
                tableMap.delete(id);

                // Relational cascading and foreign key actions
                if (tableMap === categories) {
                  // ON DELETE SET NULL on habits
                  for (const habit of habits.values()) {
                    if (habit.category_id === id) {
                      habit.category_id = null;
                    }
                  }
                } else if (tableMap === habits) {
                  // ON DELETE CASCADE on habit_schedules and logs
                  for (const [schedId, sched] of habitSchedules.entries()) {
                    if (sched.habit_id === id) {
                      habitSchedules.delete(schedId);
                    }
                  }
                  for (const [logId, log] of logs.entries()) {
                    if (log.habit_id === id) {
                      logs.delete(logId);
                    }
                  }
                }
              } else {
                tableMap.clear();
              }
            }
            return { rows: [] };
          }

          // Logs lookup by habit_id and tanggal
          if (
            sqlNormalized.includes('from "logs"') &&
            sqlNormalized.includes('"habit_id" = $1') &&
            sqlNormalized.includes('"tanggal" = $2')
          ) {
            const habitId = params[0];
            const tanggal = params[1];
            for (const record of logs.values()) {
              if (record.habit_id === habitId && record.tanggal === tanggal) {
                return { rows: [{ ...record }] };
              }
            }
            return { rows: [] };
          }

          // General SELECT queries on table
          if (
            sqlNormalized.startsWith('select') &&
            !sqlNormalized.includes('pg_try_advisory_xact_lock') &&
            !sqlNormalized.includes('vibehabit_server_seq')
          ) {
            const tableMap = getTableMap(sqlNormalized);
            if (tableMap) {
              let rows = Array.from(tableMap.values());

              // WHERE "id" = $1
              if (sqlNormalized.includes('where "id" = $1')) {
                const id = params[0];
                const found = tableMap.get(id);
                return { rows: found ? [{ ...found }] : [] };
              }

              // WHERE "id" in ($1, $2, ...)
              const inMatch = sqlNormalized.match(/where\s+"id"\s+in\s*\(([^)]+)\)/i);
              if (inMatch) {
                const numPlaceholders = inMatch[1].split(',').length;
                const ids = params.slice(0, numPlaceholders);
                rows = rows.filter((r) => ids.includes(r.id));
              }

              // WHERE "server_seq" > $1
              if (sqlNormalized.includes('"server_seq" > $1') || sqlNormalized.includes('where "server_seq" > $1')) {
                const sinceSeq = params[0];
                rows = rows.filter((r) => Number(r.server_seq) > Number(sinceSeq));
              }

              // ORDER BY "server_seq" asc / desc
              if (sqlNormalized.includes('order by "server_seq" asc') || sqlNormalized.includes('order by "server_seq"')) {
                rows.sort((a, b) => Number(a.server_seq) - Number(b.server_seq));
              }

              // LIMIT $N or LIMIT \d+
              const limitParamMatch = sqlNormalized.match(/limit\s+\$(\d+)/i);
              if (limitParamMatch) {
                const limitParamIdx = parseInt(limitParamMatch[1], 10) - 1;
                const limit = params[limitParamIdx];
                if (typeof limit === 'number') {
                  rows = rows.slice(0, limit);
                }
              } else {
                const limitLiteralMatch = sqlNormalized.match(/limit\s+(\d+)/i);
                if (limitLiteralMatch) {
                  const limit = parseInt(limitLiteralMatch[1], 10);
                  rows = rows.slice(0, limit);
                }
              }

              return { rows: rows.map((r) => ({ ...r })) };
            }
            return { rows: [] };
          }

          // Insert into table
          if (sqlNormalized.startsWith('insert into')) {
            const tableMap = getTableMap(sqlNormalized);
            if (tableMap) {
              globalSeq.current++;
              const colMatch = sqlNormalized.match(/insert into "[^"]+"\s*\(([^)]+)\)\s*values/i);
              const record: any = { server_seq: globalSeq.current };
              if (colMatch) {
                const columns = colMatch[1].split(',').map((c) => c.replace(/["\s]/g, ''));
                let paramIdx = 0;
                for (const col of columns) {
                  if (col === 'server_seq') {
                    continue;
                  }
                  record[col] = params[paramIdx++];
                }
              }

              // Enforce check constraints
              if (tableMap === habits && record.mode) {
                if (record.mode !== 'checklist' && record.mode !== 'quantitative') {
                  const err: any = new Error('new row for relation "habits" violates check constraint "habits_mode_check"');
                  err.code = '23514';
                  throw err;
                }
              }

              if (tableMap === habitSchedules && record.tipe_frekuensi) {
                if (!['daily', 'specific_days', 'x_per_week'].includes(record.tipe_frekuensi)) {
                  const err: any = new Error('new row for relation "habit_schedules" violates check constraint "habit_schedules_tipe_frekuensi_check"');
                  err.code = '23514';
                  throw err;
                }
              }

              // Enforce unique constraint uq_logs_habit_tanggal
              if (tableMap === logs) {
                for (const existingLog of logs.values()) {
                  if (
                    existingLog.habit_id === record.habit_id &&
                    existingLog.tanggal === record.tanggal &&
                    existingLog.id !== record.id
                  ) {
                    const err: any = new Error(
                      'duplicate key value violates unique constraint "uq_logs_habit_tanggal"'
                    );
                    err.code = '23505';
                    throw err;
                  }
                }
              }

              tableMap.set(record.id, record);
              return { rows: [] };
            }
          }

          // Update table
          if (sqlNormalized.startsWith('update')) {
            const tableMap = getTableMap(sqlNormalized);
            if (tableMap) {
              globalSeq.current++;
              const setMatches = [...sqlNormalized.matchAll(/"([^"]+)"\s*=\s*\$(\d+)/g)];
              const whereIdMatch = sqlNormalized.match(/where\s+"id"\s*=\s*\$(\d+)/i);
              if (whereIdMatch) {
                const idParamIdx = parseInt(whereIdMatch[1], 10) - 1;
                const id = params[idParamIdx];
                const existing = tableMap.get(id) || { id };
                for (const match of setMatches) {
                  const col = match[1];
                  const pIdx = parseInt(match[2], 10) - 1;
                  existing[col] = params[pIdx];
                }

                // Enforce check constraints on update
                if (tableMap === habits && existing.mode) {
                  if (existing.mode !== 'checklist' && existing.mode !== 'quantitative') {
                    const err: any = new Error('new row for relation "habits" violates check constraint "habits_mode_check"');
                    err.code = '23514';
                    throw err;
                  }
                }

                if (tableMap === habitSchedules && existing.tipe_frekuensi) {
                  if (!['daily', 'specific_days', 'x_per_week'].includes(existing.tipe_frekuensi)) {
                    const err: any = new Error('new row for relation "habit_schedules" violates check constraint "habit_schedules_tipe_frekuensi_check"');
                    err.code = '23514';
                    throw err;
                  }
                }

                existing.server_seq = globalSeq.current;
                tableMap.set(id, existing);
              }
              return { rows: [] };
            }
          }

          return { rows: [] };
        },
        release: () => {
          if (advisoryLockState.holdingConnId === connId) {
            advisoryLockState.held = false;
            advisoryLockState.holdingConnId = null;
          }
        }
      };
    },
    end: async () => {}
  };

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: mockPool as any
    })
  });

  return {
    db,
    isRealPostgres: false,
    pool: mockPool as any,
    cleanup: async () => {
      categories.clear();
      habits.clear();
      habitSchedules.clear();
      logs.clear();
      settings.clear();
      globalSeq.current = 0;
      advisoryLockState.held = false;
      advisoryLockState.holdingConnId = null;
    },
    close: async () => {
      await db.destroy();
    },
    getTableRows: (table) => {
      switch (table) {
        case 'categories':
          return Array.from(categories.values());
        case 'habits':
          return Array.from(habits.values());
        case 'habit_schedules':
          return Array.from(habitSchedules.values());
        case 'logs':
          return Array.from(logs.values());
        case 'settings':
          return Array.from(settings.values());
      }
    },
    getSequenceValue: async () => {
      return globalSeq.current;
    },
    simulateAdvisoryLock: (held: boolean) => {
      advisoryLockState.held = held;
      advisoryLockState.holdingConnId = held ? 999999 : null;
    },
    isAdvisoryLockCurrentlyHeld: () => advisoryLockState.held,
    executeSql: async (sqlText: string) => {
      const client = await mockPool.connect();
      try {
        const stmts = sqlText
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const stmt of stmts) {
          await client.query(stmt);
        }
      } finally {
        client.release();
      }
    }
  };
}

export async function createRealPostgresProvider(url: string): Promise<TestDbProvider> {
  const { db, pool } = createDb(url);
  let realSimulatedLockHeld = false;

  // Read and apply migration 001_init.sql to ensure schema is initialized
  const candidatePaths = [
    path.resolve(process.cwd(), 'deploy/migrations/001_init.sql'),
    path.resolve(process.cwd(), '../../deploy/migrations/001_init.sql'),
    path.resolve(process.cwd(), '../deploy/migrations/001_init.sql')
  ];
  let migrationPath = candidatePaths[0]!;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      migrationPath = p;
      break;
    }
  }
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(migrationSql);
  } finally {
    client.release();
  }

  return {
    db,
    isRealPostgres: true,
    pool,
    cleanup: async () => {
      const cl = await pool.connect();
      try {
        await cl.query('BEGIN');
        await cl.query('DELETE FROM logs');
        await cl.query('DELETE FROM habit_schedules');
        await cl.query('DELETE FROM habits');
        await cl.query('DELETE FROM categories');
        await cl.query('DELETE FROM settings');
        await cl.query('ALTER SEQUENCE vibehabit_server_seq RESTART WITH 1');
        await cl.query('COMMIT');
        realSimulatedLockHeld = false;
      } catch (err) {
        await cl.query('ROLLBACK');
        throw err;
      } finally {
        cl.release();
      }
    },
    close: async () => {
      await db.destroy();
      await pool.end();
    },
    getTableRows: () => {
      throw new Error('In real postgres mode, use db.selectFrom to query rows');
    },
    getSequenceValue: async () => {
      const cl = await pool.connect();
      try {
        const res = await cl.query<{ last_value: string; is_called: boolean }>(
          "SELECT last_value, is_called FROM pg_sequences WHERE sequencename = 'vibehabit_server_seq'"
        );
        if (res.rows.length === 0) return 0;
        return res.rows[0]?.is_called ? parseInt(res.rows[0].last_value, 10) : 0;
      } finally {
        cl.release();
      }
    },
    simulateAdvisoryLock: (held: boolean) => {
      realSimulatedLockHeld = held;
    },
    isAdvisoryLockCurrentlyHeld: () => realSimulatedLockHeld,
    executeSql: async (sqlText: string) => {
      const cl = await pool.connect();
      try {
        await cl.query(sqlText);
      } finally {
        cl.release();
      }
    }
  };
}

export async function getTestDb(): Promise<TestDbProvider> {
  const candidateUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://vibehabit_test:vibehabit_test_password@127.0.0.1:5432/vibehabit_test';

  const isReal = await checkRealPostgres(candidateUrl);
  if (isReal) {
    return await createRealPostgresProvider(candidateUrl);
  }

  return createHarnessDbProvider();
}
