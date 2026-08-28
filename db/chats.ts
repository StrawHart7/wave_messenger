import { db, mutate } from './client';
import type { ChatSummary } from '../services/chatList';
import type { DeliveryState, LocalMessage } from '../services/messageState';

type SummaryRow = {
  id: string;
  kind: string;
  title: string;
  avatar_path: string | null;
  unread_count: number;
  pinned: number;
  archived: number;
  muted_until: number | null;
  last_message_at: number;
  is_online: number | null;
  // Last-message columns, joined in.
  m_client_id: string | null;
  m_id: string | null;
  m_sender_id: string | null;
  m_kind: string | null;
  m_body: string | null;
  m_created_at: number | null;
  m_state: string | null;
  m_deleted_at: number | null;
  sender_name: string | null;
};

/**
 * The whole chat list in one query. The last message is joined rather than fetched
 * per row: a list of 200 chats issuing 200 follow-up queries is the classic way to
 * make a local database feel as slow as a network.
 */
export function listChats(): ChatSummary[] {
  const rows = db().getAllSync<SummaryRow>(`
    select
      c.id, c.kind, c.title, c.avatar_path, c.unread_count, c.pinned, c.archived,
      c.muted_until, c.last_message_at,
      p.is_online,
      m.client_id as m_client_id, m.id as m_id, m.sender_id as m_sender_id, m.kind as m_kind,
      m.body as m_body, m.created_at as m_created_at, m.state as m_state, m.deleted_at as m_deleted_at,
      sender.display_name as sender_name
    from chats c
    left join messages m
      on m.client_id = (
        select client_id from messages where chat_id = c.id order by created_at desc limit 1
      )
    left join profiles sender on sender.id = m.sender_id
    left join profiles p on c.kind = 'direct' and p.id = (
      select user_id from chat_members where chat_id = c.id limit 1
    )
  `);

  return rows.map((row) => {
    const lastMessage: LocalMessage | null = row.m_client_id
      ? {
          id: row.m_id,
          clientId: row.m_client_id,
          chatId: row.id,
          senderId: row.m_sender_id ?? '',
          kind: (row.m_kind ?? 'text') as LocalMessage['kind'],
          body: row.m_body,
          replyToId: null,
          createdAt: row.m_created_at ?? row.last_message_at,
          state: (row.m_state ?? 'sent') as DeliveryState,
          attempts: 0,
          deletedAt: row.m_deleted_at,
        }
      : null;

    return {
      chatId: row.id,
      kind: row.kind as ChatSummary['kind'],
      title: row.title,
      avatarPath: row.avatar_path,
      lastMessage,
      lastSenderName: row.sender_name,
      unreadCount: row.unread_count,
      pinned: row.pinned === 1,
      archived: row.archived === 1,
      mutedUntil: row.muted_until,
      isOnline: row.is_online === 1,
    };
  });
}

export function getChat(chatId: string): ChatSummary | null {
  return listChats().find((chat) => chat.chatId === chatId) ?? null;
}

export function upsertChat(chat: {
  id: string;
  kind: string;
  title: string;
  avatarPath?: string | null;
  description?: string | null;
  createdBy?: string | null;
  myRole?: 'member' | 'admin';
  lastMessageAt?: number;
}): void {
  mutate(() => {
    db().runSync(
      `insert into chats (id, kind, title, avatar_path, description, created_by, my_role, last_message_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         kind = excluded.kind,
         -- The outbox upserts a chat with an empty title when it drains a message
         -- for a chat it has never seen; that must not wipe a real subject.
         title = case when excluded.title = '' then chats.title else excluded.title end,
         avatar_path = coalesce(excluded.avatar_path, chats.avatar_path),
         description = coalesce(excluded.description, chats.description),
         created_by = coalesce(excluded.created_by, chats.created_by),
         my_role = coalesce(excluded.my_role, chats.my_role),
         last_message_at = max(chats.last_message_at, excluded.last_message_at)`,
      [
        chat.id,
        chat.kind,
        chat.title,
        chat.avatarPath ?? null,
        chat.description ?? null,
        chat.createdBy ?? null,
        chat.myRole ?? null,
        chat.lastMessageAt ?? Date.now(),
      ],
    );
  });
}

/**
 * Bumps a chat's sort position, creating a placeholder row if the chat is unknown.
 * Sending must never rewrite `kind` or `title` — the sender knows neither, and a
 * group would be demoted to a direct chat by its own outgoing message.
 */
