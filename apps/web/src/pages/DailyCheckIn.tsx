import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Habit, HabitSchedule, HabitLog, Category, Setting } from '@vibehabit/shared';
import { liveQuery } from 'dexie';
import {
  getEffectiveDate,
  getActiveScheduleForDate,
  isDateScheduled,
  calculateStreak,
  generateLogId,
  parseLocalDate
} from '@vibehabit/shared';
import type { VibeHabitDatabase } from '../db/database.js';
import {
  queryHabits,
  queryCategories,
  queryLogsByDate,
  saveHabitLog,
  getSetting
} from '../db/operations.js';
import {
  observeHabits,
  observeCategories,
  observeLogsForDate
} from '../db/hooks.js';
import { DateStrip } from '../components/daily/DateStrip.js';
import { ProgressRing } from '../components/daily/ProgressRing.js';
import { HabitChecklistCard } from '../components/daily/HabitChecklistCard.js';
import { HabitQuantitativeCard } from '../components/daily/HabitQuantitativeCard.js';
import { ChevronDownIcon } from '../components/common/Icons.js';
import { getOrCreateDeviceId } from '../utils/device.js';
import { getCategoryTheme } from '../utils/categories.js';

export interface DailyCheckInProps {
  db: VibeHabitDatabase;
  deviceId?: string;
  initialDate?: string;
}

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const INDO_DAYS_FULL = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

