/**
 * The WebRTC driver seam.
 *
 * `react-native-webrtc` is a native module: it does not exist in Expo Go, and
 * importing it at module scope crashes the whole app on launch there rather than
 * failing at the one screen that needs it. So it is required lazily, once, and
 * everything downstream asks `isWebrtcAvailable()` first.
 *
 * This is the same shape as services/storage.ts, and for the same reason: the
 * project runs without a development build until the user asks for one.
 */

type WebrtcModule = typeof import('react-native-webrtc');

let cached: WebrtcModule | null = null;
let attempted = false;

export function loadWebrtc(): WebrtcModule | null {
  if (attempted) return cached;
  attempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-webrtc') as WebrtcModule;
  } catch {
    // Expo Go, or a build without the native module linked.
    cached = null;
  }

  return cached;
}

export function isWebrtcAvailable(): boolean {
  return loadWebrtc() !== null;
}

/** The message every call surface shows when there is no native module to call with. */
export const NO_WEBRTC_MESSAGE =
  'Calls need a development build — the WebRTC module is native and is not present in Expo Go.';

export function assertWebrtc(): WebrtcModule {
  const module = loadWebrtc();
  if (!module) throw new Error(NO_WEBRTC_MESSAGE);
  return module;
}
