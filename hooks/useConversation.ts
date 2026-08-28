import { attachmentsFor, reactionsFor } from '../db/attachments';
import { PAGE_SIZE, firstUnreadMessageId, listMessages } from '../db/messages';
import { displayNames, type LocalProfile } from '../db/profiles';
import type { Attachment } from '../services/attachments';
import { buildListItems, type ListItem } from '../services/grouping';
import type { LocalMessage } from '../services/messageState';
import { aggregate, type Reaction, type ReactionPill } from '../services/reactions';
import { useLiveQuery } from './useLiveQuery';
import { useCallback, useState } from 'react';

export type ConversationItem = ListItem & {
  attachment?: Attachment | null;
  reactionPills?: ReactionPill[];
  replyTo?: { senderName: string; preview: string } | null;
  /** Who sent it, for group attribution. Null for the viewer's own messages. */
  sender?: { displayName: string; avatarPath: string | null } | null;
};

/**
 * A conversation page with everything a bubble needs already attached.
 *
 * Attachments, reactions and sender profiles are each fetched for the whole page in
 * one query and joined in memory. Letting each bubble query for its own would turn
 * one screen into eighty round trips to SQLite on every keystroke-driven re-render.
 */
export function useConversation(chatId: string, viewerId: string, isGroup = false) {
  const [limit, setLimit] = useState(PAGE_SIZE);

  const messages = useLiveQuery(() => listMessages(chatId, undefined, limit), [chatId, limit]);
  const firstUnread = useLiveQuery(() => firstUnreadMessageId(chatId, viewerId), [chatId, viewerId]);

  const attachments = useLiveQuery(
    () => attachmentsFor(messages.map((message) => message.clientId)),
    [messages],
  );

  const reactions = useLiveQuery(
    () =>
      reactionsFor(
        messages.map((message) => message.id).filter((id): id is string => id !== null),
      ),
    [messages],
  );

  const senders = useLiveQuery(
    () => displayNames([...new Set(messages.map((message) => message.senderId))]),
    [messages],
  );

  const chronological = [...messages].reverse();
  const byId = new Map(chronological.map((message) => [message.id, message]));

  const items: ConversationItem[] = buildListItems(chronological, {
    viewerId,
    firstUnreadId: firstUnread,
    isGroup,
  }).map((item) => {
    if (item.type !== 'message') return item;

    const messageReactions: Reaction[] = item.message.id ? (reactions.get(item.message.id) ?? []) : [];
    const profile = senders.get(item.message.senderId);

    return {
      ...item,
      attachment: attachments.get(item.message.clientId) ?? null,
      reactionPills: aggregate(messageReactions, viewerId),
      replyTo: resolveReply(item.message, byId, senders, viewerId),
      sender:
        item.message.senderId === viewerId
          ? null
          : { displayName: profile?.displayName ?? '', avatarPath: profile?.avatarPath ?? null },
    };
  });

  const loadOlder = useCallback(() => {
    if (messages.length < limit) return;
    setLimit((value) => value + PAGE_SIZE);
  }, [messages.length, limit]);

  return { items, loadOlder, hasMore: messages.length >= limit };
}

/**
 * Quoted replies resolve against the page already in memory. A reply to something
 * scrolled far out of range shows a neutral placeholder rather than triggering a
 * fetch — the quote is a hint, and one that is never worth a query.
 */
function resolveReply(
  message: LocalMessage,
  byId: Map<string | null, LocalMessage>,
  senders: Map<string, LocalProfile>,
  viewerId: string,
): { senderName: string; preview: string } | null {
  if (!message.replyToId) return null;

  const original = byId.get(message.replyToId);
  if (!original) return { senderName: '', preview: 'Message' };

  return {
    senderName:
      original.senderId === viewerId ? 'You' : (senders.get(original.senderId)?.displayName ?? ''),
    preview: original.body ?? original.kind,
  };
}
