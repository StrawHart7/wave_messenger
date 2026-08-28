import { create } from 'zustand';

import type { Invite } from '../services/callSignal';
import type { CallDirection, CallKind, CallStatus } from '../services/calls';
import type { CallSession } from '../services/callSession';

/**
 * The one call that can be on screen at a time.
 *
 * A Zustand store rather than SQLite, unlike almost everything else here: a live
 * call is not durable state. It cannot survive an app kill — the peer connection
 * dies with the process — so persisting it would only ever produce a ghost call to
 * clean up on the next launch. The *history* row is in SQLite; the session is not.
 */

export type ActiveCall = {
  callId: string;
  chatId: string;
  peerId: string;
  peerName: string;
  peerAvatarPath: string | null;
  kind: CallKind;
  direction: CallDirection;
  status: CallStatus;
  startedAt: number;
  answeredAt: number | null;
  muted: boolean;
  cameraEnabled: boolean;
  speaker: boolean;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
};

type CallState = {
  call: ActiveCall | null;
  session: CallSession | null;
  begin: (call: ActiveCall) => void;
  fromInvite: (invite: Invite) => void;
  attachSession: (session: CallSession) => void;
  setStatus: (status: CallStatus) => void;
  patch: (patch: Partial<ActiveCall>) => void;
  end: () => void;
};

export function callFromInvite(invite: Invite): ActiveCall {
  return {
    callId: invite.callId,
    chatId: invite.chatId,
    peerId: invite.callerId,
    peerName: invite.callerName,
    peerAvatarPath: invite.callerAvatarPath,
    kind: invite.kind,
    direction: 'incoming',
    status: 'ringing',
    startedAt: invite.at,
    answeredAt: null,
    muted: false,
    cameraEnabled: invite.kind === 'video',
    speaker: invite.kind === 'video',
    localStreamUrl: null,
    remoteStreamUrl: null,
  };
}

export const useCall = create<CallState>((set, get) => ({
  call: null,
  session: null,

  begin: (call) => set({ call }),

  fromInvite: (invite) => {
    // A second invite while a call is already up is not answerable, and replacing
    // the live one would drop a conversation that is happening.
    if (get().call) return;
    set({ call: callFromInvite(invite) });
  },

  attachSession: (session) => set({ session }),

  setStatus: (status) => {
    const call = get().call;
    if (!call) return;
    set({
      call: {
        ...call,
        status,
        answeredAt: status === 'active' && call.answeredAt === null ? Date.now() : call.answeredAt,
      },
    });
  },

  patch: (patch) => {
    const call = get().call;
    if (!call) return;
    set({ call: { ...call, ...patch } });
  },

  end: () => {
    get().session?.close();
    set({ call: null, session: null });
  },
}));
