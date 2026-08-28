/**
 * Privacy settings and the block list against the server.
 *
 * Nothing here caches a decision. The client stores what the settings *are* so the
 * screens can render them; what they *do* is enforced in 0006_privacy.sql, and this
 * module would be pointless to lie to.
 */
import { replaceBlocked, setBlocked } from '../db/blocks';
import { DEFAULT_PRIVACY, type PrivacyAudience, type PrivacySettings } from './settings';
import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from './supabase';

type PrivacyRow = {
  privacy_last_seen: string;
  privacy_avatar: string;
  privacy_about: string;
  read_receipts_enabled: boolean;
  typing_indicators_enabled: boolean;
};

function audience(value: string): PrivacyAudience {
  return value === 'contacts' || value === 'nobody' ? value : 'everyone';
}

export async function fetchPrivacy(userId: string): Promise<PrivacySettings> {
  if (!isSupabaseConfigured) return DEFAULT_PRIVACY;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'privacy_last_seen, privacy_avatar, privacy_about, read_receipts_enabled, typing_indicators_enabled',
    )
    .eq('id', userId)
    .single();

  if (error) throw error;
  const row = data as PrivacyRow;

  return {
    lastSeen: audience(row.privacy_last_seen),
    avatar: audience(row.privacy_avatar),
    about: audience(row.privacy_about),
    readReceipts: row.read_receipts_enabled,
    typingIndicators: row.typing_indicators_enabled,
  };
}

export async function updatePrivacy(userId: string, patch: Partial<PrivacySettings>): Promise<void> {
  assertSupabaseConfigured();

  const update: Record<string, unknown> = {};
  if (patch.lastSeen) update.privacy_last_seen = patch.lastSeen;
  if (patch.avatar) update.privacy_avatar = patch.avatar;
  if (patch.about) update.privacy_about = patch.about;
  if (patch.readReceipts !== undefined) update.read_receipts_enabled = patch.readReceipts;
  if (patch.typingIndicators !== undefined) update.typing_indicators_enabled = patch.typingIndicators;
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) throw error;
}

/**
 * Editing an existing profile. Separate from `createOrUpdateProfile` in
 * services/auth.ts, which is the onboarding path and requires the phone number —
 * the one field this screen must never be able to change.
 */
export async function updateProfileFields(
  userId: string,
  patch: { displayName?: string; avatarPath?: string | null; about?: string },
): Promise<void> {
  assertSupabaseConfigured();

  const update: Record<string, unknown> = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.avatarPath !== undefined) update.avatar_path = patch.avatarPath;
  if (patch.about !== undefined) update.about = patch.about;
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) throw error;
}

export async function updateAbout(userId: string, about: string): Promise<void> {
  await updateProfileFields(userId, { about });
}

/**
 * Presence, written on foreground and background.
 *
 * The trigger in 0006 refuses to store this at all when the user's own setting is
 * `nobody`, so a client that ignored the setting would still publish nothing.
 */
export async function updatePresence(userId: string, online: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;

  await supabase
    .from('profiles')
    .update({ is_online: online, last_seen_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function pullBlocked(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase.from('blocks').select('blocked_id');
  if (error) throw error;

  replaceBlocked((data ?? []).map((row) => row.blocked_id as string));
}

export async function blockUser(viewerId: string, userId: string): Promise<void> {
  assertSupabaseConfigured();

  // Local first: the row disappearing from the UI is the point, and the server is
  // what makes it true for the other person.
  setBlocked(userId, true);

  const { error } = await supabase.from('blocks').insert({ blocker_id: viewerId, blocked_id: userId });
  if (error && error.code !== '23505') {
    setBlocked(userId, false);
    throw error;
  }
}

export async function unblockUser(viewerId: string, userId: string): Promise<void> {
  assertSupabaseConfigured();
  setBlocked(userId, false);

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', viewerId)
    .eq('blocked_id', userId);

  if (error) {
    setBlocked(userId, true);
    throw error;
  }
}
