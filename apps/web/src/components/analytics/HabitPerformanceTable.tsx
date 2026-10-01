import React from 'react';
import { FireIcon } from '../common/Icons.js';
import { getCategoryTheme } from '../../utils/categories.js';

export interface HabitPerformanceItem {
  id: string;
  name: string;
  categoryName?: string;
  mode: 'checklist' | 'quantitative';
  satuan?: string | null;
  currentStreak: number;
  longestStreak: number;
  ratio: number; // 0.0 to 1.0
  completedCount: number;
  scheduledCount: number;
}

export interface HabitPerformanceTableProps {
  habits: HabitPerformanceItem[];
}

export const HabitPerformanceTable: React.FC<HabitPerformanceTableProps> = ({ habits }) => {
  if (habits.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-center text-sm text-slate-500">
        Belum ada kebiasaan yang terlacak.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Rincian Performa per Habit
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tinjauan lengkap momentum streak dan persentase kelulusan individu
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              <th className="py-2.5 px-3">Kebiasaan</th>
              <th className="py-2.5 px-3 text-center">Streak Aktif</th>
              <th className="py-2.5 px-3 text-center">Streak Terbaik</th>
              <th className="py-2.5 px-3 text-center">Rasio Periode</th>
              <th className="py-2.5 px-3 text-right">Selesai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {habits.map((item) => {
              const catTheme = getCategoryTheme(item.categoryName);
              const percent = Math.round(item.ratio * 100);

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${catTheme.badgeBg} ${catTheme.badgeText} ${catTheme.badgeBorder}`}
                        >
                          {item.categoryName || 'Tanpa Kategori'}
                        </span>
                        {item.mode === 'quantitative' && item.satuan && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            • {item.satuan}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Current Streak */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                      <FireIcon className="w-3.5 h-3.5" />
                      <span>{item.currentStreak}</span>
                    </div>
                  </td>

                  {/* Longest Streak */}
                  <td className="py-3 px-3 text-center tabular-nums text-slate-600 dark:text-slate-300 font-medium">
                    {item.longestStreak} Hari
                  </td>

                  {/* Ratio in period */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {percent}%
                      </span>
                      <div className="w-12 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="bg-teal-600 dark:bg-teal-400 h-full rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Completed count */}
                  <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium">
                    {item.completedCount} / {item.scheduledCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
