import { View } from 'react-native';

import { messageTime } from '../../services/grouping';
import type { RunPosition } from '../../services/grouping';
import { showsTicks, type LocalMessage } from '../../services/messageState';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Ticks } from '../ui/Ticks';

/**
 * A message bubble.
 *
 * The tail sits at the *top* outer corner (top-right outgoing, top-left incoming),
 * drawn as a clipped triangle — that is what the reference does, and it is why the
 * first bubble of a run looks anchored while the rest float.
 */
export function Bubble({
  message,
  viewerId,
  position,
  senderName,
  tail,
}: {
  message: LocalMessage;
  viewerId: string;
  position: RunPosition;
  /** Group chats colour and label the sender above the first bubble of a run. */
  senderName?: string | null;
  tail: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const outgoing = message.senderId === viewerId;

  const background = outgoing ? colors.messaging.bubbleOutgoing : colors.messaging.bubbleIncoming;
  const showsSender = Boolean(senderName) && !outgoing && (position === 'first' || position === 'single');

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: outgoing ? 'flex-end' : 'flex-start',
        marginBottom: position === 'last' || position === 'single' ? spacing.stackSm : spacing.stackXs,
        paddingHorizontal: spacing.stackSm,
      }}
    >
      <View
        style={{
          maxWidth: `${spacing.bubbleMaxWidthRatio * 100}%`,
          backgroundColor: background,
          borderRadius: radii.bubble,
          borderTopRightRadius: outgoing && tail ? radii.bubbleTail : radii.bubble,
          borderTopLeftRadius: !outgoing && tail ? radii.bubbleTail : radii.bubble,
          paddingHorizontal: spacing.stackMd,
          paddingVertical: spacing.stackSm,
        }}
      >
        {showsSender ? (
          <Text variant="labelSm" tint={colors.tide.secondary} style={{ marginBottom: 2 }}>
            {senderName}
          </Text>
        ) : null}

        {message.deletedAt ? (
          <Text
            variant="bubbleBody"
            tint={colors.messaging.meta}
            style={{ fontStyle: 'italic', paddingRight: 56 }}
          >
            This message was deleted
          </Text>
        ) : (
          <Text variant="bubbleBody" tint={colors.messaging.bubbleText} style={{ paddingRight: 56 }}>
            {message.body}
          </Text>
        )}

        {/* Timestamp and ticks overlap the last line's trailing padding, exactly as
            the reference does — a separate row would add 20px to every bubble. */}
        <View
          style={{
            position: 'absolute',
            right: spacing.stackSm,
            bottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Text variant="bubbleMeta" tint={colors.messaging.meta}>
            {messageTime(message.createdAt)}
          </Text>
          {showsTicks(message, viewerId) ? (
            <Ticks state={message.state === 'failed' ? 'pending' : message.state} size={14} />
          ) : null}
        </View>

        {tail ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              [outgoing ? 'right' : 'left']: -spacing.bubbleTailSize,
              width: spacing.bubbleTailSize,
              height: spacing.bubbleTailSize * 1.5,
              backgroundColor: background,
              // A triangle, cut by rounding the inner corner away.
              borderTopRightRadius: outgoing ? 0 : spacing.bubbleTailSize,
              borderTopLeftRadius: outgoing ? spacing.bubbleTailSize : 0,
              borderBottomLeftRadius: outgoing ? spacing.bubbleTailSize : 0,
              borderBottomRightRadius: outgoing ? 0 : spacing.bubbleTailSize,
              transform: [{ scaleX: outgoing ? 1 : -1 }],
            }}
          />
        ) : null}
      </View>

      {message.state === 'failed' ? (
        <Text variant="bubbleMeta" tint={colors.tide.error} style={{ alignSelf: 'flex-end', marginLeft: 4 }}>
          Not sent
        </Text>
      ) : null}
    </View>
  );
}

/** The centred chip used for date separators and system notices. */
export function ChatChip({ label }: { label: string }) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={{ alignItems: 'center', marginVertical: spacing.stackMd }}>
      <View
        style={{
          paddingHorizontal: spacing.stackMd,
          paddingVertical: 6,
          borderRadius: radii.lg,
          backgroundColor: colors.tide.surface,
        }}
      >
        <Text variant="chip" tint={colors.tide.onSurfaceVariant} style={{ textTransform: 'uppercase' }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** The "Unread messages" divider. */
export function UnreadDivider({ count }: { count: number }) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.tide.surfaceContainer,
        paddingVertical: 6,
        marginVertical: spacing.stackSm,
        alignItems: 'center',
      }}
    >
      <Text variant="chip" tint={colors.tide.onSurfaceVariant}>
        {count === 1 ? '1 unread message' : `${count} unread messages`}
      </Text>
    </View>
  );
}
