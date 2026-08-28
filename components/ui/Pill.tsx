import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

type PillProps = {
  label: string;
  /** Filter chips: the selected one sits on surfaceVariant, the rest on surfaceContainer. */
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, selected = false, onPress, style }: PillProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.edgeMargin,
          paddingVertical: 6,
          borderRadius: radii.full,
          backgroundColor: selected ? colors.tide.surfaceVariant : colors.tide.surfaceContainer,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.tide.outlineVariant,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text variant="sectionHeader" tint={selected ? colors.tide.onSurface : colors.tide.onSurfaceVariant}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Primary action: pill-shaped, accent green, white text, no shadow. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 48,
          paddingHorizontal: spacing.edgeMargin * 1.5,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? colors.messaging.accentPressed : colors.messaging.accent,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text variant="buttonText" tint={colors.messaging.onAccent}>
        {label}
      </Text>
    </Pressable>
  );
}
