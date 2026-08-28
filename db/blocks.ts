import { db, mutate } from './client';

/**
 * The local mirror of the block list.
 *
 * Only ever the viewer's own — `blocks` in Postgres is readable by the blocker and
 * nobody else, so there is no other list that could be cached here. That asymmetry
 * is the feature: someone must never be able to learn that they were blocked.
 */
export function listBlocked(): { userId: string; displayName: string; avatarPath: string | null }[] {
  return db()
    .getAllSync<{ user_id: string; display_name: string | null; avatar_path: string | null }>(
      `select b.user_id, p.display_name, p.avatar_path
         from blocks b left join profiles p on p.id = b.user_id
        order by p.display_name`,
    )
    .map((row) => ({
      userId: row.user_id,
      displayName: row.display_name ?? '',
      avatarPath: row.avatar_path,
    }));
}

export function isBlocked(userId: string): boolean {
  return db().getFirstSync<{ user_id: string }>('select user_id from blocks where user_id = ?', [userId]) !== null;
}

export function setBlocked(userId: string, blocked: boolean): void {
  mutate(() => {
    if (blocked) {
      db().runSync('insert or ignore into blocks (user_id, created_at) values (?, ?)', [userId, Date.now()]);
    } else {
      db().runSync('delete from blocks where user_id = ?', [userId]);
    }
  });
}

export function replaceBlocked(userIds: string[]): void {
  mutate(() => {
    db().runSync('delete from blocks');
    for (const userId of userIds) {
      db().runSync('insert or ignore into blocks (user_id, created_at) values (?, ?)', [userId, Date.now()]);
    }
  });
}

/** The peer flags that drive reciprocity for receipts and typing. */
export function peerPrivacy(userId: string): { readReceipts: boolean; typingIndicators: boolean } {
  const row = db().getFirstSync<{ read_receipts_enabled: number; typing_indicators_enabled: number }>(
    'select read_receipts_enabled, typing_indicators_enabled from profiles where id = ?',
    [userId],
  );
  return {
    readReceipts: (row?.read_receipts_enabled ?? 1) === 1,
    typingIndicators: (row?.typing_indicators_enabled ?? 1) === 1,
  };
}
