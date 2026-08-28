/**
 * Reaction aggregation. Pure: the pills hanging off a bubble are a projection of
 * the reaction rows, and the toggle rule is the same on the optimistic path and the
 * realtime one.
 */

/** The quick bar, in the reference's order. The plus opens the full picker. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export type Reaction = {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
};

export type ReactionPill = {
  emoji: string;
  count: number;
  /** Whether the viewer is part of this pill — it renders outlined when true. */
  reacted: boolean;
  /** Everyone who reacted with this emoji, oldest first, for the detail sheet. */
  userIds: string[];
};

/**
 * One reaction per person per message: reacting again with a different emoji moves
 * the person, it does not add a second pill. That constraint is a primary key in
 * Postgres, and this is the client-side half of it.
 */
export function aggregate(reactions: Reaction[], viewerId: string): ReactionPill[] {
  const byEmoji = new Map<string, ReactionPill>();

  for (const reaction of [...reactions].sort((a, b) => a.createdAt - b.createdAt)) {
    const pill = byEmoji.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reacted: false,
      userIds: [],
    };

    pill.count += 1;
    pill.userIds.push(reaction.userId);
    if (reaction.userId === viewerId) pill.reacted = true;
    byEmoji.set(reaction.emoji, pill);
  }

  // Most-reacted first, ties broken by who arrived first, so pills do not reshuffle
  // as counts change.
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

export type ToggleResult =
  | { action: 'add'; emoji: string }
  | { action: 'remove'; emoji: string }
  | { action: 'replace'; emoji: string; previous: string };

/**
 * What tapping `emoji` should do, given what the viewer already has. Tapping the
 * same emoji again removes it; a different one replaces it.
 */
export function toggle(reactions: Reaction[], viewerId: string, emoji: string): ToggleResult {
  const mine = reactions.find((reaction) => reaction.userId === viewerId);
  if (!mine) return { action: 'add', emoji };
  if (mine.emoji === emoji) return { action: 'remove', emoji };
  return { action: 'replace', emoji, previous: mine.emoji };
}

/** Applies a toggle locally so the pill updates before the round trip. */
export function applyToggle(
  reactions: Reaction[],
  viewerId: string,
  messageId: string,
  result: ToggleResult,
  now = Date.now(),
): Reaction[] {
  const withoutMine = reactions.filter((reaction) => reaction.userId !== viewerId);
  if (result.action === 'remove') return withoutMine;
  return [...withoutMine, { messageId, userId: viewerId, emoji: result.emoji, createdAt: now }];
}

/** "You, Ada and 3 others" — the summary line in the reaction detail sheet. */
export function reactionSummary(
  pill: ReactionPill,
  viewerId: string,
  nameOf: (userId: string) => string,
): string {
  const names = pill.userIds.map((userId) => (userId === viewerId ? 'You' : nameOf(userId)));
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 === 1 ? '' : 's'}`;
}
