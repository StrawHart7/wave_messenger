import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The banded card the info screens are built from: a surface block with hairlines
 * top and bottom, separated from its neighbour by the background showing through.
 * That gap is the only grouping cue these screens have — there are no headings on
 * most sections.
 */
export function InfoSection({
  title,
  trailing,
  children,
}: {
  title?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        marginTop: spacing.stackSm,
        backgroundColor: colors.tide.surfaceContainerLowest,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.messaging.separator,
        paddingVertical: spacing.stackSm,
      }}
    >
      {title ? (
        <View
          style={{
            paddingHorizontal: spacing.edgeMargin,
            paddingVertical: spacing.stackSm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
            {title}
          </Text>
          {trailing}
        </View>
      ) : null}

      {children}
    </View>
  );
}

/** A 56px settings line: icon, label, optional subtitle, optional trailing control. */
export function InfoRow({
  icon,
  label,
  subtitle,
  tint,
  trailing,
  chevron = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  subtitle?: string | null;
  /** Error red for the destructive rows at the foot of the screen. */
  tint?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const { colors, spacing, iconSizes } = useTheme();
  const color = tint ?? colors.tide.onBackground;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingHorizontal: spacing.edgeMargin,
        paddingVertical: spacing.stackMd,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.edgeMargin,
        backgroundColor: pressed ? colors.tide.surfaceVariant : 'transparent',
      })}
    >
      <MaterialIcons name={icon} size={iconSizes.lg} color={tint ?? colors.tide.onSurfaceVariant} />

      <View style={{ flex: 1 }}>
        <Text variant="chatName" tint={color}>
          {label}
        </Text>
        {subtitle ? (
          <Text variant="timestamp" tint={colors.tide.onSurfaceVariant} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
      {chevron ? (
        <MaterialIcons name="chevron-right" size={iconSizes.md} color={colors.tide.onSurfaceVariant} />
      ) : null}
    </Pressable>
  );
}

/** Audio / Video / Search — the circular actions under an info hero. */
export function QuickActions({
  actions,
}: {
  actions: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; onPress?: () => void }[];
}) {
  const { colors, spacing, radii, iconSizes } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.edgeMargin * 1.5, marginTop: spacing.edgeMargin }}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={{ alignItems: 'center', gap: spacing.stackXs }}
        >
          <View
            style={{
              width: spacing.quickActionSize,
              height: spacing.quickActionSize,
              borderRadius: radii.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.tide.surfaceContainer,
            }}
          >
            <MaterialIcons name={action.icon} size={iconSizes.lg} color={colors.tide.primary} />
          </View>
          <Text variant="labelSm" tint={colors.tide.primary}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
