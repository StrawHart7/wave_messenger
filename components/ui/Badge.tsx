import { View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

/** Unread count. Green pill, white centred text, 22px minimum (reference chat rows). */
export function Badge({ count }: { count: number }) {
  const { colors, radii } = useTheme();
  if (count <= 0) return null;

  return (
    <View
      style={{
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: radii.full,
        backgroundColor: colors.messaging.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="labelSm" tint={colors.messaging.onAccent}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
