import {
  callStatusLabel,
  callSummaryText,
  flipFacing,
  formatDuration,
  hasTurn,
  historyIcon,
  historySubtitle,
  historyTime,
  iceServersFrom,
  isLive,
  isMissed,
  isPolite,
  isTerminal,
  mediaConstraints,
  outcomeFor,
  sortHistory,
  statusFromConnection,
  winningCall,
  type CallRecord,
} from '../calls';

const NOW = new Date('2026-08-28T12:00:00Z').getTime();

function record(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    id: 'call-1',
    chatId: 'chat-1',
    peerId: 'anna',
    peerName: 'Anna',
    peerAvatarPath: null,
    kind: 'voice',
    direction: 'outgoing',
    status: 'ended',
    startedAt: NOW - 3600_000,
    answeredAt: NOW - 3590_000,
    endedAt: NOW - 3000_000,
    ...overrides,
  };
}

describe('call states', () => {
  it('knows which states a call can still leave', () => {
    expect(isTerminal('ended')).toBe(true);
    expect(isTerminal('missed')).toBe(true);
    expect(isTerminal('declined')).toBe(true);
    expect(isLive('ringing')).toBe(true);
    expect(isLive('connecting')).toBe(true);
    expect(isLive('active')).toBe(true);
  });
});

describe('formatDuration', () => {
  it('reads mm:ss, and grows an hours field only when it needs one', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(62_000)).toBe('01:02');
    expect(formatDuration(462_000)).toBe('07:42');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
  });

  it('never shows a negative clock', () => {
    expect(formatDuration(-5000)).toBe('00:00');
  });
});

describe('callStatusLabel', () => {
  it('distinguishes ringing from connecting', () => {
    expect(callStatusLabel({ status: 'ringing', direction: 'outgoing', kind: 'voice' })).toBe('Ringing…');
    expect(callStatusLabel({ status: 'connecting', direction: 'outgoing', kind: 'voice' })).toBe(
      'Connecting…',
    );
  });

  it('names the medium on an incoming call', () => {
    expect(callStatusLabel({ status: 'ringing', direction: 'incoming', kind: 'video' })).toBe(
      'Incoming video call',
    );
  });

  it('becomes a clock once the call is up', () => {
    expect(
      callStatusLabel({ status: 'active', direction: 'incoming', kind: 'voice', durationMs: 462_000 }),
    ).toBe('07:42');
  });

  it('reads an unanswered call from both sides', () => {
    expect(callStatusLabel({ status: 'missed', direction: 'outgoing', kind: 'voice' })).toBe('No answer');
    expect(callStatusLabel({ status: 'missed', direction: 'incoming', kind: 'voice' })).toBe('Missed call');
  });
});

describe('outcomeFor', () => {
  it('records an answered call as ended', () => {
    expect(outcomeFor({ answered: true, declined: false, timedOut: false })).toBe('ended');
  });

  it('separates a decline from a timeout', () => {
    expect(outcomeFor({ answered: false, declined: true, timedOut: false })).toBe('declined');
    expect(outcomeFor({ answered: false, declined: false, timedOut: true })).toBe('missed');
  });

  it('treats a caller hanging up early as a missed call', () => {
    expect(outcomeFor({ answered: false, declined: false, timedOut: false })).toBe('missed');
  });

  it('lets an answered call that later timed out still count as answered', () => {
    expect(outcomeFor({ answered: true, declined: false, timedOut: true })).toBe('ended');
  });
});

