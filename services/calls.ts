/**
 * Call rules — pure. What a call's state means, what the history row says, who
 * yields when two people dial each other at once, and how a WebRTC connection
 * state maps onto something a person can read.
 *
 * None of this imports react-native-webrtc: the peer connection lives behind the
 * seam in services/webrtc.ts, and everything decidable without a radio is decided
 * here so it can be tested without one.
 */

export type CallKind = 'voice' | 'video';
export type CallDirection = 'incoming' | 'outgoing';

/**
 * `ringing` and `connecting` are separate on purpose: the first means the other
 * phone is buzzing, the second means it was answered and the media path is still
 * being negotiated. Collapsing them makes a slow ICE round look like no answer.
 */
export type CallStatus = 'ringing' | 'connecting' | 'active' | 'ended' | 'missed' | 'declined';

export type CallRecord = {
  id: string;
  chatId: string;
  peerId: string;
  peerName: string;
  peerAvatarPath: string | null;
  kind: CallKind;
  direction: CallDirection;
  status: CallStatus;
  startedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
};

/** How long a phone rings before the call is written off as missed. */
export const RING_TIMEOUT_MS = 45_000;

/** Nothing moves a call out of one of these. */
const TERMINAL: CallStatus[] = ['ended', 'missed', 'declined'];

export function isTerminal(status: CallStatus): boolean {
  return TERMINAL.includes(status);
}

export function isLive(status: CallStatus): boolean {
  return !isTerminal(status);
}

/** "07:42", and "1:02:03" once a call runs past the hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** The line under the caller's name while the call is on screen. */
export function callStatusLabel(input: {
  status: CallStatus;
  direction: CallDirection;
  kind: CallKind;
  durationMs?: number;
}): string {
  switch (input.status) {
    case 'ringing':
      return input.direction === 'outgoing'
        ? 'Ringing…'
        : `Incoming ${input.kind === 'video' ? 'video' : 'voice'} call`;
    case 'connecting':
      return 'Connecting…';
    case 'active':
      return formatDuration(input.durationMs ?? 0);
    case 'declined':
      return 'Declined';
    case 'missed':
      return input.direction === 'outgoing' ? 'No answer' : 'Missed call';
    case 'ended':
      return 'Call ended';
  }
}

/**
 * How a call that is ending should be recorded.
 *
 * A call nobody answered is `missed` for the callee and shows as "No answer" to
 * the caller — the same row, read from two sides, which is why direction is not
 * baked into the status.
 */
export function outcomeFor(input: {
  answered: boolean;
  declined: boolean;
  timedOut: boolean;
}): CallStatus {
  if (input.answered) return 'ended';
  if (input.declined) return 'declined';
  if (input.timedOut) return 'missed';
  // The caller hung up before it was picked up: still a missed call for the callee.
  return 'missed';
}

export function isMissed(record: CallRecord): boolean {
  return record.direction === 'incoming' && (record.status === 'missed' || record.status === 'declined');
}

/** MaterialIcons glyph for a history row. */
export function historyIcon(record: CallRecord): 'call-made' | 'call-received' | 'call-missed' {
  if (isMissed(record)) return 'call-missed';
  return record.direction === 'outgoing' ? 'call-made' : 'call-received';
}

/** "Today, 10:30" / "Yesterday, 16:15" / "12/08/26, 09:04". */
export function historyTime(timestamp: number, now = Date.now()): string {
  const startOfDay = (value: number) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  const time = new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${new Date(timestamp).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })}, ${time}`;
}

/** The second line of a history row: outcome, or how long it lasted. */
export function historySubtitle(record: CallRecord, now = Date.now()): string {
  if (record.status === 'active' || record.status === 'connecting') return 'Ongoing call…';
  if (isMissed(record)) return historyTime(record.startedAt, now);
  if (record.answeredAt && record.endedAt) {
    return `${historyTime(record.startedAt, now)} · ${formatDuration(record.endedAt - record.answeredAt)}`;
  }
  return historyTime(record.startedAt, now);
}

export function sortHistory(records: CallRecord[]): CallRecord[] {
  return [...records].sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Perfect negotiation's "polite peer".
 *
 * If both sides dial at the same moment there are two offers in flight and the
 * connection deadlocks. The rule has to be decided without talking — so it is
 * decided by comparing the two user ids, which both sides already know. The
 * polite peer rolls back its own offer and accepts the other one.
 */
export function isPolite(myId: string, theirId: string): boolean {
  return myId < theirId;
}

/**
 * Which of two simultaneous calls survives. Same comparison as `isPolite`, so the
 * two can never disagree: the impolite peer's call is the one that goes through.
 */
export function winningCall(a: { id: string; callerId: string }, b: { id: string; callerId: string }): string {
  return isPolite(a.callerId, b.callerId) ? b.id : a.id;
}

/** WebRTC's own connection states, mapped onto something a person can read. */
export function statusFromConnection(
  state: string,
  current: CallStatus,
): CallStatus {
  switch (state) {
    case 'connected':
      return 'active';
    case 'connecting':
    case 'new':
      return current === 'active' ? 'active' : 'connecting';
    case 'failed':
    case 'closed':
      // A drop after the call was up is an ended call, not a missed one.
      return current === 'active' ? 'ended' : 'missed';
    case 'disconnected':
      // Transient by definition — ICE recovers from this on its own more often
      // than not, so it must not tear the call down.
      return current;
    default:
      return current;
  }
}

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * ICE servers from the environment.
 *
 * A STUN server alone connects maybe four calls in five; the fifth is behind a
 * symmetric NAT and needs TURN to relay. Shipping without TURN configured is what
 * produces "it works on wifi but not on 4G" bug reports.
 */
export function iceServersFrom(env: {
  stunUrls?: string;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
}): IceServer[] {
  const servers: IceServer[] = [];

  const stun = (env.stunUrls ?? 'stun:stun.l.google.com:19302')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (stun.length > 0) servers.push({ urls: stun });

  if (env.turnUrl && env.turnUsername && env.turnCredential) {
    servers.push({
      urls: env.turnUrl,
      username: env.turnUsername,
      credential: env.turnCredential,
    });
  }

  return servers;
}

export function hasTurn(servers: IceServer[]): boolean {
  return servers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'));
  });
}

/** What to ask the camera and microphone for. */
export function mediaConstraints(kind: CallKind, facing: 'front' | 'back' = 'front') {
  return {
    audio: true,
    video:
      kind === 'video'
        ? { facingMode: facing === 'front' ? 'user' : 'environment', width: 1280, height: 720 }
        : false,
  };
}

export function flipFacing(facing: 'front' | 'back'): 'front' | 'back' {
  return facing === 'front' ? 'back' : 'front';
}

/** The system message a finished call leaves in the conversation. */
export function callSummaryText(record: CallRecord, viewerIsCaller: boolean): string {
  const noun = record.kind === 'video' ? 'Video call' : 'Voice call';

  if (record.status === 'declined') return `${noun} declined`;
  if (record.status === 'missed') return viewerIsCaller ? `${noun}, no answer` : `Missed ${noun.toLowerCase()}`;
  if (record.answeredAt && record.endedAt) {
    return `${noun} · ${formatDuration(record.endedAt - record.answeredAt)}`;
  }
  return `${noun} ended`;
}
