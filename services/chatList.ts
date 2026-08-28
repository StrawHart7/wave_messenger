/**
 * What a chat-list row shows: the preview line, its sender prefix, the media label
 * that replaces text, and the timestamp format that changes with age. Pure.
 */
import type { LocalMessage } from './messageState';

export type ChatSummary = {
  chatId: string;
  kind: 'direct' | 'group';
  title: string;
  avatarPath: string | null;
  lastMessage: LocalMessage | null;
  /** Display name of the last sender, for the "Sarah: " prefix in groups. */
  lastSenderName: string | null;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  mutedUntil: number | null;
  isOnline: boolean;
};

export type ChatFilter = 'all' | 'unread' | 'favorites' | 'groups';

/** The label a non-text message shows in the list, next to its icon. */
export function mediaLabel(message: LocalMessage): string | null {
  switch (message.kind) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'voice':
      return 'Voice message';
    case 'document':
      return 'Document';
    case 'contact':
      return 'Contact';
    case 'location':
      return 'Location';
    case 'sticker':
      return 'Sticker';
    default:
      return null;
  }
}

/** The glyph that precedes a media preview. Names are MaterialIcons. */
export function mediaIcon(message: LocalMessage): string | null {
  switch (message.kind) {
    case 'image':
      return 'photo-camera';
    case 'video':
      return 'videocam';
    case 'voice':
      return 'mic';
    case 'document':
      return 'insert-drive-file';
    case 'contact':
      return 'person';
    case 'location':
      return 'location-on';
    case 'sticker':
      return 'emoji-emotions';
    default:
      return null;
  }
}

export function previewText(summary: ChatSummary): string {
  const message = summary.lastMessage;
  if (!message) return '';
  if (message.deletedAt) return 'This message was deleted';
  if (message.kind === 'system') return message.body ?? '';
  return mediaLabel(message) ?? message.body ?? '';
}

/**
 * Groups prefix the sender; direct chats do not, and your own messages read "You: "
 * in groups only. A system message never carries a prefix.
 */
export function previewPrefix(summary: ChatSummary, viewerId: string): string | null {
  const message = summary.lastMessage;
  if (!message || message.kind === 'system') return null;
  if (summary.kind !== 'group') return null;
  return message.senderId === viewerId ? 'You:' : summary.lastSenderName ? `${summary.lastSenderName}:` : null;
}

/**
 * Time today, "Yesterday", weekday within the week, then a date. Matches how the
 * reference rows read at a glance.
 */
export function listTimestamp(timestamp: number, now = Date.now()): string {
  const startOfDay = (value: number) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(timestamp).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function isMuted(summary: ChatSummary, now = Date.now()): boolean {
  return summary.mutedUntil !== null && summary.mutedUntil > now;
}

export function matchesFilter(summary: ChatSummary, filter: ChatFilter): boolean {
  switch (filter) {
    case 'unread':
      return summary.unreadCount > 0;
    case 'groups':
      return summary.kind === 'group';
    case 'favorites':
      return summary.pinned;
    case 'all':
    default:
      return true;
  }
}

export function matchesSearch(summary: ChatSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  if (summary.title.toLowerCase().includes(needle)) return true;
  return (summary.lastMessage?.body ?? '').toLowerCase().includes(needle);
}

/**
 * Pinned first, then most recent. Archived chats never appear in the main list —
 * they sit behind the Archived row.
 */
export function sortChats(summaries: ChatSummary[]): ChatSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.lastMessage?.createdAt ?? 0;
    const bTime = b.lastMessage?.createdAt ?? 0;
    return bTime - aTime;
  });
}

export function visibleChats(
  summaries: ChatSummary[],
  options: { filter: ChatFilter; search: string; archived?: boolean },
): ChatSummary[] {
  const { filter, search, archived = false } = options;
  return sortChats(
    summaries.filter(
      (summary) =>
        summary.archived === archived && matchesFilter(summary, filter) && matchesSearch(summary, search),
    ),
  );
}
