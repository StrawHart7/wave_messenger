import { Pressable, View } from 'react-native';

import { Avatar, Text } from '../ui';
import type { ContactCard } from '../../services/contactCard';
import { formatE164ForDisplay } from '../../services/phone';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * A shared contact: face, name, number, and one action. The action is a full-width
 * button under a hairline, which is what makes the card read as a card rather than
 * as a message that happens to contain a phone number.
 */
export function ContactBubble({ card, onOpen }: { card: ContactCard; onOpen?: () => void }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ minWidth: 200 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, paddingBottom: spacing.stackSm }}>
        <Avatar name={card.name} size="groupRow" />
        <View style={{ flex: 1 }}>
          <Text variant="chatName" tint={colors.messaging.bubbleText} numberOfLines={1}>
            {card.name}
          </Text>
          <Text variant="bubbleMeta" tint={colors.messaging.meta}>
            {formatE164ForDisplay(card.phone)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.messaging.separator,
          paddingTop: spacing.stackSm,
          paddingBottom: spacing.stackXs,
          alignItems: 'center',
        }}
      >
        <Text variant="buttonText" tint={colors.messaging.link}>
          {card.userId ? 'Message' : 'Add to contacts'}
        </Text>
      </Pressable>
    </View>
  );
}
