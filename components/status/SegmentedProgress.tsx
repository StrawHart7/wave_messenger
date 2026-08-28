import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * The row of segment bars across the top of the status viewer.
 *
 * Only the current segment animates, and it does so from a shared value on the UI
 * thread. Driving it from React state would re-render the whole viewer — video
 * included — sixty times a second to move a 3px bar.
 */
export function SegmentedProgress({
  count,
  index,
  progress,
}: {
  count: number;
  index: number;
  /** 0..1 for the segment at `index`. */
  progress: SharedValue<number>;
}) {
  const { colors, spacing, radii } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.stackXs }}>
      {Array.from({ length: count }, (_, position) => (
        <View
          key={position}
          style={{
            flex: 1,
            height: spacing.statusProgressHeight,
            borderRadius: radii.full,
            overflow: 'hidden',
            backgroundColor: colors.messaging.statusOverlay,
          }}
        >
          {position < index ? (
            <View style={{ flex: 1, backgroundColor: colors.messaging.onStatusOverlay }} />
          ) : position === index ? (
            <ActiveBar progress={progress} color={colors.messaging.onStatusOverlay} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ActiveBar({ progress, color }: { progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <Animated.View style={[{ height: '100%', backgroundColor: color }, style]} />;
}
