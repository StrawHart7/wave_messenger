/**
 * Status against the server. Network side; the rules are pure in services/status.ts.
 *
 * Posting follows the same shape as sending media: the local row exists first, so
 * the "My status" row updates the instant you tap Post, and the upload catches up.
 * The difference is that a status has no outbox — a status that failed to upload is
 * a status you would rather re-shoot than have appear an hour late.
 */
import * as Crypto from 'expo-crypto';

import { upsertProfile } from '../db/chats';
import {
  deleteStatusPost,
  expiryFor,
  markStatusViewed,
  setStatusFailed,
  setStatusUploaded,
  upsertStatusPost,
  upsertStatusView,
} from '../db/status';
import { BUCKETS, uploadLocalObject } from './media';
import type { StatusKind, StatusPost } from './status';
import { assertSupabaseConfigured, isSupabaseConfigured, supabase } from './supabase';

type StatusRowFromServer = {
  id: string;
  author_id: string;
  kind: string;
  storage_path: string | null;
  caption: string | null;
  background_color: string | null;
  created_at: string;
  expires_at: string;
};

/**
 * Posts a status: local row, then upload, then the database row.
 *
 * The order matters. Inserting the row first would publish a status pointing at an
 * object that does not exist yet, and every contact who opened it in that window
 * would see a black screen with no way to recover.
 */
export async function postStatus(input: {
  authorId: string;
  kind: StatusKind;
  localUri?: string | null;
  caption?: string | null;
  backgroundColor?: string | null;
  durationMs?: number | null;
}): Promise<StatusPost> {
  assertSupabaseConfigured();

  const id = Crypto.randomUUID();
  const createdAt = Date.now();

  const local: StatusPost = {
    id,
    authorId: input.authorId,
    kind: input.kind,
    storagePath: null,
    caption: input.caption ?? null,
    backgroundColor: input.backgroundColor ?? null,
    createdAt,
    expiresAt: expiryFor(createdAt),
    // Your own status counts as seen; it should never ring your own avatar.
    viewed: true,
    localUri: input.localUri ?? null,
    durationMs: input.durationMs ?? null,
  };

  upsertStatusPost({ ...local, state: 'pending' });

  try {
    let storagePath: string | null = null;

    if (input.localUri) {
      const extension = input.localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const contentType = input.kind === 'video' ? 'video/mp4' : `image/${extension === 'png' ? 'png' : 'jpeg'}`;
      storagePath = await uploadLocalObject(
        BUCKETS.status,
        `${input.authorId}/${id}.${extension}`,
        input.localUri,
        contentType,
      );
    }

    const { error } = await supabase.from('status_posts').insert({
      id,
      author_id: input.authorId,
      kind: input.kind,
      storage_path: storagePath,
      caption: local.caption,
      background_color: local.backgroundColor,
    });
    if (error) throw error;

    if (storagePath) setStatusUploaded(id, storagePath);
    else upsertStatusPost({ ...local, state: 'sent' });

    return { ...local, storagePath };
  } catch (error) {
    setStatusFailed(id);
    throw error;
  }
}

/**
 * Everything the viewer is allowed to see, plus which of it they have already seen.
 *
 * The `expires_at > now()` filter lives in the RLS policy, so an expired post is not
 * merely hidden here — it is unreadable. This pull cannot return one.
 */
export async function pullStatus(viewerId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('status_posts')
    .select('id, author_id, kind, storage_path, caption, background_color, created_at, expires_at')
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as StatusRowFromServer[];
  if (rows.length === 0) return;

  const { data: viewData } = await supabase
    .from('status_views')
    .select('status_id')
    .eq('viewer_id', viewerId);

  const seen = new Set((viewData ?? []).map((row) => row.status_id as string));

  // Author names come from the same profile cache the rest of the app reads; a
  // status carries no display name of its own.
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('id, display_name, avatar_path')
    .in('id', authorIds);

  for (const profile of profiles ?? []) {
    upsertProfile({
      id: profile.id as string,
      displayName: (profile.display_name as string) ?? '',
      avatarPath: (profile.avatar_path as string | null) ?? null,
    });
  }

  for (const row of rows) {
    upsertStatusPost({
      id: row.id,
      authorId: row.author_id,
      kind: row.kind as StatusKind,
      storagePath: row.storage_path,
      caption: row.caption,
      backgroundColor: row.background_color,
      createdAt: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
      viewed: row.author_id === viewerId || seen.has(row.id),
      localUri: null,
      durationMs: null,
    });
  }
}

/**
 * Records a view. Written locally first so the ring greys out on the tap rather
 * than on the round trip; the server row is what the *author* eventually reads.
 */
export async function recordView(statusId: string, viewerId: string): Promise<void> {
  markStatusViewed(statusId);
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('status_views')
    .insert({ status_id: statusId, viewer_id: viewerId });

  // A duplicate is the normal case on a re-watch, not a failure.
  if (error && error.code !== '23505') throw error;
}

/** The viewer list for one of your own posts. Nobody else's is readable. */
export async function pullViewers(statusId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('status_views')
    .select('status_id, viewer_id, viewed_at, public_profiles!inner(id, display_name, avatar_path)')
    .eq('status_id', statusId);

  if (error) throw error;

  for (const row of (data ?? []) as unknown as {
    status_id: string;
    viewer_id: string;
    viewed_at: string;
    public_profiles: { id: string; display_name: string; avatar_path: string | null } | null;
  }[]) {
    if (row.public_profiles) {
      upsertProfile({
        id: row.public_profiles.id,
        displayName: row.public_profiles.display_name,
        avatarPath: row.public_profiles.avatar_path,
      });
    }
    upsertStatusView({
      statusId: row.status_id,
      viewerId: row.viewer_id,
      viewedAt: new Date(row.viewed_at).getTime(),
    });
  }
}

export async function deleteStatus(statusId: string, storagePath: string | null): Promise<void> {
  deleteStatusPost(statusId);
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('status_posts').delete().eq('id', statusId);
  if (error) throw error;

  // The row is what makes a status readable, so it goes first; the object is
  // housekeeping and a failure here leaves nothing visible behind.
  if (storagePath) await supabase.storage.from(BUCKETS.status).remove([storagePath]);
}
