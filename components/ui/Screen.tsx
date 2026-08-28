import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/**
 * App-bar + content shell. The bar is 60px, title centred in accent green, edges at
 * the 16px margin — matching the reference top app bar.
 */
export function Screen({
  title,
  leading,
  trailing,
  titleTint,
  barHeight,
  separator = true,
  children,
}: {
  title: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Tab screens title in accent green; the auth flow uses primary text. */
  titleTint?: string;
  /** 60px on tab screens, 72px (list-item-height) in the auth flow. */
  barHeight?: number;
  separator?: boolean;
  children?: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.tide.background }}>
      <View
        style={{
          height: barHeight ?? spacing.appBarHeight,
          paddingHorizontal: spacing.edgeMargin,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: separator ? 1 : 0,
          borderBottomColor: colors.messaging.separator,
        }}
      >
        <View style={{ width: spacing.avatarXl / 1.5, alignItems: 'flex-start' }}>{leading}</View>
        <Text variant="navTitle" tint={titleTint ?? colors.tide.primary}>
          {title}
        </Text>
        <View style={{ width: spacing.avatarXl / 1.5, alignItems: 'flex-end' }}>{trailing}</View>
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

/** Placeholder body for tabs that later phases fill in. */
export function PhaseStub({ phase, what }: { phase: number; what: string }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.edgeMargin }}>
      <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
        {what}
      </Text>
      <Text variant="sectionHeader" tint={colors.messaging.metaDim} style={{ marginTop: spacing.stackXs }}>
        Phase {phase}
      </Text>
    </View>
  );
}
