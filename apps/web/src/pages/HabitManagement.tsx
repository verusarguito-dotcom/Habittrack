import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Habit, HabitSchedule, Category, HabitLog, HabitMode, FrequencyType } from '@vibehabit/shared';
import { liveQuery } from 'dexie';
import {
  getEffectiveDate,
  getActiveScheduleForDate,
  calculateStreak
} from '@vibehabit/shared';
import type { VibeHabitDatabase } from '../db/database.js';
import {
  queryHabits,
  queryCategories,
  saveHabit,
  saveHabitSchedule,
  deleteHabitCascading,
  getSetting
} from '../db/operations.js';
import { observeHabits, observeCategories } from '../db/hooks.js';
import { HabitCard } from '../components/habits/HabitCard.js';
import { HabitFormModal } from '../components/habits/HabitFormModal.js';
import { DeleteConfirmationModal } from '../components/habits/DeleteConfirmationModal.js';
import { SearchIcon, CloseIcon, PlusIcon, ChevronDownIcon, ArchiveIcon } from '../components/common/Icons.js';
import { getOrCreateDeviceId, generateUuid } from '../utils/device.js';

export interface HabitManagementProps {
  db: VibeHabitDatabase;
  deviceId?: string;
}

export const HabitManagement: React.FC<HabitManagementProps> = ({
  db,
  deviceId: propDeviceId
}) => {
  const deviceId = useMemo(() => propDeviceId || getOrCreateDeviceId(), [propDeviceId]);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [schedules, setSchedules] = useState<HabitSchedule[]>([]);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [dayStartOffset, setDayStartOffset] = useState<string>('04:00');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Habit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const effectiveToday = useMemo(() => {
    return getEffectiveDate(new Date(), dayStartOffset);
  }, [dayStartOffset]);

  // Load Settings for day start offset
  useEffect(() => {
    getSetting(db)
      .then((s) => {
        if (s?.jam_mulai_hari) {
          setDayStartOffset(s.jam_mulai_hari);
        }
      })
      .catch((err) => console.warn('Failed to load settings in habit management:', err));
  }, [db]);

  // Load all habits, schedules, categories, logs
  const loadData = useCallback(async () => {
    try {
      const [fetchedHabits, fetchedCategories, fetchedSchedules, fetchedLogs] = await Promise.all([
        queryHabits(db, true), // include archived
        queryCategories(db),
        db.habit_schedules.filter((s) => !s.deleted_at).toArray(),
        db.logs.filter((l) => !l.deleted_at).toArray()
      ]);

      setHabits(fetchedHabits);
      setCategories(fetchedCategories);
      setSchedules(fetchedSchedules);
      setAllLogs(fetchedLogs);
    } catch (err) {
      console.error('Failed to load habits in management:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadData();

    // Live reactive subscription to Dexie IndexedDB changes
    const subHabits = observeHabits(db, true).subscribe({
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

    return () => {
      subHabits.unsubscribe();
      subCategories.unsubscribe();
      subSchedules.unsubscribe();
      subAllLogs.unsubscribe();
    };
  }, [db, loadData]);

  // Category Map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.nama);
    }
    return map;
  }, [categories]);

  // Split Active vs Archived
  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits]);

  // Filter Active Habits by Search and Category
  const filteredActiveHabits = useMemo(() => {
    return activeHabits.filter((h) => {
      const matchesSearch = h.nama.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCategory =
        selectedCategoryFilter === 'all' || h.category_id === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [activeHabits, searchQuery, selectedCategoryFilter]);

  // Create or Update Habit
  const handleSaveHabit = async (payload: {
    habitData: {
      nama: string;
      category_id: string | null;
      mode: HabitMode;
      satuan: string | null;
    };
    scheduleData: {
      tipe_frekuensi: FrequencyType;
      hari_terjadwal: number[] | null;
      jumlah_per_minggu: number | null;
      target: number | null;
    };
  }) => {
    const now = new Date().toISOString();

    if (editingHabit) {
      // 1. Update Habit
      const updatedHabit: Habit = {
        ...editingHabit,
        ...payload.habitData,
        updated_at: now,
        device_id: deviceId
      };
      await saveHabit(db, updatedHabit, deviceId);

      // 2. Check if schedule changed
      const habitScheds = schedules.filter((s) => s.habit_id === editingHabit.id);
      const currentSched = getActiveScheduleForDate(habitScheds, effectiveToday);
      const isSchedChanged =
        !currentSched ||
        currentSched.tipe_frekuensi !== payload.scheduleData.tipe_frekuensi ||
        currentSched.target !== payload.scheduleData.target ||
        currentSched.jumlah_per_minggu !== payload.scheduleData.jumlah_per_minggu ||
        JSON.stringify(currentSched.hari_terjadwal) !== JSON.stringify(payload.scheduleData.hari_terjadwal);

      if (isSchedChanged) {
        // Create a NEW versioned HabitSchedule with effective_from: effectiveToday (PRD 7.5 & 8.1)
        const newSchedule: HabitSchedule = {
          id: generateUuid(),
          habit_id: editingHabit.id,
          tipe_frekuensi: payload.scheduleData.tipe_frekuensi,
          hari_terjadwal: payload.scheduleData.hari_terjadwal,
          jumlah_per_minggu: payload.scheduleData.jumlah_per_minggu,
          target: payload.scheduleData.target,
          effective_from: effectiveToday,
          updated_at: now,
          deleted_at: null,
          device_id: deviceId
        };
        await saveHabitSchedule(db, newSchedule, deviceId);
      }
    } else {
      // Create Brand New Habit
      const newHabitId = generateUuid();
      const newHabit: Habit = {
        id: newHabitId,
        ...payload.habitData,
        archived: false,
        created_date: effectiveToday,
        updated_at: now,
        deleted_at: null,
        device_id: deviceId
      };
      await saveHabit(db, newHabit, deviceId);

      // Create Initial Habit Schedule
      const newSchedule: HabitSchedule = {
        id: generateUuid(),
        habit_id: newHabitId,
        tipe_frekuensi: payload.scheduleData.tipe_frekuensi,
        hari_terjadwal: payload.scheduleData.hari_terjadwal,
        jumlah_per_minggu: payload.scheduleData.jumlah_per_minggu,
        target: payload.scheduleData.target,
        effective_from: effectiveToday,
        updated_at: now,
        deleted_at: null,
        device_id: deviceId
      };
      await saveHabitSchedule(db, newSchedule, deviceId);
    }

    await loadData();
  };

  // Archive / Unarchive Toggle
  const handleToggleArchive = async (habit: Habit) => {
    const updated: Habit = {
      ...habit,
      archived: !habit.archived,
      updated_at: new Date().toISOString(),
      device_id: deviceId
    };
    await saveHabit(db, updated, deviceId);
    await loadData();
  };

  // Cascading Delete Execution
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteHabitCascading(db, deleteTarget.id, deviceId);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error('Failed to cascade delete habit:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Total logs for deleteTarget
  const deleteTargetLogsCount = useMemo(() => {
    if (!deleteTarget) return 0;
    return allLogs.filter((l) => l.habit_id === deleteTarget.id).length;
  }, [deleteTarget, allLogs]);

  const deleteTargetStreak = useMemo(() => {
    if (!deleteTarget) return 0;
    const targetScheds = schedules.filter((s) => s.habit_id === deleteTarget.id);
    return calculateStreak(deleteTarget, targetScheds, allLogs, effectiveToday).currentStreak;
  }, [deleteTarget, schedules, allLogs, effectiveToday]);

  return (
    <div className="flex flex-col w-full gap-5">
      {/* Header Intro */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Kelola Kebiasaan
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Atur target, jadwal, dan arsip ritual pribadi Anda.
          </p>
        </div>

        {/* Add Habit Button */}
        <button
          type="button"
          onClick={() => {
            setEditingHabit(null);
            setIsFormOpen(true);
          }}
          className="h-10 px-4 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 active:scale-95 shadow-sm shadow-teal-600/30 flex items-center gap-1.5 transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Tambah Habit</span>
        </button>
      </div>

      {/* Search Bar & Category Chips */}
      <section className="flex flex-col gap-3">
        {/* Search Input */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kebiasaan..."
            className="w-full h-11 pl-10 pr-9 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter('all')}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategoryFilter === 'all'
                ? 'bg-teal-600 text-white font-semibold shadow-sm shadow-teal-600/20'
                : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            Semua ({activeHabits.length})
          </button>

          {categories.map((c) => {
            const count = activeHabits.filter((h) => h.category_id === c.id).length;
            const isSelected = selectedCategoryFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(c.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-teal-600 text-white font-semibold shadow-sm shadow-teal-600/20'
                    : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {c.nama} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Habits List */}
      <section className="flex flex-col gap-2.5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700/50 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filteredActiveHabits.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Tidak ada kebiasaan yang cocok.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {searchQuery
                ? 'Coba gunakan kata kunci pencarian yang berbeda.'
                : 'Mulai dengan menambahkan ritual kebiasaan pertama Anda.'}
            </p>
          </div>
        ) : (
          filteredActiveHabits.map((habit) => {
            const habitScheds = schedules.filter((s) => s.habit_id === habit.id);
            const schedule = getActiveScheduleForDate(habitScheds, effectiveToday);
            const catName = habit.category_id ? categoryMap.get(habit.category_id) : null;
            const streak = calculateStreak(habit, habitScheds, allLogs, effectiveToday).currentStreak;

            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                schedule={schedule}
                categoryName={catName}
                streakDays={streak}
                onEdit={() => {
                  setEditingHabit(habit);
                  setIsFormOpen(true);
                }}
                onToggleArchive={() => handleToggleArchive(habit)}
                onDelete={() => setDeleteTarget(habit)}
              />
            );
          })
        )}
      </section>

      {/* Archived Habits Collapsible Accordion */}
      {archivedHabits.length > 0 && (
        <section className="mt-4">
          <div className="bg-slate-100/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-200/50 dark:hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ArchiveIcon className="w-4 h-4 text-slate-500" />
                <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Kebiasaan Diarsipkan ({archivedHabits.length})
                </span>
              </div>
              <ChevronDownIcon
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  showArchived ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showArchived && (
              <div className="p-4 pt-1 flex flex-col gap-2.5 border-t border-slate-200/40 dark:border-slate-700/40">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                  Kebiasaan yang diarsipkan mempertahankan seluruh data histori tanpa membebani hari ini.
                </p>

                {archivedHabits.map((habit) => {
                  const habitScheds = schedules.filter((s) => s.habit_id === habit.id);
                  const schedule = getActiveScheduleForDate(habitScheds, effectiveToday);
                  const catName = habit.category_id ? categoryMap.get(habit.category_id) : null;
                  const streak = calculateStreak(habit, habitScheds, allLogs, effectiveToday).currentStreak;

                  return (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      schedule={schedule}
                      categoryName={catName}
                      streakDays={streak}
                      onEdit={() => {
                        setEditingHabit(habit);
                        setIsFormOpen(true);
                      }}
                      onToggleArchive={() => handleToggleArchive(habit)}
                      onDelete={() => setDeleteTarget(habit)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Create / Edit Habit Modal */}
      <HabitFormModal
        isOpen={isFormOpen}
        habitToEdit={editingHabit}
        currentSchedule={
          editingHabit
            ? getActiveScheduleForDate(
                schedules.filter((s) => s.habit_id === editingHabit.id),
                effectiveToday
              )
            : null
        }
        categories={categories}
        todayDate={effectiveToday}
        onClose={() => {
          setIsFormOpen(false);
          setEditingHabit(null);
        }}
        onSave={handleSaveHabit}
      />

      {/* Cascading Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        habit={deleteTarget}
        totalLogsCount={deleteTargetLogsCount}
        streakDays={deleteTargetStreak}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
