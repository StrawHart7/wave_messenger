import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Switch, View } from 'react-native';

import { Text } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The rounded card the settings screens are built from — a surface block with a
 * hairline border, rows divided by inset separators.
 *
 * Different from `InfoSection` (the group/contact screens) on purpose: those bands
 * run edge to edge, these are inset cards. Both come from the reference, and
 * flattening them into one component would mean one of the two screens stops
 * matching it.
 */
export function SettingsCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors, spacing, radii } = useTheme();

  return (
    <View style={{ gap: spacing.stackSm }}>
      {title ? (
        <Text
          variant="labelSm"
          tint={colors.tide.onSurfaceVariant}
          style={{ paddingHorizontal: spacing.edgeMargin, textTransform: 'uppercase', letterSpacing: 1 }}
        >
          {title}
        </Text>
      ) : null}

      <View
        style={{
          borderRadius: radii.xl,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.messaging.separator,
          backgroundColor: colors.tide.surfaceContainerLowest,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsRow({
  icon,
  iconTint,
  iconBackground,
  label,
  description,
  value,
  valueTint,
  chevron = false,
  toggle,
  onToggle,
  onPress,
  separator = true,
}: {
  icon?: React.ComponentProps<typeof MaterialIcons>['name'];
  iconTint?: string;
  iconBackground?: string;
  label: string;
  description?: string;
  /** The trailing summary — "Everyone", "3 chats", a count. */
  value?: string;
  valueTint?: string;
  chevron?: boolean;
  toggle?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  separator?: boolean;
}) {
  const { colors, spacing, radii, iconSizes } = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : toggle !== undefined ? 'switch' : undefined}
      accessibilityLabel={label}
      accessibilityState={toggle !== undefined ? { checked: toggle } : undefined}
      onPress={onPress ?? (toggle !== undefined ? () => onToggle?.(!toggle) : undefined)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.edgeMargin,
        padding: spacing.edgeMargin,
        borderBottomWidth: separator ? 1 : 0,
        borderBottomColor: colors.messaging.separator,
        backgroundColor: pressed ? colors.tide.surfaceVariant : 'transparent',
      })}
    >
      {icon ? (
        <View
          style={{
            width: spacing.avatarGroupRow,
            height: spacing.avatarGroupRow,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconBackground ?? colors.tide.surfaceContainer,
          }}
        >
          <MaterialIcons name={icon} size={iconSizes.md} color={iconTint ?? colors.tide.primary} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="chatName" tint={colors.tide.onBackground}>
          {label}
        </Text>
        {description ? (
          <Text variant="timestamp" tint={colors.tide.onSurfaceVariant}>
            {description}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text variant="messageBody" tint={valueTint ?? colors.tide.onSurfaceVariant}>
          {value}
        </Text>
      ) : null}

      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          trackColor={{ true: colors.tide.primary, false: colors.tide.surfaceVariant }}
          thumbColor={colors.tide.surfaceContainerLowest}
        />
      ) : null}

      {chevron ? (
        <MaterialIcons name="chevron-right" size={iconSizes.md} color={colors.tide.onSurfaceVariant} />
      ) : null}
    </Pressable>
  );
}
