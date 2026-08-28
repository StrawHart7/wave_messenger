import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * Delivery state, drawn exactly as the reference: clock, one grey check, two grey
 * checks, two blue checks. This component is the single source of that mapping —
 * never re-derive tick colors at a call site.
 */
export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read';

export function Ticks({ state, size }: { state: DeliveryState; size?: number }) {
  const { colors, iconSizes } = useTheme();
  const glyphSize = size ?? iconSizes.sm;

  if (state === 'pending') {
    return <MaterialIcons name="schedule" size={glyphSize} color={colors.messaging.tickPending} />;
  }

  const color = state === 'read' ? colors.messaging.tickRead : colors.messaging.tickSent;

  if (state === 'sent') {
    return <MaterialIcons name="check" size={glyphSize} color={color} />;
  }

  // Delivered and read are the double tick; only the color changes.
  return (
    <View style={{ flexDirection: 'row' }}>
      <MaterialIcons name="check" size={glyphSize} color={color} />
      <MaterialIcons name="check" size={glyphSize} color={color} style={{ marginLeft: -glyphSize * 0.42 }} />
    </View>
  );
}
