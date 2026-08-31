import { Booking, BookingType } from '../types';
import { formatTimeFromISO } from './format';

/**
 * Pure response-deadline math — deliberately has zero dependency on
 * `data/dataSource.ts` (unlike `utils/bookingRequest.ts`, which does need
 * the live `dataSource` singleton for `expireIfOverdue`), specifically so
 * both `MockDataSource` and `SupabaseDataSource` can import
 * `computeResponseDeadline` from here without creating an import cycle back
 * through `data/dataSource.ts` (which constructs whichever data source is
 * active at module load time).
 */

/** How long the owner has to Accept/Decline an instant-booking request. */
export const INSTANT_RESPONSE_WINDOW_MINUTES = 10;
/** Upper bound on how long the owner has to respond to an advance-booking request. */
export const ADVANCE_RESPONSE_WINDOW_MINUTES = 180;
/** Never give an owner less than this to respond, even for an advance
 * booking starting very soon — matches the instant-booking window. */
const MIN_RESPONSE_WINDOW_MINUTES = INSTANT_RESPONSE_WINDOW_MINUTES;
/** Don't let the response deadline land after the booking should already
 * have started — leaves this much buffer before `startTime`. */
const PRE_START_BUFFER_MINUTES = 15;

/**
 * The deadline an owner has to Accept/Decline a new booking request, per the
 * product rule: 10 minutes for an instant booking (the renter is standing at
 * the spot right now), up to 3 hours for an advance one — capped so it never
 * lands after the booking would already have started (an advance booking for
 * 30 minutes from now can't realistically get the full 3-hour window).
 */
export function computeResponseDeadline(
  type: BookingType,
  startTime: string,
  createdAt: Date = new Date()
): string {
  if (type === 'instant') {
    return new Date(createdAt.getTime() + INSTANT_RESPONSE_WINDOW_MINUTES * 60000).toISOString();
  }

  const proposed = createdAt.getTime() + ADVANCE_RESPONSE_WINDOW_MINUTES * 60000;
  const capped = new Date(startTime).getTime() - PRE_START_BUFFER_MINUTES * 60000;
  const floor = createdAt.getTime() + MIN_RESPONSE_WINDOW_MINUTES * 60000;
  return new Date(Math.max(floor, Math.min(proposed, capped))).toISOString();
}

/** Whether a still-`pending` request's response window has passed. */
export function isRequestExpired(booking: Pick<Booking, 'status' | 'responseDeadline'>): boolean {
  return booking.status === 'pending' && Date.now() > new Date(booking.responseDeadline).getTime();
}

/** "by 2:45 PM" / "by 6:30 PM" style label for a response deadline. */
export function formatResponseDeadline(iso: string): string {
  return `by ${formatTimeFromISO(iso)}`;
}