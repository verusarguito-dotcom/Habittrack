import React, { useState } from 'react';
import { getDayOfWeek } from '@vibehabit/shared';
import { ChevronLeftIcon, ChevronRightIcon } from '../common/Icons.js';

export interface HeatmapDayData {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  completedCount: number;
  scheduledCount: number;
  ratio: number; // 0.0 to 1.0
  isFuture: boolean;
  isToday: boolean;
}

export interface CalendarHeatmapProps {
  days: HeatmapDayData[];
  monthLabel: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  title?: string;
  subtitle?: string;
}

export function getHeatmapLevelClass(
  ratio: number,
  completedCount: number,
  isFuture: boolean
): string {
  if (isFuture) {
    return 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800';
  }
  if (completedCount === 0 || ratio <= 0) {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60';
  }
  if (ratio <= 0.25) {
    return 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/40';
  }
  if (ratio <= 0.5) {
    return 'bg-teal-300 dark:bg-teal-800 text-teal-950 dark:text-teal-100';
  }
  if (ratio <= 0.75) {
    return 'bg-teal-500 dark:bg-teal-600 text-white font-medium';
  }
  return 'bg-teal-600 dark:bg-teal-500 text-white font-medium';
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  days,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  title = 'Peta Densitas Konsistensi',
  subtitle = 'Frekuensi penyelesaian kebiasaan per hari kalender'
}) => {
  const [activeTooltipDate, setActiveTooltipDate] = useState<string | null>(null);

  // Compute leading empty slots based on the first day's weekday (Monday = 1)
  const firstDay = days[0];
  const leadingOffset = firstDay ? getDayOfWeek(firstDay.date) - 1 : 0;

  const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
            {onPrevMonth && (
              <button
                type="button"
                onClick={onPrevMonth}
                aria-label="Bulan sebelumnya"
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
            )}
            <span className="px-2 text-xs font-semibold text-slate-800 dark:text-slate-200 select-none min-w-[100px] text-center">
              {monthLabel}
            </span>
            {onNextMonth && (
              <button
                type="button"
                onClick={onNextMonth}
                aria-label="Bulan berikutnya"
                className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 5-Level Legend */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium select-none">
            <span>Rendah</span>
            <span
              className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="0% Selesai / Kosong"
            />
            <span
              className="w-3 h-3 rounded bg-teal-100 dark:bg-teal-950/70"
              title="1-25% Selesai"
            />
            <span
              className="w-3 h-3 rounded bg-teal-300 dark:bg-teal-800"
              title="26-50% Selesai"
            />
            <span
              className="w-3 h-3 rounded bg-teal-500 dark:bg-teal-600"
              title="51-75% Selesai"
            />
            <span
              className="w-3 h-3 rounded bg-teal-600 dark:bg-teal-500"
              title="76-100% Selesai"
            />
            <span>Tinggi</span>
          </div>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-1">
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Heatmap Grid (Pure CSS Grid 7 cols) */}
      <div className="grid grid-cols-7 gap-1.5 select-none" role="grid" aria-label="Kalender Heatmap Kontribusi">
        {/* Leading empty slots */}
        {Array.from({ length: leadingOffset }).map((_, idx) => (
          <div
            key={`offset-${idx}`}
            className="h-9 sm:h-10 rounded-lg bg-slate-50/50 dark:bg-slate-800/20 border border-dashed border-slate-200/50 dark:border-slate-800/40"
            aria-hidden="true"
          />
        ))}

        {/* Days cells */}
        {days.map((day) => {
          const levelClass = getHeatmapLevelClass(day.ratio, day.completedCount, day.isFuture);
          const percent = Math.round(day.ratio * 100);
          const tooltipContent = day.isFuture
            ? `${day.date}: Belum berlangsung`
            : day.completedCount === 0
            ? `${day.date}: Rehat (0 selesai)`
            : `${day.date}: ${day.completedCount}/${day.scheduledCount} selesai (${percent}%)`;

          const isTooltipActive = activeTooltipDate === day.date;

          return (
            <div
              key={day.date}
              className={`group relative h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${levelClass} ${
                day.isToday ? 'ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-slate-900 font-bold' : ''
              } hover:ring-2 hover:ring-teal-600 hover:scale-[1.03] active:scale-95`}
              onMouseEnter={() => setActiveTooltipDate(day.date)}
              onMouseLeave={() => setActiveTooltipDate(null)}
              onClick={() => setActiveTooltipDate((prev) => (prev === day.date ? null : day.date))}
              tabIndex={0}
              role="gridcell"
              aria-label={tooltipContent}
            >
              <span className="text-xs leading-none tabular-nums">
                {day.dayNumber}
              </span>

              {/* Tooltip on hover / active */}
              {isTooltipActive && (
                <div
                  className="absolute bottom-full mb-1 z-30 px-2 py-1 rounded bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-[11px] font-medium whitespace-nowrap shadow-lg pointer-events-none transform -translate-x-1/2 left-1/2"
                >
                  {tooltipContent}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
