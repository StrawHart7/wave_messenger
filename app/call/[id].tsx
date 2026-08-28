import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StreamView } from '../../components/call/StreamView';
import { Avatar, Text } from '../../components/ui';
import { answerCall, declineIncoming, flipCamera, hangUp, toggleCamera, toggleMute } from '../../services/callFlow';
import { callStatusLabel, isTerminal } from '../../services/calls';
import { publicUrl } from '../../services/media';
import { NO_WEBRTC_MESSAGE } from '../../services/webrtc';
import { useCall } from '../../stores/call';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One screen for all three stages of a call — outgoing, incoming and active.
 *
 * The reference draws two, but they are the same surface at different moments: the
 * same avatar, the same name, the same status line. Splitting them into two routes
 * would mean a navigation transition at the instant somebody answers, which is the
 * one moment a call must not flicker.
 */
export default function CallScreen() {
  const { colors, spacing, radii } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const call = useCall((s) => s.call);

  const [elapsed, setElapsed] = useState(0);

  // The duration ticks in state rather than on the UI thread: it changes once a
  // second, and a second is not a frame budget worth optimising.
  useEffect(() => {
    if (!call?.answeredAt) return;
    const timer = setInterval(() => setElapsed(Date.now() - call.answeredAt!), 1000);
    return () => clearInterval(timer);
  }, [call?.answeredAt]);

  // The screen owns nothing: when the call ends anywhere, it leaves.
  useEffect(() => {
    if (call === null || isTerminal(call.status)) {
      const timer = setTimeout(() => router.back(), call === null ? 0 : 900);
      return () => clearTimeout(timer);
    }
  }, [call]);

  const answer = useCallback(() => {
    void answerCall(viewerId).catch((error: Error) => {
      Alert.alert('Could not answer', error.message === NO_WEBRTC_MESSAGE ? error.message : 'Try again.');
    });
  }, [viewerId]);

  if (!call) {
    return <View style={{ flex: 1, backgroundColor: colors.tide.inverseSurface }} />;
  }

  const isVideo = call.kind === 'video';
  const showsRemoteVideo = isVideo && call.status === 'active' && call.remoteStreamUrl !== null;
  const ringing = call.status === 'ringing';
  const incoming = call.direction === 'incoming';

  return (
    <View style={{ flex: 1, backgroundColor: colors.tide.inverseSurface }}>
      {showsRemoteVideo ? (
        <StreamView
          streamUrl={call.remoteStreamUrl}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        {/* Header: name and the status line, which becomes the clock once connected. */}
        <View style={{ alignItems: 'center', paddingTop: spacing.edgeMargin, gap: spacing.stackXs }}>
          <Text variant="chatName" tint={colors.messaging.onStatusOverlay}>
            {call.peerName}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.stackSm,
              paddingHorizontal: spacing.stackMd,
              paddingVertical: spacing.stackXs,
              borderRadius: radii.full,
              backgroundColor: colors.messaging.statusOverlay,
            }}
          >
            {call.status === 'active' ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radii.full,
                  backgroundColor: colors.messaging.accent,
                }}
              />
            ) : null}
            <Text variant="timestamp" tint={colors.messaging.onStatusOverlay}>
              {callStatusLabel({
                status: call.status,
                direction: call.direction,
                kind: call.kind,
                durationMs: elapsed,
              })}
            </Text>
          </View>
        </View>

        {/* The avatar carries the call whenever there is no remote video to show —
            a voice call, or a video call still ringing. */}
        {!showsRemoteVideo ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Avatar
              uri={call.peerAvatarPath ? publicUrl('avatars', call.peerAvatarPath) : null}
              name={call.peerName}
              size="xl"
            />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* PiP self-view, only once there is a local camera feed to put in it. */}
        {isVideo && call.localStreamUrl && call.cameraEnabled ? (
          <StreamView
            streamUrl={call.localStreamUrl}
            mirror
            style={{
              position: 'absolute',
              top: spacing.heroCollapsedHeight + spacing.edgeMargin * 3,
              right: spacing.edgeMargin,
              width: 112,
              height: 160,
              borderRadius: radii.xl,
              overflow: 'hidden',
              backgroundColor: colors.tide.surfaceContainerLowest,
            }}
          />
        ) : null}

        {ringing && incoming ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.edgeMargin * 2.5,
              paddingBottom: spacing.edgeMargin * 2,
            }}
          >
            <RoundButton
              label="Decline"
              icon="call-end"
              size={72}
              background={colors.tide.error}
              foreground={colors.tide.onError}
              onPress={() => declineIncoming(viewerId)}
            />
            <RoundButton
              label="Accept"
              icon="call"
              size={72}
              background={colors.messaging.accent}
              foreground={colors.messaging.onAccent}
              onPress={answer}
            />
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.edgeMargin * 1.5,
              paddingBottom: spacing.edgeMargin * 2,
            }}
          >
            {isVideo ? (
              <RoundButton
                label="Flip camera"
                icon="flip-camera-ios"
                size={48}
                background={colors.messaging.statusOverlay}
                foreground={colors.messaging.onStatusOverlay}
                onPress={flipCamera}
              />
            ) : null}

            {isVideo ? (
              <RoundButton
                label={call.cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                icon={call.cameraEnabled ? 'videocam' : 'videocam-off'}
                size={48}
                // An active toggle inverts, so its state reads without a label.
                background={call.cameraEnabled ? colors.messaging.statusOverlay : colors.tide.surface}
                foreground={call.cameraEnabled ? colors.messaging.onStatusOverlay : colors.tide.onSurface}
                onPress={toggleCamera}
              />
            ) : null}

            <RoundButton
              label={call.muted ? 'Unmute' : 'Mute'}
              icon={call.muted ? 'mic-off' : 'mic'}
              size={48}
              background={call.muted ? colors.tide.surface : colors.messaging.statusOverlay}
              foreground={call.muted ? colors.tide.onSurface : colors.messaging.onStatusOverlay}
              onPress={toggleMute}
            />

            <RoundButton
              label="End call"
              icon="call-end"
              size={56}
              background={colors.tide.error}
              foreground={colors.tide.onError}
              onPress={hangUp}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function RoundButton({
  label,
  icon,
  size,
  background,
  foreground,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  size: number;
  background: string;
  foreground: string;
  onPress: () => void;
}) {
  const { radii } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <MaterialIcons name={icon} size={size >= 72 ? 34 : 24} color={foreground} />
    </Pressable>
  );
}
