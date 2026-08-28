/**
 * The incoming-call notification.
 *
 * What this can and cannot do, stated plainly because the difference matters:
 *
 *  - **App in the foreground** — the invite arrives over the Realtime channel and
 *    the full-screen incoming UI is pushed. No notification involved.
 *  - **App in the background but alive** — the channel is usually still connected,
 *    so a local notification is posted here. Tapping it opens the call.
 *  - **App killed** — nothing arrives. A killed app has no socket, so no amount of
 *    local-notification code can help; that case needs a *push* notification and,
 *    for a real ringing screen over the lock screen, CallKit on iOS and
 *    ConnectionService on Android. All three need a development build, an APNs/FCM
 *    key, and a server-side trigger. That work is not done here and is recorded as
 *    outstanding in PLAN.md rather than faked.
 *
 * expo-notifications is loaded through a seam for the same reason WebRTC is: it is
 * native, and the project still runs without a development build.
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
let attempted = false;

function load(): NotificationsModule | null {
  if (attempted) return cached;
  attempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }

  return cached;
}

export function areCallNotificationsAvailable(): boolean {
  return load() !== null;
}

let configured = false;

/** Called once, when the session becomes ready. Safe to call repeatedly. */
export async function configureCallNotifications(): Promise<void> {
  const notifications = load();
  if (!notifications || configured) return;
  configured = true;

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await notifications.requestPermissionsAsync().catch(() => null);
}

/**
 * Posts the ringing notification. Fire-and-forget: a failure here must never stop
 * the in-app call UI, which is the path that actually works.
 */
export async function notifyIncomingCall(input: {
  callId: string;
  callerName: string;
  kind: 'voice' | 'video';
}): Promise<void> {
  const notifications = load();
  if (!notifications) return;

  await notifications
    .scheduleNotificationAsync({
      content: {
        title: input.callerName || 'Incoming call',
        body: input.kind === 'video' ? 'Incoming video call' : 'Incoming voice call',
        data: { callId: input.callId, type: 'call' },
        // A call is the one thing in a messenger that earns a full-volume alert.
        priority: notifications.AndroidNotificationPriority.MAX,
        sound: true,
      },
      trigger: null,
    })
    .catch(() => {});
}

/** Pulls the notification once the call is answered, declined or missed. */
export async function dismissCallNotification(): Promise<void> {
  const notifications = load();
  if (!notifications) return;
  await notifications.dismissAllNotificationsAsync().catch(() => {});
}
