/**
 * The call lifecycle, tying the store, the peer connection, the signalling and the
 * history row together.
 *
 * It lives outside React so that hanging up works from anywhere — a call has to be
 * able to end when the screen that started it is gone.
 */
import * as Crypto from 'expo-crypto';

import { setCallStatus, upsertCall } from '../db/calls';
import { useCall, type ActiveCall } from '../stores/call';
import { cancelInvite, sendInvite, type Invite } from './callSignal';
import { declineCall as sendDecline, startCallSession } from './callSession';
import { createCallRow, updateCallRow } from './callSync';
import { dismissCallNotification } from './callNotifications';
import { outcomeFor, RING_TIMEOUT_MS, type CallKind, type CallStatus } from './calls';
import { isWebrtcAvailable, NO_WEBRTC_MESSAGE } from './webrtc';

let ringTimer: ReturnType<typeof setTimeout> | null = null;

function clearRingTimer(): void {
  if (ringTimer) clearTimeout(ringTimer);
  ringTimer = null;
}

/** Writes the outcome everywhere it has to be recorded, then drops the session. */
function finish(status: CallStatus): void {
  const { call } = useCall.getState();
  clearRingTimer();
  void dismissCallNotification();

  if (call) {
    const endedAt = Date.now();
    setCallStatus(call.callId, status, {
      answeredAt: call.answeredAt ?? undefined,
      endedAt,
    });
    void updateCallRow(call.callId, { status, answeredAt: call.answeredAt ?? undefined, endedAt }).catch(
      () => {},
    );
  }

  useCall.getState().end();
}

/**
 * Places a call: local row first, then the server row, then the invite, then the
 * offer. The local row exists before anything can fail, so a call that never
 * connects still shows in the history as an attempt rather than vanishing.
 */
export async function placeCall(input: {
  selfId: string;
  selfName: string;
  selfAvatarPath: string | null;
  chatId: string;
  peerId: string;
  peerName: string;
  peerAvatarPath: string | null;
  kind: CallKind;
}): Promise<string> {
  if (!isWebrtcAvailable()) throw new Error(NO_WEBRTC_MESSAGE);

  const callId = Crypto.randomUUID();
  const startedAt = Date.now();

  const call: ActiveCall = {
    callId,
    chatId: input.chatId,
    peerId: input.peerId,
    peerName: input.peerName,
    peerAvatarPath: input.peerAvatarPath,
    kind: input.kind,
    direction: 'outgoing',
    status: 'ringing',
    startedAt,
    answeredAt: null,
    muted: false,
    cameraEnabled: input.kind === 'video',
    speaker: input.kind === 'video',
    localStreamUrl: null,
    remoteStreamUrl: null,
  };

  useCall.getState().begin(call);
  upsertCall({ ...call, id: callId });

  void createCallRow({ callId, chatId: input.chatId, initiatorId: input.selfId, kind: input.kind }).catch(
    () => {},
  );

  const invite: Invite = {
    callId,
    chatId: input.chatId,
    callerId: input.selfId,
    callerName: input.selfName,
    callerAvatarPath: input.selfAvatarPath,
    kind: input.kind,
    at: startedAt,
  };

  const session = await startCallSession({
    callId,
    selfId: input.selfId,
    peerId: input.peerId,
    kind: input.kind,
    role: 'caller',
    events: sessionEvents(),
  });

  useCall.getState().attachSession(session);
  await sendInvite(input.peerId, invite);

  // A phone that rings forever is a phone somebody left face-down on a table.
  ringTimer = setTimeout(() => {
    if (useCall.getState().call?.status === 'ringing') {
      void cancelInvite(input.peerId, callId);
      finish(outcomeFor({ answered: false, declined: false, timedOut: true }));
    }
  }, RING_TIMEOUT_MS);

  return callId;
}

/** The callee picking up. The peer connection is only built at this point. */
export async function answerCall(selfId: string): Promise<void> {
  const { call } = useCall.getState();
  if (!call) return;
  if (!isWebrtcAvailable()) throw new Error(NO_WEBRTC_MESSAGE);

  clearRingTimer();
  void dismissCallNotification();

  const session = await startCallSession({
    callId: call.callId,
    selfId,
    peerId: call.peerId,
    kind: call.kind,
    role: 'callee',
    events: sessionEvents(),
  });

  useCall.getState().attachSession(session);
  await session.accept();

  const answeredAt = Date.now();
  useCall.getState().patch({ answeredAt });
  void updateCallRow(call.callId, { status: 'active', answeredAt }).catch(() => {});
}

export function declineIncoming(selfId: string): void {
  const { call } = useCall.getState();
  if (!call) return;

  sendDecline(call.callId, selfId);
  finish('declined');
}

/** Hanging up, from either side and at any stage. */
export function hangUp(): void {
  const { call, session } = useCall.getState();
  if (!call) return;

  session?.hangUp();
  finish(
    outcomeFor({
      answered: call.answeredAt !== null,
      declined: false,
      timedOut: false,
    }),
  );
}

export function toggleMute(): void {
  const { call, session } = useCall.getState();
  if (!call) return;
  const muted = !call.muted;
  session?.setMuted(muted);
  useCall.getState().patch({ muted });
}

export function toggleCamera(): void {
  const { call, session } = useCall.getState();
  if (!call) return;
  const cameraEnabled = !call.cameraEnabled;
  session?.setCameraEnabled(cameraEnabled);
  useCall.getState().patch({ cameraEnabled });
}

export function flipCamera(): void {
  useCall.getState().session?.flipCamera();
}

/** Records the local row for an invite so a missed call still lands in history. */
export function recordIncoming(invite: Invite): void {
  upsertCall({
    id: invite.callId,
    chatId: invite.chatId,
    peerId: invite.callerId,
    kind: invite.kind,
    direction: 'incoming',
    status: 'ringing',
    startedAt: invite.at,
  });

  clearRingTimer();
  ringTimer = setTimeout(() => {
    if (useCall.getState().call?.callId === invite.callId) {
      finish(outcomeFor({ answered: false, declined: false, timedOut: true }));
    }
  }, RING_TIMEOUT_MS);
}

/** The caller giving up before it was answered, seen from the callee's side. */
export function cancelledByCaller(callId: string): void {
  if (useCall.getState().call?.callId !== callId) return;
  finish('missed');
}

function sessionEvents() {
  return {
    onStatus: (status: CallStatus) => {
      useCall.getState().setStatus(status);
      if (status === 'active') {
        clearRingTimer();
        void updateCallRow(useCall.getState().call?.callId ?? '', { status: 'active' }).catch(() => {});
      }
    },
    onLocalStream: (streamUrl: string | null) => useCall.getState().patch({ localStreamUrl: streamUrl }),
    onRemoteStream: (streamUrl: string | null) => useCall.getState().patch({ remoteStreamUrl: streamUrl }),
    onDeclined: () => finish('declined'),
    onHangup: () => {
      const { call } = useCall.getState();
      finish(call?.answeredAt ? 'ended' : 'missed');
    },
  };
}
