/**
 * FlowUp Frontend Mobile Number Validation Utility — Admin Frontend
 *
 * Matches backend/src/utils/validateMobile.js.
 * Indian 10-digit mobile numbers. First digit 6–9. Optional +91/91 prefix.
 */

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

export function stripMobile(value: string): string | null {
  let digits = value.trim().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0'))  digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function isValidMobile(value: string): boolean {
  const digits = stripMobile(value);
  return !!digits && INDIAN_MOBILE_RE.test(digits);
}

export function normalizeMobile(value: string): string {
  const digits = stripMobile(value);
  if (!digits || !INDIAN_MOBILE_RE.test(digits)) throw new Error(`Invalid mobile: ${value}`);
  return digits;
}

export const MOBILE_ERROR_MESSAGE =
  'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
