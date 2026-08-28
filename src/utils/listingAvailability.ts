import { Listing } from '../types';

export interface AvailabilityWindow {
  /** 0 = Sunday ... 6 = Saturday, matches Date#getDay(). */
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Whether a listing is available for a given day-of-week + time window, per
 * its own `availableDays` / `availableFrom` / `availableUntil` fields. A
 * listing that doesn't declare one of these (as several of the sample
 * listings don't) has no restriction on that axis and passes it unchecked —
 * only listings that actually declare a window are filtered by it.
 */
export function isListingAvailableForWindow(listing: Listing, window: AvailabilityWindow): boolean {
  const { dayOfWeek, startMinutes, endMinutes } = window;

  if (listing.availableDays && !listing.availableDays.includes(dayOfWeek)) {
    return false;
  }

  if (listing.availableFrom) {
    const [fromHour, fromMinute] = listing.availableFrom.split(':').map(Number);
    if (startMinutes < fromHour * 60 + fromMinute) return false;
  }

  if (listing.availableUntil) {
    const [untilHour, untilMinute] = listing.availableUntil.split(':').map(Number);
    if (endMinutes > untilHour * 60 + untilMinute) return false;
  }

  return true;
}