import { Pressable, View } from 'react-native';

import { Avatar } from '../ui/Avatar';
import type { Attachment } from '../../services/attachments';
import { messageTime, type RunPosition } from '../../services/grouping';
import { showsTicks, type LocalMessage } from '../../services/messageState';
import type { ReactionPill } from '../../services/reactions';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Ticks } from '../ui/Ticks';
import { decodeContactCard } from '../../services/contactCard';
import { ContactBubble } from './ContactBubble';
import { DocumentAttachment, MediaAttachment } from './MediaBubble';
import { VoiceNote } from './VoiceNoteBubble';

export type BubbleProps = {
  message: LocalMessage;
  viewerId: string;
  position: RunPosition;
  tail: boolean;
  senderName?: string | null;
  /** Per-sender name colour in a group; falls back to the secondary tint. */
  senderTint?: string;
  /** The sender's avatar, drawn in the group gutter next to the last bubble of a run. */
  senderAvatarUri?: string | null;
  /** Reserve the gutter even when this bubble does not draw the avatar. */
  gutter?: boolean;
  /** Draw the avatar in the reserved gutter. */
  showsAvatar?: boolean;
  attachment?: Attachment | null;
  /** Signed URL for a remote attachment; null while it is still resolving. */
  attachmentUri?: string | null;
  reactions?: ReactionPill[];
  /** The quoted message this one replies to, already resolved. */
  replyTo?: { senderName: string; preview: string } | null;
  maxMediaWidth?: number;
  onLongPress?: () => void;
  onPressReaction?: () => void;
  /** Tapping a shared contact's action. */
  onOpenContact?: (userId: string | undefined) => void;
};

/**
 * A message bubble, in every kind it can take.
 *
 * The tail sits at the *top* outer corner (top-right outgoing, top-left incoming) —
 * that is what the reference does, and it is why the first bubble of a run looks
 * anchored while the rest float.
 */
