import React, { useState, useEffect, useMemo } from 'react';
import { addDays, parseLocalDate } from '@vibehabit/shared';
import { ChevronLeftIcon, ChevronRightIcon } from '../common/Icons.js';

export interface DateStripProps {
  selectedDate: string; // YYYY-MM-DD
  todayDate: string;    // YYYY-MM-DD effective today
  onSelectDate: (dateStr: string) => void;
  className?: string;
}

const INDO_DAYS = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

export const DateStrip: React.FC<DateStripProps> = ({
  selectedDate,
  todayDate,
  onSelectDate,
  className = ''
}) => {
  // Center window around todayDate or follow selectedDate when it moves outside
  const [anchorDate, setAnchorDate] = useState<string>(todayDate);

  const isSelectedInWindow = useMemo(() => {
    const minDate = addDays(anchorDate, -2);
    const maxDate = addDays(anchorDate, 2);
    return selectedDate >= minDate && selectedDate <= maxDate;
  }, [anchorDate, selectedDate]);

  useEffect(() => {
    if (!isSelectedInWindow) {
      setAnchorDate(selectedDate);
    }
  }, [isSelectedInWindow, selectedDate]);

  // Generate 5 days centered around anchorDate: -2, -1, 0, +1, +2
  const days = [-2, -1, 0, 1, 2].map((offset) => {
    const dStr = addDays(anchorDate, offset);
    const dateObj = parseLocalDate(dStr);
    const dayOfWeek = INDO_DAYS[dateObj.getDay()] || '';
    const dayNumber = dateObj.getDate();
    return {
      dateStr: dStr,
      dayOfWeek,
      dayNumber,
      isToday: dStr === todayDate,
      isSelected: dStr === selectedDate
    };
  });

  const handlePrev = () => {
    onSelectDate(addDays(selectedDate, -1));
  };

  const handleNext = () => {
    onSelectDate(addDays(selectedDate, 1));
  };

  return (
    <div
      className={`flex items-center justify-between gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm ${className}`}
      role="region"
      aria-label="Pemilih Tanggal"
    >
      {/* Prev Button */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Hari sebelumnya"
        className="w-9 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 active:scale-95 transition-all"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      {/* 5-Day Strip */}
      <div className="flex-1 grid grid-cols-5 gap-1 text-center">
        {days.map((item) => {
          return (
            <button
              key={item.dateStr}
              type="button"
              onClick={() => onSelectDate(item.dateStr)}
              aria-label={`${item.dayOfWeek}, ${item.dayNumber}${item.isToday ? ' (Hari ini)' : ''}`}
              aria-pressed={item.isSelected}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                item.isSelected
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30 font-bold scale-[1.03]'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 active:scale-95'
              }`}
            >
              <span
                className={`text-[10px] font-semibold tracking-wider uppercase leading-none mb-1 ${
                  item.isSelected
                    ? 'text-teal-100'
                    : item.isToday
                    ? 'text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {item.dayOfWeek}
              </span>
              <span className="text-base font-semibold tabular-nums leading-tight">
                {item.dayNumber}
              </span>
              {item.isToday && !item.isSelected && (
                <span className="w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={handleNext}
        aria-label="Hari berikutnya"
        className="w-9 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 active:scale-95 transition-all"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
