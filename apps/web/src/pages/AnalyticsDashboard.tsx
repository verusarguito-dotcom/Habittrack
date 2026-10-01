import React, { useState, useEffect, useMemo } from 'react';
import type { VibeHabitDatabase } from '../db/database.js';
import type {
  Habit,
  HabitSchedule,
  HabitLog,
  Category,
  Setting
} from '@vibehabit/shared';
import {
  getEffectiveDate,
  addDays,
  generateDateRange,
  parseLocalDate,
  getActiveScheduleForDate,
  isDateScheduled,
  isDaySuccessful,
  calculateStreak
} from '@vibehabit/shared';
import { liveQuery } from 'dexie';
import { TimeRangeFilter, type TimeRangeKey } from '../components/analytics/TimeRangeFilter.js';
import { MetricSummaryCards } from '../components/analytics/MetricSummaryCards.js';
import { ConsistencyChart, type ChartDataPoint } from '../components/analytics/ConsistencyChart.js';
import { CalendarHeatmap, type HeatmapDayData } from '../components/analytics/CalendarHeatmap.js';
import { CategorySummaryCards, type CategoryStat } from '../components/analytics/CategorySummaryCards.js';
import {
  HabitPerformanceTable,
  type HabitPerformanceItem
} from '../components/analytics/HabitPerformanceTable.js';

