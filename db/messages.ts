import { db, mutate } from './client';
import type { DeliveryState, LocalMessage } from '../services/messageState';
import { advanceState } from '../services/messageState';

type Row = {
  client_id: string;
  id: string | null;
  chat_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  reply_to_id: string | null;
  created_at: number;
  deleted_at: number | null;
  state: string;
  attempts: number;
};

function toMessage(row: Row): LocalMessage {
  return {
    id: row.id,
    clientId: row.client_id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    kind: row.kind as LocalMessage['kind'],
    body: row.body,
    replyToId: row.reply_to_id,
    createdAt: row.created_at,
    state: row.state as DeliveryState,
    attempts: row.attempts,
    deletedAt: row.deleted_at,
  };
}

export const PAGE_SIZE = 40;

/**
 * One page of a conversation, newest first — the order an inverted list wants.
 * `before` is the createdAt of the oldest row already on screen, which keeps
 * pagination stable when new messages arrive at the other end.
 */
export function listMessages(chatId: string, before?: number, limit = PAGE_SIZE): LocalMessage[] {
  const rows = before
    ? db().getAllSync<Row>(
        'select * from messages where chat_id = ? and created_at < ? order by created_at desc limit ?',
        [chatId, before, limit],
      )
    : db().getAllSync<Row>('select * from messages where chat_id = ? order by created_at desc limit ?', [
        chatId,
        limit,
      ]);

  return rows.map(toMessage);
}

export function getMessage(clientId: string): LocalMessage | null {
  const row = db().getFirstSync<Row>('select * from messages where client_id = ?', [clientId]);
  return row ? toMessage(row) : null;
}

/**
 * Inserts or updates by client_id. `insert or replace` would lose the local state
 * of a row the server echoed back, so the update path merges explicitly and never
 * moves the delivery state backwards.
 */
export function upsertMessage(message: LocalMessage): void {
  mutate(() => {
    const existing = db().getFirstSync<Row>('select * from messages where client_id = ?', [message.clientId]);

    if (!existing) {
      db().runSync(
        `insert into messages
           (client_id, id, chat_id, sender_id, kind, body, reply_to_id, created_at, deleted_at, state, attempts, remote)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.clientId,
          message.id,
          message.chatId,
          message.senderId,
          message.kind,
          message.body,
          message.replyToId,
          message.createdAt,
          message.deletedAt,
          message.state,
          message.attempts,
          message.id ? 1 : 0,
        ],
      );
      return;
    }

    const state = advanceState(existing.state as DeliveryState, message.state);
    db().runSync(
      `update messages
          set id = coalesce(?, id),
              body = ?,
              kind = ?,
              reply_to_id = ?,
              created_at = ?,
              deleted_at = ?,
              state = ?,
              attempts = ?
        where client_id = ?`,
      [
        message.id,
        message.body,
        message.kind,
        message.replyToId,
        message.createdAt,
        message.deletedAt,
        state,
        message.attempts,
        message.clientId,
      ],
    );
  });
}

export function setMessageState(clientId: string, state: DeliveryState, attempts?: number): void {
  mutate(() => {
    const existing = db().getFirstSync<Row>('select state, attempts from messages where client_id = ?', [
      clientId,
    ]);
    if (!existing) return;

    db().runSync('update messages set state = ?, attempts = ? where client_id = ?', [
      advanceState(existing.state as DeliveryState, state),
      attempts ?? existing.attempts,
      clientId,
    ]);
  });
}

export function markDeleted(clientId: string, deletedAt: number): void {
  mutate(() => {
    db().runSync('update messages set deleted_at = ?, body = null where client_id = ?', [deletedAt, clientId]);
  });
}

/** Everything the outbox still owes the server, oldest first. */
export function pendingMessages(limit = 50): LocalMessage[] {
  return db()
    .getAllSync<Row>(
      "select * from messages where state in ('pending', 'failed') order by created_at asc limit ?",
      [limit],
    )
    .map(toMessage);
}

export function upsertReceipt(input: {
  messageId: string;
  userId: string;
  deliveredAt: number | null;
  readAt: number | null;
}): void {
  mutate(() => {
    db().runSync(
      `insert into receipts (message_id, user_id, delivered_at, read_at)
       values (?, ?, ?, ?)
       on conflict (message_id, user_id) do update set
         delivered_at = coalesce(excluded.delivered_at, receipts.delivered_at),
         read_at = coalesce(excluded.read_at, receipts.read_at)`,
      [input.messageId, input.userId, input.deliveredAt, input.readAt],
    );
  });
}

export function receiptsFor(messageId: string): { deliveredAt: number | null; readAt: number | null }[] {
  return db()
    .getAllSync<{ delivered_at: number | null; read_at: number | null }>(
      'select delivered_at, read_at from receipts where message_id = ?',
      [messageId],
    )
    .map((row) => ({ deliveredAt: row.delivered_at, readAt: row.read_at }));
}

/** The oldest message the viewer has not read, for the unread divider. */
export function firstUnreadMessageId(chatId: string, viewerId: string): string | null {
  const row = db().getFirstSync<{ id: string }>(
    `select m.id from messages m
       join chats c on c.id = m.chat_id
      where m.chat_id = ? and m.sender_id <> ? and m.created_at > c.last_read_at and m.id is not null
      order by m.created_at asc limit 1`,
    [chatId, viewerId],
  );
  return row?.id ?? null;
}
