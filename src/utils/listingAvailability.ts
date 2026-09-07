import { Listing } from '../types';

export interface AvailabilityWindow {
  /** 0 = Sunday ... 6 = Saturday, matches Date#getDay(). */
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Shortest slot worth showing someone. A spot that closes eight minutes into
 * the window they asked for is noise in the results, not a booking.
 */
export const MIN_BOOKABLE_MINUTES = 30;

function parseHHmm(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

/** The listing's own opening hours, or null on an axis it doesn't declare. */
function openingHours(listing: Listing): { from: number | null; until: number | null } {
  return {
    from: listing.availableFrom ? parseHHmm(listing.availableFrom) : null,
    until: listing.availableUntil ? parseHHmm(listing.availableUntil) : null,
  };
}

/**
 * The part of `window` this listing can actually take, or null if none of it.
 *
 * This is what makes partial booking work. Asking for 4–6pm at a spot open
 * 2–5pm used to return nothing at all, because the old check demanded the
 * requested window fit *entirely* inside the opening hours. Now it returns
 * 4–5pm: the overlap is a perfectly good booking, and hiding the spot
 * outright was the app deciding on the renter's behalf that an hour is no use
 * to them.
 *
 * Returns null when the overlap is shorter than `MIN_BOOKABLE_MINUTES`, when
 * the day is excluded, or when there is no overlap at all.
 *
 * A listing that declares no hours is unrestricted on that axis and gets the
 * requested window back unchanged.
 */
export function getAvailableOverlap(
  listing: Listing,
  window: AvailabilityWindow
): { startMinutes: number; endMinutes: number } | null {
  if (listing.availableDays && !listing.availableDays.includes(window.dayOfWeek)) {
    return null;
  }

  const { from, until } = openingHours(listing);
  const startMinutes = Math.max(window.startMinutes, from ?? window.startMinutes);
  const endMinutes = Math.min(window.endMinutes, until ?? window.endMinutes);

  // An instant search is a point in time, not a span — `startMinutes` and
  // `endMinutes` are equal. There is nothing to trim, only to include or not.
  if (window.endMinutes === window.startMinutes) {
    return startMinutes === window.startMinutes && endMinutes === window.endMinutes
      ? { startMinutes, endMinutes }
      : null;
  }

  if (endMinutes - startMinutes < MIN_BOOKABLE_MINUTES) return null;
  return { startMinutes, endMinutes };
}

/** Whether any part of `window` is bookable at this listing. */
export function isListingAvailableForWindow(listing: Listing, window: AvailabilityWindow): boolean {
  return getAvailableOverlap(listing, window) !== null;
}

/**
 * True when the listing can take only part of what was asked for — the case
 * worth telling the renter about, so a shortened booking is never a surprise
 * they discover at the confirmation screen.
 */
export function isPartialMatch(listing: Listing, window: AvailabilityWindow): boolean {
  const overlap = getAvailableOverlap(listing, window);
  if (!overlap) return false;
  return (
    overlap.startMinutes !== window.startMinutes || overlap.endMinutes !== window.endMinutes
  );
}
