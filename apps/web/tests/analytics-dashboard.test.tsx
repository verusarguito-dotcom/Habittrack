import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';
import { createDatabase, type VibeHabitDatabase } from '../src/db/database.js';
import {
  saveCategory,
  saveHabit,
  saveHabitSchedule,
  saveHabitLog
} from '../src/db/operations.js';
import type { Category, Habit, HabitSchedule, HabitLog } from '@vibehabit/shared';
import { generateLogId, addDays } from '@vibehabit/shared';
import { TimeRangeFilter } from '../src/components/analytics/TimeRangeFilter.js';
import { MetricSummaryCards } from '../src/components/analytics/MetricSummaryCards.js';
import { ConsistencyChart, type ChartDataPoint } from '../src/components/analytics/ConsistencyChart.js';
import { CalendarHeatmap, getHeatmapLevelClass } from '../src/components/analytics/CalendarHeatmap.js';
import { CategorySummaryCards } from '../src/components/analytics/CategorySummaryCards.js';
import { HabitPerformanceTable } from '../src/components/analytics/HabitPerformanceTable.js';
import { AnalyticsDashboard } from '../src/pages/AnalyticsDashboard.js';

describe('Analytics Dashboard Components & Engine (T014)', () => {
  let db: VibeHabitDatabase;
  const testDeviceId = 'test-device-analitik-1';

  beforeEach(() => {
    db = createDatabase(`test_analytics_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('TimeRangeFilter Component', () => {
    it('renders all 4 segmented filter options with active state', () => {
      const onSelect = vi.fn();
      const html = renderToStaticMarkup(
        <TimeRangeFilter selectedRange="30d" onRangeChange={onSelect} />
      );

      expect(html).toContain('7 Hari');
      expect(html).toContain('30 Hari');
      expect(html).toContain('90 Hari');
      expect(html).toContain('Tahun Ini');

      // 30d should have aria-pressed="true"
      expect(html).toMatch(/aria-pressed="true"[^>]*>30 Hari/);
    });
  });

  describe('MetricSummaryCards Component', () => {
    it('renders all 4 KPI summary cards with tabular numbers', () => {
      const html = renderToStaticMarkup(
        <MetricSummaryCards
          successRatio={0.82}
          totalCompleted={41}
          totalScheduled={50}
          longestActiveStreak={14}
          longestActiveStreakHabitName="Meditasi Pagi"
          mostConsistentHabitName="Minum Air 2L"
          mostConsistentHabitRatio={0.95}
        />
      );

      // Card 1: Rasio Keberhasilan
      expect(html).toContain('Rasio Keberhasilan');
      expect(html).toContain('82%');
      expect(html).toContain('41 dari 50 terjadwal');

      // Card 2: Total Check-in
      expect(html).toContain('Total Check-in');
      expect(html).toContain('41');

      // Card 3: Streak Terpanjang
      expect(html).toContain('Streak Terpanjang');
      expect(html).toContain('14');
      expect(html).toContain('Meditasi Pagi');

      // Card 4: Paling Konsisten
      expect(html).toContain('Paling Konsisten');
      expect(html).toContain('Minum Air 2L');
      expect(html).toContain('95% konsistensi');
    });
  });

  describe('ConsistencyChart Component', () => {
    it('renders SVG lines, area gradients, and benchmark dashed line', () => {
      const mockPoints: ChartDataPoint[] = [
        { date: '2026-09-01', label: '01/09', ratio: 0.5, completedCount: 1, scheduledCount: 2 },
        { date: '2026-09-02', label: '02/09', ratio: 1.0, completedCount: 2, scheduledCount: 2 },
        { date: '2026-09-03', label: '03/09', ratio: 0.0, completedCount: 0, scheduledCount: 2 }
      ];

      const html = renderToStaticMarkup(
        <ConsistencyChart
          dataPoints={mockPoints}
          averageRatio={0.5}
          title="Tren Tes"
          subtitle="Subjudul Tes"
        />
      );

      expect(html).toContain('Tren Tes');
      expect(html).toContain('Rata-rata (50%)');
      expect(html).toContain('<svg');
      expect(html).toContain('consistencyAreaGrad');
      expect(html).toContain('stroke-dasharray="4 4"'); // benchmark line
    });

    it('renders empty message when data points array is empty', () => {
      const html = renderToStaticMarkup(
        <ConsistencyChart dataPoints={[]} averageRatio={0} />
      );
      expect(html).toContain('Tidak ada data untuk rentang waktu ini');
    });
  });

  describe('CalendarHeatmap Component', () => {
    it('evaluates 5-level scale classes accurately', () => {
      // Future
      expect(getHeatmapLevelClass(0, 0, true)).toContain('border-dashed');

      // Level 0: 0% / empty
      expect(getHeatmapLevelClass(0, 0, false)).toContain('bg-slate-100');

      // Level 1: 1% to 25%
      expect(getHeatmapLevelClass(0.2, 1, false)).toContain('bg-teal-100');

      // Level 2: 26% to 50%
      expect(getHeatmapLevelClass(0.5, 2, false)).toContain('bg-teal-300');

      // Level 3: 51% to 75%
      expect(getHeatmapLevelClass(0.66, 2, false)).toContain('bg-teal-500');

      // Level 4: 76% to 100%
      expect(getHeatmapLevelClass(1.0, 3, false)).toContain('bg-teal-600');
    });

    it('renders weekday headers and day cells with month navigation', () => {
      const days = [
        {
          date: '2026-09-01',
          dayNumber: 1,
          completedCount: 2,
          scheduledCount: 2,
          ratio: 1.0,
          isFuture: false,
          isToday: false
        },
        {
          date: '2026-09-02',
          dayNumber: 2,
          completedCount: 1,
          scheduledCount: 2,
          ratio: 0.5,
          isFuture: false,
          isToday: true
        }
      ];

      const html = renderToStaticMarkup(
        <CalendarHeatmap
          days={days}
          monthLabel="September 2026"
          onPrevMonth={vi.fn()}
          onNextMonth={vi.fn()}
        />
      );

      // Weekdays
      expect(html).toContain('Sen');
      expect(html).toContain('Sel');
      expect(html).toContain('Min');

      // Month label
      expect(html).toContain('September 2026');

      // Legend
      expect(html).toContain('Rendah');
      expect(html).toContain('Tinggi');

      // Day numbers
      expect(html).toContain('>1<');
      expect(html).toContain('>2<');
    });
  });

  describe('CategorySummaryCards Component', () => {
    it('renders category cards with habit counts and progress bars', () => {
      const mockCategories = [
        {
          categoryId: 'cat-1',
          categoryName: 'Kesehatan',
          habitCount: 3,
          completedLogs: 20,
          scheduledOpportunities: 25,
          ratio: 0.8
        },
        {
          categoryId: null,
          categoryName: 'Tanpa Kategori',
          habitCount: 1,
          completedLogs: 5,
          scheduledOpportunities: 10,
          ratio: 0.5
        }
      ];

      const html = renderToStaticMarkup(
        <CategorySummaryCards categories={mockCategories} />
      );

      expect(html).toContain('Kesehatan');
      expect(html).toContain('3 Habit');
      expect(html).toContain('80%');
      expect(html).toContain('20 / 25 selesai');

      expect(html).toContain('Tanpa Kategori');
      expect(html).toContain('1 Habit');
      expect(html).toContain('50%');
    });

    it('returns null when category list is empty', () => {
      const html = renderToStaticMarkup(
        <CategorySummaryCards categories={[]} />
      );
      expect(html).toBe('');
    });
  });

  describe('HabitPerformanceTable Component', () => {
    it('renders habit rows with current streak and longest streak', () => {
      const mockHabits = [
        {
          id: 'h-1',
          name: 'Belajar Coding',
          categoryName: 'Produktivitas',
          mode: 'quantitative' as const,
          satuan: 'mnt',
          currentStreak: 7,
          longestStreak: 14,
          ratio: 0.85,
          completedCount: 17,
          scheduledCount: 20
        }
      ];

      const html = renderToStaticMarkup(
        <HabitPerformanceTable habits={mockHabits} />
      );

      expect(html).toContain('Belajar Coding');
      expect(html).toContain('Produktivitas');
      expect(html).toContain('mnt');
      expect(html).toContain('>7<'); // current streak
      expect(html).toContain('14 Hari'); // longest streak
      expect(html).toContain('85%');
      expect(html).toContain('17 / 20');
    });
  });

  describe('Full AnalyticsDashboard Integration', () => {
    it('computes metrics from live IndexedDB habits, schedules, and logs', async () => {
      const nowIso = new Date().toISOString();

      // 1. Create category
      const cat: Category = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        nama: 'Kesehatan',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveCategory(db, cat, testDeviceId);

      // 2. Create habit
      const habit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        nama: 'Minum Air 2L',
        category_id: cat.id,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabit(db, habit, testDeviceId);

      // 3. Create schedule
      const schedule: HabitSchedule = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        habit_id: habit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: null,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      await saveHabitSchedule(db, schedule, testDeviceId);

      const logs: HabitLog[] = [];
      for (let i = 0; i < 3; i++) {
        const date = addDays('2026-09-24', -i);
        const logId = generateLogId(habit.id, date);
        const log: HabitLog = {
          id: logId,
          habit_id: habit.id,
          tanggal: date,
          nilai: null,
          selesai: true,
          updated_at: nowIso,
          deleted_at: null,
          device_id: testDeviceId
        };
        await saveHabitLog(db, log, testDeviceId);
        logs.push(log);
      }

      // Render dashboard with referenceDate and initial props
      const html = renderToStaticMarkup(
        <AnalyticsDashboard
          db={db}
          deviceId={testDeviceId}
          referenceDate="2026-09-24"
          initialHabits={[habit]}
          initialSchedules={[schedule]}
          initialCategories={[cat]}
          initialLogs={logs}
        />
      );

      expect(html).toContain('Dashboard Konsistensi');
      expect(html).toContain('Rasio Keberhasilan');
      expect(html).toContain('Minum Air 2L');
      expect(html).toContain('Kesehatan');
    });

    it('uses pure domain calculateSuccessRatio for x_per_week habits yielding accurate 100% ratio', async () => {
      const nowIso = new Date().toISOString();
      const weeklyHabit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174020',
        nama: 'Berenang 2x Seminggu',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-21',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      const weeklySchedule: HabitSchedule = {
        id: '123e4567-e89b-12d3-a456-426614174021',
        habit_id: weeklyHabit.id,
        tipe_frekuensi: 'x_per_week',
        hari_terjadwal: null,
        jumlah_per_minggu: 2,
        target: 1,
        effective_from: '2026-09-21',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };

      const logs: HabitLog[] = [
        {
          id: generateLogId(weeklyHabit.id, '2026-09-21'),
          habit_id: weeklyHabit.id,
          tanggal: '2026-09-21',
          nilai: null,
          selesai: true,
          updated_at: nowIso,
          deleted_at: null,
          device_id: testDeviceId
        },
        {
          id: generateLogId(weeklyHabit.id, '2026-09-23'),
          habit_id: weeklyHabit.id,
          tanggal: '2026-09-23',
          nilai: null,
          selesai: true,
          updated_at: nowIso,
          deleted_at: null,
          device_id: testDeviceId
        }
      ];

      const html = renderToStaticMarkup(
        <AnalyticsDashboard
          db={db}
          deviceId={testDeviceId}
          referenceDate="2026-09-27"
          initialHabits={[weeklyHabit]}
          initialSchedules={[weeklySchedule]}
          initialCategories={[]}
          initialLogs={logs}
        />
      );

      // Weekly habit completed 2/2 target -> 100% ratio, NOT 2/7 (29%)
      expect(html).toContain('Berenang 2x Seminggu');
      expect(html).toContain('100%');
      expect(html).not.toContain('29%');
    });

    it('respects PRD 7.4 rule that uncompleted today does not penalize ratio denominator', async () => {
      const nowIso = new Date().toISOString();
      const dailyHabit: Habit = {
        id: '123e4567-e89b-12d3-a456-426614174030',
        nama: 'Jurnal Malam',
        category_id: null,
        mode: 'checklist',
        satuan: null,
        archived: false,
        created_date: '2026-09-23',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };
      const dailySchedule: HabitSchedule = {
        id: '123e4567-e89b-12d3-a456-426614174031',
        habit_id: dailyHabit.id,
        tipe_frekuensi: 'daily',
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-23',
        updated_at: nowIso,
        deleted_at: null,
        device_id: testDeviceId
      };

      // Completed yesterday (2026-09-23), NOT completed today (2026-09-24)
      const logs: HabitLog[] = [
        {
          id: generateLogId(dailyHabit.id, '2026-09-23'),
          habit_id: dailyHabit.id,
          tanggal: '2026-09-23',
          nilai: null,
          selesai: true,
          updated_at: nowIso,
          deleted_at: null,
          device_id: testDeviceId
        }
      ];

      const html = renderToStaticMarkup(
        <AnalyticsDashboard
          db={db}
          deviceId={testDeviceId}
          referenceDate="2026-09-24"
          initialHabits={[dailyHabit]}
          initialSchedules={[dailySchedule]}
          initialCategories={[]}
          initialLogs={logs}
        />
      );

      // Today uncompleted is excluded from denominator: 1 scheduled day (yesterday), 1 successful -> 100%
      expect(html).toContain('Jurnal Malam');
      expect(html).toContain('100%');
    });

    it('renders rest day tooltips accurately in CalendarHeatmap and ConsistencyChart', () => {
      const restDay = {
        date: '2026-09-26',
        dayNumber: 26,
        completedCount: 0,
        scheduledCount: 0,
        ratio: 0,
        isFuture: false,
        isToday: false
      };
      const missedDay = {
        date: '2026-09-27',
        dayNumber: 27,
        completedCount: 0,
        scheduledCount: 2,
        ratio: 0,
        isFuture: false,
        isToday: false
      };

      const heatmapHtml = renderToStaticMarkup(
        <CalendarHeatmap
          days={[restDay, missedDay]}
          monthLabel="September 2026"
        />
      );

      expect(heatmapHtml).toContain('Rehat (tidak ada jadwal)');
      expect(heatmapHtml).toContain('0/2 selesai (0%)');

      const chartHtml = renderToStaticMarkup(
        <ConsistencyChart
          dataPoints={[
            { date: '2026-09-26', label: '26/09', ratio: 0.5, completedCount: 0, scheduledCount: 0 }
          ]}
          averageRatio={0.5}
        />
      );
      expect(chartHtml).toContain('aria-label="26/09: Hari Rehat"');
    });
  });
});
