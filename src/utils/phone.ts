/**
 * Philippine mobile numbers. The form shows a fixed "+63" and the person types
 * the 10 digits that follow (9XX XXX XXXX).
 */

/** Strips everything but digits and a leading 0 / 63 / +63, keeping at most 10 digits. */
export function normalizePhLocal(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** "9171234567" -> "917 123 4567" (partial input is formatted as far as it goes). */
export function formatPhLocal(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
}

export function isValidPhMobile(digits: string): boolean {
  return /^9\d{9}$/.test(digits);
}

/** "+639171234567", or '' when nothing was entered. */
export function toPhE164(digits: string): string {
  return digits ? `+63${digits}` : '';
}
