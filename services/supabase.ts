import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { storage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether the app has credentials at all. Every screen can run without them (they
 * show the auth flow and fail on submit with a clear message) so the project stays
 * developable before the Supabase project exists.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Supabase's auth storage contract is the same get/set/remove surface as our driver
 * seam, so the session rides on whatever storage.ts is backed by today.
 */
const authStorage = {
  getItem: (key: string) => storage.get(key),
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
};

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar to parse a session out of.
    detectSessionInUrl: false,
  },
});

/** Throw early and legibly rather than letting an unconfigured client 401. */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}
