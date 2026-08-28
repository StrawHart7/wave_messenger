/**
 * The message state machine. Pure — no SQLite, no network — because every subtle
 * bug users notice (a tick that goes backwards, a message stuck on the clock, a
 * duplicate after a reconnect) lives here rather than in the UI.
 */

export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type LocalMessage = {
  /** Server id. Null until the insert is acknowledged. */
  id: string | null;
  /** Generated on the device; the join key for reconciliation. */
  clientId: string;
  chatId: string;
  senderId: string;
  kind: 'text' | 'image' | 'video' | 'voice' | 'document' | 'contact' | 'location' | 'sticker' | 'system';
  body: string | null;
  replyToId: string | null;
  /** Milliseconds since epoch. Set optimistically, corrected by the server value. */
  createdAt: number;
  state: DeliveryState;
  /** Attempts made by the outbox so far. */
  attempts: number;
  deletedAt: number | null;
};

/** Ordering of the tick progression; a message never moves left through it. */
const RANK: Record<DeliveryState, number> = {
  failed: -1,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * Receipts arrive out of order over realtime — a read receipt can land before the
 * delivery one. Advancing only forward is what stops the tick flickering blue then
 * grey again.
 */
export function advanceState(current: DeliveryState, next: DeliveryState): DeliveryState {
  if (current === 'failed' && next === 'pending') return 'pending'; // manual retry
  if (next === 'failed') return current === 'read' ? current : 'failed';
  return RANK[next] > RANK[current] ? next : current;
}

/**
 * In a group the ticks reflect the *weakest* member: blue only once everyone has
 * read, one grey tick while anyone is still undelivered. This mirrors WhatsApp and
 * is why the state cannot be stored per-receipt alone.
 */
export function stateFromReceipts(
  receipts: { deliveredAt: number | null; readAt: number | null }[],
  options: { acknowledged: boolean },
): DeliveryState {
  if (!options.acknowledged) return 'pending';
  if (receipts.length === 0) return 'sent';

  if (receipts.every((r) => r.readAt !== null)) return 'read';
  if (receipts.every((r) => r.deliveredAt !== null)) return 'delivered';
  return 'sent';
}

/**
 * Reconciles an optimistic row with the server row that comes back over realtime.
 * Matching is by clientId, never by content or timestamp: two identical messages
 * sent twice are two messages, and the server clock is not the device clock.
 */
export function reconcile(
  local: LocalMessage,
  server: { id: string; createdAt: number; state?: DeliveryState },
): LocalMessage {
  return {
    ...local,
    id: server.id,
    createdAt: server.createdAt,
    state: advanceState(local.state, server.state ?? 'sent'),
    attempts: 0,
  };
}

/**
 * Merges an incoming realtime row into a list. A row already present by server id
 * is updated in place; one that matches a pending local row by clientId replaces it
 * (this is the case that produces duplicates if you get it wrong).
 */
export function mergeIncoming(messages: LocalMessage[], incoming: LocalMessage): LocalMessage[] {
  const byId = incoming.id
    ? messages.findIndex((m) => m.id !== null && m.id === incoming.id)
    : -1;
  if (byId >= 0) {
    const existing = messages[byId]!;
    const merged = { ...existing, ...incoming, state: advanceState(existing.state, incoming.state) };
    return messages.map((m, i) => (i === byId ? merged : m));
  }

  const byClient = messages.findIndex((m) => m.clientId === incoming.clientId);
  if (byClient >= 0) {
    const existing = messages[byClient]!;
    const merged = { ...existing, ...incoming, state: advanceState(existing.state, incoming.state) };
    return messages.map((m, i) => (i === byClient ? merged : m));
  }

  return [...messages, incoming];
}

/** Only the sender sees ticks, and never on a system message. */
export function showsTicks(message: LocalMessage, viewerId: string): boolean {
  return message.senderId === viewerId && message.kind !== 'system';
}

export function isRetryable(message: LocalMessage, maxAttempts = 5): boolean {
  return message.state === 'failed' && message.attempts < maxAttempts;
}

/** Exponential backoff with a ceiling, so a dead network does not spin. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, 60_000);
}
