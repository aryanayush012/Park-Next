/**
 * Mobile numbers, shared by every screen that collects one — the Profile edit
 * form and `PhoneRequiredDialog`.
 *
 * India only, and strict about it: exactly 10 digits, starting with a real
 * mobile prefix (6–9). Landlines and the 0–5 ranges aren't reachable by SMS
 * or a call from a stranger's handset, which is the number's whole job here.
 *
 * Enforcement is at the keystroke, not just on save — `sanitizePhoneInput` is
 * wired into `onChangeText` at both call sites, so letters and punctuation
 * can't be typed or pasted in and an 11th digit can't be added.
 *
 * Deliberately not `libphonenumber-js`: ~150KB of per-country carrier rules
 * for a field that now accepts exactly one country.
 */

/** 10 subscriber digits, starting with a real Indian mobile prefix. */
const INDIA_MOBILE = /^[6-9]\d{9}$/;

/**
 * The only thing that may reach the input's state: digits, at most 10.
 *
 * A country code is absorbed rather than rejected, so pasting
 * `+91 98765 00009` or `098765 00009` from a contact card leaves the right 10
 * digits instead of a mangled prefix. That only applies past 10 digits, so a
 * genuine number beginning `91…` is left alone.
 */
export function sanitizePhoneInput(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (digits.length > 10) {
    if (digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** True for a number someone could actually be reached on. */
export function isValidPhone(input: string): boolean {
  return INDIA_MOBILE.test(sanitizePhoneInput(input));
}

/**
 * Canonical `+91XXXXXXXXXX` form for storage, so one number is one value in
 * the database however it was typed. Only meaningful for input `isValidPhone`
 * accepts.
 */
export function toE164(input: string): string {
  return `+91${sanitizePhoneInput(input)}`;
}

/** `+91 98765 00009` — for display only, never for storage. */
export function formatPhone(stored: string): string {
  const digits = sanitizePhoneInput(stored);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : stored;
}
