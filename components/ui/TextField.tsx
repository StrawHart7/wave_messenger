import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  /**
   * `row` sits inside a grouped container with hairline separators (phone entry).
   * `underline` is a single bottom rule that turns accent on focus (profile name).
   */
  appearance?: 'row' | 'underline';
  /** Rendered to the left inside the field — the dial code, for instance. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  focused?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { appearance = 'row', leading, trailing, focused = false, containerStyle, ...rest },
  ref,
) {
  const { colors, spacing, type } = useTheme();

  return (
    <View
      style={[
        {
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: appearance === 'row' ? colors.tide.surfaceContainerLowest : 'transparent',
          borderBottomWidth: appearance === 'underline' ? 2 : 1,
          borderBottomColor: focused ? colors.tide.primary : colors.tide.outlineVariant,
        },
        containerStyle,
      ]}
    >
      {leading}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.tide.onSurfaceVariant}
        style={[
          type('navTitle'),
          {
            flex: 1,
            height: '100%',
            paddingHorizontal: spacing.edgeMargin,
            color: colors.tide.onBackground,
          },
        ]}
        {...rest}
      />
      {trailing}
    </View>
  );
});
