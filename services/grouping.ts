/**
 * Turning a flat message list into what the conversation actually renders: date
 * separators, an unread divider, and runs of consecutive messages from one sender
 * (only the last of a run carries a tail).
 *
 * Pure and timezone-aware through the device locale — no date library.
 */
import type { LocalMessage } from './messageState';

export type ListItem =
  | { type: 'message'; message: LocalMessage; position: RunPosition; showsAvatar: boolean }
  | { type: 'date'; key: string; label: string }
  | { type: 'unread'; key: string; count: number };

/** Where a message sits inside a run from the same sender. */
export type RunPosition = 'single' | 'first' | 'middle' | 'last';

/** Messages further apart than this start a new run even from the same sender. */
export const RUN_GAP_MS = 5 * 60 * 1000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** "Today" / "Yesterday" / "12 August 2026" — the separator chip label. */
export function dateSeparatorLabel(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "10:42" — the timestamp inside a bubble. */
export function messageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function sameRun(previous: LocalMessage, current: LocalMessage): boolean {
  return (
    previous.senderId === current.senderId &&
    previous.kind !== 'system' &&
    current.kind !== 'system' &&
    isSameDay(previous.createdAt, current.createdAt) &&
    current.createdAt - previous.createdAt <= RUN_GAP_MS
  );
}

/**
 * Builds the render list from messages in ascending time order.
 *
 * `firstUnreadId` inserts the "Unread messages" divider above that message, once,
 * and only when it is not the viewer's own.
 */
export function buildListItems(
  messages: LocalMessage[],
  options: { viewerId: string; firstUnreadId?: string | null; isGroup?: boolean; now?: number } ,
): ListItem[] {
  const { viewerId, firstUnreadId = null, isGroup = false, now = Date.now() } = options;
  const items: ListItem[] = [];
  let unreadInserted = false;

  messages.forEach((message, index) => {
    const previous = index > 0 ? messages[index - 1]! : null;
    const next = index < messages.length - 1 ? messages[index + 1]! : null;

    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
      items.push({
        type: 'date',
        key: `date-${startOfDay(message.createdAt)}`,
        label: dateSeparatorLabel(message.createdAt, now),
      });
    }

    if (!unreadInserted && firstUnreadId && message.id === firstUnreadId && message.senderId !== viewerId) {
      items.push({
        type: 'unread',
        key: 'unread-divider',
        count: messages.slice(index).filter((m) => m.senderId !== viewerId).length,
      });
      unreadInserted = true;
    }

    const continuesFromPrevious = previous ? sameRun(previous, message) : false;
    const continuesIntoNext = next ? sameRun(message, next) : false;

    const position: RunPosition = continuesFromPrevious
      ? continuesIntoNext
        ? 'middle'
        : 'last'
      : continuesIntoNext
        ? 'first'
        : 'single';

    items.push({
      type: 'message',
      message,
      position,
      // In a group, the avatar sits next to the last bubble of an incoming run.
      showsAvatar:
        isGroup &&
        message.senderId !== viewerId &&
        message.kind !== 'system' &&
        (position === 'last' || position === 'single'),
    });
  });

  return items;
}

/** The tail is drawn once per run, on the bubble that ends it. */
export function hasTail(position: RunPosition): boolean {
  return position === 'single' || position === 'last';
}