export function Bubble({
  message,
  viewerId,
  position,
  tail,
  senderName,
  senderTint,
  senderAvatarUri,
  gutter = false,
  showsAvatar = false,
  attachment,
  attachmentUri,
  reactions = [],
  replyTo,
  maxMediaWidth = 260,
  onLongPress,
  onPressReaction,
  onOpenContact,
}: BubbleProps) {
  const { colors, radii, spacing } = useTheme();
  const outgoing = message.senderId === viewerId;

  const background = outgoing ? colors.messaging.bubbleOutgoing : colors.messaging.bubbleIncoming;
  // The name heads the run; the avatar ends it. That is what the reference does,
  // and it is what keeps a long run from repeating either.
  const showsSender = Boolean(senderName) && !outgoing && (position === 'first' || position === 'single');
  const isMedia = message.kind === 'image' || message.kind === 'video' || message.kind === 'sticker';
  const contactCard = message.kind === 'contact' ? decodeContactCard(message.body) : null;
  // A contact card lives in the body, so the body must not also render as text.
  const hasText = Boolean(message.body) && !message.deletedAt && contactCard === null;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: outgoing ? 'flex-end' : 'flex-start',
        marginBottom:
          reactions.length > 0
            ? spacing.edgeMargin
            : position === 'last' || position === 'single'
              ? spacing.stackSm
              : spacing.stackXs,
        paddingHorizontal: spacing.stackSm,
        alignItems: 'flex-end',
        gap: spacing.stackSm,
      }}
    >
      {/* The gutter is reserved for the whole run, so bubbles in a run share one
          left edge and only the last of them carries a face. */}
      {gutter && !outgoing ? (
        showsAvatar ? (
          <Avatar uri={senderAvatarUri ?? null} name={senderName ?? ''} size="sm" />
        ) : (
          <View style={{ width: spacing.avatarBubbleGutter }} />
        )
      ) : null}

      <Pressable
        onLongPress={onLongPress}
        delayLongPress={250}
        style={{
          maxWidth: `${spacing.bubbleMaxWidthRatio * 100}%`,
          backgroundColor: background,
          borderRadius: radii.bubble,
          borderTopRightRadius: outgoing && tail ? radii.bubbleTail : radii.bubble,
          borderTopLeftRadius: !outgoing && tail ? radii.bubbleTail : radii.bubble,
          // Media sits flush inside a 3px frame; text bubbles get real padding.
          padding: isMedia ? 3 : undefined,
          paddingHorizontal: isMedia ? 3 : spacing.stackMd,
          paddingVertical: isMedia ? 3 : spacing.stackSm,
        }}
      >
        {showsSender ? (
          <Text
            variant="labelSm"
            tint={senderTint ?? colors.tide.secondary}
            style={{ marginBottom: 2, paddingHorizontal: isMedia ? spacing.stackSm : 0 }}
          >
            {senderName}
          </Text>
        ) : null}

        {replyTo ? (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: colors.messaging.accent,
              backgroundColor: colors.tide.surfaceContainer,
              borderRadius: radii.md,
              paddingHorizontal: spacing.stackSm,
              paddingVertical: 6,
              marginBottom: spacing.stackXs,
            }}
          >
            <Text variant="labelSm" tint={colors.tide.secondary}>
              {replyTo.senderName}
            </Text>
            <Text variant="bubbleMeta" tint={colors.messaging.meta} numberOfLines={1}>
              {replyTo.preview}
            </Text>
          </View>
        ) : null}

        {attachment && isMedia ? (
          <MediaAttachment
            attachment={attachment}
            uri={attachmentUri ?? null}
            maxWidth={maxMediaWidth}
            isVideo={message.kind === 'video'}
          />
        ) : null}

        {attachment && message.kind === 'voice' ? (
          <VoiceNote attachment={attachment} uri={attachment.localUri ?? attachmentUri ?? null} tint={colors.messaging.meta} />
        ) : null}

        {attachment && message.kind === 'document' ? (
          <DocumentAttachment attachment={attachment} tint={colors.messaging.meta} />
        ) : null}

        {contactCard && !message.deletedAt ? (
          <ContactBubble card={contactCard} onOpen={() => onOpenContact?.(contactCard.userId)} />
        ) : null}

        {message.deletedAt ? (
          <Text
            variant="bubbleBody"
            tint={colors.messaging.meta}
            style={{ fontStyle: 'italic', paddingRight: 56 }}
          >
            This message was deleted
          </Text>
        ) : hasText ? (
          <Text
            variant="bubbleBody"
            tint={colors.messaging.bubbleText}
            style={{
              paddingRight: 56,
              paddingHorizontal: isMedia ? spacing.stackSm : 0,
              paddingTop: isMedia ? 6 : 0,
              paddingBottom: isMedia ? spacing.stackMd : 0,
            }}
          >
            {message.body}
          </Text>
        ) : null}

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
            // Over an image the meta needs its own scrim to stay legible.
            paddingHorizontal: isMedia && !hasText ? 6 : 0,
            paddingVertical: isMedia && !hasText ? 2 : 0,
            borderRadius: radii.md,
            backgroundColor: isMedia && !hasText ? 'rgba(0,0,0,0.35)' : 'transparent',
          }}
        >
          <Text
            variant="bubbleMeta"
            tint={isMedia && !hasText ? colors.messaging.onAccent : colors.messaging.meta}
          >
            {messageTime(message.createdAt)}
          </Text>
          {showsTicks(message, viewerId) ? (
            <Ticks state={message.state === 'failed' ? 'pending' : message.state} size={14} />
          ) : null}
        </View>

        {reactions.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See reactions"
            onPress={onPressReaction}
            style={{
              position: 'absolute',
              bottom: -14,
              [outgoing ? 'right' : 'left']: spacing.stackMd,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: radii.full,
              backgroundColor: colors.tide.surfaceContainerLowest,
              borderWidth: 1,
              borderColor: colors.tide.outlineVariant,
            }}
          >
            {reactions.slice(0, 3).map((pill) => (
              <Text key={pill.emoji} variant="bubbleMeta" tint={colors.tide.onSurface} style={{ fontSize: 12 }}>
                {pill.emoji}
              </Text>
            ))}
            {reactions.reduce((sum, pill) => sum + pill.count, 0) > 1 ? (
              <Text variant="bubbleMeta" tint={colors.messaging.meta}>
                {reactions.reduce((sum, pill) => sum + pill.count, 0)}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

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
      </Pressable>

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
