/**
 * Phone-number handling for the auth flow. Pure functions — no I/O — so the rules
 * that decide whether "Next" is enabled are testable without a device.
 *
 * ASSUMPTION: a curated country list rather than a full libphonenumber dependency.
 * Validation is length-based per country, which is what the reference screen does
 * ("more than 5 digits enables the button") only stricter. Swap in libphonenumber-js
 * if the product ever needs real per-region rules.
 */

export type Country = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** Dial prefix including the plus. */
  dial: string;
  /** Accepted national-number lengths, digits only. */
  lengths: number[];
};

export const COUNTRIES: Country[] = [
  { code: 'BJ', name: 'Benin', dial: '+229', lengths: [8, 10] },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', lengths: [10] },
  { code: 'FR', name: 'France', dial: '+33', lengths: [9] },
  { code: 'BE', name: 'Belgium', dial: '+32', lengths: [9] },
  { code: 'CH', name: 'Switzerland', dial: '+41', lengths: [9] },
  { code: 'CA', name: 'Canada', dial: '+1', lengths: [10] },
  { code: 'US', name: 'United States', dial: '+1', lengths: [10] },
  { code: 'GB', name: 'United Kingdom', dial: '+44', lengths: [10] },
  { code: 'DE', name: 'Germany', dial: '+49', lengths: [10, 11] },
  { code: 'ES', name: 'Spain', dial: '+34', lengths: [9] },
  { code: 'IT', name: 'Italy', dial: '+39', lengths: [9, 10] },
  { code: 'NG', name: 'Nigeria', dial: '+234', lengths: [10] },
  { code: 'SN', name: 'Senegal', dial: '+221', lengths: [9] },
  { code: 'TG', name: 'Togo', dial: '+228', lengths: [8] },
  { code: 'MA', name: 'Morocco', dial: '+212', lengths: [9] },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES.find((c) => c.code === 'BJ') ?? COUNTRIES[0]!;

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((country) => country.code === code);
}

/** Everything that is not a digit, gone. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Strips the national trunk prefix people type out of habit (0 in most of Europe
 * and West Africa) so "06 12 34 56 78" and "612345678" reach the same E.164.
 */
export function normalizeNational(input: string, country: Country): string {
  const digits = digitsOnly(input);
  const withoutDial = digits.startsWith(digitsOnly(country.dial))
    ? digits.slice(digitsOnly(country.dial).length)
    : digits;
  return withoutDial.replace(/^0+/, '');
}

export function isValidNational(input: string, country: Country): boolean {
  return country.lengths.includes(normalizeNational(input, country).length);
}

/** `+22997123456`. The only format that reaches Supabase or the database. */
export function toE164(input: string, country: Country): string {
  return `${country.dial}${normalizeNational(input, country)}`;
}

/**
 * Light grouping for display: pairs for most countries, 3-3-4 for +1. Never used as
 * the value sent anywhere — only what the user sees while typing.
 */
export function formatNational(input: string, country: Country): string {
  const digits = normalizeNational(input, country);
  if (digits.length === 0) return '';

  const groups = country.dial === '+1' ? [3, 3, 4] : null;
  if (groups) {
    const parts: string[] = [];
    let cursor = 0;
    for (const size of groups) {
      if (cursor >= digits.length) break;
      parts.push(digits.slice(cursor, cursor + size));
      cursor += size;
    }
    if (cursor < digits.length) parts.push(digits.slice(cursor));
    return parts.join(' ');
  }

  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/** `+229 97 12 34 56` — for the "we sent a code to…" line on the OTP screen. */
export function formatE164ForDisplay(e164: string): string {
  const country = COUNTRIES.find((c) => e164.startsWith(c.dial));
  if (!country) return e164;
  return `${country.dial} ${formatNational(e164.slice(country.dial.length), country)}`.trim();
}

export const OTP_LENGTH = 6;

export function isCompleteOtp(code: string): boolean {
  return digitsOnly(code).length === OTP_LENGTH;
}

/** Countdown label for the resend control: 42 -> "0:42". */
export function formatResendCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
