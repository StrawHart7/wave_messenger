import * as Crypto from 'expo-crypto';

import { recomputeUnread, upsertChat } from '../../db/chats';
import { pendingMessages, setMessageState, upsertMessage } from '../../db/messages';
import { isRetryable, retryDelayMs, type LocalMessage } from '../messageState';
import { supabase, isSupabaseConfigured } from '../supabase';

/**
 * The outbox: the only path a message takes to the server.
 *
 * Sending writes to SQLite first and returns immediately; the flush loop drains
 * whatever is pending whenever it can. That is what makes the composer feel instant
 * and what makes an app kill mid-send harmless — the row is already durable.
 */

let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function draftMessage(input: {
  chatId: string;
  senderId: string;
  body: string;
  replyToId?: string | null;
  now?: number;
}): LocalMessage {
  return {
    id: null,
    clientId: Crypto.randomUUID(),
    chatId: input.chatId,
    senderId: input.senderId,
    kind: 'text',
    body: input.body,
    replyToId: input.replyToId ?? null,
    createdAt: input.now ?? Date.now(),
    state: 'pending',
    attempts: 0,
    deletedAt: null,
  };
}

/** Writes the optimistic row and kicks the flush. Never awaits the network. */
export function enqueue(message: LocalMessage): LocalMessage {
  upsertMessage(message);
  upsertChat({
    id: message.chatId,
    kind: 'direct',
    title: '',
    lastMessageAt: message.createdAt,
  });
  void flush();
  return message;
}

async function send(message: LocalMessage): Promise<void> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: message.chatId,
      sender_id: message.senderId,
      kind: message.kind,
      body: message.body,
      reply_to_id: message.replyToId,
      client_id: message.clientId,
    })
    .select('id, created_at')
    .single();

  if (error) throw error;

  upsertMessage({
    ...message,
    id: data.id as string,
    createdAt: new Date(data.created_at as string).getTime(),
    state: 'sent',
    attempts: 0,
  });
}

/**
 * Drains the queue once. Concurrent calls collapse into the running one, so a burst
 * of sends does not start a burst of loops.
 */
export async function flush(): Promise<void> {
  if (flushing || !isSupabaseConfigured) return;
  flushing = true;

  try {
    const queue = pendingMessages();
    let failed = 0;

    for (const message of queue) {
      try {
        await send(message);
      } catch {
        failed += 1;
        const attempts = message.attempts + 1;
        setMessageState(message.clientId, 'failed', attempts);
        // One dead network fails every queued message the same way; stop after the
        // first rather than hammering the connection with the whole backlog.
        break;
      }
    }

    if (failed > 0) scheduleRetry(queue[0]?.attempts ?? 0);
  } finally {
    flushing = false;
  }
}

function scheduleRetry(attempts: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, retryDelayMs(attempts));
}

/** Manual retry from a failed bubble. */
export function retry(message: LocalMessage): void {
  if (!isRetryable(message)) return;
  setMessageState(message.clientId, 'pending', message.attempts);
  void flush();
}

/** Call on app start: anything left pending from a previous run goes out now. */
export function resumeOutbox(viewerId: string): void {
  for (const message of pendingMessages()) {
    recomputeUnread(message.chatId, viewerId);
  }
  void flush();
}

/** Test seam. */
export function stopOutbox(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  flushing = false;
}
