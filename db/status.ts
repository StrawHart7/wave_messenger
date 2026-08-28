import { db, mutate } from './client';
import { STATUS_TTL_MS, type StatusPost } from '../services/status';

type StatusRow = {
  id: string;
  author_id: string;
  kind: string;
  storage_path: string | null;
  caption: string | null;
  background_color: string | null;
  created_at: number;
  expires_at: number;
  duration_ms: number | null;
  viewed: number;
  local_uri: string | null;
  state: string;
};

function toPost(row: StatusRow): StatusPost {
  return {
    id: row.id,
    authorId: row.author_id,
    kind: row.kind as StatusPost['kind'],
    storagePath: row.storage_path,
    caption: row.caption,
    backgroundColor: row.background_color,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewed: row.viewed === 1,
    localUri: row.local_uri,
    durationMs: row.duration_ms,
  };
}

/**
 * Every status still alive, the viewer's own included — the tab splits them, and
 * doing it in one query keeps the two lists from disagreeing about `now`.
 */
export function listStatus(now = Date.now()): StatusPost[] {
  return db()
    .getAllSync<StatusRow>('select * from status_posts where expires_at > ? order by created_at asc', [now])
    .map(toPost);
}

export function myStatus(viewerId: string, now = Date.now()): StatusPost[] {
  return db()
    .getAllSync<StatusRow>(
      'select * from status_posts where author_id = ? and expires_at > ? order by created_at asc',
      [viewerId, now],
    )
    .map(toPost);
}

export function upsertStatusPost(post: StatusPost & { state?: string }): void {
  mutate(() => {
    db().runSync(
      `insert into status_posts
         (id, author_id, kind, storage_path, caption, background_color, created_at, expires_at,
          duration_ms, viewed, local_uri, state)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         storage_path = coalesce(excluded.storage_path, status_posts.storage_path),
         caption = excluded.caption,
         background_color = excluded.background_color,
         expires_at = excluded.expires_at,
         duration_ms = coalesce(excluded.duration_ms, status_posts.duration_ms),
         -- A refetch must never un-view something already seen on this device.
         viewed = max(status_posts.viewed, excluded.viewed),
         local_uri = excluded.local_uri,
         state = excluded.state`,
      [
        post.id,
        post.authorId,
        post.kind,
        post.storagePath,
        post.caption,
        post.backgroundColor,
        post.createdAt,
        post.expiresAt,
        post.durationMs,
        post.viewed ? 1 : 0,
        post.localUri,
        post.state ?? 'sent',
      ],
    );
  });
}

export function markStatusViewed(statusId: string): void {
  mutate(() => {
    db().runSync('update status_posts set viewed = 1 where id = ?', [statusId]);
  });
}

export function setStatusUploaded(statusId: string, storagePath: string): void {
  mutate(() => {
    db().runSync("update status_posts set storage_path = ?, local_uri = null, state = 'sent' where id = ?", [
      storagePath,
      statusId,
    ]);
  });
}

export function setStatusFailed(statusId: string): void {
  mutate(() => {
    db().runSync("update status_posts set state = 'failed' where id = ?", [statusId]);
  });
}

export function deleteStatusPost(statusId: string): void {
  mutate(() => {
    db().runSync('delete from status_views where status_id = ?', [statusId]);
    db().runSync('delete from status_posts where id = ?', [statusId]);
  });
}

/**
 * Drops what the deadline has passed. The queries already filter on `expires_at`,
 * so this is housekeeping rather than correctness — without it the table grows by
 * every status anyone ever posted.
 */
export function pruneExpiredStatus(now = Date.now()): void {
  mutate(() => {
    db().runSync(
      'delete from status_views where status_id in (select id from status_posts where expires_at <= ?)',
      [now],
    );
    db().runSync('delete from status_posts where expires_at <= ?', [now]);
  });
}

export function upsertStatusView(view: { statusId: string; viewerId: string; viewedAt: number }): void {
  mutate(() => {
    db().runSync(
      `insert into status_views (status_id, viewer_id, viewed_at) values (?, ?, ?)
       on conflict (status_id, viewer_id) do update set viewed_at = min(status_views.viewed_at, excluded.viewed_at)`,
      [view.statusId, view.viewerId, view.viewedAt],
    );
  });
}

export type StatusViewer = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  viewedAt: number;
};

/** Who has seen one of the viewer's own posts, most recent first. */
export function statusViewers(statusId: string): StatusViewer[] {
  return db()
    .getAllSync<{
      viewer_id: string;
      viewed_at: number;
      display_name: string | null;
      avatar_path: string | null;
    }>(
      `select v.viewer_id, v.viewed_at, p.display_name, p.avatar_path
         from status_views v
         left join profiles p on p.id = v.viewer_id
        where v.status_id = ?
        order by v.viewed_at desc`,
      [statusId],
    )
    .map((row) => ({
      userId: row.viewer_id,
      displayName: row.display_name ?? '',
      avatarPath: row.avatar_path,
      viewedAt: row.viewed_at,
    }));
}

/** The deadline a post created now would carry, mirroring the Postgres default. */
export function expiryFor(createdAt: number): number {
  return createdAt + STATUS_TTL_MS;
}
