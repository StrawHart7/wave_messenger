import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { formatDuration } from '../../services/waveform';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';

/**
 * The composer while a voice note is being recorded: a pulsing dot, the running
 * timer, "slide to cancel", and a lock affordance for hands-free.
 *
 * The recorder itself lives in hooks/useVoiceRecorder — this only draws its state,
 * so the audio session and the layout can be reasoned about separately.
 */
export function VoiceRecorder({
  elapsedMs,
  locked,
  onCancel,
  onLock,
  onStop,
}: {
  elapsedMs: number;
  locked: boolean;
  onCancel: () => void;
  onLock: () => void;
  onStop: () => void;
}) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.stackMd,
        paddingHorizontal: spacing.edgeMargin,
        paddingVertical: spacing.stackMd,
        backgroundColor: colors.tide.surface,
        borderTopWidth: 1,
        borderTopColor: colors.tide.outlineVariant,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: radii.full,
          backgroundColor: colors.tide.error,
        }}
      />

      <Text variant="chatName" tint={colors.tide.onBackground}>
        {formatDuration(elapsedMs)}
      </Text>

      {locked ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={{ flex: 1, alignItems: 'center' }}
        >
          <Text variant="buttonText" tint={colors.tide.error}>
            Cancel
          </Text>
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <MaterialIcons name="chevron-left" size={18} color={colors.tide.onSurfaceVariant} />
          <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
            slide to cancel
          </Text>
        </View>
      )}

      {!locked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lock recording"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLock();
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.tide.surfaceContainer,
          }}
        >
          <MaterialIcons name="lock-outline" size={18} color={colors.tide.onSurfaceVariant} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send voice message"
        onPress={onStop}
        style={{
          width: spacing.composerActionSize,
          height: spacing.composerActionSize,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.messaging.accent,
        }}
      >
        <MaterialIcons name="send" size={22} color={colors.messaging.onAccent} />
      </Pressable>
    </View>
  );
}
