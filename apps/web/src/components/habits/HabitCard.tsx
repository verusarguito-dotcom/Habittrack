import React, { useState } from 'react';
import type { Habit, HabitSchedule } from '@vibehabit/shared';
import {
  FireIcon,
  MoreVertIcon,
  EditIcon,
  ArchiveIcon,
  UnarchiveIcon,
  TrashIcon
} from '../common/Icons.js';
import { getCategoryTheme } from '../../utils/categories.js';

export interface HabitCardProps {
  habit: Habit;
  schedule?: HabitSchedule | null;
  categoryName?: string | null;
  streakDays: number;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  className?: string;
}

const INDO_DAY_NAMES: Record<number, string> = {
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab',
  7: 'Min'
};

export const HabitCard: React.FC<HabitCardProps> = ({
  habit,
  schedule,
  categoryName,
  streakDays,
  onEdit,
  onToggleArchive,
  onDelete,
  className = ''
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const categoryTheme = getCategoryTheme(categoryName);

  // Format schedule description
  let freqLabel = 'Setiap hari';
  if (schedule?.tipe_frekuensi === 'specific_days' && schedule.hari_terjadwal) {
    freqLabel = schedule.hari_terjadwal.map((d) => INDO_DAY_NAMES[d] || String(d)).join(', ');
  } else if (schedule?.tipe_frekuensi === 'x_per_week' && schedule.jumlah_per_minggu) {
    freqLabel = `${schedule.jumlah_per_minggu}x / minggu`;
  }

  // Format mode description
  const modeLabel =
    habit.mode === 'checklist'
      ? 'Checklist'
      : `${schedule?.target ?? 1} ${habit.satuan || ''}`.trim();

  return (
    <article
      className={`relative p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all ${
        habit.archived ? 'opacity-70 bg-slate-50 dark:bg-slate-800/50' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Category Pill */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${categoryTheme.badgeBg} ${categoryTheme.badgeText} ${categoryTheme.badgeBorder}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${categoryTheme.dotColor}`} />
              {categoryTheme.name}
            </span>

            {/* Frequency Badge */}
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
              {freqLabel}
            </span>

            {/* Mode Badge */}
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
              {modeLabel}
            </span>
          </div>

          <h3
            className={`text-base font-semibold text-slate-900 dark:text-white truncate ${
              habit.archived ? 'line-through text-slate-500 dark:text-slate-400' : ''
            }`}
          >
            {habit.nama}
          </h3>
        </div>

        {/* Right: Streak & Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {streakDays > 0 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
              <FireIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="tabular-nums">{streakDays} hr</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 text-xs font-medium">
              <FireIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="tabular-nums">0</span>
            </span>
          )}

          {/* Menu Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              aria-label={`Opsi untuk ${habit.nama}`}
              aria-expanded={showMenu}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            >
              <MoreVertIcon className="w-4 h-4" />
            </button>

            {/* Context Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-30 w-36 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 flex flex-col text-xs"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 font-medium transition-colors"
                  >
                    <EditIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ubah</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onToggleArchive();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 font-medium transition-colors"
                  >
                    {habit.archived ? (
                      <>
                        <UnarchiveIcon className="w-3.5 h-3.5 text-teal-600" />
                        <span>Pulihkan</span>
                      </>
                    ) : (
                      <>
                        <ArchiveIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Arsipkan</span>
                      </>
                    )}
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Hapus</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
