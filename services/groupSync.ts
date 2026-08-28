/**
 * Group membership against the server. Native and network territory — the rules
 * that decide who may do what are pure and live in services/groups.ts.
 *
 * Two things are deliberately *not* here:
 *  - System messages ("Anna added David"). A Postgres trigger writes them, so they
 *    are identical for everyone and still appear for the person being removed, who
 *    by definition is no longer running any code that could have written them.
 *  - Optimistic membership. A membership change the server refuses would otherwise
 *    show as applied and silently roll back on the next sync; the round trip here
 *    is a hundred milliseconds against a screen nobody types into.
 */
import { upsertChat, upsertProfile } from '../db/chats';
import { replaceMembers, setMyRole } from '../db/members';
import { BUCKETS, uploadLocalObject } from './media';
import { normalizeSubject, type MemberRole } from './groups';
import { assertSupabaseConfigured, supabase } from './supabase';

type MemberRowFromServer = {
  user_id: string;
  role: string;
  joined_at: string;
  public_profiles: {
    id: string;
    display_name: string;
    avatar_path: string | null;
    about: string | null;
    last_seen_at: string | null;
    is_online: boolean | null;
  } | null;
};

function roleOf(value: string): MemberRole {
  return value === 'admin' ? 'admin' : 'member';
}

/**
 * Creates the group and seeds its membership, the creator first.
 *
 * The order matters and is enforced by RLS: the creator inserts themselves as admin
 * while `created_by` still grants them the right to, and every insert after that
 * passes because they are now an admin. Adding someone else first would lock the
 * creator out of their own group.
 */
export async function createGroup(input: {
  creatorId: string;
  subject: string;
  memberIds: string[];
  iconPath?: string | null;
}): Promise<string> {
  assertSupabaseConfigured();
  const subject = normalizeSubject(input.subject);

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({
      kind: 'group',
      subject,
      icon_path: input.iconPath ?? null,
      created_by: input.creatorId,
    })
    .select('id, created_at')
    .single();

  if (error) throw error;
  const chatId = chat.id as string;

  const { error: selfError } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: input.creatorId, role: 'admin' });
  if (selfError) throw selfError;

  if (input.memberIds.length > 0) {
    const { error: membersError } = await supabase.from('chat_members').insert(
      input.memberIds.map((userId) => ({ chat_id: chatId, user_id: userId, role: 'member' })),
    );
    if (membersError) throw membersError;
  }

  upsertChat({
    id: chatId,
    kind: 'group',
    title: subject,
    avatarPath: input.iconPath ?? null,
    createdBy: input.creatorId,
    myRole: 'admin',
    lastMessageAt: new Date(chat.created_at as string).getTime(),
  });
  await refreshMembers(chatId, input.creatorId);

  return chatId;
}

/**
 * Pulls the membership and caches the profiles behind it.
 *
 * The join reads `public_profiles`, never `profiles`: a member who hides their
 * avatar or last-seen has it nulled inside the view, so the privacy setting is
 * applied before the row leaves Postgres rather than in the member list here.
 */
export async function refreshMembers(chatId: string, viewerId: string): Promise<void> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id, role, joined_at, public_profiles!inner(id, display_name, avatar_path, about, last_seen_at, is_online)')
    .eq('chat_id', chatId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as MemberRowFromServer[];

  for (const row of rows) {
    const profile = row.public_profiles;
    if (!profile) continue;
    upsertProfile({
      id: profile.id,
      displayName: profile.display_name,
      avatarPath: profile.avatar_path,
      about: profile.about,
      isOnline: profile.is_online === true,
      lastSeenAt: profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : null,
    });
  }

  replaceMembers(
    chatId,
    rows.map((row) => ({
      userId: row.user_id,
      role: roleOf(row.role),
      joinedAt: new Date(row.joined_at).getTime(),
    })),
  );

  const mine = rows.find((row) => row.user_id === viewerId);
  setMyRole(chatId, mine ? roleOf(mine.role) : 'member');
}

export async function addMembers(chatId: string, userIds: string[], viewerId: string): Promise<void> {
  assertSupabaseConfigured();
  if (userIds.length === 0) return;

  const { error } = await supabase
    .from('chat_members')
    .insert(userIds.map((userId) => ({ chat_id: chatId, user_id: userId, role: 'member' })));
  if (error) throw error;

  await refreshMembers(chatId, viewerId);
}

export async function removeMember(chatId: string, userId: string, viewerId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', userId);
  if (error) throw error;

  await refreshMembers(chatId, viewerId);
}

export async function setRole(
  chatId: string,
  userId: string,
  role: MemberRole,
  viewerId: string,
): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from('chat_members')
    .update({ role })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
  if (error) throw error;

  await refreshMembers(chatId, viewerId);
}

/** Leaving is a self-delete, which is why it works even for a demoted admin. */
export async function exitGroup(chatId: string, viewerId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', viewerId);
  if (error) throw error;

  replaceMembers(chatId, []);
}

export async function renameGroup(chatId: string, subject: string): Promise<void> {
  assertSupabaseConfigured();
  const next = normalizeSubject(subject);

  const { error } = await supabase.from('chats').update({ subject: next }).eq('id', chatId);
  if (error) throw error;

  upsertChat({ id: chatId, kind: 'group', title: next });
}

export async function setGroupDescription(chatId: string, description: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.from('chats').update({ description }).eq('id', chatId);
  if (error) throw error;

  upsertChat({ id: chatId, kind: 'group', title: '', description });
}

/**
 * Group icons live in the avatars bucket keyed by *chat* id rather than user id —
 * the object belongs to the group, not to whichever admin last changed it. The
 * matching storage policy is in 0003_groups.sql.
 */
export async function setGroupIcon(chatId: string, localUri: string): Promise<string> {
  assertSupabaseConfigured();

  const extension = localUri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
  const path = `${chatId}/icon-${Date.now()}.${extension}`;
  await uploadLocalObject(BUCKETS.avatars, path, localUri, `image/${extension === 'png' ? 'png' : 'jpeg'}`);

  const { error } = await supabase.from('chats').update({ icon_path: path }).eq('id', chatId);
  if (error) throw error;

  upsertChat({ id: chatId, kind: 'group', title: '', avatarPath: path });
  return path;
}
