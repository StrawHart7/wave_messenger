/**
 * Status rules — pure. Grouping posts into per-author rings, deciding what is still
 * alive, how long a segment runs, and where a tap sends you.
 *
 * Expiry appears here *and* in the RLS policy on status_posts. That is deliberate:
 * the client filter is what makes an expired status vanish from a screen that is
 * already open, and the policy is what makes it actually unreadable. Neither one
 * alone is enough — a client-only rule is a suggestion, and a server-only rule
 * leaves a stale post on screen until the next fetch.
 */

export type StatusKind = 'image' | 'video' | 'text';

export type StatusPost = {
  id: string;
  authorId: string;
  kind: StatusKind;
  storagePath: string | null;
  caption: string | null;
  backgroundColor: string | null;
  createdAt: number;
  expiresAt: number;
  /** Whether the viewer has already seen this one. */
  viewed: boolean;
  /** file:// URI while the upload is in flight, so it renders immediately. */
  localUri: string | null;
  durationMs: number | null;
};

export type StatusRing = {
  authorId: string;
  displayName: string;
  avatarPath: string | null;
  /** Oldest first — the order the viewer plays them in. */
  posts: StatusPost[];
  allViewed: boolean;
  latestAt: number;
};

export const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/** How long a still image or a text card stays on screen. */
export const IMAGE_SEGMENT_MS = 5000;
/** Ceiling for a video segment, so one long clip cannot hold the viewer hostage. */
export const MAX_VIDEO_SEGMENT_MS = 30_000;

export function isExpired(post: StatusPost, now = Date.now()): boolean {
  return post.expiresAt <= now;
}

export function activePosts(posts: StatusPost[], now = Date.now()): StatusPost[] {
  return posts.filter((post) => !isExpired(post, now));
}

/**
 * Groups live posts into one ring per author, oldest post first within a ring.
 *
 * The viewer's own posts are excluded: they belong in the "My status" row, which
 * has a different affordance (tap to add) and a different meaning.
 */
export function buildRings(
  posts: StatusPost[],
  authors: Map<string, { displayName: string; avatarPath: string | null }>,
  options: { viewerId: string; now?: number },
): StatusRing[] {
  const now = options.now ?? Date.now();
  const byAuthor = new Map<string, StatusPost[]>();

  for (const post of activePosts(posts, now)) {
    if (post.authorId === options.viewerId) continue;
    const existing = byAuthor.get(post.authorId);
    if (existing) existing.push(post);
    else byAuthor.set(post.authorId, [post]);
  }

  const rings: StatusRing[] = [];
  for (const [authorId, authorPosts] of byAuthor) {
    const ordered = [...authorPosts].sort((a, b) => a.createdAt - b.createdAt);
    const author = authors.get(authorId);
    rings.push({
      authorId,
      displayName: author?.displayName ?? '',
      avatarPath: author?.avatarPath ?? null,
      posts: ordered,
      allViewed: ordered.every((post) => post.viewed),
      latestAt: ordered[ordered.length - 1]?.createdAt ?? 0,
    });
  }

  return sortRings(rings);
}

/** Unseen first, newest first within each half — the order the reference lists. */
export function sortRings(rings: StatusRing[]): StatusRing[] {
  return [...rings].sort((a, b) => {
    if (a.allViewed !== b.allViewed) return a.allViewed ? 1 : -1;
    return b.latestAt - a.latestAt;
  });
}

export function splitRings(rings: StatusRing[]): { recent: StatusRing[]; viewed: StatusRing[] } {
  return {
    recent: rings.filter((ring) => !ring.allViewed),
    viewed: rings.filter((ring) => ring.allViewed),
  };
}

/**
 * The first post a ring should open on: the oldest unseen one, or the very first if
 * everything has been seen. Reopening a fully-viewed ring replays it from the top
 * rather than dropping you at the end with nothing to watch.
 */
export function entryIndex(ring: StatusRing): number {
  const unseen = ring.posts.findIndex((post) => !post.viewed);
  return unseen === -1 ? 0 : unseen;
}

export function segmentDurationMs(post: StatusPost): number {
  if (post.kind !== 'video') return IMAGE_SEGMENT_MS;
  if (post.durationMs === null) return IMAGE_SEGMENT_MS;
  return Math.min(Math.max(post.durationMs, 1000), MAX_VIDEO_SEGMENT_MS);
}

/** 0 to 1 for the segment currently playing. */
export function segmentProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(Math.max(elapsedMs / durationMs, 0), 1);
}

export type Advance =
  | { type: 'segment'; index: number }
  | { type: 'author'; direction: 'next' | 'previous' }
  | { type: 'close' };

/**
 * Where a tap or an ended segment sends you.
 *
 * Running off the end of the last author's last post closes the viewer; running off
 * the *start* of the first one does not — going backwards past the beginning stays
 * put, because a back-tap that dismisses the whole viewer is infuriating.
 */
export function advance(input: {
  index: number;
  count: number;
  direction: 'next' | 'previous';
  isFirstAuthor: boolean;
  isLastAuthor: boolean;
}): Advance {
  const { index, count, direction, isFirstAuthor, isLastAuthor } = input;

  if (direction === 'next') {
    if (index + 1 < count) return { type: 'segment', index: index + 1 };
    return isLastAuthor ? { type: 'close' } : { type: 'author', direction: 'next' };
  }

  if (index - 1 >= 0) return { type: 'segment', index: index - 1 };
  if (isFirstAuthor) return { type: 'segment', index: 0 };
  return { type: 'author', direction: 'previous' };
}

/**
 * "45 minutes ago" / "2 hours ago" / "Yesterday, 22:30" — the timestamps the
 * reference rows carry. A status never lives past 24h, so nothing older than
 * yesterday can appear here.
 */
export function statusTime(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  const sameDay = new Date(timestamp).toDateString() === new Date(now).toDateString();
  const time = new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (!sameDay) return `Yesterday, ${time}`;
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

/** The second line of the "My status" row. */
export function myStatusSubtitle(posts: StatusPost[], now = Date.now()): string {
  const live = activePosts(posts, now);
  if (live.length === 0) return 'Tap to add status update';

  const latest = live.reduce((newest, post) => (post.createdAt > newest.createdAt ? post : newest));
  const count = live.length === 1 ? '1 update' : `${live.length} updates`;
  return `${count} · ${statusTime(latest.createdAt, now)}`;
}

export function viewerCountLabel(count: number): string {
  if (count === 0) return 'No views yet';
  return count === 1 ? '1 view' : `${count} views`;
}

/** Cycles the text-status background. The ring lives in `colors.messaging`. */
export function nextBackground(current: string, ring: string[]): string {
  if (ring.length === 0) return current;
  const index = ring.indexOf(current);
  return ring[(index + 1) % ring.length] ?? ring[0]!;
}

export const MAX_CAPTION_LENGTH = 700;

export function isPostable(input: { kind: StatusKind; caption: string; localUri: string | null }): boolean {
  if (input.kind === 'text') return input.caption.trim().length > 0;
  return input.localUri !== null;
}

/** The quoted line a status reply carries into the conversation. */
export function replyPreview(post: StatusPost): string {
  if (post.kind === 'text') return post.caption ?? '';
  return post.caption ?? (post.kind === 'video' ? 'Video status' : 'Photo status');
}
