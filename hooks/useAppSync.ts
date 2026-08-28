import { useEffect } from 'react';

import { subscribeToMembership } from '../services/realtime/membership';
import { subscribeToMessages } from '../services/realtime/messages';
import { subscribeToStatus } from '../services/realtime/status';
import { pullChats } from '../services/sync/bootstrap';
import { resumeOutbox } from '../services/sync/outbox';
import { pullStatus } from '../services/statusSync';
import { useSession } from '../stores/session';
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
    resumeOutbox(viewerId);

    const stopMessages = subscribeToMessages(viewerId);
    const stopMembership = subscribeToMembership(viewerId);
    const stopStatus = subscribeToStatus(viewerId);

    return () => {
      stopMessages();
      stopMembership();
      stopStatus();
    };
  }, [status, viewerId]);
}
