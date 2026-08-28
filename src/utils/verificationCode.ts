/**
 * Generates a 4-digit numeric arrival-verification code, e.g. "0482".
 * Shown to the renter on the Active Booking screen and entered by the
 * owner on Booking Detail to confirm arrival and auto-start the booking.
 * Zero-padded so it always reads as exactly 4 digits.
 */
export function generateVerificationCode(): string {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }