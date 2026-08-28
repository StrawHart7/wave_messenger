import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeProvider';

/** Drag past this and releasing triggers the reply. */
const TRIGGER_DISTANCE = 56;
/** The bubble stops moving here, so a long drag does not tear the row apart. */
const MAX_DRAG = 80;

/**
 * Drag a bubble to the right to reply.
 *
 * `activeOffsetX` is what makes this coexist with the vertical list: the gesture
 * only claims the touch after 12px of horizontal movement, so scrolling still wins
 * every ambiguous drag.
 */
export function SwipeToReply({
  onReply,
  children,
}: {
  onReply: () => void;
  children: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);

  const fire = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply();
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.max(0, Math.min(MAX_DRAG, event.translationX));

      // Haptic at the threshold, once per drag — buzzing on every frame past it is
      // the classic way to make a good gesture feel broken.
      if (!triggered.value && translateX.value >= TRIGGER_DISTANCE) {
        triggered.value = true;
        runOnJS(fire)();
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      triggered.value = false;
    });

  const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, translateX.value / TRIGGER_DISTANCE),
    transform: [{ scale: 0.6 + 0.4 * Math.min(1, translateX.value / TRIGGER_DISTANCE) }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: spacing.edgeMargin,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            },
            iconStyle,
          ]}
        >
          <MaterialIcons name="reply" size={20} color={colors.tide.onSurfaceVariant} />
        </Animated.View>

        <Animated.View style={bubbleStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
