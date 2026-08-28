import { router } from 'expo-router';
import { useEffect } from 'react';

import { listCalls } from '../db/calls';
import { configureCallNotifications, notifyIncomingCall } from '../services/callNotifications';
import { cancelledByCaller, recordIncoming } from '../services/callFlow';
import { subscribeToInvites } from '../services/callSignal';
import { pullCallHistory } from '../services/callSync';
import { sortHistory, type CallRecord } from '../services/calls';
import { useCall } from '../stores/call';
import { useSession } from '../stores/session';
import { useLiveQuery } from './useLiveQuery';

export function useCallHistory(): CallRecord[] {
  const records = useLiveQuery(() => listCalls(), []);
  return sortHistory(records);
}

/**
 * The doorbell, mounted once at the root.
 *
 * An invite has to be able to arrive on any screen, so this cannot live on the
 * Calls tab. It routes straight to the call screen — an incoming call that only
 * shows as a banner is one people miss.
 */
export function useIncomingCalls(): void {
  const status = useSession((s) => s.status);
  const viewerId = useSession((s) => s.userId);

  useEffect(() => {
    if (status !== 'ready' || !viewerId) return;

    void configureCallNotifications();
    void pullCallHistory(viewerId).catch(() => {});

    return subscribeToInvites(viewerId, {
      onInvite: (invite) => {
        // Already on a call: the store refuses the second one, and the caller sees
        // it ring out rather than being told "busy" — which is what a second line
        // would need, and this app does not have one.
        if (useCall.getState().call) return;

        recordIncoming(invite);
        useCall.getState().fromInvite(invite);
        void notifyIncomingCall({
          callId: invite.callId,
          callerName: invite.callerName,
          kind: invite.kind,
        });
        router.push(`/call/${invite.callId}`);
      },
      onCancel: (callId) => cancelledByCaller(callId),
    });
  }, [status, viewerId]);
}
