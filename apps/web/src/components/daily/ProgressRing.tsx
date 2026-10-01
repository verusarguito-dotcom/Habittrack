import React from 'react';
import { FireIcon } from '../common/Icons.js';

export interface ProgressRingProps {
  completedCount: number;
  totalCount: number;
  activeStreakDays?: number;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  completedCount,
  totalCount,
  activeStreakDays = 0,
  className = ''
}) => {
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // SVG circle calculations (radius = 30, circumference = 2 * PI * 30 ≈ 188.495)
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <section
      aria-label="Ringkasan Progres Harian"
      className={`p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-4 md:gap-6 ${className}`}
    >
      {/* Circular SVG Ring */}
      <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
        <svg
          className="w-20 h-20 -rotate-90 transform"
          viewBox="0 0 72 72"
          role="img"
          aria-label={`Progres: ${percent}%`}
        >
          {/* Background Track */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="transparent"
            strokeWidth="8"
            className="text-slate-200 dark:text-slate-700"
            stroke="currentColor"
          />
          {/* Animated Value Path */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="transparent"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-teal-600 dark:text-teal-400 transition-all duration-500 ease-out"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        {/* Center Percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-base font-bold text-teal-600 dark:text-teal-400 tabular-nums leading-none">
            {percent}%
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
            Fokus
          </span>
        </div>
      </div>

      {/* Summary Text & Active Streak Badge */}
      <div className="flex-1 min-w-0 flex flex-col">
        {activeStreakDays > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-semibold w-fit mb-1.5">
            <FireIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="tabular-nums">{activeStreakDays} Hari Aktif</span>
          </div>
        )}

        <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
          <span className="tabular-nums">{completedCount}</span> dari{' '}
          <span className="tabular-nums">{totalCount}</span> Selesai
        </h2>

        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          {percent === 100 && totalCount > 0
            ? 'Luar biasa! Seluruh target hari ini telah tercapai.'
            : percent > 50
            ? 'Lebih dari separuh selesai, pertahankan ritme fokus.'
            : 'Mulai satu ritual kecil untuk membangun momentum hari ini.'}
        </p>
      </div>
    </section>
  );
};
