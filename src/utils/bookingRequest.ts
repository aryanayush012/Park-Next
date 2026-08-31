import { dataSource } from '../data/dataSource';
import { Booking } from '../types';
import { isRequestExpired } from './responseDeadline';

export * from './responseDeadline';

/**
 * Lazily flips an overdue `pending` request to `expired` the moment any
 * screen notices — there's no server-side cron in this app, so whichever
 * side looks at it first (the renter's own "waiting for approval" screen, or
 * the owner's Booking Requests list) is what actually performs the
 * transition. Idempotent and safe to call on a booking that isn't overdue
 * (returns it unchanged) or that's already been transitioned by the other
 * side (best-effort — swallows the resulting error and returns the booking
 * as passed in, since a fresh read will show the real status either way).
 */
export async function expireIfOverdue(booking: Booking): Promise<Booking> {
  if (!isRequestExpired(booking)) return booking;
  try {
    return await dataSource.expireBookingRequest(booking.id);
  } catch {
    return booking;
  }
}