export function touchChat(chatId: string, at: number): void {
  mutate(() => {
    db().runSync(
      `insert into chats (id, kind, title, last_message_at) values (?, 'direct', '', ?)
       on conflict (id) do update set last_message_at = max(chats.last_message_at, excluded.last_message_at)`,
      [chatId, at],
    );
  });
}

export function upsertProfile(profile: {
  id: string;
  displayName: string;
  avatarPath?: string | null;
  about?: string | null;
  phone?: string | null;
  isOnline?: boolean;
  lastSeenAt?: number | null;
  /** The peer's own privacy toggles, which drive reciprocity locally. */
  readReceipts?: boolean;
  typingIndicators?: boolean;
}): void {
  mutate(() => {
    db().runSync(
      `insert into profiles
         (id, display_name, avatar_path, about, phone, is_online, last_seen_at,
          read_receipts_enabled, typing_indicators_enabled)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         display_name = excluded.display_name,
         avatar_path = coalesce(excluded.avatar_path, profiles.avatar_path),
         -- A null from the server means "hidden by their privacy settings", not
         -- "cleared": keep what we already had rather than blanking the row.
         about = coalesce(excluded.about, profiles.about),
         phone = coalesce(excluded.phone, profiles.phone),
         is_online = excluded.is_online,
         last_seen_at = coalesce(excluded.last_seen_at, profiles.last_seen_at),
         read_receipts_enabled = excluded.read_receipts_enabled,
         typing_indicators_enabled = excluded.typing_indicators_enabled`,
      [
        profile.id,
        profile.displayName,
        profile.avatarPath ?? null,
        profile.about ?? null,
        profile.phone ?? null,
        profile.isOnline ? 1 : 0,
        profile.lastSeenAt ?? null,
        (profile.readReceipts ?? true) ? 1 : 0,
        (profile.typingIndicators ?? true) ? 1 : 0,
      ],
    );
  });
}

export function addMember(chatId: string, userId: string, role: 'member' | 'admin' = 'member'): void {
  mutate(() => {
    db().runSync(
      `insert into chat_members (chat_id, user_id, role) values (?, ?, ?)
       on conflict (chat_id, user_id) do update set role = excluded.role`,
      [chatId, userId, role],
    );
  });
}

/** Recomputes the unread badge from messages rather than incrementing a counter —
 * counters drift the moment a realtime event is missed or replayed. */
export function recomputeUnread(chatId: string, viewerId: string): void {
  mutate(() => {
    db().runSync(
      `update chats set unread_count = (
         select count(*) from messages
          where chat_id = ? and sender_id <> ? and created_at > chats.last_read_at
       ), last_message_at = coalesce((
         select max(created_at) from messages where chat_id = ?
       ), last_message_at)
       where id = ?`,
      [chatId, viewerId, chatId, chatId],
    );
  });
}

export function markChatRead(chatId: string, viewerId: string, at = Date.now()): void {
  mutate(() => {
    db().runSync('update chats set last_read_at = ?, unread_count = 0 where id = ?', [at, chatId]);
  });
  recomputeUnread(chatId, viewerId);
}

export function setChatFlags(
  chatId: string,
  flags: { pinned?: boolean; archived?: boolean; mutedUntil?: number | null },
): void {
  mutate(() => {
    if (flags.pinned !== undefined) {
      db().runSync('update chats set pinned = ? where id = ?', [flags.pinned ? 1 : 0, chatId]);
    }
    if (flags.archived !== undefined) {
      db().runSync('update chats set archived = ? where id = ?', [flags.archived ? 1 : 0, chatId]);
    }
    if (flags.mutedUntil !== undefined) {
      db().runSync('update chats set muted_until = ? where id = ?', [flags.mutedUntil, chatId]);
    }
  });
}

export function markChatUnread(chatId: string): void {
  mutate(() => {
    db().runSync('update chats set unread_count = max(unread_count, 1) where id = ?', [chatId]);
  });
}

export function deleteChat(chatId: string): void {
  mutate(() => {
    db().runSync('delete from messages where chat_id = ?', [chatId]);
    db().runSync('delete from chat_members where chat_id = ?', [chatId]);
    db().runSync('delete from chats where id = ?', [chatId]);
  });
}
