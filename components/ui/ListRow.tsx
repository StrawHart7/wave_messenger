import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type ListRowProps = {
  leading?: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  height?: number;
  /** Hairline separators are inset to the text, never to the screen edge. */
  separator?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  leading,
  children,
  trailing,
  height,
  separator = true,
  onPress,
  onLongPress,
  style,
}: ListRowProps) {
  const { colors, spacing } = useTheme();
  const leadingWidth = spacing.avatarLg + spacing.stackMd;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        {
          height: height ?? spacing.listItemHeight,
          paddingHorizontal: spacing.edgeMargin,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? colors.tide.surfaceVariant : 'transparent',
        },
        style,
      ]}
    >
      {leading ? <View style={{ marginRight: spacing.stackMd }}>{leading}</View> : null}

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>{children}</View>

      {trailing ? <View style={{ marginLeft: spacing.stackSm }}>{trailing}</View> : null}

      {separator ? (
        <View
          style={{
            position: 'absolute',
            left: spacing.edgeMargin + (leading ? leadingWidth : 0),
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: colors.messaging.separator,
          }}
        />
      ) : null}
    </Pressable>
  );
}
