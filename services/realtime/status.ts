import type { RealtimeChannel } from '@supabase/supabase-js';

import { deleteStatusPost } from '../../db/status';
import { pullStatus } from '../statusSync';
import { isSupabaseConfigured, supabase } from '../supabase';

/**
 * New and deleted status posts.
 *
 * An insert triggers a refetch rather than being applied from the payload: the row
 * arrives without the author's profile, and a ring with a blank name and no avatar
 * is worse than one that appears a moment later.
 */
export function subscribeToStatus(viewerId: string): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel: RealtimeChannel = supabase
    .channel('wave:status')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_posts' }, () => {
      void pullStatus(viewerId).catch(() => {});
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'status_posts' }, (payload) => {
      const row = payload.old as { id?: string };
      if (row.id) deleteStatusPost(row.id);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