export interface AnalyticsDashboardProps {
  db: VibeHabitDatabase;
  deviceId?: string;
  referenceDate?: string;
  initialHabits?: Habit[];
  initialSchedules?: HabitSchedule[];
  initialCategories?: Category[];
  initialLogs?: HabitLog[];
  initialSetting?: Setting;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  db,
  referenceDate,
  initialHabits,
  initialSchedules,
  initialCategories,
  initialLogs,
  initialSetting
}) => {
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('30d');
  const [monthOffset, setMonthOffset] = useState<number>(0);

  // Reactive DB subscriptions with optional initial fallback
  const [habits, setHabits] = useState<Habit[]>(initialHabits || []);
  const [schedules, setSchedules] = useState<HabitSchedule[]>(initialSchedules || []);
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [allLogs, setAllLogs] = useState<HabitLog[]>(initialLogs || []);
  const [setting, setSetting] = useState<Setting | undefined>(initialSetting);

  useEffect(() => {
    const subHabits = liveQuery(() =>
      db.habits.filter((h) => !h.deleted_at).toArray()
    ).subscribe({
      next: (val) => setHabits(val),
      error: (err) => console.warn('Error observing habits in analytics:', err)
    });

    const subSchedules = liveQuery(() =>
      db.habit_schedules.filter((s) => !s.deleted_at).toArray()
    ).subscribe({
      next: (val) => setSchedules(val),
      error: (err) => console.warn('Error observing schedules in analytics:', err)
    });

    const subCategories = liveQuery(() =>
      db.categories.filter((c) => !c.deleted_at).toArray()
    ).subscribe({
      next: (val) => setCategories(val),
      error: (err) => console.warn('Error observing categories in analytics:', err)
    });

    const subLogs = liveQuery(() =>
      db.logs.filter((l) => !l.deleted_at).toArray()
    ).subscribe({
      next: (val) => setAllLogs(val),
      error: (err) => console.warn('Error observing logs in analytics:', err)
    });

    const subSetting = liveQuery(() =>
      db.settings.filter((s) => !s.deleted_at).first()
    ).subscribe({
      next: (val) => setSetting(val),
      error: (err) => console.warn('Error observing setting in analytics:', err)
    });

    return () => {
      subHabits.unsubscribe();
      subSchedules.unsubscribe();
      subCategories.unsubscribe();
      subLogs.unsubscribe();
      subSetting.unsubscribe();
    };
  }, [db]);

  // Compute effective today string
  const todayStr = useMemo(() => {
    if (referenceDate) return referenceDate;
    return getEffectiveDate(new Date(), setting?.jam_mulai_hari || '00:00');
  }, [referenceDate, setting?.jam_mulai_hari]);

  // Date range determination
  const { startDate, endDate } = useMemo(() => {
    if (selectedRange === '7d') {
      return {
        startDate: addDays(todayStr, -6),
        endDate: todayStr
      };
    }
    if (selectedRange === '30d') {
      return {
        startDate: addDays(todayStr, -29),
        endDate: todayStr
      };
    }
    if (selectedRange === '90d') {
      return {
        startDate: addDays(todayStr, -89),
        endDate: todayStr
      };
    }
    // 'year': from Jan 1st of current year to today
    const currentYear = todayStr.slice(0, 4);
    return {
      startDate: `${currentYear}-01-01`,
      endDate: todayStr
    };
  }, [selectedRange, todayStr]);

  // Category map for fast lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.nama);
    }
    return map;
  }, [categories]);

  // Logs map by `${habit_id}:${tanggal}`
  const logsMap = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const l of allLogs) {
      map.set(`${l.habit_id}:${l.tanggal}`, l);
    }
    return map;
  }, [allLogs]);

  // Active non-archived habits
  const activeHabits = useMemo(() => {
    return habits.filter((h) => !h.archived);
  }, [habits]);

  // Calculations across the selected date range
  const {
    chartDataPoints,
    totalCompleted,
    totalScheduled,
    overallRatio,
    habitStatsMap,
    categoryStats
  } = useMemo(() => {
    const dateList = generateDateRange(startDate, endDate);

    let sumCompleted = 0;
    let sumScheduled = 0;

    // Per habit tracking
    const hStats = new Map<
      string,
      { completedCount: number; scheduledCount: number }
    >();
    for (const h of activeHabits) {
      hStats.set(h.id, { completedCount: 0, scheduledCount: 0 });
    }

    const points: ChartDataPoint[] = [];

    for (const date of dateList) {
      let dayCompleted = 0;
      let dayScheduled = 0;

      for (const habit of activeHabits) {
        if (habit.created_date > date) continue;

        const habitSchedules = schedules.filter((s) => s.habit_id === habit.id);
        const activeSchedule = getActiveScheduleForDate(habitSchedules, date);
        if (!activeSchedule) continue;

        const isScheduled = isDateScheduled(activeSchedule, date);
        if (!isScheduled) continue;

        dayScheduled++;
        const stat = hStats.get(habit.id);
        if (stat) stat.scheduledCount++;

        const log = logsMap.get(`${habit.id}:${date}`);
        const success = isDaySuccessful(habit, activeSchedule, log);

        if (success) {
          dayCompleted++;
          if (stat) stat.completedCount++;
        }
      }

      sumCompleted += dayCompleted;
      sumScheduled += dayScheduled;

      const dayRatio = dayScheduled > 0 ? dayCompleted / dayScheduled : 0;
      const [_, mStr, dStr] = date.split('-');
      points.push({
        date,
        label: `${dStr}/${mStr}`,
        ratio: dayRatio,
        completedCount: dayCompleted,
        scheduledCount: dayScheduled
      });
    }

    const calculatedOverallRatio =
      sumScheduled > 0 ? sumCompleted / sumScheduled : 0;

    // Category aggregation
    const catBuckets = new Map<
      string | null,
      {
        categoryName: string;
        habitCount: number;
        completed: number;
        scheduled: number;
      }
    >();

    for (const habit of activeHabits) {
      const catId = habit.category_id;
      const catName = catId ? categoryMap.get(catId) || 'Tanpa Kategori' : 'Tanpa Kategori';
      const existing = catBuckets.get(catId) || {
        categoryName: catName,
        habitCount: 0,
        completed: 0,
        scheduled: 0
      };

      existing.habitCount++;
      const hStat = hStats.get(habit.id);
      if (hStat) {
        existing.completed += hStat.completedCount;
        existing.scheduled += hStat.scheduledCount;
      }
      catBuckets.set(catId, existing);
    }

    const catStatsList: CategoryStat[] = [];
    for (const [catId, b] of catBuckets.entries()) {
      catStatsList.push({
        categoryId: catId,
        categoryName: b.categoryName,
        habitCount: b.habitCount,
        completedLogs: b.completed,
        scheduledOpportunities: b.scheduled,
        ratio: b.scheduled > 0 ? b.completed / b.scheduled : 0
      });
    }

    return {
      chartDataPoints: points,
      totalCompleted: sumCompleted,
      totalScheduled: sumScheduled,
      overallRatio: calculatedOverallRatio,
      habitStatsMap: hStats,
      categoryStats: catStatsList
    };
  }, [startDate, endDate, activeHabits, schedules, logsMap, categoryMap]);

  // Streaks and individual habit performance breakdown
  const {
    habitPerformanceItems,
    longestActiveStreak,
    longestActiveStreakHabitName,
    mostConsistentHabitName,
    mostConsistentHabitRatio
  } = useMemo(() => {
    let maxCurrentStreak = 0;
    let maxStreakHabitName = '';

    let bestRatio = -1;
    let bestRatioHabitName = '';

    const items: HabitPerformanceItem[] = [];

    for (const habit of activeHabits) {
      const habitSchedules = schedules.filter((s) => s.habit_id === habit.id);
      const streakResult = calculateStreak(
        habit,
        habitSchedules,
        allLogs,
        todayStr
      );

      if (streakResult.currentStreak > maxCurrentStreak) {
        maxCurrentStreak = streakResult.currentStreak;
        maxStreakHabitName = habit.nama;
      }

      const hStat = habitStatsMap.get(habit.id) || {
        completedCount: 0,
        scheduledCount: 0
      };
      const ratio =
        hStat.scheduledCount > 0 ? hStat.completedCount / hStat.scheduledCount : 0;

      if (hStat.scheduledCount > 0 && ratio > bestRatio) {
        bestRatio = ratio;
        bestRatioHabitName = habit.nama;
      }

      items.push({
        id: habit.id,
        name: habit.nama,
        categoryName: habit.category_id ? categoryMap.get(habit.category_id) : undefined,
        mode: habit.mode,
        satuan: habit.satuan,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        ratio,
        completedCount: hStat.completedCount,
        scheduledCount: hStat.scheduledCount
      });
    }

    return {
      habitPerformanceItems: items,
      longestActiveStreak: maxCurrentStreak,
      longestActiveStreakHabitName: maxStreakHabitName,
      mostConsistentHabitName: bestRatio >= 0 ? bestRatioHabitName : undefined,
      mostConsistentHabitRatio: bestRatio >= 0 ? bestRatio : undefined
    };
  }, [activeHabits, schedules, allLogs, todayStr, habitStatsMap, categoryMap]);

  // Heatmap generation based on monthOffset
  const { heatmapDays, heatmapMonthLabel } = useMemo(() => {
    const baseDate = parseLocalDate(todayStr);
    // Shift by monthOffset
    baseDate.setMonth(baseDate.getMonth() + monthOffset, 1);

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-indexed

    // Indonesian month names
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthLabel = `${monthNames[month]} ${year}`;

    // Days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: HeatmapDayData[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = date > todayStr;
      const isToday = date === todayStr;

      let completedCount = 0;
      let scheduledCount = 0;

      for (const habit of activeHabits) {
        if (habit.created_date > date) continue;
        const habitSchedules = schedules.filter((s) => s.habit_id === habit.id);
        const activeSchedule = getActiveScheduleForDate(habitSchedules, date);
        if (!activeSchedule) continue;

        if (isDateScheduled(activeSchedule, date)) {
          scheduledCount++;
          const log = logsMap.get(`${habit.id}:${date}`);
          if (isDaySuccessful(habit, activeSchedule, log)) {
            completedCount++;
          }
        }
      }

      const ratio = scheduledCount > 0 ? completedCount / scheduledCount : 0;

      days.push({
        date,
        dayNumber: d,
        completedCount,
        scheduledCount,
        ratio,
        isFuture,
        isToday
      });
    }

    return {
      heatmapDays: days,
      heatmapMonthLabel: monthLabel
    };
  }, [todayStr, monthOffset, activeHabits, schedules, logsMap]);

  return (
    <div className="flex flex-col gap-5 md:gap-6 w-full animate-fadeIn pb-8">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-teal-600 dark:text-teal-400 uppercase">
            Analisis &amp; Wawasan
          </span>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard Konsistensi
          </h1>
        </div>

        <TimeRangeFilter
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
        />
      </div>

      {/* KPI Metric Summary Cards */}
      <MetricSummaryCards
        successRatio={overallRatio}
        totalCompleted={totalCompleted}
        totalScheduled={totalScheduled}
        longestActiveStreak={longestActiveStreak}
        longestActiveStreakHabitName={longestActiveStreakHabitName}
        mostConsistentHabitName={mostConsistentHabitName}
        mostConsistentHabitRatio={mostConsistentHabitRatio}
      />

      {/* Consistency Line/Area Chart */}
      <ConsistencyChart
        dataPoints={chartDataPoints}
        averageRatio={overallRatio}
        title="Tren Konsistensi Harian"
        subtitle={`Rasio penyelesaian ritual harian (${startDate} s.d. ${endDate})`}
      />

      {/* Calendar Heatmap (CSS Grid) */}
      <CalendarHeatmap
        days={heatmapDays}
        monthLabel={heatmapMonthLabel}
        onPrevMonth={() => setMonthOffset((prev) => prev - 1)}
        onNextMonth={() => setMonthOffset((prev) => prev + 1)}
      />

      {/* Performance by Category */}
      <CategorySummaryCards categories={categoryStats} />

      {/* Breakdown per Habit */}
      <HabitPerformanceTable habits={habitPerformanceItems} />
    </div>
  );
};
