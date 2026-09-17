import { dataSource } from '../data/dataSource';
import { Booking } from '../types';
import { OVERTIME_CAP_MINUTES } from './overtimeBilling';

/** True once a checked-in booking has run over the overtime cap and should
 * be force-closed rather than left running indefinitely. */
export function isOverOvertimeCap(booking: Booking): boolean {
  if (booking.status !== 'in_progress') return false;
  const overdueMs = Date.now() - new Date(booking.endTime).getTime();
  return overdueMs >= OVERTIME_CAP_MINUTES * 60000;
}

/**
 * Automatically checks a booking out ("squares it off") once it's run over
 * the overtime cap, instead of leaving it running indefinitely. Bills
 * exactly `OVERTIME_CAP_MINUTES` of overtime — `computeOvertimeBilling`'s
 * own cap, inside `DataSource.checkOut` — regardless of how much later than
 * the cap this actually happens to run, so a slow poll can never overcharge
 * someone for a delay that's really the app's own, not theirs.
 *
 * Same lazy, idempotent, "whichever client notices first" pattern as
 * `expireIfOverdue`/`expireIfNoShow`: a no-op if the booking isn't actually
 * over the cap, or if it's already been checked out by the time this runs
 * (both `checkOut` implementations guard on `status === 'in_progress'`, so a
 * second, redundant call from another poll/screen can't double-bill it).
 *
 * Deliberately its own file, not part of `utils/overtimeBilling.ts` — that
 * one is imported BY `data/dataSource.ts` (for the pure billing maths), and
 * this needs to import `dataSource` itself to actually perform the
 * checkout, which would make the two files import each other.
 */
export async function autoCheckoutIfOverLimit(booking: Booking): Promise<Booking> {
  if (!isOverOvertimeCap(booking)) return booking;
  try {
    return await dataSource.checkOut(booking.id);
  } catch (error) {
    // Was a bare silent swallow — indistinguishable from "hasn't fired yet"
    // when it was actually a real, repeating failure (an RLS policy, a bad
    // constraint interaction, anything) with zero trace of why. Logged, not
    // rethrown: the poll calling this treats a failed attempt as "try again
    // next tick" either way, same as every other lazy transition in this app.
    console.warn('[overtimeAutoCheckout] checkOut failed for', booking.id, error);
    return booking;
  }
}
