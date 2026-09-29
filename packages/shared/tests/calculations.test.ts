import { describe, it, expect } from 'vitest';
import type { Habit, HabitSchedule, HabitLog } from '../src/types/index.js';
import {
  calculateStreak,
  calculateSuccessRatio,
  isDaySuccessful,
  getActiveScheduleForDate
} from '../src/logic/index.js';

describe('Streak Counter & Success Ratio Calculations (T004 / PRD 7.1–7.5 & 11.2)', () => {
  const habitId = 'habit-uuid-001';
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const nowIso = '2026-09-29T10:00:00.000Z';

  function createHabit(overrides: Partial<Habit> = {}): Habit {
    return {
      id: habitId,
      nama: 'Test Habit',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: nowIso,
      deleted_at: null,
      device_id: 'device-1',
      ...overrides
    };
  }

  function createDailySchedule(overrides: Partial<HabitSchedule> = {}): HabitSchedule {
    return {
      id: 'sched-1',
      habit_id: habitId,
      tipe_frekuensi: 'daily',
      hari_terjadwal: null,
      jumlah_per_minggu: null,
      target: 1,
      effective_from: '2026-09-01',
      updated_at: nowIso,
      deleted_at: null,
      device_id: 'device-1',
      ...overrides
    };
  }

  function createLog(date: string, selesai = true, nilai: number | null = null, deletedAt: string | null = null): HabitLog {
    return {
      id: `log-${date}`,
      habit_id: habitId,
      tanggal: date,
      nilai,
      selesai,
      updated_at: nowIso,
      deleted_at: deletedAt,
      device_id: 'device-1'
    };
  }

  describe('1. Daily Habits (PRD 7.3)', () => {
    it('calculates current and longest streak for consecutive days', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03'),
        createLog('2026-09-04'),
        createLog('2026-09-05')
      ];

      // Today is 2026-09-05, and completed today
      const resultTodayDone = calculateStreak(habit, schedules, logs, '2026-09-05');
      expect(resultTodayDone.currentStreak).toBe(5);
      expect(resultTodayDone.longestStreak).toBe(5);

      // Today is 2026-09-06, uncompleted today does NOT break streak achieved through yesterday
      const resultTodayUncompleted = calculateStreak(habit, schedules, logs, '2026-09-06');
      expect(resultTodayUncompleted.currentStreak).toBe(5);
      expect(resultTodayUncompleted.longestStreak).toBe(5);
    });

    it('resets current streak when a past scheduled day was missed', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];
      // Done Sept 1, 2, 3; Missed Sept 4; Done Sept 5
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03'),
        // 2026-09-04 missed
        createLog('2026-09-05')
      ];

      // Today is 2026-09-05 (done today)
      const res = calculateStreak(habit, schedules, logs, '2026-09-05');
      expect(res.currentStreak).toBe(1); // restarted on Sept 5
      expect(res.longestStreak).toBe(3); // Sept 1, 2, 3
    });

    it('handles brand new habit created today', () => {
      const habit = createHabit({ created_date: '2026-09-29' });
      const schedules = [createDailySchedule({ effective_from: '2026-09-29' })];

      // Uncompleted today
      const resUncompleted = calculateStreak(habit, schedules, [], '2026-09-29');
      expect(resUncompleted.currentStreak).toBe(0);
      expect(resUncompleted.longestStreak).toBe(0);

      // Completed today
      const resCompleted = calculateStreak(habit, schedules, [createLog('2026-09-29')], '2026-09-29');
      expect(resCompleted.currentStreak).toBe(1);
      expect(resCompleted.longestStreak).toBe(1);
    });
  });

  describe('2. Specific Days of Week Habits (PRD 7.3)', () => {
    // 2026-09-21 is Monday (1)
    // 2026-09-22 is Tuesday (2)
    // 2026-09-23 is Wednesday (3)
    // 2026-09-24 is Thursday (4)
    // 2026-09-25 is Friday (5)
    // 2026-09-26 is Saturday (6)
    // 2026-09-27 is Sunday (7)
    const mwfSchedule: HabitSchedule = {
      id: 'sched-mwf',
      habit_id: habitId,
      tipe_frekuensi: 'specific_days',
      hari_terjadwal: [1, 3, 5], // Mon, Wed, Fri
      jumlah_per_minggu: null,
      target: 1,
      effective_from: '2026-09-21',
      updated_at: nowIso,
      deleted_at: null,
      device_id: 'device-1'
    };

    it('skips non-scheduled days without breaking streak', () => {
      const habit = createHabit({ created_date: '2026-09-21' });
      const schedules = [mwfSchedule];
      const logs = [
        createLog('2026-09-21'), // Mon (scheduled) - done
        createLog('2026-09-23'), // Wed (scheduled) - done
        createLog('2026-09-25')  // Fri (scheduled) - done
      ];

      // On Friday (Fri completed)
      const resFri = calculateStreak(habit, schedules, logs, '2026-09-25');
      expect(resFri.currentStreak).toBe(3);
      expect(resFri.longestStreak).toBe(3);

      // On Saturday 2026-09-26 (non-scheduled day)
      const resSat = calculateStreak(habit, schedules, logs, '2026-09-26');
      expect(resSat.currentStreak).toBe(3);
      expect(resSat.longestStreak).toBe(3);

      // On Sunday 2026-09-27 (non-scheduled day)
      const resSun = calculateStreak(habit, schedules, logs, '2026-09-27');
      expect(resSun.currentStreak).toBe(3);
      expect(resSun.longestStreak).toBe(3);

      // On Monday 2026-09-28 morning (uncompleted today does not break streak yet)
      const resMonMorning = calculateStreak(habit, schedules, logs, '2026-09-28');
      expect(resMonMorning.currentStreak).toBe(3);

      // Monday 2026-09-28 completed
      const logsMonDone = [...logs, createLog('2026-09-28')];
      const resMonDone = calculateStreak(habit, schedules, logsMonDone, '2026-09-28');
      expect(resMonDone.currentStreak).toBe(4);
      expect(resMonDone.longestStreak).toBe(4);
    });

    it('breaks streak when a scheduled day was missed in the past', () => {
      const habit = createHabit({ created_date: '2026-09-21' });
      const schedules = [mwfSchedule];
      const logs = [
        createLog('2026-09-21'), // Mon done
        // Wed missed!
        createLog('2026-09-25')  // Fri done
      ];

      // On Saturday 2026-09-26
      const resSat = calculateStreak(habit, schedules, logs, '2026-09-26');
      expect(resSat.currentStreak).toBe(1); // Only Friday
      expect(resSat.longestStreak).toBe(1);
    });
  });

  describe('3. X Times Per Week Habits (PRD 7.3)', () => {
    // Schedule: 3 times per week, weeks starting on Monday
    const xPerWeekSchedule: HabitSchedule = {
      id: 'sched-x-week',
      habit_id: habitId,
      tipe_frekuensi: 'x_per_week',
      hari_terjadwal: null,
      jumlah_per_minggu: 3,
      target: 1,
      effective_from: '2026-09-07', // Monday
      updated_at: nowIso,
      deleted_at: null,
      device_id: 'device-1'
    };

    it('counts streak in weeks when minimum X completions achieved per week', () => {
      const habit = createHabit({ created_date: '2026-09-07' });
      const schedules = [xPerWeekSchedule];

      // Week 1 (2026-09-07 to 2026-09-13): 3 completions
      // Week 2 (2026-09-14 to 2026-09-20): 4 completions
      const logs = [
        // Week 1: Mon, Wed, Fri
        createLog('2026-09-07'),
        createLog('2026-09-09'),
        createLog('2026-09-11'),
        // Week 2: Tue, Thu, Sat, Sun
        createLog('2026-09-15'),
        createLog('2026-09-17'),
        createLog('2026-09-19'),
        createLog('2026-09-20')
      ];

      // During Week 3 on Wednesday 2026-09-23: only 1 completion so far
      // The week is not over yet, so current streak remains 2 weeks!
      const logsWeek3Mid = [...logs, createLog('2026-09-22')];
      const resMidWeek = calculateStreak(habit, schedules, logsWeek3Mid, '2026-09-23');
      expect(resMidWeek.currentStreak).toBe(2);
      expect(resMidWeek.longestStreak).toBe(2);

      // On Friday of Week 3, 3rd completion achieved -> week reaches target X!
      const logsWeek3Met = [
        ...logsWeek3Mid,
        createLog('2026-09-24'),
        createLog('2026-09-25')
      ];
      const resWeek3Met = calculateStreak(habit, schedules, logsWeek3Met, '2026-09-25');
      expect(resWeek3Met.currentStreak).toBe(3);
      expect(resWeek3Met.longestStreak).toBe(3);
    });

    it('breaks weekly streak if a past week failed to meet X', () => {
      const habit = createHabit({ created_date: '2026-09-07' });
      const schedules = [xPerWeekSchedule];

      const logs = [
        // Week 1: met (3)
        createLog('2026-09-07'),
        createLog('2026-09-09'),
        createLog('2026-09-11'),
        // Week 2: only 2 completions (< 3)
        createLog('2026-09-15'),
        createLog('2026-09-17'),
        // Week 3: met (3)
        createLog('2026-09-21'),
        createLog('2026-09-23'),
        createLog('2026-09-25')
      ];

      // On Sunday of Week 3 2026-09-27
      const res = calculateStreak(habit, schedules, logs, '2026-09-27');
      expect(res.currentStreak).toBe(1); // Only Week 3
      expect(res.longestStreak).toBe(1);
    });
  });

  describe('4. Quantitative Habits and Partial Values (PRD 7.2 & 11.2)', () => {
    it('considers day successful only when nilai >= target', () => {
      const habit = createHabit({
        mode: 'quantitative',
        satuan: 'menit'
      });
      const schedules = [
        createDailySchedule({ target: 30 }) // target: 30 minutes
      ];

      // Day 1: 30 minutes (success)
      // Day 2: 15 minutes (partial, NOT success)
      // Day 3: 45 minutes (exceeded, success)
      const logs = [
        createLog('2026-09-01', true, 30),
        createLog('2026-09-02', false, 15),
        createLog('2026-09-03', true, 45)
      ];

      const res = calculateStreak(habit, schedules, logs, '2026-09-03');
      expect(res.currentStreak).toBe(1); // Day 3 only (Day 2 broken)
      expect(res.longestStreak).toBe(1);

      // Verify isDaySuccessful helper directly
      expect(isDaySuccessful(habit, schedules[0]!, logs[0])).toBe(true);
      expect(isDaySuccessful(habit, schedules[0]!, logs[1])).toBe(false);
      expect(isDaySuccessful(habit, schedules[0]!, logs[2])).toBe(true);

      // PRD 7.2: Partial value with selesai: true MUST still be false
      const partialWithSelesaiTrue = createLog('2026-09-04', true, 15);
      expect(isDaySuccessful(habit, schedules[0]!, partialWithSelesaiTrue)).toBe(false);
    });
  });

  describe('5. Past Log Edits & Dynamic Recalculation (PRD 7.3 & 11.2)', () => {
    it('dynamically updates streak when past log is retroactively completed or modified', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];

      // Initially Day 2 was missing
      const initialLogs = [
        createLog('2026-09-01'),
        createLog('2026-09-03')
      ];

      const resBefore = calculateStreak(habit, schedules, initialLogs, '2026-09-03');
      expect(resBefore.currentStreak).toBe(1);
      expect(resBefore.longestStreak).toBe(1);

      // Retroactively insert Day 2
      const updatedLogs = [
        ...initialLogs,
        createLog('2026-09-02')
      ];

      const resAfter = calculateStreak(habit, schedules, updatedLogs, '2026-09-03');
      expect(resAfter.currentStreak).toBe(3);
      expect(resAfter.longestStreak).toBe(3);
    });
  });

  describe('6. Habit Schedule Versions (effective_from) (PRD 7.5 & 11.2)', () => {
    it('smoothly transitions streak across schedule versions', () => {
      const habit = createHabit({ created_date: '2026-09-01' });

      // Version 1: Daily from Sept 1 to Sept 6
      const sched1 = createDailySchedule({
        id: 'sched-v1',
        effective_from: '2026-09-01'
      });

      // Version 2: Specific days [1, 3, 5] (Mon, Wed, Fri) starting Sept 7 (Monday)
      const sched2: HabitSchedule = {
        id: 'sched-v2',
        habit_id: habitId,
        tipe_frekuensi: 'specific_days',
        hari_terjadwal: [1, 3, 5],
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-07',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };

      const schedules = [sched1, sched2];

      // Sept 1 to Sept 6 were completed daily (6 days)
      // Sept 7 (Mon) completed
      // Sept 8 (Tue, non-scheduled) skipped
      // Sept 9 (Wed) completed
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03'),
        createLog('2026-09-04'),
        createLog('2026-09-05'),
        createLog('2026-09-06'),
        createLog('2026-09-07'), // Mon under v2
        createLog('2026-09-09')  // Wed under v2
      ];

      // On Sept 9 (Wed), streak should include all 6 daily days + 2 MWF days = 8
      const res = calculateStreak(habit, schedules, logs, '2026-09-09');
      expect(res.currentStreak).toBe(8);
      expect(res.longestStreak).toBe(8);

      // Verify active schedule resolution
      expect(getActiveScheduleForDate(schedules, '2026-09-05')?.id).toBe('sched-v1');
      expect(getActiveScheduleForDate(schedules, '2026-09-07')?.id).toBe('sched-v2');
      expect(getActiveScheduleForDate(schedules, '2026-09-10')?.id).toBe('sched-v2');
    });
  });

  describe('7. Archived Habits Handling (PRD 7.5 & 11.2)', () => {
    it('computes streak and ratio accurately for archived habits', () => {
      const habit = createHabit({
        created_date: '2026-09-01',
        archived: true
      });
      const schedules = [createDailySchedule()];
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03')
      ];

      const resStreak = calculateStreak(habit, schedules, logs, '2026-09-03');
      expect(resStreak.currentStreak).toBe(3);
      expect(resStreak.longestStreak).toBe(3);

      const resRatio = calculateSuccessRatio(habit, schedules, logs, '2026-09-03');
      expect(resRatio.successfulDays).toBe(3);
      expect(resRatio.scheduledDays).toBe(3);
      expect(resRatio.ratio).toBe(1.0);
    });
  });

  describe('8. Success Ratio Calculation (PRD 7.4 & 11.2)', () => {
    it('calculates ratio for daily habit excluding uncompleted today from denominator', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];

      // Done on Sept 1, 2, 3; Missed Sept 4.
      // Today is Sept 5 (uncompleted).
      // Denominator should count past days (Sept 1, 2, 3, 4 = 4 days).
      // Sept 5 (today, uncompleted) is excluded from denominator.
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03')
      ];

      const resTodayUncompleted = calculateSuccessRatio(habit, schedules, logs, '2026-09-05');
      expect(resTodayUncompleted.scheduledDays).toBe(4);
      expect(resTodayUncompleted.successfulDays).toBe(3);
      expect(resTodayUncompleted.ratio).toBe(0.75); // 3 / 4

      // Now today (Sept 5) is completed -> included in both numerator and denominator!
      const logsTodayDone = [...logs, createLog('2026-09-05')];
      const resTodayDone = calculateSuccessRatio(habit, schedules, logsTodayDone, '2026-09-05');
      expect(resTodayDone.scheduledDays).toBe(5);
      expect(resTodayDone.successfulDays).toBe(4);
      expect(resTodayDone.ratio).toBe(0.8); // 4 / 5
    });

    it('excludes non-scheduled days from ratio denominator', () => {
      // Mon (1), Wed (3), Fri (5) schedule
      const habit = createHabit({ created_date: '2026-09-21' }); // Mon
      const schedules: HabitSchedule[] = [{
        id: 'sched-mwf',
        habit_id: habitId,
        tipe_frekuensi: 'specific_days',
        hari_terjadwal: [1, 3, 5],
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-21',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      }];

      // Completed Mon (Sept 21) and Wed (Sept 23).
      // Today is Sunday Sept 27.
      // Scheduled days in range: Mon (21), Wed (23), Fri (25) = 3 scheduled days.
      // Tue (22), Thu (24), Sat (26), Sun (27) are non-scheduled and excluded.
      const logs = [
        createLog('2026-09-21'),
        createLog('2026-09-23')
      ];

      const res = calculateSuccessRatio(habit, schedules, logs, '2026-09-27');
      expect(res.scheduledDays).toBe(3);
      expect(res.successfulDays).toBe(2);
      expect(res.ratio).toBeCloseTo(2 / 3, 4);
    });

    it('ignores soft-deleted logs with deleted_at set', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];
      const logs = [
        createLog('2026-09-01'),
        createLog('2026-09-02', true, null, '2026-09-02T12:00:00.000Z'), // deleted!
        createLog('2026-09-03')
      ];

      const streakRes = calculateStreak(habit, schedules, logs, '2026-09-03');
      expect(streakRes.currentStreak).toBe(1); // Sept 2 was deleted, so broke streak

      const ratioRes = calculateSuccessRatio(habit, schedules, logs, '2026-09-03');
      expect(ratioRes.successfulDays).toBe(2); // Sept 1 and Sept 3 only
      expect(ratioRes.scheduledDays).toBe(3);
      expect(ratioRes.ratio).toBeCloseTo(2 / 3, 4);
    });
  });

  describe('9. Isolation & Concurrency Resilience', () => {
    it('strictly isolates schedules by habit_id', () => {
      const habitA = createHabit({ id: 'habit-A', created_date: '2026-09-01' });
      const schedA = createDailySchedule({ habit_id: 'habit-A', effective_from: '2026-09-01' });

      // Habit B has an MWF schedule with a LATER effective_from date
      const schedB: HabitSchedule = {
        id: 'sched-B',
        habit_id: 'habit-B',
        tipe_frekuensi: 'specific_days',
        hari_terjadwal: [1, 3, 5],
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-05',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };

      const mixedSchedules = [schedA, schedB];
      const logsA = [
        createLog('2026-09-01'),
        createLog('2026-09-02'),
        createLog('2026-09-03'),
        createLog('2026-09-04'),
        createLog('2026-09-05')
      ].map((l) => ({ ...l, habit_id: 'habit-A' }));

      // SchedB must NOT override SchedA for HabitA
      const streakA = calculateStreak(habitA, mixedSchedules, logsA, '2026-09-05');
      expect(streakA.currentStreak).toBe(5);

      const ratioA = calculateSuccessRatio(habitA, mixedSchedules, logsA, '2026-09-05');
      expect(ratioA.scheduledDays).toBe(5);
      expect(ratioA.successfulDays).toBe(5);
      expect(ratioA.ratio).toBe(1.0);
    });

    it('resolves duplicate uncoalesced logs for the same date using LWW', () => {
      const habit = createHabit({ created_date: '2026-09-01' });
      const schedules = [createDailySchedule()];

      // Two logs for 2026-09-01: older is done=false, newer is done=true
      const logs = [
        {
          id: 'log-older',
          habit_id: habitId,
          tanggal: '2026-09-01',
          nilai: null,
          selesai: false,
          updated_at: '2026-09-01T10:00:00.000Z',
          deleted_at: null,
          device_id: 'device-1'
        },
        {
          id: 'log-newer',
          habit_id: habitId,
          tanggal: '2026-09-01',
          nilai: null,
          selesai: true,
          updated_at: '2026-09-01T11:00:00.000Z',
          deleted_at: null,
          device_id: 'device-1'
        }
      ];

      // Newer log (selesai=true) should win via LWW regardless of order
      const res = calculateStreak(habit, schedules, logs, '2026-09-01');
      expect(res.currentStreak).toBe(1);

      // Reversed array order: newer first, older second
      const resReversed = calculateStreak(habit, schedules, [logs[1]!, logs[0]!], '2026-09-01');
      expect(resReversed.currentStreak).toBe(1);
    });

    it('does not leak pre-creation logs into weekly calculations', () => {
      // Created on Thursday 2026-09-10
      const habit = createHabit({ created_date: '2026-09-10' });
      const schedules: HabitSchedule[] = [{
        id: 'sched-x',
        habit_id: habitId,
        tipe_frekuensi: 'x_per_week',
        hari_terjadwal: null,
        jumlah_per_minggu: 2,
        target: 1,
        effective_from: '2026-09-10',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      }];

      // Rogue log on Monday 2026-09-07 before habit creation
      const logs = [
        createLog('2026-09-07'), // Before created_date!
        createLog('2026-09-11'), // Friday (valid)
        createLog('2026-09-12')  // Saturday (valid)
      ];

      // Only Friday & Saturday should count toward the week's 2 completions
      const streakRes = calculateStreak(habit, schedules, logs, '2026-09-13');
      expect(streakRes.currentStreak).toBe(1);

      // If only rogue log existed, streak must be 0
      const rogueOnlyStreak = calculateStreak(habit, schedules, [createLog('2026-09-07')], '2026-09-13');
      expect(rogueOnlyStreak.currentStreak).toBe(0);
    });
  });
});
