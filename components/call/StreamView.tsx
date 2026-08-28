import { View, type StyleProp, type ViewStyle } from 'react-native';

import { loadWebrtc } from '../../services/webrtc';

/**
 * A WebRTC video surface.
 *
 * `RTCView` comes from the native module, so it is pulled through the seam and the
 * component degrades to a plain black rectangle when there is nothing to pull. The
 * call screen then still lays out correctly in Expo Go instead of crashing on an
 * undefined component.
 */
export function StreamView({
  streamUrl,
  mirror = false,
  objectFit = 'cover',
  style,
}: {
  streamUrl: string | null;
  mirror?: boolean;
  objectFit?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
}) {
  const webrtc = loadWebrtc();

  if (!webrtc || !streamUrl) {
    return <View style={style} />;
  }

  const RTCView = webrtc.RTCView;
  return <RTCView streamURL={streamUrl} mirror={mirror} objectFit={objectFit} style={style} />;
}
