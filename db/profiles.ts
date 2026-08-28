import { db, mutate } from './client';
import type { PickerCandidate } from '../services/groups';

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  about: string | null;
  phone: string | null;
  last_seen_at: number | null;
  is_online: number;
};

export type LocalProfile = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  about: string | null;
  phone: string | null;
  lastSeenAt: number | null;
  isOnline: boolean;
};

function toProfile(row: ProfileRow): LocalProfile {
  return {
    userId: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    about: row.about,
    phone: row.phone,
    lastSeenAt: row.last_seen_at,
    isOnline: row.is_online === 1,
  };
}

export function getProfile(userId: string): LocalProfile | null {
  const row = db().getFirstSync<ProfileRow>('select * from profiles where id = ?', [userId]);
  return row ? toProfile(row) : null;
}

/**
 * Everyone the device knows about — matched contacts and anyone met in a chat.
 * This is what the picker offers, and it is deliberately local: opening "New group"
 * must not wait on a round trip to list people the app already has.
 */
export function listKnownProfiles(excludeIds: string[] = []): PickerCandidate[] {
  return db()
    .getAllSync<ProfileRow>("select * from profiles where display_name <> '' order by display_name")
    .filter((row) => !excludeIds.includes(row.id))
    .map((row) => ({
      userId: row.id,
      displayName: row.display_name,
      avatarPath: row.avatar_path,
      about: row.about,
    }));
}

/** Names for a set of ids, for bubble attribution and typing lines. */
export function displayNames(userIds: string[]): Map<string, LocalProfile> {
  if (userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = db().getAllSync<ProfileRow>(
    `select * from profiles where id in (${placeholders})`,
    userIds,
  );

  return new Map(rows.map((row) => [row.id, toProfile(row)]));
}

export function setProfileAbout(userId: string, about: string | null): void {
  mutate(() => {
    db().runSync('update profiles set about = ? where id = ?', [about, userId]);
  });
}
