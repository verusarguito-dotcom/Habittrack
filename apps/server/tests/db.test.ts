import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { getDb, createDb, closeDb } from '../src/db/index.js';
import type { Database, CategoryRow, HabitRow, HabitLogRow, HabitScheduleRow, SettingRow } from '../src/db/types.js';
import type { Category, Habit, HabitLog, HabitSchedule, Setting } from '@vibehabit/shared';

describe('apps/server - Database Schema & Kysely Types', () => {
  it('verifies 001_init.sql migration exists and contains all domain tables and constraints', () => {
    const migrationPath = path.resolve(process.cwd(), 'deploy/migrations/001_init.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, 'utf-8');
    // Check tables
    expect(content).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS habits');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS habit_schedules');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS logs');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS settings');

    // Check global sequence
    expect(content).toContain('CREATE SEQUENCE IF NOT EXISTS vibehabit_server_seq');

    // Check standard columns
    expect(content).toContain('server_seq BIGINT NOT NULL DEFAULT nextval(\'vibehabit_server_seq\')');
    expect(content).toContain('updated_at TIMESTAMPTZ NOT NULL');
    expect(content).toContain('deleted_at TIMESTAMPTZ NULL');
    expect(content).toContain('device_id VARCHAR');

    // Check unique constraint on logs
    expect(content).toMatch(/CONSTRAINT uq_logs_habit_tanggal UNIQUE\s*\(\s*habit_id\s*,\s*tanggal\s*\)/);

    // Check indexes
    expect(content).toContain('idx_categories_server_seq');
    expect(content).toContain('idx_habits_server_seq');
    expect(content).toContain('idx_habit_schedules_server_seq');
    expect(content).toContain('idx_logs_server_seq');
    expect(content).toContain('idx_settings_server_seq');
  });

  it('verifies compose.test.yml exists and defines postgres service for dev testing', () => {
    const composePath = path.resolve(process.cwd(), 'compose.test.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('image: postgres:16-alpine');
    expect(content).toContain('5432:5432');
    expect(content).toContain('POSTGRES_DB: vibehabit_test');
    expect(content).toContain('deploy/migrations:/docker-entrypoint-initdb.d:ro');
  });

  it('verifies Kysely table row types align with @vibehabit/shared domain models', () => {
    // Compile-time and runtime type compatibility check
    const mockCategory: CategoryRow = {
      id: '11111111-1111-4111-a111-111111111111',
      nama: 'Kesehatan',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1',
      server_seq: 1
    };

    const sharedCategory: Category = {
      ...mockCategory,
      deleted_at: mockCategory.deleted_at
    };
    expect(sharedCategory.nama).toBe('Kesehatan');

    const mockHabit: HabitRow = {
      id: '22222222-2222-4222-a222-222222222222',
      nama: 'Meditasi',
      category_id: mockCategory.id,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1',
      server_seq: 2
    };

    const sharedHabit: Habit = {
      ...mockHabit
    };
    expect(sharedHabit.mode).toBe('checklist');

    const mockLog: HabitLogRow = {
      id: '33333333-3333-4333-a333-333333333333',
      habit_id: mockHabit.id,
      tanggal: '2026-09-29',
      nilai: null,
      selesai: true,
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1',
      server_seq: 3
    };

    const sharedLog: HabitLog = {
      ...mockLog
    };
    expect(sharedLog.selesai).toBe(true);
  });

  it('configures custom pg type parsers for DATE, INT8, TIMESTAMPTZ, TIMESTAMP, and NUMERIC', () => {
    // DATE (OID 1082)
    const dateParser = pg.types.getTypeParser(1082);
    expect(dateParser('2026-09-30')).toBe('2026-09-30');

    // INT8 (OID 20)
    const int8Parser = pg.types.getTypeParser(20);
    expect(int8Parser('1005')).toBe(1005);

    // TIMESTAMPTZ (OID 1184)
    const timestamptzParser = pg.types.getTypeParser(1184);
    const parsedTz = timestamptzParser('2026-09-30 03:00:00+00');
    expect(typeof parsedTz).toBe('string');
    expect(parsedTz).toBe('2026-09-30T03:00:00.000Z');

    // TIMESTAMP (OID 1114)
    const timestampParser = pg.types.getTypeParser(1114);
    const parsedTs = timestampParser('2026-09-30 03:00:00');
    expect(typeof parsedTs).toBe('string');
    expect(parsedTs).toBe('2026-09-30T03:00:00.000Z');

    // NUMERIC (OID 1700)
    const numericParser = pg.types.getTypeParser(1700);
    expect(numericParser('42.5')).toBe(42.5);
    expect(typeof numericParser('42.5')).toBe('number');
  });

  it('manages db client lifecycle and throws when getDb() is called uninitialized', async () => {
    await closeDb();
    expect(() => getDb()).toThrow(/Database client has not been initialized/);

    const client = createDb('postgresql://user:pass@127.0.0.1:5432/vibehabit');
    expect(client.db).toBeDefined();
    expect(client.pool).toBeDefined();
    await client.db.destroy();
  });
});
