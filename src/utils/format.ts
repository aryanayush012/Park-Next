import { BookingStatus, GeoPoint, ListingStatus } from '../types';

/**
 * Maps a booking's own status onto the 4-variant ListingStatus union
 * StatusBadge understands. `pending` reads closest to `booked` (awaiting
 * confirmation, same accent); `declined`/`cancelled` read as a neutral,
 * closed-out `completed`.
 */
export function bookingStatusToBadgeStatus(status: BookingStatus): ListingStatus {
  if (status === 'pending') return 'booked';
  if (status === 'cancelled' || status === 'declined') return 'completed';
  return status;
}

/** Great-circle distance between two points, in kilometres. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rough driving-time estimate for city traffic — used only for the directions info bar. */
export function estimateDrivingMinutes(distanceKm: number): number {
  const AVG_CITY_SPEED_KMH = 18;
  return Math.max(1, Math.round((distanceKm / AVG_CITY_SPEED_KMH) * 60));
}

export function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

export function formatTimeFromISO(iso: string): string {
  return formatTime(new Date(iso));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today" / "Tomorrow" / "Yesterday" / "3 Aug" style relative date label. */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  if (isSameDay(date, now)) return 'Today';

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Tomorrow';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTimeRange(startIso: string, endIso: string): string {
  return `${formatRelativeDate(startIso)} · ${formatTimeFromISO(startIso)} – ${formatTimeFromISO(
    endIso
  )}`;
}

export function formatDurationHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/** HH:MM:SS elapsed-time readout for the Active Booking timer. */
export function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "HH:mm" 24-hour string from hour/minute numbers, used by the time steppers. */
export function toHHmm(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/** Formats a "HH:mm" 24-hour string as "10:00 AM". */
export function formatHHmm(hhmm: string): string {
  const [hourStr, minuteStr] = hhmm.split(':');
  const date = new Date();
  date.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return formatTime(date);
}

const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/** "Every weekday" / "Every Sat & Sun" / "Every Mon, Wed" style label for a set of weekday indices. */
export function formatWeekdayList(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.every((d, i) => d === WEEKDAYS_MON_FRI[i])) {
    return 'Every weekday';
  }
  if (sorted.length === 2 && sorted[0] === WEEKEND[0] && sorted[1] === WEEKEND[1]) {
    return 'Every Sat & Sun';
  }
  return `Every ${sorted.map((d) => WEEKDAY_LABELS[d]).join(', ')}`;
}

/** "Every weekday, 9:00 AM – 6:00 PM" style summary for a RecurringSchedule. */
export function formatRecurringSchedule(days: number[], startHHmm: string, endHHmm: string): string {
  return `${formatWeekdayList(days)}, ${formatHHmm(startHHmm)} – ${formatHHmm(endHHmm)}`;
}
