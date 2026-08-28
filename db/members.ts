import { db, mutate } from './client';
import type { GroupMember, MemberRole } from '../services/groups';

type MemberRow = {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_path: string | null;
  about: string | null;
};

/**
 * The membership of one chat, joined against the local profile cache in a single
 * query. A member whose profile has not been cached yet still appears — with an
 * empty name rather than being silently dropped from the count.
 */
export function listMembers(chatId: string): GroupMember[] {
  return db()
    .getAllSync<MemberRow>(
      `select cm.user_id, cm.role, p.display_name, p.avatar_path, p.about
         from chat_members cm
         left join profiles p on p.id = cm.user_id
        where cm.chat_id = ?`,
      [chatId],
    )
    .map((row) => ({
      userId: row.user_id,
      displayName: row.display_name ?? '',
      avatarPath: row.avatar_path,
      about: row.about,
      role: (row.role === 'admin' ? 'admin' : 'member') as MemberRole,
    }));
}

export function memberIds(chatId: string): string[] {
  return db()
    .getAllSync<{ user_id: string }>('select user_id from chat_members where chat_id = ?', [chatId])
    .map((row) => row.user_id);
}

/** The viewer's own role, which is what every permission check in the UI reads. */
export function myRole(chatId: string): MemberRole | null {
  const row = db().getFirstSync<{ my_role: string }>('select my_role from chats where id = ?', [chatId]);
  if (!row) return null;
  return row.my_role === 'admin' ? 'admin' : 'member';
}

export function setMyRole(chatId: string, role: MemberRole): void {
  mutate(() => {
    db().runSync('update chats set my_role = ? where id = ?', [role, chatId]);
  });
}

export function setMemberRole(chatId: string, userId: string, role: MemberRole): void {
  mutate(() => {
    db().runSync('update chat_members set role = ? where chat_id = ? and user_id = ?', [
      role,
      chatId,
      userId,
    ]);
  });
}

export function removeMember(chatId: string, userId: string): void {
  mutate(() => {
    db().runSync('delete from chat_members where chat_id = ? and user_id = ?', [chatId, userId]);
  });
}

/**
 * Replaces the whole membership with what the server just returned. Membership is
 * small and changes rarely, so a wholesale swap is both cheaper to reason about and
 * the only way a removal that happened while the app was closed disappears locally.
 */
export function replaceMembers(
  chatId: string,
  members: { userId: string; role: MemberRole; joinedAt?: number }[],
): void {
  mutate(() => {
    db().runSync('delete from chat_members where chat_id = ?', [chatId]);
    for (const member of members) {
      db().runSync(
        'insert into chat_members (chat_id, user_id, role, joined_at) values (?, ?, ?, ?)',
        [chatId, member.userId, member.role, member.joinedAt ?? 0],
      );
    }
  });
}
