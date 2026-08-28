import {
  advanceState,
  isRetryable,
  mergeIncoming,
  reconcile,
  retryDelayMs,
  showsTicks,
  stateFromReceipts,
  type LocalMessage,
} from '../messageState';

function message(overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id: null,
    clientId: 'c1',
    chatId: 'chat1',
    senderId: 'me',
    kind: 'text',
    body: 'hello',
    replyToId: null,
    createdAt: 1000,
    state: 'pending',
    attempts: 0,
    deletedAt: null,
    ...overrides,
  };
}

describe('advanceState', () => {
  it('moves forward through the tick progression', () => {
    expect(advanceState('pending', 'sent')).toBe('sent');
    expect(advanceState('sent', 'delivered')).toBe('delivered');
    expect(advanceState('delivered', 'read')).toBe('read');
  });

  it('never moves backwards — receipts arrive out of order', () => {
    expect(advanceState('read', 'delivered')).toBe('read');
    expect(advanceState('delivered', 'sent')).toBe('delivered');
    expect(advanceState('sent', 'pending')).toBe('sent');
  });

  it('lets a send fail, but not one that was already read', () => {
    expect(advanceState('pending', 'failed')).toBe('failed');
    expect(advanceState('read', 'failed')).toBe('read');
  });

  it('allows a manual retry to reset a failed message', () => {
    expect(advanceState('failed', 'pending')).toBe('pending');
  });
});

describe('stateFromReceipts', () => {
  it('is pending until the server acknowledges', () => {
    expect(stateFromReceipts([], { acknowledged: false })).toBe('pending');
    expect(
      stateFromReceipts([{ deliveredAt: 1, readAt: 2 }], { acknowledged: false }),
    ).toBe('pending');
  });

  it('is sent when acknowledged with no receipts yet', () => {
    expect(stateFromReceipts([], { acknowledged: true })).toBe('sent');
  });

  it('reflects the weakest member in a group', () => {
    const receipts = [
      { deliveredAt: 1, readAt: 2 },
      { deliveredAt: 1, readAt: null },
    ];
    expect(stateFromReceipts(receipts, { acknowledged: true })).toBe('delivered');

    const partial = [
      { deliveredAt: 1, readAt: 2 },
      { deliveredAt: null, readAt: null },
    ];
    expect(stateFromReceipts(partial, { acknowledged: true })).toBe('sent');
  });

  it('is read only when everyone has read', () => {
    const receipts = [
      { deliveredAt: 1, readAt: 2 },
      { deliveredAt: 1, readAt: 3 },
    ];
    expect(stateFromReceipts(receipts, { acknowledged: true })).toBe('read');
  });
});

describe('reconcile', () => {
  it('adopts the server id and clock, and clears the attempt count', () => {
    const local = message({ state: 'failed', attempts: 3 });
    const result = reconcile(local, { id: 'server-1', createdAt: 5000 });

    expect(result.id).toBe('server-1');
    expect(result.createdAt).toBe(5000);
    expect(result.attempts).toBe(0);
    expect(result.state).toBe('sent');
  });

  it('does not undo a read that landed before the ack', () => {
    const local = message({ state: 'read' });
    expect(reconcile(local, { id: 'server-1', createdAt: 5000 }).state).toBe('read');
  });
});

describe('mergeIncoming', () => {
  it('replaces the optimistic row rather than duplicating it', () => {
    const optimistic = message({ clientId: 'c1', state: 'pending' });
    const fromServer = message({ clientId: 'c1', id: 'server-1', state: 'delivered', createdAt: 2000 });

    const merged = mergeIncoming([optimistic], fromServer);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.id).toBe('server-1');
    expect(merged[0]!.state).toBe('delivered');
  });

  it('updates in place when the same server row arrives twice', () => {
    const existing = message({ clientId: 'c1', id: 'server-1', state: 'delivered' });
    const replay = message({ clientId: 'c1', id: 'server-1', state: 'read' });

    const merged = mergeIncoming([existing], replay);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.state).toBe('read');
  });

  it('appends a genuinely new message', () => {
    const existing = message({ clientId: 'c1', id: 'server-1' });
    const other = message({ clientId: 'c2', id: 'server-2', senderId: 'them' });

    expect(mergeIncoming([existing], other)).toHaveLength(2);
  });

  it('treats two identical bodies as two messages', () => {
    const first = message({ clientId: 'c1', id: 's1', body: 'ok' });
    const second = message({ clientId: 'c2', id: 's2', body: 'ok', createdAt: 1001 });

    expect(mergeIncoming([first], second)).toHaveLength(2);
  });
});

describe('ticks and retries', () => {
  it('shows ticks only on your own non-system messages', () => {
    expect(showsTicks(message({ senderId: 'me' }), 'me')).toBe(true);
    expect(showsTicks(message({ senderId: 'them' }), 'me')).toBe(false);
    expect(showsTicks(message({ senderId: 'me', kind: 'system' }), 'me')).toBe(false);
  });

  it('stops retrying after the attempt ceiling', () => {
    expect(isRetryable(message({ state: 'failed', attempts: 2 }))).toBe(true);
    expect(isRetryable(message({ state: 'failed', attempts: 5 }))).toBe(false);
    expect(isRetryable(message({ state: 'sent', attempts: 0 }))).toBe(false);
  });

  it('backs off exponentially up to a ceiling', () => {
    expect(retryDelayMs(0)).toBe(1000);
    expect(retryDelayMs(3)).toBe(8000);
    expect(retryDelayMs(20)).toBe(60_000);
  });
});
