import { View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from './Avatar';
import { Text } from './Text';

/**
 * The overlapping avatar cluster in a group's app bar.
 *
 * Overflow is counted, not truncated: "+3" tells you how big the group is, where a
 * fourth cropped face tells you nothing. Each avatar carries a surface-coloured ring
 * so the overlap reads as depth rather than as one smudged shape.
 */
export function AvatarStack({
  faces,
  max = 2,
  ringColor,
}: {
  faces: { uri: string | null; name: string }[];
  max?: number;
  /** Defaults to the app-bar surface; pass the container behind the stack. */
  ringColor?: string;
}) {
  const { colors, spacing, radii } = useTheme();
  const size = spacing.avatarStack;
  const shown = faces.slice(0, max);
  const overflow = faces.length - shown.length;
  const ring = ringColor ?? colors.tide.surface;

  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((face, index) => (
        <View
          key={`${face.name}-${index}`}
          style={{
            width: size,
            height: size,
            borderRadius: radii.full,
            borderWidth: 2,
            borderColor: ring,
            overflow: 'hidden',
            marginLeft: index === 0 ? 0 : -spacing.stackMd,
            // Earlier faces sit on top, matching the reference's z-order.
            zIndex: shown.length - index,
          }}
        >
          <Avatar uri={face.uri} name={face.name} size="sm" />
        </View>
      ))}

      {overflow > 0 ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radii.full,
            borderWidth: 2,
            borderColor: ring,
            marginLeft: -spacing.stackMd,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.tide.surfaceVariant,
          }}
        >
          <Text variant="chip" tint={colors.tide.onSurfaceVariant}>
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
