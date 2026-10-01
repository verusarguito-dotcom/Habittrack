import React, { useState } from 'react';
import type { Habit, HabitLog } from '@vibehabit/shared';
import { FireIcon, PlusIcon, MinusIcon, CheckIcon } from '../common/Icons.js';
import { getCategoryTheme } from '../../utils/categories.js';

export interface HabitQuantitativeCardProps {
  habit: Habit;
  targetValue: number;
  log?: HabitLog | null;
  categoryName?: string | null;
  streakDays: number;
  onUpdateValue: (newValue: number) => void;
  className?: string;
}

export const HabitQuantitativeCard: React.FC<HabitQuantitativeCardProps> = ({
  habit,
  targetValue,
  log,
  categoryName,
  streakDays,
  onUpdateValue,
  className = ''
}) => {
  const currentValue = log?.nilai ?? 0;
  const isCompleted = currentValue >= targetValue;
  const unit = habit.satuan || '';
  const categoryTheme = getCategoryTheme(categoryName);
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(currentValue));

  const percent = targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0;

  const handleStep = (delta: number) => {
    const next = Math.max(0, currentValue + delta);
    onUpdateValue(next);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(inputVal);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateValue(parsed);
    }
    setIsEditing(false);
  };

  return (
    <article
      className={`p-3.5 md:p-4 rounded-2xl border transition-all duration-150 flex flex-col gap-2.5 ${
        isCompleted
          ? 'bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-800/40 shadow-sm'
          : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-slate-300 dark:hover:border-slate-600'
      } ${className}`}
    >
      {/* Header Row: Category, Streak, Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${categoryTheme.badgeBg} ${categoryTheme.badgeText} ${categoryTheme.badgeBorder}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${categoryTheme.dotColor}`} />
            {categoryTheme.name}
          </span>

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

        <span
          className={`text-xs font-semibold ${
            isCompleted
              ? 'text-teal-600 dark:text-teal-400 flex items-center gap-1'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckIcon className="w-3.5 h-3.5" />
              Target Tercapai
            </>
          ) : (
            'Sedang Berjalan'
          )}
        </span>
      </div>

      {/* Title & Counters */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
            {habit.nama}
          </h3>

          <div className="flex items-center justify-between mt-1 mb-1.5">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Progres harian
            </span>

            {isEditing ? (
              <form onSubmit={handleFormSubmit} className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onBlur={handleFormSubmit}
                  autoFocus
                  className="w-16 px-1.5 py-0.5 text-xs font-bold rounded border border-teal-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-right tabular-nums"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  / {targetValue} {unit}
                </span>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setInputVal(String(currentValue));
                  setIsEditing(true);
                }}
                title="Klik untuk mengubah nilai manual"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 tabular-nums transition-colors"
              >
                {currentValue} / {targetValue} {unit}
              </button>
            )}
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                isCompleted ? 'bg-teal-600 dark:bg-teal-500' : 'bg-teal-600'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Quick Stepper Buttons (- and +) */}
        <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={currentValue <= 0}
            aria-label={`Kurangi 1 ${unit}`}
            className="h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 text-xs font-bold transition-all"
          >
            <MinusIcon className="w-4 h-4" />
            <span>1</span>
          </button>

          <button
            type="button"
            onClick={() => handleStep(1)}
            aria-label={`Tambah 1 ${unit}`}
            className="h-11 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/50 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 active:scale-95 text-xs font-bold flex items-center gap-1 transition-all"
          >
            <PlusIcon className="w-4 h-4" />
            <span>1</span>
          </button>
        </div>
      </div>
    </article>
  );
};
