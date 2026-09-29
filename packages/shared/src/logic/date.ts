/**
 * Date and time domain utilities for VibeHabit.
 * Handles local date strings (YYYY-MM-DD), day start hour offsets,
 * and calendar arithmetic strictly in local time.
 */

/**
 * Format a Date object to YYYY-MM-DD using local time components.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string into a local midnight Date.
 */
export function parseLocalDate(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get effective local date (YYYY-MM-DD) taking into account custom day start hour offset.
 * e.g. With offset "04:00", 03:30 AM on 2026-09-29 still belongs to 2026-09-28.
 *
 * @param date - Date object, ISO string, or timestamp milliseconds.
 * @param dayStartOffset - Offset in "HH:mm" format (default "00:00").
 */
export function getEffectiveDate(
  date: Date | string | number = new Date(),
  dayStartOffset = '00:00'
): string {
  let d: Date;
  if (date instanceof Date) {
    d = new Date(date.getTime());
  } else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Plain YYYY-MM-DD string: parse as local midnight to avoid UTC timezone shifts
    d = parseLocalDate(date);
  } else {
    d = new Date(date);
  }

  const [hoursStr = '00', minutesStr = '00'] = (dayStartOffset || '00:00').split(':');
  const hours = Number(hoursStr) || 0;
  const minutes = Number(minutesStr) || 0;
  const offsetMs = (hours * 60 + minutes) * 60 * 1000;

  // Subtract offset to align nocturnal hours to the effective day
  const effectiveDate = new Date(d.getTime() - offsetMs);
  return formatLocalDate(effectiveDate);
}

/**
 * Add or subtract days to a YYYY-MM-DD date string.
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

/**
 * Number of days between two YYYY-MM-DD dates (endDate - startDate).
 */
export function daysBetween(startDateStr: string, endDateStr: string): number {
  const d1 = parseLocalDate(startDateStr);
  const d2 = parseLocalDate(endDateStr);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Get ISO 8601 day of week (1 = Monday, 2 = Tuesday, ..., 7 = Sunday).
 */
export function getDayOfWeek(dateStr: string): number {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  return day === 0 ? 7 : day;
}

/**
 * Get Monday (start of week) for a given date in YYYY-MM-DD.
 */
export function getStartOfWeek(dateStr: string): string {
  const dow = getDayOfWeek(dateStr); // 1..7
  return addDays(dateStr, -(dow - 1));
}

/**
 * Get Sunday (end of week) for a given date in YYYY-MM-DD.
 */
export function getEndOfWeek(dateStr: string): string {
  const dow = getDayOfWeek(dateStr);
  return addDays(dateStr, 7 - dow);
}

/**
 * Generate an array of date strings from startDate to endDate inclusive.
 */
export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const range: string[] = [];
  if (startDateStr > endDateStr) {
    return range;
  }

  let current = startDateStr;
  while (current <= endDateStr) {
    range.push(current);
    current = addDays(current, 1);
  }
  return range;
}
