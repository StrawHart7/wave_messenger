import * as Crypto from 'expo-crypto';

import { assertSupabaseConfigured, supabase } from './supabase';

export type Profile = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  about: string | null;
};

/**
 * Contact matching compares sha256 of the E.164 number, so the address book never
 * leaves the device in plaintext. The same hash is stored on the profile row at
 * sign-up, which is what makes the comparison possible at all.
 */
export async function hashPhone(e164: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164);
}

export async function sendOtp(e164: string): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  if (error) throw error;
}

/** Returns the profile if one already exists — the caller uses that to decide
 * whether to route to profile setup or straight into the app. */
export async function verifyOtp(e164: string, token: string): Promise<Profile | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token, type: 'sms' });
  if (error) throw error;
  if (!data.user) throw new Error('Verification succeeded but returned no user.');

  return fetchProfile(data.user.id);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path, about')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // A row with an empty name is a half-finished sign-up, not a usable profile.
  if (!data.display_name) return null;

  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarPath: (data.avatar_path as string | null) ?? null,
    about: (data.about as string | null) ?? null,
  };
}

export async function createOrUpdateProfile(input: {
  userId: string;
  e164: string;
  displayName: string;
  avatarPath?: string | null;
}): Promise<Profile> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: input.userId,
        phone: input.e164,
        phone_hash: await hashPhone(input.e164),
        display_name: input.displayName.trim(),
        avatar_path: input.avatarPath ?? null,
      },
      { onConflict: 'id' },
    )
    .select('id, display_name, avatar_path, about')
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarPath: (data.avatar_path as string | null) ?? null,
    about: (data.about as string | null) ?? null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
