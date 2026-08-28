import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'groupRow' | 'lg' | 'xl';

type AvatarProps = {
  uri?: string | null;
  /** Used for the initials fallback when there is no image. */
  name?: string;
  size?: AvatarSize;
  /** Green presence dot at the bottom-right. */
  online?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_KEY = {
  sm: 'avatarSm',
  groupRow: 'avatarGroupRow',
  lg: 'avatarLg',
  xl: 'avatarXl',
} as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Always circular, with a hairline inner border so light avatars do not blend into
 * light backgrounds (DESIGN.md, Avatars).
 */
export function Avatar({ uri, name = '', size = 'lg', online = false, style }: AvatarProps) {
  const { colors, spacing } = useTheme();
  const diameter = spacing[SIZE_KEY[size]];

  return (
    <View style={[{ width: diameter, height: diameter }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            borderWidth: 1,
            borderColor: colors.tide.outlineVariant,
          }}
        />
      ) : (
        <View
          style={{
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: colors.tide.surfaceContainerHighest,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
            {initials(name)}
          </Text>
        </View>
      )}

      {online ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: spacing.statusDot,
            height: spacing.statusDot,
            borderRadius: spacing.statusDot / 2,
            backgroundColor: colors.messaging.accent,
            borderWidth: 2.5,
            borderColor: colors.tide.background,
          }}
        />
      ) : null}
    </View>
  );
}
