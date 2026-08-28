import { useEffect, useState } from 'react';

import { displayNames } from '../db/profiles';
import { listStatus, myStatus, pruneExpiredStatus, statusViewers, type StatusViewer } from '../db/status';
import { buildRings, splitRings, type StatusPost, type StatusRing } from '../services/status';
import { useLiveQuery } from './useLiveQuery';

/** Expiry is time-driven, not write-driven, so something has to move the clock. */
const TICK_MS = 60_000;

/**
 * A clock that advances once a minute.
 *
 * `useLiveQuery` re-reads when SQLite changes, and nothing changes in SQLite when a
 * status expires — the deadline simply passes. Without this the tab would keep
 * showing a status that is already unreadable on the server.
 */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}

export function useStatusRings(viewerId: string): {
  rings: StatusRing[];
  recent: StatusRing[];
  viewed: StatusRing[];
  mine: StatusPost[];
  now: number;
} {
  const now = useMinuteClock();

  const posts = useLiveQuery(() => listStatus(now), [now]);
  const mine = useLiveQuery(() => myStatus(viewerId, now), [viewerId, now]);

  const authors = useLiveQuery(
    () => displayNames([...new Set(posts.map((post) => post.authorId))]),
    [posts],
  );

  const profileMap = new Map(
    [...authors.entries()].map(([userId, profile]) => [
      userId,
      { displayName: profile.displayName, avatarPath: profile.avatarPath },
    ]),
  );

  const rings = buildRings(posts, profileMap, { viewerId, now });
  const { recent, viewed } = splitRings(rings);

  return { rings, recent, viewed, mine, now };
}

/** One author's ring, for the viewer screen. */
export function useAuthorRing(authorId: string, viewerId: string): StatusRing | null {
  const { rings, mine } = useStatusRings(viewerId);

  if (authorId === viewerId) {
    return mine.length === 0
      ? null
      : {
          authorId: viewerId,
          displayName: 'You',
          avatarPath: null,
          posts: mine,
          allViewed: true,
          latestAt: mine[mine.length - 1]?.createdAt ?? 0,
        };
  }

  return rings.find((ring) => ring.authorId === authorId) ?? null;
}

export function useStatusViewers(statusId: string | null): StatusViewer[] {
  return useLiveQuery(() => (statusId ? statusViewers(statusId) : []), [statusId]);
}

/**
 * Drops expired rows on mount. Housekeeping, not correctness — every query already
 * filters on the deadline; this is what stops the table growing without bound.
 */
export function useStatusHousekeeping(): void {
  useEffect(() => {
    pruneExpiredStatus();
  }, []);
}
