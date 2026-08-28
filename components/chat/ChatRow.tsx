import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import {
  isMuted,
  listTimestamp,
  mediaIcon,
  previewPrefix,
  previewText,
  type ChatSummary,
} from '../../services/chatList';
import { showsTicks } from '../../services/messageState';
import { useTheme } from '../../theme/ThemeProvider';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { ListRow } from '../ui/ListRow';
import { Text } from '../ui/Text';
import { Ticks } from '../ui/Ticks';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export function ChatRow({
  summary,
  viewerId,
  avatarUri,
  onPress,
  onLongPress,
}: {
  summary: ChatSummary;
  viewerId: string;
  avatarUri?: string | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing, iconSizes } = useTheme();
  const message = summary.lastMessage;
  const prefix = previewPrefix(summary, viewerId);
  const icon = message ? (mediaIcon(message) as IconName | null) : null;
  const muted = isMuted(summary);
  const unread = summary.unreadCount > 0;

  return (
    <ListRow
      onPress={onPress}
      onLongPress={onLongPress}
      leading={
        <Avatar uri={avatarUri} name={summary.title} size="lg" online={summary.isOnline} />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1} style={{ flex: 1 }}>
          {summary.title}
        </Text>
        {message ? (
          <Text
            variant="timestamp"
            // An unread chat times its last message in accent green, as the
            // reference row does — it is the second unread cue after the badge.
            tint={unread ? colors.messaging.accent : colors.messaging.metaDim}
            style={{ marginLeft: spacing.stackSm }}
          >
            {listTimestamp(message.createdAt)}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
        {message && showsTicks(message, viewerId) && !message.deletedAt ? (
          <View style={{ marginRight: 4 }}>
            <Ticks state={message.state === 'failed' ? 'pending' : message.state} size={16} />
          </View>
        ) : null}

        {prefix ? (
          <Text variant="messageBody" tint={colors.messaging.meta} style={{ marginRight: 4 }}>
            {prefix}
          </Text>
        ) : null}

        {icon ? (
          <MaterialIcons
            name={icon}
            size={iconSizes.sm}
            color={colors.messaging.metaDim}
            style={{ marginRight: 4 }}
          />
        ) : null}

        <Text
          variant="messageBody"
          tint={colors.messaging.meta}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {previewText(summary)}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: spacing.stackSm }}>
          {summary.pinned ? (
            <MaterialIcons name="push-pin" size={iconSizes.sm} color={colors.messaging.metaDim} />
          ) : null}
          {muted ? (
            <MaterialIcons name="notifications-off" size={iconSizes.sm} color={colors.messaging.metaDim} />
          ) : null}
          <Badge count={summary.unreadCount} />
        </View>
      </View>
    </ListRow>
  );
}
