import type { RealtimeChannel } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '../supabase';

/**
 * Typing and presence ride a broadcast/presence channel per chat, not the database.
 * Writing "X is typing" to Postgres would produce a row per keystroke and a WAL
 * entry per row for information that is worthless two seconds later.
 */

/** A typing signal expires on its own, so a killed app cannot leave "typing…" stuck. */
export const TYPING_TTL_MS = 5000;
/** Keystrokes are noisy; one broadcast per this window is enough to look live. */
export const TYPING_THROTTLE_MS = 2000;

export type ChatPresence = {
  /** User ids currently typing, already expired-filtered. */
  typing: string[];
  /** User ids present on the channel. */
  online: string[];
};

type TypingEvent = { userId: string; at: number };

export function subscribeToChatPresence(
  chatId: string,
  viewerId: string,
  onChange: (presence: ChatPresence) => void,
): { stop: () => void; setTyping: () => void } {
  if (!isSupabaseConfigured) {
    return { stop: () => {}, setTyping: () => {} };
  }

  const typingAt = new Map<string, number>();
  let lastSent = 0;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  const channel: RealtimeChannel = supabase.channel(`wave:chat:${chatId}`, {
    config: { presence: { key: viewerId } },
  });

  const emit = () => {
    const now = Date.now();
    const typing = [...typingAt.entries()]
      .filter(([, at]) => now - at < TYPING_TTL_MS)
      .map(([userId]) => userId)
      .filter((userId) => userId !== viewerId);

    const online = Object.keys(channel.presenceState());
    onChange({ typing, online });

    // Re-emit when the oldest signal is due to expire, so "typing…" disappears
    // without needing another event to arrive.
    if (expiryTimer) clearTimeout(expiryTimer);
    if (typing.length > 0) expiryTimer = setTimeout(emit, TYPING_TTL_MS);
  };

  channel
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      const event = payload as TypingEvent;
      typingAt.set(event.userId, event.at);
      emit();
    })
    .on('presence', { event: 'sync' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track({ at: Date.now() });
    });

  return {
    stop: () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      void supabase.removeChannel(channel);
    },
    setTyping: () => {
      const now = Date.now();
      if (now - lastSent < TYPING_THROTTLE_MS) return;
      lastSent = now;
      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: viewerId, at: now } satisfies TypingEvent,
      });
    },
  };
}

/** "online" / "typing…" / "last seen today at 14:32" — the header subtitle. */
export function presenceLabel(input: {
  typing: boolean;
  online: boolean;
  lastSeenAt: number | null;
  now?: number;
}): string {
  if (input.typing) return 'typing…';
  if (input.online) return 'online';
  if (input.lastSeenAt === null) return '';

  const now = input.now ?? Date.now();
  const startOfDay = (value: number) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(input.lastSeenAt)) / 86_400_000);
  const time = new Date(input.lastSeenAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (days === 0) return `last seen today at ${time}`;
  if (days === 1) return `last seen yesterday at ${time}`;
  return `last seen ${new Date(input.lastSeenAt).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })}`;
}
