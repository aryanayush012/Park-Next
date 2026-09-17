import { dataSource } from '../data/dataSource';
import { Booking } from '../types';

/**
 * An accepted (`booked`) request whose own end time has passed with no
 * check-in — the renter simply never showed up. Distinct from
 * `isRequestExpired` (`responseDeadline.ts`), which is about the *owner*
 * never responding to a still-`pending` request.
 */
export function isNoShow(booking: Booking): boolean {
  return (
    booking.status === 'booked' &&
    !booking.checkInAt &&
    Date.now() > new Date(booking.endTime).getTime()
  );
}

/**
 * Lazily flips a no-show `booked` booking to `no_show` the moment any screen
 * notices — same "whichever side looks at it first performs the transition"
 * pattern as `expireIfOverdue` in `bookingRequest.ts` (there's no
 * server-side cron in this app). Doesn't affect search results either way —
 * `occupied_until` (migration 0020/0022) already stops counting a booking as
 * holding a listing the instant its own end time passes, regardless of
 * whether this has run yet. This is purely about giving the renter an
 * honest "you missed it" message and keeping the owner's dashboard from
 * showing a booking that will never happen.
 *
 * Idempotent and safe to call on a booking that isn't a no-show (returns it
 * unchanged) or that's already been transitioned by the other side
 * (best-effort — swallows the resulting error and returns the booking as
 * passed in, since a fresh read shows the real status either way).
 */
export async function expireIfNoShow(booking: Booking): Promise<Booking> {
  if (!isNoShow(booking)) return booking;
  try {
    return await dataSource.expireNoShowBooking(booking.id);
  } catch {
    return booking;
  }
}
