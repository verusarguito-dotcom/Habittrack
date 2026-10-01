import React, { useState, useEffect } from 'react';
import type { Habit, HabitSchedule, Category, HabitMode, FrequencyType } from '@vibehabit/shared';
import { CloseIcon, CheckIcon } from '../common/Icons.js';

export interface HabitFormModalProps {
  isOpen: boolean;
  habitToEdit?: Habit | null;
  currentSchedule?: HabitSchedule | null;
  categories: Category[];
  todayDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (payload: {
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
  }) => Promise<void>;
}

const WEEKDAYS = [
  { id: 1, label: 'Sen' },
  { id: 2, label: 'Sel' },
  { id: 3, label: 'Rab' },
  { id: 4, label: 'Kam' },
  { id: 5, label: 'Jum' },
  { id: 6, label: 'Sab' },
  { id: 7, label: 'Min' }
];

const COMMON_UNITS = ['menit', 'halaman', 'ml', 'kali'];

export const HabitFormModal: React.FC<HabitFormModalProps> = ({
  isOpen,
  habitToEdit,
  currentSchedule,
  categories,
  onClose,
  onSave
}) => {
  const [nama, setNama] = useState(habitToEdit?.nama || '');
  const [categoryId, setCategoryId] = useState<string | null>(
    habitToEdit !== undefined ? habitToEdit?.category_id ?? null : categories[0]?.id || null
  );
  const [mode, setMode] = useState<HabitMode>(habitToEdit?.mode || 'checklist');
  const [satuan, setSatuan] = useState(habitToEdit?.satuan || 'menit');
  const [target, setTarget] = useState(currentSchedule?.target ?? 30);
  const [tipeFrekuensi, setTipeFrekuensi] = useState<FrequencyType>(currentSchedule?.tipe_frekuensi || 'daily');
  const [hariTerjadwal, setHariTerjadwal] = useState<number[]>(currentSchedule?.hari_terjadwal || [1, 2, 3, 4, 5, 6, 7]);
  const [jumlahPerMinggu, setJumlahPerMinggu] = useState(currentSchedule?.jumlah_per_minggu || 3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when editing or opening
  useEffect(() => {
    if (habitToEdit) {
      setNama(habitToEdit.nama);
      setCategoryId(habitToEdit.category_id);
      setMode(habitToEdit.mode);
      setSatuan(habitToEdit.satuan || 'menit');
      setTarget(currentSchedule?.target ?? 1);
      setTipeFrekuensi(currentSchedule?.tipe_frekuensi || 'daily');
      setHariTerjadwal(currentSchedule?.hari_terjadwal || [1, 2, 3, 4, 5, 6, 7]);
      setJumlahPerMinggu(currentSchedule?.jumlah_per_minggu || 3);
    } else {
      setNama('');
      setCategoryId(categories[0]?.id || null);
      setMode('checklist');
      setSatuan('menit');
      setTarget(30);
      setTipeFrekuensi('daily');
      setHariTerjadwal([1, 2, 3, 4, 5, 6, 7]);
      setJumlahPerMinggu(3);
    }
    setErrorMsg(null);
  }, [habitToEdit, currentSchedule, categories, isOpen]);

  if (!isOpen) return null;

  const toggleDay = (dayId: number) => {
    if (hariTerjadwal.includes(dayId)) {
      if (hariTerjadwal.length === 1) return; // Must have at least 1 day
      setHariTerjadwal(hariTerjadwal.filter((d) => d !== dayId));
    } else {
      setHariTerjadwal([...hariTerjadwal, dayId].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setErrorMsg('Nama habit wajib diisi.');
      return;
    }

    if (mode === 'quantitative' && (!target || target < 1)) {
      setErrorMsg('Target angka minimal 1.');
      return;
    }

    if (tipeFrekuensi === 'specific_days' && hariTerjadwal.length === 0) {
      setErrorMsg('Pilih minimal satu hari dalam sepekan.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        habitData: {
          nama: nama.trim(),
          category_id: categoryId || null,
          mode,
          satuan: mode === 'quantitative' ? satuan.trim() : null
        },
        scheduleData: {
          tipe_frekuensi: tipeFrekuensi,
          hari_terjadwal: tipeFrekuensi === 'specific_days' ? hariTerjadwal : null,
          jumlah_per_minggu: tipeFrekuensi === 'x_per_week' ? jumlahPerMinggu : null,
          target: mode === 'quantitative' ? target : 1
        }
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan kebiasaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            {habitToEdit ? 'Ubah Kebiasaan' : 'Tambah Kebiasaan Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. Nama Habit */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="habit-nama-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nama Habit <span className="text-rose-500">*</span>
            </label>
            <input
              id="habit-nama-input"
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="e.g. Minum Air 2 Liter"
              required
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          {/* 2. Kategori */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="habit-cat-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kategori
            </label>
            <select
              id="habit-cat-select"
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            >
              <option value="">Tanpa Kategori (Umum)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Mode Target */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mode Target
            </label>
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-700/60 gap-1">
              <button
                type="button"
                onClick={() => setMode('checklist')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'checklist'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Checklist
              </button>
              <button
                type="button"
                onClick={() => setMode('quantitative')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'quantitative'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Kuantitatif
              </button>
            </div>
          </div>

          {/* Mode Kuantitatif Inputs */}
          {mode === 'quantitative' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="target-input" className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Target Angka
                  </label>
                  <input
                    id="target-input"
                    type="number"
                    min="1"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value) || 1)}
                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm tabular-nums font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="satuan-input" className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Satuan
                  </label>
                  <input
                    id="satuan-input"
                    type="text"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="menit, ml, hal"
                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Quick Unit Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {COMMON_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSatuan(u)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      satuan === u
                        ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Frekuensi Ritual */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Frekuensi Ritual
            </label>
            <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-700/60 gap-1">
              <button
                type="button"
                onClick={() => setTipeFrekuensi('daily')}
                className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                  tipeFrekuensi === 'daily'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Setiap Hari
              </button>
              <button
                type="button"
                onClick={() => setTipeFrekuensi('specific_days')}
                className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                  tipeFrekuensi === 'specific_days'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Hari Tertentu
              </button>
              <button
                type="button"
                onClick={() => setTipeFrekuensi('x_per_week')}
                className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                  tipeFrekuensi === 'x_per_week'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                X Kali/Minggu
              </button>
            </div>

            {/* Specific Days Weekdays Chips */}
            {tipeFrekuensi === 'specific_days' && (
              <div className="pt-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Pilih hari aktif:
                </span>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d) => {
                    const active = hariTerjadwal.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center ${
                          active
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* X per week Stepper */}
            {tipeFrekuensi === 'x_per_week' && (
              <div className="pt-1.5 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Target penyelesaian sepekan:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJumlahPerMinggu(Math.max(1, jumlahPerMinggu - 1))}
                    disabled={jumlahPerMinggu <= 1}
                    className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white w-8 text-center">
                    {jumlahPerMinggu}x
                  </span>
                  <button
                    type="button"
                    onClick={() => setJumlahPerMinggu(Math.min(7, jumlahPerMinggu + 1))}
                    disabled={jumlahPerMinggu >= 7}
                    className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[1.5] h-11 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 shadow-md shadow-teal-600/30 flex items-center justify-center gap-1.5 transition-all"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Ritual'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
