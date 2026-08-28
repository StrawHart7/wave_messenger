/**
 * Opening a one-to-one chat. Network side; the pure list rules are in
 * services/chatList.ts.
 */
import { upsertChat, upsertProfile } from '../db/chats';
import { replaceMembers, setMyRole } from '../db/members';
import { assertSupabaseConfigured, supabase } from './supabase';

async function directChatIdsFor(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('chat_id, chats!inner(kind)')
    .eq('user_id', userId)
    .eq('chats.kind', 'direct');

  if (error) throw error;
  return (data ?? []).map((row) => row.chat_id as string);
}

/**
 * The existing one-to-one chat with someone, or a new one.
 *
 * There is no unique constraint that could express "one direct chat per pair" —
 * membership lives in a separate table — so the lookup is an intersection of both
 * users' direct chats. Losing a race here creates a duplicate chat, which is
 * recoverable; a constraint that blocked group membership would not be.
 */
export async function findOrCreateDirectChat(
  viewerId: string,
  peer: { userId: string; displayName: string; avatarPath: string | null },
): Promise<string> {
  assertSupabaseConfigured();

  const [mine, theirs] = await Promise.all([
    directChatIdsFor(viewerId),
    directChatIdsFor(peer.userId),
  ]);

  const shared = mine.find((chatId) => theirs.includes(chatId));
  const chatId = shared ?? (await createDirectChat(viewerId, peer.userId));

  upsertProfile({
    id: peer.userId,
    displayName: peer.displayName,
    avatarPath: peer.avatarPath,
  });
  upsertChat({
    id: chatId,
    kind: 'direct',
    title: peer.displayName,
    avatarPath: peer.avatarPath,
    createdBy: viewerId,
  });
  replaceMembers(chatId, [
    { userId: viewerId, role: 'admin' },
    { userId: peer.userId, role: 'member' },
  ]);
  setMyRole(chatId, 'admin');

  return chatId;
}

/**
 * The creator seeds themselves as `admin` even in a direct chat, where the role
 * carries no meaning. It is what the RLS insert policy keys off: without it the
 * second insert — the other person — has nothing granting it.
 */
async function createDirectChat(viewerId: string, peerId: string): Promise<string> {
  const { data, error } = await supabase
    .from('chats')
    .insert({ kind: 'direct', created_by: viewerId })
    .select('id')
    .single();
  if (error) throw error;

  const chatId = data.id as string;

  const { error: selfError } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: viewerId, role: 'admin' });
  if (selfError) throw selfError;

  const { error: peerError } = await supabase
    .from('chat_members')
    .insert({ chat_id: chatId, user_id: peerId, role: 'member' });
  if (peerError) throw peerError;

  return chatId;
}