export const DailyCheckIn: React.FC<DailyCheckInProps> = ({
  db,
  deviceId: propDeviceId,
  initialDate
}) => {
  const deviceId = useMemo(() => propDeviceId || getOrCreateDeviceId(), [propDeviceId]);

  // Settings & Effective Date
  const [setting, setSetting] = useState<Setting | null>(null);
  const effectiveToday = useMemo(() => {
    const offset = setting?.jam_mulai_hari || '04:00';
    return getEffectiveDate(new Date(), offset);
  }, [setting]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || effectiveToday);

  // Domain data from Dexie
  const [habits, setHabits] = useState<Habit[]>([]);
  const [schedules, setSchedules] = useState<HabitSchedule[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showUnscheduled, setShowUnscheduled] = useState<boolean>(false);

  // Load Settings
  useEffect(() => {
    getSetting(db)
      .then((s) => {
        if (s) {
          setSetting(s);
          if (!initialDate) {
            setSelectedDate(getEffectiveDate(new Date(), s.jam_mulai_hari));
          }
        }
      })
      .catch((err) => console.warn('Failed to load settings:', err));
  }, [db, initialDate]);

  // Load Habits, Schedules, Categories, Logs
  const loadData = useCallback(async () => {
    try {
      const [fetchedHabits, fetchedCategories, fetchedLogs, fetchedSchedules, fetchedAllLogs] =
        await Promise.all([
          queryHabits(db, false), // active only
          queryCategories(db),
          queryLogsByDate(db, selectedDate),
          db.habit_schedules.filter((s) => !s.deleted_at).toArray(),
          db.logs.filter((l) => !l.deleted_at).toArray()
        ]);

      setHabits(fetchedHabits);
      setCategories(fetchedCategories);
      setLogs(fetchedLogs);
      setSchedules(fetchedSchedules);
      setAllLogs(fetchedAllLogs);
    } catch (err) {
      console.error('Failed to load check-in data from Dexie:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db, selectedDate]);

  useEffect(() => {
    loadData();

    // Live reactive subscription to Dexie IndexedDB changes
    const subHabits = observeHabits(db, false).subscribe({
      next: (val) => setHabits(val),
      error: (err) => console.warn('observeHabits error:', err)
    });
    const subCategories = observeCategories(db).subscribe({
      next: (val) => setCategories(val),
      error: (err) => console.warn('observeCategories error:', err)
    });
    const subSchedules = liveQuery(() =>
      db.habit_schedules.filter((s) => !s.deleted_at).toArray()
    ).subscribe({
      next: (val) => setSchedules(val),
      error: (err) => console.warn('observeSchedules error:', err)
    });
    const subAllLogs = liveQuery(() =>
      db.logs.filter((l) => !l.deleted_at).toArray()
    ).subscribe({
      next: (val) => setAllLogs(val),
      error: (err) => console.warn('observeAllLogs error:', err)
    });
    const subLogs = observeLogsForDate(db, selectedDate).subscribe({
      next: (val) => setLogs(val),
      error: (err) => console.warn('observeLogs error:', err)
    });

    return () => {
      subHabits.unsubscribe();
      subCategories.unsubscribe();
      subSchedules.unsubscribe();
      subAllLogs.unsubscribe();
      subLogs.unsubscribe();
    };
  }, [db, selectedDate, loadData]);

  // Map categories for easy lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.nama);
    }
    return map;
  }, [categories]);

  // Map logs for selected date by habit_id
  const logsByHabitId = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const l of logs) {
      map.set(l.habit_id, l);
    }
    return map;
  }, [logs]);

  // Determine scheduled vs unscheduled habits for selectedDate
  const { scheduledHabits, unscheduledHabits } = useMemo(() => {
    const scheduled: Array<{
      habit: Habit;
      schedule: HabitSchedule;
      log?: HabitLog;
      streak: number;
    }> = [];

    const unscheduled: Array<{
      habit: Habit;
      schedule: HabitSchedule;
      log?: HabitLog;
      streak: number;
    }> = [];

    for (const habit of habits) {
      // Must filter schedules for this specific habit to avoid cross-habit schedule leakage
      const habitScheds = schedules.filter((s) => s.habit_id === habit.id);
      const schedule = getActiveScheduleForDate(habitScheds, selectedDate);
      if (!schedule) continue;

      const log = logsByHabitId.get(habit.id);
      const streak = calculateStreak(habit, habitScheds, allLogs, selectedDate).currentStreak;

      if (isDateScheduled(schedule, selectedDate)) {
        scheduled.push({ habit, schedule, log, streak });
      } else {
        unscheduled.push({ habit, schedule, log, streak });
      }
    }

    return { scheduledHabits: scheduled, unscheduledHabits: unscheduled };
  }, [habits, schedules, selectedDate, logsByHabitId, allLogs]);

  // Group scheduled habits by category for Serene Focus presentation
  const groupedScheduledHabits = useMemo(() => {
    const groups: Array<{
      categoryId: string | null;
      categoryName: string;
      items: typeof scheduledHabits;
      completedCount: number;
      totalCount: number;
    }> = [];

    const map = new Map<string | null, typeof scheduledHabits>();
    for (const item of scheduledHabits) {
      const catId = item.habit.category_id || null;
      if (!map.has(catId)) {
        map.set(catId, []);
      }
      map.get(catId)!.push(item);
    }

    // Add groups in categories defined order
    for (const cat of categories) {
      if (map.has(cat.id)) {
        const items = map.get(cat.id)!;
        const comp = items.filter((it) => {
          if (it.habit.mode === 'checklist') return !!it.log?.selesai;
          return (it.log?.nilai ?? 0) >= (it.schedule.target ?? 1);
        }).length;
        groups.push({
          categoryId: cat.id,
          categoryName: cat.nama,
          items,
          completedCount: comp,
          totalCount: items.length
        });
        map.delete(cat.id);
      }
    }

    // Remaining (e.g. Uncategorized)
    for (const [catId, items] of map.entries()) {
      const catName = catId ? categoryMap.get(catId) || 'Umum' : 'Umum';
      const comp = items.filter((it) => {
        if (it.habit.mode === 'checklist') return !!it.log?.selesai;
        return (it.log?.nilai ?? 0) >= (it.schedule.target ?? 1);
      }).length;
      groups.push({
        categoryId: catId,
        categoryName: catName,
        items,
        completedCount: comp,
        totalCount: items.length
      });
    }

    return groups;
  }, [scheduledHabits, categories, categoryMap]);

  // Progress summary
  const completedCount = useMemo(() => {
    return scheduledHabits.filter((item) => {
      if (item.habit.mode === 'checklist') {
        return !!item.log?.selesai;
      }
      const target = item.schedule.target ?? 1;
      return (item.log?.nilai ?? 0) >= target;
    }).length;
  }, [scheduledHabits]);

  const maxStreak = useMemo(() => {
    return scheduledHabits.reduce((max, item) => Math.max(max, item.streak), 0);
  }, [scheduledHabits]);

  // Instant reactive toggle for checklist habit
  const handleChecklistToggle = async (habit: Habit) => {
    const existingLog = logsByHabitId.get(habit.id);
    const now = new Date().toISOString();
    const newCompleted = !existingLog?.selesai;

    const updatedLog: HabitLog = {
      id: existingLog?.id || generateLogId(habit.id, selectedDate),
      habit_id: habit.id,
      tanggal: selectedDate,
      nilai: null,
      selesai: newCompleted,
      updated_at: now,
      deleted_at: null,
      device_id: deviceId,
      server_seq: existingLog?.server_seq || null
    };

    // Optimistic UI update
    setLogs((prev) => {
      const filtered = prev.filter((l) => l.habit_id !== habit.id);
      return [...filtered, updatedLog];
    });

    setAllLogs((prev) => {
      const filtered = prev.filter((l) => l.id !== updatedLog.id);
      return [...filtered, updatedLog];
    });

    // Save to Dexie & Outbox
    await saveHabitLog(db, updatedLog, deviceId);
  };

  // Instant reactive update for quantitative habit
  const handleQuantitativeUpdate = async (habit: Habit, schedule: HabitSchedule, newValue: number) => {
    const existingLog = logsByHabitId.get(habit.id);
    const now = new Date().toISOString();
    const target = schedule.target ?? 1;
    const isCompleted = newValue >= target;

    const updatedLog: HabitLog = {
      id: existingLog?.id || generateLogId(habit.id, selectedDate),
      habit_id: habit.id,
      tanggal: selectedDate,
      nilai: newValue,
      selesai: isCompleted,
      updated_at: now,
      deleted_at: null,
      device_id: deviceId,
      server_seq: existingLog?.server_seq || null
    };

    // Optimistic UI update
    setLogs((prev) => {
      const filtered = prev.filter((l) => l.habit_id !== habit.id);
      return [...filtered, updatedLog];
    });

    setAllLogs((prev) => {
      const filtered = prev.filter((l) => l.id !== updatedLog.id);
      return [...filtered, updatedLog];
    });

    // Save to Dexie & Outbox
    await saveHabitLog(db, updatedLog, deviceId);
  };

  // Date Header Text
  const formattedDateTitle = useMemo(() => {
    const dateObj = parseLocalDate(selectedDate);
    const dayName = INDO_DAYS_FULL[dateObj.getDay()] || '';
    const dayNum = dateObj.getDate();
    const monthName = INDO_MONTHS[dateObj.getMonth()] || '';
    const year = dateObj.getFullYear();
    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  }, [selectedDate]);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Top Greeting & Selected Date */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">
          {selectedDate === effectiveToday ? 'Hari Ini' : 'Riwayat Catatan'}
        </span>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {formattedDateTitle}
        </h1>
      </div>

      {/* Date Strip */}
      <DateStrip
        selectedDate={selectedDate}
        todayDate={effectiveToday}
        onSelectDate={setSelectedDate}
      />

      {/* Daily Progress Summary Ring */}
      <ProgressRing
        completedCount={completedCount}
        totalCount={scheduledHabits.length}
        activeStreakDays={maxStreak}
      />

      {/* Habits List Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
            Ritual Terjadwal ({scheduledHabits.length})
          </h2>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {completedCount} / {scheduledHabits.length} Siap
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Memuat kebiasaan">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700/50 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : scheduledHabits.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Tidak ada ritual yang dijadwalkan untuk hari ini.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Nikmati waktu istirahat atau buat ritual baru di menu Kelola.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedScheduledHabits.map((group) => {
              const theme = getCategoryTheme(group.categoryName);
              return (
                <div key={group.categoryId || 'uncategorized'} className="space-y-2">
                  {groupedScheduledHabits.length > 1 && (
                    <div className="flex items-center justify-between px-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
                        <span className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                          {group.categoryName}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        {group.completedCount} / {group.totalCount} Siap
                      </span>
                    </div>
                  )}
                  <div className="space-y-2.5">
                    {group.items.map(({ habit, schedule, log, streak }) => {
                      const catName = habit.category_id ? categoryMap.get(habit.category_id) : null;
                      if (habit.mode === 'checklist') {
                        return (
                          <HabitChecklistCard
                            key={habit.id}
                            habit={habit}
                            log={log}
                            categoryName={catName}
                            streakDays={streak}
                            onToggle={() => handleChecklistToggle(habit)}
                          />
                        );
                      }

                      return (
                        <HabitQuantitativeCard
                          key={habit.id}
                          habit={habit}
                          targetValue={schedule.target ?? 1}
                          log={log}
                          categoryName={catName}
                          streakDays={streak}
                          onUpdateValue={(val) => handleQuantitativeUpdate(habit, schedule, val)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Unscheduled Habits Collapsible Section */}
      {unscheduledHabits.length > 0 && (
        <section className="pt-2">
          <button
            type="button"
            onClick={() => setShowUnscheduled(!showUnscheduled)}
            className="w-full flex items-center justify-between py-2 px-1 text-left text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <span className="text-xs font-semibold">
              Tidak dijadwalkan hari ini ({unscheduledHabits.length})
            </span>
            <ChevronDownIcon
              className={`w-4 h-4 transition-transform duration-200 ${
                showUnscheduled ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showUnscheduled && (
            <div className="mt-2 space-y-2">
              {unscheduledHabits.map(({ habit, streak }) => {
                const catName = habit.category_id ? categoryMap.get(habit.category_id) : null;
                return (
                  <article
                    key={habit.id}
                    className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 opacity-75 flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {catName || 'Umum'}
                        </span>
                        <span className="text-[11px] text-slate-400">• Libur hari ini</span>
                      </div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {habit.nama}
                      </h4>
                    </div>

                    {streak > 0 && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        🔥 {streak} hr
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
