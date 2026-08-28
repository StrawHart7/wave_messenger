import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '../ui';
import { publicUrl } from '../../services/media';
import { useTheme } from '../../theme/ThemeProvider';

const DOTS = [0, 1, 2];
const DOT_MS = 420;

/**
 * The three-dot bubble at the foot of the thread while someone types.
 *
 * It sits in the list's footer rather than as a list item: a typing bubble that
 * were data would push the unread divider and the scroll anchor around every time
 * somebody paused for two seconds.
 */
export function TypingBubble({ avatarPath, name }: { avatarPath?: string | null; name?: string }) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.stackSm,
        paddingHorizontal: spacing.stackMd,
        paddingBottom: spacing.stackSm,
      }}
    >
      {name !== undefined ? (
        <Avatar uri={avatarPath ? publicUrl('avatars', avatarPath) : null} name={name} size="sm" />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: spacing.stackMd,
          paddingVertical: spacing.stackMd,
          borderRadius: radii.bubble,
          borderTopLeftRadius: radii.bubbleTail,
          backgroundColor: colors.messaging.bubbleIncoming,
        }}
      >
        {DOTS.map((index) => (
          <Dot key={index} index={index} color={colors.messaging.metaDim} />
        ))}
      </View>
    </View>
  );
}

function Dot({ index, color }: { index: number; color: string }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    // Each dot runs the same loop, started a third of a beat apart.
    offset.value = withRepeat(
      withSequence(
        withTiming(0, { duration: index * (DOT_MS / 3) }),
        withTiming(-4, { duration: DOT_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: DOT_MS / 2, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [index, offset]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}
