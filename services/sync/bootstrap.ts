/**
 * Pulling server state into SQLite.
 *
 * Realtime only carries what happens while the app is connected. Everything that
 * happened before — the chats a fresh install has never seen, the group somebody
 * added you to yesterday — arrives through here. The UI never waits on it: these
 * write into SQLite, and the screens are already subscribed to that.
 */
import { touchChat, upsertChat, upsertProfile } from '../../db/chats';
import { replaceMembers, setMyRole } from '../../db/members';
import { upsertMessage } from '../../db/messages';
import type { MemberRole } from '../groups';
import type { DeliveryState, LocalMessage } from '../messageState';
import { isSupabaseConfigured, supabase } from '../supabase';

type ChatRow = {
  chat_id: string;
  role: string;
  muted_until: string | null;
  pinned: boolean;
  archived: boolean;
  last_read_at: string;
  chats: {
    id: string;
    kind: string;
    subject: string | null;
    description: string | null;
    icon_path: string | null;
    created_by: string;
    last_message_at: string;
  } | null;
};

type MemberRow = {
  chat_id: string;
  user_id: string;
  role: string;
  public_profiles: {
    id: string;
    display_name: string;
    avatar_path: string | null;
    about: string | null;
    last_seen_at: string | null;
    is_online: boolean | null;
    read_receipts_enabled: boolean;
    typing_indicators_enabled: boolean;
  } | null;
};

function roleOf(value: string): MemberRole {
  return value === 'admin' ? 'admin' : 'member';
}

/**
 * Every chat the viewer belongs to, with its membership and the profiles behind it.
 *
 * A direct chat's title is the other person's name, which lives in a joined profile
 * rather than on the chat row — Postgres has no "title" for a two-person chat and
 * inventing one server-side would bake in whichever name the creator saw.
 */
export async function pullChats(viewerId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('chat_members')
    .select(
      'chat_id, role, muted_until, pinned, archived, last_read_at, chats!inner(id, kind, subject, description, icon_path, created_by, last_message_at)',
    )
    .eq('user_id', viewerId);

  if (error) throw error;
  const rows = (data ?? []) as unknown as ChatRow[];
  if (rows.length === 0) return;

  const chatIds = rows.map((row) => row.chat_id);

  const { data: memberData, error: memberError } = await supabase
    .from('chat_members')
    .select('chat_id, user_id, role, public_profiles!inner(id, display_name, avatar_path, about, last_seen_at, is_online, read_receipts_enabled, typing_indicators_enabled)')
    .in('chat_id', chatIds);

  if (memberError) throw memberError;
  const memberRows = (memberData ?? []) as unknown as MemberRow[];

  for (const row of memberRows) {
    const profile = row.public_profiles;
    if (!profile) continue;
    upsertProfile({
      id: profile.id,
      displayName: profile.display_name,
      avatarPath: profile.avatar_path,
      about: profile.about,
      isOnline: profile.is_online === true,
      lastSeenAt: profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : null,
      readReceipts: profile.read_receipts_enabled,
      typingIndicators: profile.typing_indicators_enabled,
    });
  }

  for (const row of rows) {
    const chat = row.chats;
    if (!chat) continue;

    const mine = memberRows.filter((member) => member.chat_id === row.chat_id);
    const peer = mine.find((member) => member.user_id !== viewerId)?.public_profiles ?? null;

    upsertChat({
      id: chat.id,
      kind: chat.kind,
      title: chat.kind === 'group' ? (chat.subject ?? '') : (peer?.display_name ?? ''),
      avatarPath: chat.kind === 'group' ? chat.icon_path : (peer?.avatar_path ?? null),
      description: chat.description,
      createdBy: chat.created_by,
      myRole: roleOf(row.role),
      lastMessageAt: new Date(chat.last_message_at).getTime(),
    });

    replaceMembers(
      chat.id,
      mine.map((member) => ({ userId: member.user_id, role: roleOf(member.role) })),
    );
    setMyRole(chat.id, roleOf(row.role));
  }
}

type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  reply_to_id: string | null;
  client_id: string;
  created_at: string;
  deleted_at: string | null;
};

/**
 * The tail of one conversation. Called when a chat is opened, so a device that has
 * never seen this thread fills in behind whatever SQLite already holds.
 *
 * Incoming rows are upserted by `client_id`, so a message this device sent and
 * already has locally is merged rather than duplicated.
 */
export async function pullMessages(chatId: string, viewerId: string, limit = 40): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('messages')
    .select('id, chat_id, sender_id, kind, body, reply_to_id, client_id, created_at, deleted_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  for (const row of (data ?? []) as MessageRow[]) {
    const message: LocalMessage = {
      id: row.id,
      clientId: row.client_id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      kind: row.kind as LocalMessage['kind'],
      body: row.body,
      replyToId: row.reply_to_id,
      createdAt: new Date(row.created_at).getTime(),
      // A row that came back from the server is at least sent; receipts move it on.
      state: (row.sender_id === viewerId ? 'sent' : 'delivered') as DeliveryState,
      attempts: 0,
      deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    };
    upsertMessage(message);
    touchChat(row.chat_id, message.createdAt);
  }
}
