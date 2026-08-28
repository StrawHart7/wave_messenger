import {
  isMuted,
  listTimestamp,
  mediaLabel,
  previewPrefix,
  previewText,
  sortChats,
  visibleChats,
  type ChatSummary,
} from '../chatList';
import type { LocalMessage } from '../messageState';

const DAY = 86_400_000;
const noon = new Date(2026, 7, 28, 12, 0, 0).getTime();

function message(overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id: 'm1',
    clientId: 'c1',
    chatId: 'chat1',
    senderId: 'them',
    kind: 'text',
    body: 'The new assets are ready for review.',
    replyToId: null,
    createdAt: noon,
    state: 'sent',
    attempts: 0,
    deletedAt: null,
    ...overrides,
  };
}

function chat(overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    chatId: 'chat1',
    kind: 'direct',
    title: 'Marco',
    avatarPath: null,
    lastMessage: message(),
    lastSenderName: 'Marco',
    unreadCount: 0,
    pinned: false,
    archived: false,
    mutedUntil: null,
    isOnline: false,
    ...overrides,
  };
}

describe('preview text', () => {
  it('shows the body for a text message', () => {
    expect(previewText(chat())).toBe('The new assets are ready for review.');
  });

  it('replaces the body with a media label', () => {
    expect(previewText(chat({ lastMessage: message({ kind: 'voice', body: null }) }))).toBe('Voice message');
    expect(mediaLabel(message({ kind: 'image' }))).toBe('Photo');
    expect(mediaLabel(message({ kind: 'text' }))).toBeNull();
  });

  it('says so when the message was deleted', () => {
    expect(previewText(chat({ lastMessage: message({ deletedAt: noon }) }))).toBe(
      'This message was deleted',
    );
  });

  it('is empty for a chat with no messages', () => {
    expect(previewText(chat({ lastMessage: null }))).toBe('');
  });
});

describe('preview prefix', () => {
  it('is absent in a direct chat', () => {
    expect(previewPrefix(chat(), 'me')).toBeNull();
  });

  it('names the sender in a group', () => {
    expect(previewPrefix(chat({ kind: 'group', lastSenderName: 'Sarah' }), 'me')).toBe('Sarah:');
  });

  it('says "You:" for your own message in a group', () => {
    expect(
      previewPrefix(chat({ kind: 'group', lastMessage: message({ senderId: 'me' }) }), 'me'),
    ).toBe('You:');
  });

  it('never prefixes a system message', () => {
    expect(
      previewPrefix(chat({ kind: 'group', lastMessage: message({ kind: 'system' }) }), 'me'),
    ).toBeNull();
  });
});

describe('listTimestamp', () => {
  it('shows a time today and a word yesterday', () => {
    expect(listTimestamp(noon, noon)).toMatch(/\d/);
    expect(listTimestamp(noon - DAY, noon)).toBe('Yesterday');
  });

  it('shows a weekday within the week and a date beyond it', () => {
    expect(listTimestamp(noon - 3 * DAY, noon)).not.toMatch(/\d{2}\//);
    expect(listTimestamp(noon - 30 * DAY, noon)).toMatch(/\d/);
  });
});

describe('mute', () => {
  it('is muted only until the deadline passes', () => {
    expect(isMuted(chat({ mutedUntil: noon + DAY }), noon)).toBe(true);
    expect(isMuted(chat({ mutedUntil: noon - DAY }), noon)).toBe(false);
    expect(isMuted(chat({ mutedUntil: null }), noon)).toBe(false);
  });
});

describe('sorting and filtering', () => {
  it('puts pinned chats first, then the most recent', () => {
    const sorted = sortChats([
      chat({ chatId: 'old', lastMessage: message({ createdAt: noon - DAY }) }),
      chat({ chatId: 'new', lastMessage: message({ createdAt: noon }) }),
      chat({ chatId: 'pinned', pinned: true, lastMessage: message({ createdAt: noon - 2 * DAY }) }),
    ]);

    expect(sorted.map((c) => c.chatId)).toEqual(['pinned', 'new', 'old']);
  });

  it('hides archived chats from the main list', () => {
    const result = visibleChats(
      [chat({ chatId: 'a' }), chat({ chatId: 'b', archived: true })],
      { filter: 'all', search: '' },
    );

    expect(result.map((c) => c.chatId)).toEqual(['a']);
  });

  it('filters to unread and to groups', () => {
    const chats = [
      chat({ chatId: 'read' }),
      chat({ chatId: 'unread', unreadCount: 3 }),
      chat({ chatId: 'group', kind: 'group' }),
    ];

    expect(visibleChats(chats, { filter: 'unread', search: '' }).map((c) => c.chatId)).toEqual(['unread']);
    expect(visibleChats(chats, { filter: 'groups', search: '' }).map((c) => c.chatId)).toEqual(['group']);
  });

  it('searches titles and message bodies', () => {
    const chats = [
      chat({ chatId: 'byTitle', title: 'Design crew' }),
      chat({ chatId: 'byBody', title: 'Ada', lastMessage: message({ body: 'lunch at noon?' }) }),
    ];

    expect(visibleChats(chats, { filter: 'all', search: 'design' }).map((c) => c.chatId)).toEqual(['byTitle']);
    expect(visibleChats(chats, { filter: 'all', search: 'lunch' }).map((c) => c.chatId)).toEqual(['byBody']);
    expect(visibleChats(chats, { filter: 'all', search: '  ' })).toHaveLength(2);
  });
});
