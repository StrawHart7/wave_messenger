import { useEffect } from 'react';

import { subscribeToMembership } from '../services/realtime/membership';
import { subscribeToMessages } from '../services/realtime/messages';
import { subscribeToStatus } from '../services/realtime/status';
import { pullChats } from '../services/sync/bootstrap';
import { resumeOutbox } from '../services/sync/outbox';
import { pullStatus } from '../services/statusSync';
import { pullBlocked, updatePresence } from '../services/privacySync';
import { useSession } from '../stores/session';
import { useSettings } from '../stores/settings';
import { useIncomingCalls } from './useCalls';

/**
 * Everything that has to be running for the app to be live, started once the
 * session is ready and torn down when it is not.
 *
 * It lives at the root rather than on the chat list: an outbox that only drains
 * while a particular screen is mounted is not an outbox, and a message that arrives
 * while the user is in Settings still has to land in SQLite.
 */
export function useAppSync(): void {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);

  // Incoming calls have their own hook: a call arriving is the one event that
  // takes over the screen, so it routes rather than writing to SQLite.
  useIncomingCalls();

  useEffect(() => {
    if (status !== 'ready' || !viewerId) return;

    // Catch up on what happened while the app was closed, then stay subscribed.
    void pullChats(viewerId).catch(() => {});
    void pullStatus(viewerId).catch(() => {});
    void pullBlocked().catch(() => {});
    void useSettings.getState().load(viewerId).catch(() => {});
    resumeOutbox(viewerId);

    // Presence is written here and cleared on teardown. The trigger in 0006
    // refuses to store it at all when the user's own setting is `nobody`, so a
    // client that ignored the setting would still publish nothing.
    void updatePresence(viewerId, true).catch(() => {});

    const stopMessages = subscribeToMessages(viewerId);
    const stopMembership = subscribeToMembership(viewerId);
    const stopStatus = subscribeToStatus(viewerId);

    return () => {
      void updatePresence(viewerId, false).catch(() => {});
      stopMessages();
      stopMembership();
      stopStatus();
    };
  }, [status, viewerId]);
}
