import { View } from 'react-native';

import { Avatar, type AvatarSize } from '../ui/Avatar';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * An avatar inside a status ring: accent green while anything is unseen, grey once
 * everything has been watched.
 *
 * The reference draws a single continuous ring rather than one arc per post. Arcs
 * are what Instagram does; WhatsApp's own list does not, and segmenting a ring
 * around a 48px circle turns into hairlines nobody can read anyway.
 */
export function StatusAvatar({
  uri,
  name,
  viewed,
  size = 'lg',
}: {
  uri: string | null;
  name: string;
  viewed: boolean;
  size?: AvatarSize;
}) {
  const { colors, spacing, radii } = useTheme();

  return (
    <View
      style={{
        padding: spacing.statusRingGap,
        borderRadius: radii.full,
        borderWidth: spacing.statusRingWidth,
        borderColor: viewed ? colors.messaging.statusRingViewed : colors.messaging.statusRing,
      }}
    >
      <Avatar uri={uri} name={name} size={size} />
    </View>
  );
}
