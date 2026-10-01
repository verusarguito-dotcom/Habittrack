import React from 'react';
import { FireIcon, CheckCircleIcon, CalendarIcon, TrendingUpIcon } from '../common/Icons.js';

export interface MetricSummaryCardsProps {
  successRatio: number; // 0.0 to 1.0
  totalCompleted: number;
  totalScheduled: number;
  longestActiveStreak: number;
  longestActiveStreakHabitName?: string;
  mostConsistentHabitName?: string;
  mostConsistentHabitRatio?: number;
}

export const MetricSummaryCards: React.FC<MetricSummaryCardsProps> = ({
  successRatio,
  totalCompleted,
  totalScheduled,
  longestActiveStreak,
  longestActiveStreakHabitName,
  mostConsistentHabitName,
  mostConsistentHabitRatio
}) => {
  const percentStr = `${Math.round(successRatio * 100)}%`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {/* Metric 1: Rasio Keberhasilan */}
      <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Rasio Keberhasilan
          </span>
          <span className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <TrendingUpIcon className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {percentStr}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {totalCompleted} dari {totalScheduled} terjadwal
          </p>
        </div>
        {/* Decorative mini sparkline */}
        <div className="w-full h-4 pt-1" aria-hidden="true">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 16">
            <path
              d="M0,14 Q25,12 45,8 T75,6 L100,2"
              fill="none"
              stroke="#0D9488"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Metric 2: Total Check-in Selesai */}
      <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Check-in
          </span>
          <span className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <CheckCircleIcon className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {totalCompleted}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Check-in berhasil tercatat
          </p>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-sky-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0)}%` }}
          />
        </div>
      </div>

      {/* Metric 3: Streak Terpanjang Aktif */}
      <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Streak Terpanjang
          </span>
          <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-500">
            <FireIcon className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {longestActiveStreak}
            </span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Hari
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {longestActiveStreakHabitName ? longestActiveStreakHabitName : 'Belum ada streak aktif'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400/90 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="truncate">Momentum terjaga</span>
        </div>
      </div>

      {/* Metric 4: Habit Paling Konsisten */}
      <div className="flex flex-col justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Paling Konsisten
          </span>
          <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <CalendarIcon className="w-4 h-4" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white line-clamp-1">
            {mostConsistentHabitName || 'Belum ada data'}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {mostConsistentHabitRatio !== undefined
              ? `${Math.round(mostConsistentHabitRatio * 100)}% konsistensi`
              : 'Belum ada jadwal'}
          </p>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.round((mostConsistentHabitRatio ?? 0) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
