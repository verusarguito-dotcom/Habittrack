import React from 'react';
import { getCategoryTheme } from '../../utils/categories.js';

export interface CategoryStat {
  categoryId: string | null;
  categoryName: string;
  habitCount: number;
  completedLogs: number;
  scheduledOpportunities: number;
  ratio: number; // 0.0 to 1.0
}

export interface CategorySummaryCardsProps {
  categories: CategoryStat[];
}

export const CategorySummaryCards: React.FC<CategorySummaryCardsProps> = ({ categories }) => {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Performa Berdasarkan Kategori
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Distribusi rasio penyelesaian kebiasaan per ranah fokus
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const theme = getCategoryTheme(cat.categoryName);
          const percent = Math.round(cat.ratio * 100);

          return (
            <div
              key={cat.categoryId ?? 'uncategorized'}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor}`} />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {cat.categoryName}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {cat.habitCount} Habit
                </span>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {percent}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {cat.completedLogs} / {cat.scheduledOpportunities} selesai
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-600 dark:bg-teal-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
