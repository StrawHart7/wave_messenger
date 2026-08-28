/**
 * One peer connection, from dial to hang-up.
 *
 * Perfect negotiation (the polite/impolite rule in services/calls.ts) rather than
 * a hand-rolled state machine: if both sides happen to negotiate at once, the
 * polite peer rolls its own offer back and takes the other one. Without it, a
 * simultaneous renegotiation deadlocks with both sides waiting for an answer.
 */
import type { MediaStream } from 'react-native-webrtc';

import { openSignalChannel, type SignalChannel, type SignalMessage } from './callSignal';
import {
  iceServersFrom,
  isPolite,
  mediaConstraints,
  statusFromConnection,
  type CallKind,
  type CallStatus,
} from './calls';
import { assertWebrtc } from './webrtc';

export type CallSessionEvents = {
  onStatus: (status: CallStatus) => void;
  onLocalStream: (streamUrl: string | null) => void;
  onRemoteStream: (streamUrl: string | null) => void;
  onDeclined: () => void;
  onHangup: () => void;
};

export type CallSession = {
  accept: () => Promise<void>;
  hangUp: () => void;
  setMuted: (muted: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  flipCamera: () => void;
  close: () => void;
};

function iceServers() {
  return iceServersFrom({
    stunUrls: process.env.EXPO_PUBLIC_STUN_URLS,
    turnUrl: process.env.EXPO_PUBLIC_TURN_URL,
    turnUsername: process.env.EXPO_PUBLIC_TURN_USERNAME,
    turnCredential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  });
}

/**
 * Starts a session. The caller creates the offer immediately; the callee waits for
 * one and only answers after `accept()` — a phone that negotiates media before it
 * is picked up is a phone that has already opened your microphone.
 */
export async function startCallSession(input: {
  callId: string;
  selfId: string;
  peerId: string;
  kind: CallKind;
  role: 'caller' | 'callee';
  events: CallSessionEvents;
}): Promise<CallSession> {
  const webrtc = assertWebrtc();
  const { callId, selfId, peerId, kind, role, events } = input;

  const connection = new webrtc.RTCPeerConnection({ iceServers: iceServers() });
  const polite = isPolite(selfId, peerId);

  let localStream: MediaStream | null = null;
  let status: CallStatus = 'ringing';
  let makingOffer = false;
  let ignoreOffer = false;
  let facing: 'front' | 'back' = 'front';
  let closed = false;
  // Candidates that arrive before the remote description does have nowhere to go
  // yet; adding them early throws and loses them for good.
  const pendingCandidates: unknown[] = [];

  const setStatus = (next: CallStatus) => {
    if (next === status) return;
    status = next;
    events.onStatus(next);
  };

  let channel: SignalChannel;

  const attachLocalMedia = async () => {
    if (localStream) return localStream;
    const stream = (await webrtc.mediaDevices.getUserMedia(
      mediaConstraints(kind, facing),
    )) as MediaStream;

    localStream = stream;
    for (const track of stream.getTracks()) connection.addTrack(track, stream);
    events.onLocalStream(stream.toURL());
    return stream;
  };

  const negotiate = async () => {
    try {
      makingOffer = true;
      const offer = await connection.createOffer({});
      await connection.setLocalDescription(offer);
      const local = connection.localDescription;
      if (local) channel.send({ type: 'offer', sdp: JSON.stringify(local), from: selfId });
    } finally {
      makingOffer = false;
    }
  };

  const handle = async (message: SignalMessage) => {
    if (closed) return;

    switch (message.type) {
      case 'offer':
      case 'answer': {
        const description = JSON.parse(message.sdp) as { type: string; sdp: string };

        // The glare window: an offer arriving while we have one in flight.
        const collision =
          description.type === 'offer' && (makingOffer || connection.signalingState !== 'stable');

        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;

        await connection.setRemoteDescription(new webrtc.RTCSessionDescription(description));

        for (const candidate of pendingCandidates.splice(0)) {
          await connection
            .addIceCandidate(new webrtc.RTCIceCandidate(candidate as never))
            .catch(() => {});
        }

        if (description.type === 'offer') {
          await attachLocalMedia();
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          const local = connection.localDescription;
          if (local) channel.send({ type: 'answer', sdp: JSON.stringify(local), from: selfId });
        }
        return;
      }

      case 'ice': {
        if (!connection.remoteDescription) {
          pendingCandidates.push(message.candidate);
          return;
        }
        await connection
          .addIceCandidate(new webrtc.RTCIceCandidate(message.candidate as never))
          .catch(() => {});
        return;
      }

      case 'accept':
        setStatus('connecting');
        return;

      case 'decline':
        setStatus('declined');
        events.onDeclined();
        return;

      case 'hangup':
        events.onHangup();
        return;
    }
  };

  channel = openSignalChannel(callId, selfId, (message) => {
    void handle(message).catch(() => {});
  });

  // The library's own typings for these handlers are a bare `Event<string>` — the
  // vendored event-target-shim types are not shipped — so the payloads are narrowed
  // here rather than pretended to be typed upstream.
  connection.onicecandidate = ((event: { candidate: unknown }) => {
    if (event.candidate) channel.send({ type: 'ice', candidate: event.candidate, from: selfId });
  }) as typeof connection.onicecandidate;

  connection.ontrack = ((event: { streams: MediaStream[] }) => {
    const [remote] = event.streams;
    if (remote) events.onRemoteStream(remote.toURL());
  }) as typeof connection.ontrack;

  connection.onconnectionstatechange = (() => {
    setStatus(statusFromConnection(connection.connectionState, status));
  }) as typeof connection.onconnectionstatechange;

  if (role === 'caller') {
    await attachLocalMedia();
    await negotiate();
  }

  const stopLocalTracks = () => {
    for (const track of localStream?.getTracks() ?? []) track.stop();
    localStream = null;
    events.onLocalStream(null);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    stopLocalTracks();
    connection.close();
    channel.close();
  };

  return {
    accept: async () => {
      channel.send({ type: 'accept', from: selfId });
      setStatus('connecting');
      await attachLocalMedia();
    },

    hangUp: () => {
      channel.send({ type: 'hangup', from: selfId });
      close();
    },

    setMuted: (muted) => {
      for (const track of localStream?.getAudioTracks() ?? []) track.enabled = !muted;
    },

    setCameraEnabled: (enabled) => {
      for (const track of localStream?.getVideoTracks() ?? []) track.enabled = enabled;
    },

    flipCamera: () => {
      facing = facing === 'front' ? 'back' : 'front';
      // react-native-webrtc switches the camera on the track itself, which keeps
      // the existing sender and avoids a renegotiation for what is a local change.
      for (const track of localStream?.getVideoTracks() ?? []) {
        track._switchCamera();
      }
    },

    close,
  };
}

/** The decline path, for a call refused without ever creating a peer connection. */
export function declineCall(callId: string, selfId: string): void {
  const channel = openSignalChannel(callId, selfId, () => {});
  channel.send({ type: 'decline', from: selfId });
  // Give the broadcast a moment to leave before the socket is torn down.
  setTimeout(() => channel.close(), 500);
}
