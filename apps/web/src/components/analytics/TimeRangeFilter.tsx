import React from 'react';

export type TimeRangeKey = '7d' | '30d' | '90d' | 'year';

export interface TimeRangeOption {
  key: TimeRangeKey;
  label: string;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '90d', label: '90 Hari' },
  { key: 'year', label: 'Tahun Ini' }
];

export interface TimeRangeFilterProps {
  selectedRange: TimeRangeKey;
  onRangeChange: (range: TimeRangeKey) => void;
}

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
  selectedRange,
  onRangeChange
}) => {
  return (
    <div
      role="group"
      aria-label="Filter Rentang Waktu Analitik"
      className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60"
    >
      {TIME_RANGE_OPTIONS.map((option) => {
        const isActive = selectedRange === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onRangeChange(option.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 font-semibold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
