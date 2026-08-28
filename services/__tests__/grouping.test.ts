import { RUN_GAP_MS, buildListItems, dateSeparatorLabel, hasTail, isSameDay } from '../grouping';
import type { LocalMessage } from '../messageState';

const DAY = 86_400_000;

function message(overrides: Partial<LocalMessage> & { clientId: string }): LocalMessage {
  return {
    id: overrides.clientId,
    chatId: 'chat1',
    senderId: 'me',
    kind: 'text',
    body: 'hi',
    replyToId: null,
    createdAt: 0,
    state: 'sent',
    attempts: 0,
    deletedAt: null,
    ...overrides,
  };
}

// A fixed local noon, so the tests do not straddle a day boundary wherever they run.
const noon = new Date(2026, 7, 28, 12, 0, 0).getTime();

describe('date labels', () => {
  it('names today and yesterday', () => {
    expect(dateSeparatorLabel(noon, noon)).toBe('Today');
    expect(dateSeparatorLabel(noon - DAY, noon)).toBe('Yesterday');
  });

  it('uses the weekday inside the last week, then a full date', () => {
    expect(dateSeparatorLabel(noon - 3 * DAY, noon)).toMatch(/day$/i);
    expect(dateSeparatorLabel(noon - 30 * DAY, noon)).toMatch(/\d{4}/);
  });

  it('compares calendar days, not elapsed hours', () => {
    const lateEvening = new Date(2026, 7, 28, 23, 30).getTime();
    const earlyMorning = new Date(2026, 7, 29, 0, 30).getTime();
    expect(isSameDay(lateEvening, earlyMorning)).toBe(false);
  });
});

describe('buildListItems', () => {
  it('opens with a date separator', () => {
    const items = buildListItems([message({ clientId: 'a', createdAt: noon })], {
      viewerId: 'me',
      now: noon,
    });

    expect(items[0]).toMatchObject({ type: 'date', label: 'Today' });
    expect(items[1]).toMatchObject({ type: 'message' });
  });

  it('emits one separator per day, not per message', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon - DAY }),
        message({ clientId: 'b', createdAt: noon - DAY + 60_000 }),
        message({ clientId: 'c', createdAt: noon }),
      ],
      { viewerId: 'me', now: noon },
    );

    expect(items.filter((item) => item.type === 'date')).toHaveLength(2);
  });

  it('marks run positions so only the last bubble gets a tail', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon }),
        message({ clientId: 'b', createdAt: noon + 1000 }),
        message({ clientId: 'c', createdAt: noon + 2000 }),
      ],
      { viewerId: 'me', now: noon },
    );

    const positions = items.filter((i) => i.type === 'message').map((i) => (i as never)['position']);
    expect(positions).toEqual(['first', 'middle', 'last']);
    expect(hasTail('first')).toBe(false);
    expect(hasTail('last')).toBe(true);
    expect(hasTail('single')).toBe(true);
  });

  it('breaks a run when the sender changes', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon }),
        message({ clientId: 'b', createdAt: noon + 1000, senderId: 'them' }),
      ],
      { viewerId: 'me', now: noon },
    );

    const positions = items.filter((i) => i.type === 'message').map((i) => (i as never)['position']);
    expect(positions).toEqual(['single', 'single']);
  });

  it('breaks a run after a long silence from the same sender', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon }),
        message({ clientId: 'b', createdAt: noon + RUN_GAP_MS + 1 }),
      ],
      { viewerId: 'me', now: noon },
    );

    const positions = items.filter((i) => i.type === 'message').map((i) => (i as never)['position']);
    expect(positions).toEqual(['single', 'single']);
  });

  it('inserts the unread divider once, above the first unread incoming message', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon, senderId: 'them' }),
        message({ clientId: 'b', createdAt: noon + 1000, senderId: 'them' }),
      ],
      { viewerId: 'me', firstUnreadId: 'b', now: noon },
    );

    const dividers = items.filter((item) => item.type === 'unread');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]).toMatchObject({ count: 1 });
  });

  it('never puts the unread divider above your own message', () => {
    const items = buildListItems([message({ clientId: 'a', createdAt: noon, senderId: 'me' })], {
      viewerId: 'me',
      firstUnreadId: 'a',
      now: noon,
    });

    expect(items.some((item) => item.type === 'unread')).toBe(false);
  });

  it('shows a group avatar only on the bubble that ends an incoming run', () => {
    const items = buildListItems(
      [
        message({ clientId: 'a', createdAt: noon, senderId: 'them' }),
        message({ clientId: 'b', createdAt: noon + 1000, senderId: 'them' }),
      ],
      { viewerId: 'me', isGroup: true, now: noon },
    );

    const avatars = items.filter((i) => i.type === 'message').map((i) => (i as never)['showsAvatar']);
    expect(avatars).toEqual([false, true]);
  });
});
