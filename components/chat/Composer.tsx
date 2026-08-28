import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * The composer. The trailing button is a mic until there is text, then a send
 * arrow — that swap is the single most recognisable interaction in the app, so it
 * is driven straight off the input value rather than any derived state.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  onAttach,
  onCamera,
  onMic,
  enterToSend = false,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  onCamera?: () => void;
  onMic?: () => void;
  /** Return sends instead of adding a newline (Settings → Chats). */
  enterToSend?: boolean;
}) {
  const { colors, radii, spacing, type, iconSizes } = useTheme();
  const [height, setHeight] = useState<number>(spacing.composerMinHeight);
  const hasText = value.trim().length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.stackSm,
        paddingHorizontal: spacing.stackSm,
        paddingVertical: spacing.stackSm,
        backgroundColor: colors.tide.surface,
        borderTopWidth: 1,
        borderTopColor: colors.tide.outlineVariant,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add attachment"
        onPress={onAttach}
        style={{ height: spacing.composerActionSize, justifyContent: 'center', paddingHorizontal: 6 }}
      >
        <MaterialIcons name="add" size={iconSizes.tab} color={colors.messaging.accent} />
      </Pressable>

      <View
        style={{
          flex: 1,
          minHeight: spacing.composerMinHeight,
          borderRadius: radii.composer,
          backgroundColor: colors.tide.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: colors.tide.outlineVariant,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.edgeMargin,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={colors.tide.onSurfaceVariant}
          multiline
          // `submitBehavior` keeps the keyboard up after a send; a composer that
          // dismisses it makes a back-and-forth conversation a tapping exercise.
          submitBehavior={enterToSend ? 'submit' : 'newline'}
          returnKeyType={enterToSend ? 'send' : 'default'}
          onSubmitEditing={enterToSend ? onSend : undefined}
          onContentSizeChange={(event) =>
            // Grow with the text but stop at roughly five lines, as WhatsApp does.
            setHeight(Math.min(120, Math.max(spacing.composerMinHeight, event.nativeEvent.contentSize.height)))
          }
          style={[
            type('composer'),
            {
              flex: 1,
              color: colors.tide.onBackground,
              height,
              paddingTop: spacing.stackMd,
              paddingBottom: spacing.stackMd,
            },
          ]}
        />

        <Pressable accessibilityRole="button" accessibilityLabel="Camera" onPress={onCamera} hitSlop={8}>
          <MaterialIcons name="photo-camera" size={iconSizes.xl} color={colors.tide.onSurfaceVariant} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasText ? 'Send' : 'Record a voice message'}
        onPress={hasText ? onSend : onMic}
        style={({ pressed }) => ({
          width: spacing.composerActionSize,
          height: spacing.composerActionSize,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.messaging.accentPressed : colors.messaging.accent,
        })}
      >
        <MaterialIcons
          name={hasText ? 'send' : 'mic'}
          size={iconSizes.lg}
          color={colors.messaging.onAccent}
        />
      </Pressable>
    </View>
  );
}
