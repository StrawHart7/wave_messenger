import { useCallback, useState } from 'react';

import { PAGE_SIZE, firstUnreadMessageId, listMessages } from '../db/messages';
import { buildListItems, type ListItem } from '../services/grouping';
import { useLiveQuery } from './useLiveQuery';

/**
 * A conversation page, already grouped into render items.
 *
 * Pagination grows a limit rather than accumulating pages in state: the live query
 * re-reads from SQLite on every write, so holding pages in React would mean merging
 * two sources of truth on each new message.
 */
export function useMessages(chatId: string, viewerId: string, isGroup = false) {
  const [limit, setLimit] = useState(PAGE_SIZE);

  const messages = useLiveQuery(
    () => listMessages(chatId, undefined, limit),
    [chatId, limit],
  );
  const firstUnread = useLiveQuery(() => firstUnreadMessageId(chatId, viewerId), [chatId, viewerId]);

  // listMessages returns newest-first (that is the indexed order); the list renders
  // chronologically, so reverse once here.
  const items: ListItem[] = buildListItems([...messages].reverse(), {
    viewerId,
    firstUnreadId: firstUnread,
    isGroup,
  });

  const loadOlder = useCallback(() => {
    if (messages.length < limit) return; // already at the beginning
    setLimit((value) => value + PAGE_SIZE);
  }, [messages.length, limit]);

  return {
    /** Oldest first. FlashList v2 renders chat lists upright and starts at the
     * bottom — there is no `inverted` prop any more, and inverting by hand fights
     * its scroll-anchoring. */
    items,
    loadOlder,
    hasMore: messages.length >= limit,
  };
}
