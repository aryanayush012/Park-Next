import { formatHHmm, toHHmm } from './format';

/** Shared time-picker constants/helpers — used by both the renter's Booking
 * Flow (choosing an exact slot for a specific spot) and the Home/Map search's
 * "when do you need parking?" picker (filtering spots by availability before
 * a specific one is even chosen). Kept in one place so the two stay in sync
 * rather than drifting as separate copies. */

export const TIME_STEP_MINUTES = 30;
export const MIN_MINUTES_OF_DAY = 6 * 60; // 6:00 AM
export const MAX_MINUTES_OF_DAY = 23 * 60; // 11:00 PM
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 12 * 60;

export function clampToStep(value: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

/** `count` consecutive days starting today, each paired with its offset (0 = today). */
export function nextDays(count: number): { offset: number; date: Date }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return { offset, date };
  });
}

/** Minutes-since-midnight -> "10:00 AM" style label. */
export function minutesToTimeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return formatHHmm(toHHmm(hour, minute));
}

/** Minutes -> "1 hr 30 min" / "2 hrs" / "45 min" style label. */
export function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr ${mins} min`;
}