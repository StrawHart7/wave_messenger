/**
 * Contact normalisation — pure, no device or network APIs, so the rules that decide
 * which address-book entries are usable stay testable. Anything that touches
 * expo-contacts, crypto or Supabase lives in services/contactSync.ts.
 */
import { digitsOnly, toE164, type Country } from './phone';

export type DeviceContact = {
  name: string;
  e164: string;
};

export type MatchedContact = DeviceContact & {
  userId: string;
  displayName: string;
  avatarPath: string | null;
};

/**
 * Turns whatever the address book holds into E.164, using the user's own country as
 * the assumption for numbers stored in national form. Returns null when the entry
 * cannot be resolved rather than guessing — a wrong country prefix produces a
 * plausible number belonging to a stranger.
 */
export function toE164FromContact(raw: string, homeCountry: Country): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith('+')) {
    const digits = digitsOnly(trimmed);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  // 00 is the other international prefix in wide use.
  if (trimmed.startsWith('00')) {
    const digits = digitsOnly(trimmed).slice(2);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  const digits = digitsOnly(trimmed);
  if (digits.length < 6) return null;

  return toE164(digits, homeCountry);
}

/** Deduplicates by E.164, keeping the first name seen for a number. */
export function dedupeContacts(contacts: DeviceContact[]): DeviceContact[] {
  const seen = new Map<string, DeviceContact>();
  for (const contact of contacts) {
    if (!seen.has(contact.e164)) seen.set(contact.e164, contact);
  }
  return [...seen.values()];
}
