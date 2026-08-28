import type { RealtimeChannel } from '@supabase/supabase-js';

import { recomputeUnread } from '../../db/chats';
import { upsertMessage, upsertReceipt } from '../../db/messages';
import type { DeliveryState, LocalMessage } from '../messageState';
import { isSupabaseConfigured, supabase } from '../supabase';

/**
 * Realtime writes into SQLite and stops there. Nothing here touches React state:
 * the screens are already subscribed to the database, so a row landing in SQLite is
 * what makes the UI move. One path in, one path out.
 */

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

type ReceiptRow = {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};

function toLocal(row: MessageRow, viewerId: string): LocalMessage {
  return {
    id: row.id,
    clientId: row.client_id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    kind: row.kind as LocalMessage['kind'],
    body: row.body,
    replyToId: row.reply_to_id,
    createdAt: new Date(row.created_at).getTime(),
    // Our own echo is at least 'sent'; someone else's arrival needs no local state.
    state: (row.sender_id === viewerId ? 'sent' : 'delivered') as DeliveryState,
    attempts: 0,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

/**
 * Subscribes to every chat the viewer belongs to. RLS already restricts the stream
 * to those rows, so there is no per-chat filter to maintain and no leak if the
 * membership changes while subscribed.
 */
export function subscribeToMessages(viewerId: string): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel: RealtimeChannel = supabase
    .channel('wave:messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      const row = (payload.new ?? payload.old) as MessageRow | null;
      if (!row) return;

      upsertMessage(toLocal(row, viewerId));
      recomputeUnread(row.chat_id, viewerId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_receipts' }, (payload) => {
      const row = payload.new as ReceiptRow | null;
      if (!row) return;

      upsertReceipt({
        messageId: row.message_id,
        userId: row.user_id,
        deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : null,
        readAt: row.read_at ? new Date(row.read_at).getTime() : null,
      });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Marks everything from other people in this chat as read, in one statement. Called
 * when the conversation is opened and when it regains focus; the server policy
 * refuses the write outright if the viewer has read receipts disabled, so there is
 * no separate client-side check to keep in step.
 */
export async function sendReadReceipts(chatId: string, viewerId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('chat_id', chatId)
    .neq('sender_id', viewerId)
    .limit(200);

  if (error || !data?.length) return;

  const now = new Date().toISOString();
  await supabase.from('message_receipts').upsert(
    data.map((row) => ({
      message_id: row.id as string,
      user_id: viewerId,
      chat_id: chatId,
      delivered_at: now,
      read_at: now,
    })),
    { onConflict: 'message_id,user_id' },
  );
}
