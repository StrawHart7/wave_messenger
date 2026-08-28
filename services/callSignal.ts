import type { RealtimeChannel } from '@supabase/supabase-js';

import type { CallKind } from './calls';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Call signalling over Supabase Realtime broadcast.
 *
 * Broadcast rather than Postgres rows: an SDP offer and a dozen ICE candidates are
 * worthless four seconds later, and writing each one to a table means a row, a WAL
 * entry and a replication hop for data whose entire lifetime is the handshake.
 * The `calls` table still exists — it holds the history, not the negotiation.
 *
 * Two channels, because they answer different questions:
 *  - `wave:user:<id>`  is the callee's doorbell. They are subscribed to it always.
 *  - `wave:call:<id>`  carries the handshake, and exists only for that one call.
 */

export type Invite = {
  callId: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatarPath: string | null;
  kind: CallKind;
  at: number;
};

export type SignalMessage =
  | { type: 'offer'; sdp: string; from: string }
  | { type: 'answer'; sdp: string; from: string }
  | { type: 'ice'; candidate: unknown; from: string }
  | { type: 'accept'; from: string }
  | { type: 'decline'; from: string }
  | { type: 'hangup'; from: string };

/**
 * The doorbell. Subscribed for the whole session, so an invite arrives whatever
 * screen the user is on.
 *
 * It only works while the app is running. An invite to a killed app needs a push
 * notification, which needs a development build and push credentials — see
 * services/callNotifications.ts.
 */
export function subscribeToInvites(
  userId: string,
  handlers: { onInvite: (invite: Invite) => void; onCancel: (callId: string) => void },
): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`wave:user:${userId}`)
    .on('broadcast', { event: 'invite' }, ({ payload }) => handlers.onInvite(payload as Invite))
    .on('broadcast', { event: 'cancel' }, ({ payload }) =>
      handlers.onCancel((payload as { callId: string }).callId),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function sendInvite(calleeId: string, invite: Invite): Promise<void> {
  if (!isSupabaseConfigured) return;

  const channel = supabase.channel(`wave:user:${calleeId}`);
  await channel.subscribe();
  await channel.send({ type: 'broadcast', event: 'invite', payload: invite });
  void supabase.removeChannel(channel);
}

export async function cancelInvite(calleeId: string, callId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const channel = supabase.channel(`wave:user:${calleeId}`);
  await channel.subscribe();
  await channel.send({ type: 'broadcast', event: 'cancel', payload: { callId } });
  void supabase.removeChannel(channel);
}

export type SignalChannel = {
  send: (message: SignalMessage) => void;
  close: () => void;
};

/**
 * The handshake channel for one call.
 *
 * `self: false` is what stops each peer receiving its own candidates back and
 * feeding them into its own connection, which fails in a way that looks exactly
 * like a network problem.
 */
export function openSignalChannel(
  callId: string,
  selfId: string,
  onMessage: (message: SignalMessage) => void,
): SignalChannel {
  if (!isSupabaseConfigured) {
    return { send: () => {}, close: () => {} };
  }

  const channel: RealtimeChannel = supabase.channel(`wave:call:${callId}`, {
    config: { broadcast: { self: false } },
  });

  const queue: SignalMessage[] = [];
  let ready = false;

  channel
    .on('broadcast', { event: 'signal' }, ({ payload }) => {
      const message = payload as SignalMessage;
      // Belt and braces: `self: false` should already have filtered these.
      if (message.from === selfId) return;
      onMessage(message);
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      ready = true;
      // Anything produced before the channel finished joining. ICE candidates
      // start arriving from the local connection almost immediately, and a
      // dropped one is a call that connects on wifi and not on 4G.
      for (const message of queue.splice(0)) {
        void channel.send({ type: 'broadcast', event: 'signal', payload: message });
      }
    });

  return {
    send: (message) => {
      if (!ready) {
        queue.push(message);
        return;
      }
      void channel.send({ type: 'broadcast', event: 'signal', payload: message });
    },
    close: () => {
      void supabase.removeChannel(channel);
    },
  };
}
