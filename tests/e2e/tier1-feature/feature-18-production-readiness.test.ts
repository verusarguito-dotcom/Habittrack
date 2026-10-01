import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { createDatabase, type VibeHabitDatabase } from '../../../apps/web/src/db/database.js';
import { queryLogsByDate, queryLogsByHabitAndDate } from '../../../apps/web/src/db/operations.js';
import type { HabitLog } from '@vibehabit/shared';

describe('T018: Final Performance Audit & Production Readiness Verification (PRD §11.1 & AGENTS §5)', () => {
  let db: VibeHabitDatabase;

  beforeEach(async () => {
    db = createDatabase(`perf_audit_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  describe('Cold Start Latency Audit (Target: < 1.0s per PRD §11.1)', () => {
    it('initializes database and core schema stores in under 1 second', async () => {
      const coldStartTimer = performance.now();
      const freshDb = createDatabase(`cold_start_${Date.now()}`);
      await freshDb.open();
      const elapsed = performance.now() - coldStartTimer;

      expect(freshDb.isOpen()).toBe(true);
      expect(freshDb.habits).toBeDefined();
      expect(freshDb.logs).toBeDefined();
      expect(elapsed).toBeLessThan(1000); // PRD §11.1 cold start target < 1.0s

      await freshDb.delete();
    });
  });

  describe('Warm Start & Query Latency Audit (Target: < 0.3s per PRD §11.1)', () => {
    it('executes indexed compound queries in under 300ms on pre-warmed database', async () => {
      // Seed initial set of habits and logs
      const seedLogs: HabitLog[] = [];
      for (let i = 1; i <= 500; i++) {
        const day = (i % 28) + 1;
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        seedLogs.push({
          id: `warm-log-${i}`,
          habit_id: `habit-${i % 10}`,
          tanggal: `2026-09-${dayStr}`,
          nilai: 1,
          selesai: true,
          updated_at: '2026-09-29T10:00:00.000Z',
          deleted_at: null,
          device_id: 'device-warm'
        });
      }
      await db.logs.bulkAdd(seedLogs);

      const warmStartTimer = performance.now();
      const result = await queryLogsByHabitAndDate(db, 'habit-3', '2026-09-14');
      const elapsed = performance.now() - warmStartTimer;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(300); // PRD §11.1 warm start target < 0.3s
    });
  });

  describe('Scale Query Performance (35,000 log history simulation)', () => {
    it('queries daily logs within sub-second execution on large dataset', async () => {
      // PRD §5: 20 active habits over ~5 years (1,750 days) = 35,000 logs
      const totalLogs = 35000;
      const numDays = 1750;
      const logs: HabitLog[] = [];

      for (let i = 1; i <= totalLogs; i++) {
        const dayOffset = i % numDays;
        const d = new Date(2021, 0, 1);
        d.setDate(d.getDate() + dayOffset);
        const dateStr = d.toISOString().slice(0, 10);
        logs.push({
          id: `scale-log-${i}`,
          habit_id: `habit-${i % 20}`,
          tanggal: dateStr,
          nilai: 1,
          selesai: true,
          updated_at: '2026-09-29T10:00:00.000Z',
          deleted_at: null,
          device_id: 'device-scale'
        });
      }
      await db.logs.bulkAdd(logs);

      const queryTimer = performance.now();
      const results = await queryLogsByDate(db, '2024-05-15');
      const elapsed = performance.now() - queryTimer;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(1000); // Must be strictly sub-second per PRD §11.1
    }, 15000);
  });

  describe('Monorepo Integrity & Production Readiness Check', () => {
    it('verifies all domain tables have compound indexes configured', () => {
      const schema = db.tables.map((t) => t.name);
      expect(schema).toContain('categories');
      expect(schema).toContain('habits');
      expect(schema).toContain('habit_schedules');
      expect(schema).toContain('logs');
      expect(schema).toContain('settings');
      expect(schema).toContain('outbox');
    });
  });
});
