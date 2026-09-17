import { PricingModel } from '../types';

/**
 * Overtime is billed at this multiple of the listing's normal per-hour rate
 * — the cost of staying past the time actually paid for, not just more of
 * the same rate. Applies from the *scheduled* end time (the original booking
 * plus any explicit, renter-chosen extension via `DataSource.extendBooking`)
 * — never from `grace_until` (`DataSource.renewOverdueBooking`), which only
 * protects the slot from being double-booked while someone's still there
 * and carries no price meaning of its own. See migration 0023 for why those
 * two are separate columns.
 */
export const OVERTIME_RATE_MULTIPLIER = 2;

/**
 * How long overtime is allowed to run before the booking is force-closed —
 * see `shouldAutoCheckout` below, the only intended trigger for actually
 * closing it out. Enforced here too (billing itself never charges past this
 * many minutes) so a lagging poll/trigger elsewhere can never overcharge
 * someone for a delay that's really the app's own, not theirs.
 */
export const OVERTIME_CAP_MINUTES = 120;

export interface OvertimeBillingInput {
  pricingModel: PricingModel;
  /** The listing's normal per-hour rate. */
  pricePerHour: number;
  /** ISO timestamp — when the renter actually checked in. */
  checkInAt: string;
  /**
   * ISO timestamp — the *scheduled* end (`booking.endTime`/`bookings.end_at`),
   * i.e. the last moment already paid for at the normal rate. Must NOT be a
   * `grace_until`-inflated value, or every checkout would show zero overtime.
   */
  scheduledEndTime: string;
  /**
   * For `flat` pricing: the flat total as of check-in (already reflects any
   * paid extension). Ignored for `metered`, which is recomputed from elapsed
   * time instead.
   */
  flatTotal: number;
  /** ISO timestamp or ms epoch to bill as of — `Date.now()` for a live
   * running estimate while still checked in, or the real checkout time for
   * the final charge. */
  asOf: string | number;
}

export interface OvertimeBilling {
  /** 0 while still within the scheduled window. */
  overtimeMinutes: number;
  /** 0 while `overtimeMinutes` is 0. */
  overtimeCost: number;
  /** The full amount owed, overtime included. */
  total: number;
}

export function computeOvertimeBilling(input: OvertimeBillingInput): OvertimeBilling {
  const asOfMs = typeof input.asOf === 'string' ? new Date(input.asOf).getTime() : input.asOf;
  const scheduledEndMs = new Date(input.scheduledEndTime).getTime();
  const checkInMs = new Date(input.checkInAt).getTime();

  const overtimeMs = Math.min(
    Math.max(0, asOfMs - scheduledEndMs),
    OVERTIME_CAP_MINUTES * 60000
  );
  const overtimeMinutes = Math.round(overtimeMs / 60000);
  const overtimeCost = Math.round(
    input.pricePerHour * OVERTIME_RATE_MULTIPLIER * (overtimeMs / 3600000)
  );

  if (input.pricingModel === 'metered') {
    // Only the portion up to the scheduled end counts at the normal rate —
    // the overtime portion is billed separately above, at its own rate, not
    // folded into a single elapsed-time * rate figure the way a plain
    // metered calculation normally would be.
    const normalMs = Math.max(0, Math.min(asOfMs, scheduledEndMs) - checkInMs);
    const baseAmount = Math.round(input.pricePerHour * (normalMs / 3600000));
    return { overtimeMinutes, overtimeCost, total: baseAmount + overtimeCost };
  }

  return { overtimeMinutes, overtimeCost, total: input.flatTotal + overtimeCost };
}