describe('history rows', () => {
  it('picks the glyph from direction and outcome', () => {
    expect(historyIcon(record({ direction: 'outgoing' }))).toBe('call-made');
    expect(historyIcon(record({ direction: 'incoming' }))).toBe('call-received');
    expect(historyIcon(record({ direction: 'incoming', status: 'missed' }))).toBe('call-missed');
  });

  it('counts an outgoing call nobody answered as unanswered, not missed', () => {
    // "Missed" is the callee's word. The caller's row is not red.
    expect(isMissed(record({ direction: 'outgoing', status: 'missed' }))).toBe(false);
    expect(historyIcon(record({ direction: 'outgoing', status: 'missed' }))).toBe('call-made');
  });

  it('dates a row relative to today', () => {
    expect(historyTime(NOW - 3600_000, NOW)).toContain('Today, ');
    expect(historyTime(new Date('2026-08-27T16:15:00Z').getTime(), NOW)).toContain('Yesterday, ');
    expect(historyTime(new Date('2026-08-12T09:04:00Z').getTime(), NOW)).toMatch(/^\d/);
  });

  it('appends the duration to an answered call', () => {
    const subtitle = historySubtitle(
      record({ startedAt: NOW - 3600_000, answeredAt: NOW - 3590_000, endedAt: NOW - 3000_000 }),
      NOW,
    );
    expect(subtitle).toContain(' · 09:50');
  });

  it('says a live call is ongoing rather than dating it', () => {
    expect(historySubtitle(record({ status: 'active' }), NOW)).toBe('Ongoing call…');
  });

  it('omits a duration for a call that was never answered', () => {
    expect(historySubtitle(record({ status: 'missed', answeredAt: null, endedAt: NOW }), NOW)).not.toContain(
      '·',
    );
  });

  it('sorts most recent first', () => {
    const sorted = sortHistory([
      record({ id: 'old', startedAt: 1 }),
      record({ id: 'new', startedAt: 9 }),
      record({ id: 'mid', startedAt: 5 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('glare', () => {
  it('picks a polite peer without either side having to ask', () => {
    expect(isPolite('anna', 'david')).toBe(true);
    expect(isPolite('david', 'anna')).toBe(false);
  });

  it('agrees with itself from both sides when two calls collide', () => {
    const a = { id: 'call-a', callerId: 'anna' };
    const b = { id: 'call-b', callerId: 'david' };
    // Anna is polite, so David's call is the one that survives — and the answer is
    // the same whichever order the two are compared in.
    expect(winningCall(a, b)).toBe('call-b');
    expect(winningCall(b, a)).toBe('call-b');
  });
});

describe('statusFromConnection', () => {
  it('goes active on connect', () => {
    expect(statusFromConnection('connected', 'connecting')).toBe('active');
  });

  it('ignores a transient disconnect rather than tearing the call down', () => {
    expect(statusFromConnection('disconnected', 'active')).toBe('active');
  });

  it('separates a drop from a call that never connected', () => {
    expect(statusFromConnection('failed', 'active')).toBe('ended');
    expect(statusFromConnection('failed', 'connecting')).toBe('missed');
  });

  it('does not walk an active call back to connecting', () => {
    expect(statusFromConnection('connecting', 'active')).toBe('active');
    expect(statusFromConnection('new', 'active')).toBe('active');
  });

  it('leaves an unknown state alone', () => {
    expect(statusFromConnection('something-else', 'ringing')).toBe('ringing');
  });
});

describe('ICE configuration', () => {
  it('falls back to a public STUN server when nothing is configured', () => {
    const servers = iceServersFrom({});
    expect(servers).toHaveLength(1);
    expect(hasTurn(servers)).toBe(false);
  });

  it('parses a comma-separated STUN list', () => {
    const servers = iceServersFrom({ stunUrls: 'stun:a:1, stun:b:2' });
    expect(servers[0]?.urls).toEqual(['stun:a:1', 'stun:b:2']);
  });

  it('adds TURN only when the credentials are complete', () => {
    expect(hasTurn(iceServersFrom({ turnUrl: 'turn:t:3478' }))).toBe(false);
    expect(
      hasTurn(iceServersFrom({ turnUrl: 'turn:t:3478', turnUsername: 'u', turnCredential: 'c' })),
    ).toBe(true);
  });

  it('recognises turns: as TURN too', () => {
    expect(hasTurn([{ urls: 'turns:t:5349' }])).toBe(true);
    expect(hasTurn([{ urls: ['stun:a:1'] }])).toBe(false);
  });
});

describe('media', () => {
  it('asks for no camera on a voice call', () => {
    expect(mediaConstraints('voice').video).toBe(false);
    expect(mediaConstraints('voice').audio).toBe(true);
  });

  it('asks for the front camera by default and flips', () => {
    expect(mediaConstraints('video')).toMatchObject({ video: { facingMode: 'user' } });
    expect(mediaConstraints('video', 'back')).toMatchObject({ video: { facingMode: 'environment' } });
    expect(flipFacing('front')).toBe('back');
    expect(flipFacing('back')).toBe('front');
  });
});

describe('callSummaryText', () => {
  it('reads an unanswered call differently for each side', () => {
    const missed = record({ status: 'missed', answeredAt: null, endedAt: NOW });
    expect(callSummaryText(missed, true)).toBe('Voice call, no answer');
    expect(callSummaryText(missed, false)).toBe('Missed voice call');
  });

  it('states the duration of a call that happened', () => {
    expect(
      callSummaryText(
        record({ kind: 'video', answeredAt: NOW - 462_000, endedAt: NOW, status: 'ended' }),
        true,
      ),
    ).toBe('Video call · 07:42');
  });

  it('names a decline', () => {
    expect(callSummaryText(record({ status: 'declined' }), true)).toBe('Voice call declined');
  });
});
