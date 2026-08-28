/**
 * Reading the device address book and matching it against registered users.
 * Native-module territory — the pure normalisation rules live in services/contacts.ts.
 */
import * as Contacts from 'expo-contacts';

import { upsertProfile } from '../db/chats';
import { hashPhone } from './auth';
import { dedupeContacts, toE164FromContact, type DeviceContact, type MatchedContact } from './contacts';
import { DEFAULT_COUNTRY, findCountry } from './phone';
import { supabase } from './supabase';

export async function readDeviceContacts(homeCountryCode?: string): Promise<DeviceContact[]> {
  const permission = await Contacts.requestPermissionsAsync();
  if (!permission.granted) return [];

  const homeCountry = (homeCountryCode ? findCountry(homeCountryCode) : undefined) ?? DEFAULT_COUNTRY;

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
  });

  const flattened: DeviceContact[] = [];
  for (const contact of data) {
    for (const phone of contact.phoneNumbers ?? []) {
      const e164 = phone.number ? toE164FromContact(phone.number, homeCountry) : null;
      if (e164) flattened.push({ name: contact.name ?? e164, e164 });
    }
  }

  return dedupeContacts(flattened);
}

/**
 * Matches the address book against registered users by sha256 of the number, in
 * chunks so a 2000-contact phone does not build one enormous `in` clause.
 */
export async function matchRegisteredContacts(
  contacts: DeviceContact[],
  chunkSize = 200,
): Promise<MatchedContact[]> {
  const byHash = new Map<string, DeviceContact>();
  for (const contact of contacts) {
    byHash.set(await hashPhone(contact.e164), contact);
  }

  const hashes = [...byHash.keys()];
  const matches: MatchedContact[] = [];

  for (let index = 0; index < hashes.length; index += chunkSize) {
    const chunk = hashes.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_path, phone_hash')
      .in('phone_hash', chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      const contact = byHash.get(row.phone_hash as string);
      if (!contact) continue;
      matches.push({
        ...contact,
        userId: row.id as string,
        // The address-book name wins over the profile name, as it does in WhatsApp.
        displayName: contact.name || (row.display_name as string),
        avatarPath: (row.avatar_path as string | null) ?? null,
      });
    }
  }

  return matches;
}

/**
 * Reads the address book, matches it, and caches the matches locally so the people
 * pickers have something to show without a network call. Returns how many Wave
 * users were found.
 */
export async function syncContacts(homeCountryCode?: string): Promise<number> {
  const contacts = await readDeviceContacts(homeCountryCode);
  if (contacts.length === 0) return 0;

  const matches = await matchRegisteredContacts(contacts);
  for (const match of matches) {
    upsertProfile({
      id: match.userId,
      displayName: match.displayName,
      avatarPath: match.avatarPath,
      phone: match.e164,
    });
  }

  return matches.length;
}
