import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import type { TypeRole } from '../../theme/tokens';

type TextProps = Omit<RNTextProps, 'role'> & {
  /**
   * Type role from DESIGN.md. Named `variant` rather than `role` because React
   * Native reserves `role` for the ARIA role.
   */
  variant?: TypeRole;
  /** Any palette value; defaults to primary body text. */
  tint?: string;
};

/**
 * The only Text used in the app. Passing a raw fontSize or fontFamily through
 * `style` defeats the point of the token layer.
 */
export function Text({ variant = 'messageBody', tint, style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  return <RNText {...rest} style={[type(variant), { color: tint ?? colors.tide.onBackground }, style]} />;
}
