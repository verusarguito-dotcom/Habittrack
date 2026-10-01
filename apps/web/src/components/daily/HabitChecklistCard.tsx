import React from 'react';
import type { Habit, HabitLog } from '@vibehabit/shared';
import { CheckIcon, FireIcon } from '../common/Icons.js';
import { getCategoryTheme } from '../../utils/categories.js';

export interface HabitChecklistCardProps {
  habit: Habit;
  log?: HabitLog | null;
  categoryName?: string | null;
  streakDays: number;
  onToggle: () => void;
  className?: string;
}

export const HabitChecklistCard: React.FC<HabitChecklistCardProps> = ({
  habit,
  log,
  categoryName,
  streakDays,
  onToggle,
  className = ''
}) => {
  const isCompleted = !!log?.selesai;
  const categoryTheme = getCategoryTheme(categoryName);

  return (
    <article
      className={`p-3.5 md:p-4 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 ${
        isCompleted
          ? 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-800/40 shadow-sm'
          : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-slate-300 dark:hover:border-slate-600'
      } ${className}`}
    >
      {/* Habit Details */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* Category Chip */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${categoryTheme.badgeBg} ${categoryTheme.badgeText} ${categoryTheme.badgeBorder}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${categoryTheme.dotColor}`} />
            {categoryTheme.name}
          </span>

          {/* Dynamic Streak Badge */}
          {streakDays > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
              <FireIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="tabular-nums">{streakDays} hr</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
              <FireIcon className="w-3 h-3 text-slate-400" />
              <span className="tabular-nums">0</span>
            </span>
          )}
        </div>

        {/* Habit Title */}
        <h3
          className={`text-base font-semibold transition-all truncate ${
            isCompleted
              ? 'text-slate-500 dark:text-slate-400 line-through opacity-80'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          {habit.nama}
        </h3>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {isCompleted ? 'Target harian tercapai' : 'Checklist harian'}
        </p>
      </div>

      {/* Checkbox Button (44px x 44px min touch target) */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isCompleted ? `Tandai belum selesai: ${habit.nama}` : `Selesaikan: ${habit.nama}`}
        aria-checked={isCompleted}
        role="checkbox"
        className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
          isCompleted
            ? 'bg-teal-600 text-white shadow-teal-600/30'
            : 'bg-slate-100 dark:bg-slate-700/60 text-transparent hover:text-slate-400 dark:hover:text-slate-500 border border-slate-200 dark:border-slate-600'
        }`}
      >
        <CheckIcon className="w-5 h-5" />
      </button>
    </article>
  );
};
