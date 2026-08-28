import type { RealtimeChannel } from '@supabase/supabase-js';

import { deleteChat } from '../../db/chats';
import { pullChats } from '../sync/bootstrap';
import { isSupabaseConfigured, supabase } from '../supabase';

/**
 * Membership and group-metadata changes.
 *
 * Being added to a group, removed from one, or seeing it renamed are all things
 * that happen *to* the viewer rather than because of them, so they have no local
 * write to piggyback on. Without this subscription a group you were added to only
 * appears after a cold start.
 */
export function subscribeToMembership(viewerId: string): () => void {
  if (!isSupabaseConfigured) return () => {};

  const resync = () => {
    void pullChats(viewerId).catch(() => {});
  };

  const channel: RealtimeChannel = supabase
    .channel('wave:membership')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, (payload) => {
      // A delete of the viewer's own row means they are out: RLS stops serving the
      // chat's rows from that moment, so the local copy has to go too.
      if (payload.eventType === 'DELETE') {
        const row = payload.old as { user_id?: string; chat_id?: string };
        if (row.user_id === viewerId && row.chat_id) {
          deleteChat(row.chat_id);
          return;
        }
      }
      resync();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, resync)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
