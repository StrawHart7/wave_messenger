import { MaterialIcons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentSheet, type AttachmentAction } from '../../../components/chat/AttachmentSheet';
import { Bubble, ChatChip, UnreadDivider } from '../../../components/chat/Bubble';
import { Composer } from '../../../components/chat/Composer';
import { MessageActions, type MessageAction } from '../../../components/chat/MessageActions';
import { SwipeToReply } from '../../../components/chat/SwipeToReply';
import { VoiceRecorder } from '../../../components/chat/VoiceRecorder';
import { TypingBubble } from '../../../components/chat/TypingBubble';
import { ContactPicker } from '../../../components/group/ContactPicker';
import { Avatar, Text } from '../../../components/ui';
import { AvatarStack } from '../../../components/ui/AvatarStack';
import { removeReaction, setReaction } from '../../../db/attachments';
import { getChat, markChatRead } from '../../../db/chats';
import { memberIds } from '../../../db/members';
import { markDeleted } from '../../../db/messages';
import { displayNames, getProfile } from '../../../db/profiles';
import { useConversation } from '../../../hooks/useConversation';
import { useLiveQuery } from '../../../hooks/useLiveQuery';
import { useKnownProfiles, useMembers } from '../../../hooks/useMembers';
import { useSignedUrls } from '../../../hooks/useSignedUrls';
import { useVoiceRecorder } from '../../../hooks/useVoiceRecorder';
import { kindForMime } from '../../../services/attachments';
import { encodeContactCard } from '../../../services/contactCard';
import { placeCall } from '../../../services/callFlow';
import type { CallKind } from '../../../services/calls';
import { filterCandidates, groupSubtitle, headerMemberLine, senderTintIndex } from '../../../services/groups';
import { refreshMembers } from '../../../services/groupSync';
import type { LocalMessage } from '../../../services/messageState';
import { publicUrl } from '../../../services/media';
import { sendReadReceipts } from '../../../services/realtime/messages';
import { presenceLabel, subscribeToChatPresence } from '../../../services/realtime/presence';
import { toggle } from '../../../services/reactions';
import { NO_WEBRTC_MESSAGE, isWebrtcAvailable } from '../../../services/webrtc';
import { pullMessages } from '../../../services/sync/bootstrap';
import { draftMessage, enqueue } from '../../../services/sync/outbox';
import { compressImage, sendMedia } from '../../../services/sync/uploads';
import { useSession } from '../../../stores/session';
import { useTheme } from '../../../theme/ThemeProvider';

const wallpaperTile = require('../../../assets/chat-wallpaper-tile.png');

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ?? '';
  const { colors, spacing, radii, iconSizes } = useTheme();
  const { width } = useWindowDimensions();
  const viewerId = useSession((s) => s.userId) ?? '';
  const profile = useSession((s) => s.profile);

  const chat = useLiveQuery(() => getChat(chatId), [chatId]);
  const isGroup = chat?.kind === 'group';
  const { items, loadOlder, hasMore } = useConversation(chatId, viewerId, isGroup);
  const members = useMembers(chatId, viewerId);
  const recorder = useVoiceRecorder();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [presence, setPresence] = useState<{ typing: string[]; online: string[] }>({ typing: [], online: [] });
  const [atBottom, setAtBottom] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<LocalMessage | null>(null);
  const [contactPicker, setContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const typingRef = useRef<(() => void) | null>(null);
  const listRef = useRef<FlashListRef<(typeof items)[number]>>(null);

  // A group's membership can have changed while the app was closed — a rename, a
  // new participant, or the viewer's own removal.
  useEffect(() => {
    if (!isGroup || !chatId || !viewerId) return;
    void refreshMembers(chatId, viewerId).catch(() => {});
  }, [isGroup, chatId, viewerId]);

  // Opening the conversation is what clears the badge and sends read receipts.
  useEffect(() => {
    if (!chatId || !viewerId) return;
    markChatRead(chatId, viewerId);
    void sendReadReceipts(chatId, viewerId);
    // The thread renders from SQLite immediately; this fills in anything this
    // device has never seen, behind whatever is already on screen.
    void pullMessages(chatId, viewerId).catch(() => {});
  }, [chatId, viewerId]);

  useEffect(() => {
    if (!chatId || !viewerId) return;
    const channel = subscribeToChatPresence(chatId, viewerId, setPresence);
    typingRef.current = channel.setTyping;
    return () => {
      typingRef.current = null;
      channel.stop();
    };
  }, [chatId, viewerId]);

  const send = useCallback(() => {
    const body = draft.trim();
    if (body.length === 0 || !viewerId) return;
    enqueue(draftMessage({ chatId, senderId: viewerId, body, replyToId: replyTo?.id ?? null }));
    setDraft('');
    setReplyTo(null);
    listRef.current?.scrollToEnd({ animated: true });
  }, [draft, chatId, viewerId, replyTo]);

  const attach = useCallback(
    async (action: AttachmentAction) => {
      if (!viewerId) return;

      if (action === 'gallery' || action === 'camera') {
        const picker =
          action === 'camera'
            ? await ImagePicker.launchCameraAsync({ quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1 });

        if (picker.canceled || !picker.assets[0]) return;
        const asset = picker.assets[0];
        const isVideo = asset.type === 'video';

        // Video is uploaded as captured; images are shrunk first.
        const prepared = isVideo
          ? { uri: asset.uri, width: asset.width, height: asset.height }
          : await compressImage(asset.uri);

        const result = sendMedia({
          chatId,
          senderId: viewerId,
          kind: isVideo ? 'video' : 'image',
          media: {
            localUri: prepared.uri,
            mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
            byteSize: asset.fileSize ?? 0,
            fileName: asset.fileName ?? 'media',
            width: prepared.width,
            height: prepared.height,
            durationMs: asset.duration ?? null,
          },
        });

        if (!result.ok) Alert.alert('Too large', 'That file is over the size limit for this chat.');
        return;
      }

      if (action === 'document') {
        const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (picked.canceled || !picked.assets[0]) return;
        const asset = picked.assets[0];

        const result = sendMedia({
          chatId,
          senderId: viewerId,
          kind: kindForMime(asset.mimeType ?? 'application/octet-stream'),
          media: {
            localUri: asset.uri,
            mimeType: asset.mimeType ?? 'application/octet-stream',
            byteSize: asset.size ?? 0,
            fileName: asset.name,
          },
        });

        if (!result.ok) Alert.alert('Too large', 'That file is over the size limit for this chat.');
        return;
      }

      if (action === 'contact') {
        setContactPicker(true);
        return;
      }

      // Location and poll need a map surface and a vote model respectively; both
      // are their own feature rather than a variation on sending a file.
      Alert.alert('Not yet', `${action} attachments arrive in a later phase.`);
    },
    [chatId, viewerId],
  );

  const startRecording = useCallback(async () => {
    const granted = await recorder.start();
    if (!granted) Alert.alert('Microphone needed', 'Allow microphone access to record voice messages.');
  }, [recorder]);

  const finishRecording = useCallback(async () => {
    const result = await recorder.stop();
    if (!result || !viewerId) return;

    sendMedia({
      chatId,
      senderId: viewerId,
      kind: 'voice',
      media: {
        localUri: result.uri,
        mimeType: 'audio/m4a',
        byteSize: 0,
        fileName: 'voice.m4a',
        durationMs: result.durationMs,
        waveform: result.waveform,
      },
    });
  }, [recorder, chatId, viewerId]);

  const react = useCallback(
    (message: LocalMessage, emoji: string) => {
      if (!message.id || !viewerId) return;

      // The pill updates from SQLite immediately; the server row follows.
      const existing = items
        .flatMap((item) => (item.type === 'message' && item.message.id === message.id ? item.reactionPills ?? [] : []))
        .flatMap((pill) => pill.userIds.map((userId) => ({ messageId: message.id!, userId, emoji: pill.emoji, createdAt: 0 })));

      const result = toggle(existing, viewerId, emoji);
      if (result.action === 'remove') removeReaction(message.id, viewerId);
      else setReaction({ messageId: message.id, userId: viewerId, emoji, createdAt: Date.now() });
    },
    [items, viewerId],
  );

  const runAction = useCallback(
    (message: LocalMessage, action: MessageAction) => {
      switch (action) {
        case 'reply':
          setReplyTo(message);
          break;
        case 'copy':
          if (message.body) void Clipboard.setStringAsync(message.body);
          break;
        case 'delete':
          markDeleted(message.clientId, Date.now());
          break;
        default:
          Alert.alert('Not yet', `${action} arrives in a later phase.`);
      }
    },
    [],
  );

  // Typing ids become names through the same profile cache the bubbles read.
  const typingProfiles = useLiveQuery(() => displayNames(presence.typing), [presence.typing]);
  const typingNames = presence.typing
    .map((userId) => typingProfiles.get(userId)?.displayName ?? '')
    .filter((name) => name.length > 0);

  /**
   * Calling from the conversation. Group calls are refused rather than half-built:
   * a mesh of peer connections is a different piece of engineering from a 1:1 call,
   * and one that has to wait until 1:1 is proven on real devices.
   */
  const call = useCallback(
    async (kind: CallKind) => {
      if (isGroup) {
        Alert.alert('Not yet', 'Group calls arrive after 1:1 calling is verified on real devices.');
        return;
      }
      if (!isWebrtcAvailable()) {
        Alert.alert('Not available here', NO_WEBRTC_MESSAGE);
        return;
      }

      const peer = memberIds(chatId).find((userId) => userId !== viewerId);
      if (!peer) return;

      try {
        const callId = await placeCall({
          selfId: viewerId,
          selfName: profile?.displayName ?? '',
          selfAvatarPath: profile?.avatarPath ?? null,
          chatId,
          peerId: peer,
          peerName: chat?.title ?? '',
          peerAvatarPath: chat?.avatarPath ?? null,
          kind,
        });
        router.push(`/call/${callId}`);
      } catch {
        Alert.alert('Could not start the call', 'Check your connection and try again.');
      }
    },
    // `chat` whole, not its two fields: the closure captures the object, and the
    // compiler refuses to preserve a memo whose stated deps are narrower than the
    // ones it can see.
    [isGroup, chatId, viewerId, profile, chat],
  );

  const subtitle = isGroup
    ? groupSubtitle({ typingNames, memberLine: headerMemberLine(members, viewerId) })
    : presenceLabel({
        typing: presence.typing.length > 0,
        online: presence.online.some((userId) => userId !== viewerId),
        lastSeenAt: null,
      });

  // Tapping the header is how you reach group info or a contact card, exactly as
  // it is in the reference — there is no other affordance for it on this screen.
  const openInfo = useCallback(() => {
    if (isGroup) {
      router.push(`/chat/${chatId}/info`);
      return;
    }
    const peer = memberIds(chatId).find((userId) => userId !== viewerId);
    if (peer) router.push(`/contact/${peer}`);
  }, [isGroup, chatId, viewerId]);

  const senderTints = colors.messaging.senderTints;

  const knownContacts = useKnownProfiles([viewerId]);
  const contactCandidates = filterCandidates(knownContacts, { query: contactSearch });

  const shareContact = useCallback(
    (candidate: { userId: string; displayName: string }) => {
      setContactPicker(false);
      // The number is not in the picker's shape; it comes from the profile cache.
      const phone = getProfile(candidate.userId)?.phone ?? '';
      enqueue(
        draftMessage({
          chatId,
          senderId: viewerId,
          kind: 'contact',
          body: encodeContactCard({
            name: candidate.displayName,
            phone,
            userId: candidate.userId,
          }),
        }),
      );
    },
    [chatId, viewerId],
  );

  // Signed URLs for every attachment on the page, minted once for the whole list.
  const mediaUrls = useSignedUrls(
    items.flatMap((item) =>
      item.type === 'message' && item.attachment && !item.attachment.localUri
        ? [item.attachment.storagePath]
        : [],
    ),
  );

  // In a group the reply banner has to name the person, not the chat.
  const replyToProfiles = useLiveQuery(
    () => displayNames(replyTo ? [replyTo.senderId] : []),
    [replyTo?.senderId],
  );
  const replyToName = replyTo
    ? (replyToProfiles.get(replyTo.senderId)?.displayName ?? (chat?.title ?? ''))
    : '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.tide.surface }}>
      <View
        style={{
          height: spacing.appBarHeight,
          paddingHorizontal: spacing.stackSm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.stackSm,
          borderBottomWidth: 1,
          borderBottomColor: colors.tide.outlineVariant,
        }}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isGroup ? 'Group info' : 'Contact info'}
          onPress={openInfo}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm }}
        >
          {isGroup && !chat?.avatarPath && members.length > 1 ? (
            <AvatarStack
              faces={members
                .filter((member) => member.userId !== viewerId)
                .map((member) => ({
                  uri: member.avatarPath ? publicUrl('avatars', member.avatarPath) : null,
                  name: member.displayName,
                }))}
            />
          ) : (
            <Avatar
              uri={chat?.avatarPath ? publicUrl('avatars', chat.avatarPath) : null}
              name={chat?.title ?? ''}
              size="sm"
            />
          )}

          <View style={{ flex: 1 }}>
            <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
              {chat?.title ?? ''}
            </Text>
            {subtitle ? (
              <Text
                variant="bubbleMeta"
                tint={typingNames.length > 0 ? colors.tide.primary : colors.messaging.meta}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Video call"
          onPress={() => void call('video')}
          hitSlop={8}
        >
          <MaterialIcons name="videocam" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice call"
          onPress={() => void call('voice')}
          hitSlop={8}
        >
          <MaterialIcons name="call" size={iconSizes.lg} color={colors.tide.primary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="More" hitSlop={8}>
          <MaterialIcons name="more-vert" size={iconSizes.lg} color={colors.tide.primary} />
        </Pressable>
      </View>

      <ImageBackground
        source={wallpaperTile}
        resizeMode="repeat"
        style={{ flex: 1, backgroundColor: colors.messaging.wallpaper }}
      >
        <FlashList
          ref={listRef}
          data={items}
          keyExtractor={(item) =>
            item.type === 'message' ? item.message.clientId : `${item.type}-${item.key}`
          }
          // Older messages load at the *start* of an upright chat list.
          onStartReached={hasMore ? loadOlder : undefined}
          onStartReachedThreshold={0.4}
          maintainVisibleContentPosition={{
            startRenderingFromBottom: true,
            autoscrollToBottomThreshold: 0.2,
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
            setAtBottom(distanceFromBottom < 80);
          }}
          contentContainerStyle={{ paddingVertical: spacing.stackMd }}
          ListFooterComponent={
            presence.typing.length > 0 && isGroup ? (
              <TypingBubble
                name={typingNames[0] ?? ''}
                avatarPath={
                  members.find((member) => member.userId === presence.typing[0])?.avatarPath ?? null
                }
              />
            ) : presence.typing.length > 0 ? (
              <TypingBubble />
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'date') return <ChatChip label={item.label} />;
            if (item.type === 'unread') return <UnreadDivider count={item.count} />;

            // Membership changes are narrated by the server as system messages, and
            // they read as notices in the thread rather than as anyone's bubble.
            if (item.message.kind === 'system') {
              return <ChatChip label={item.message.body ?? ''} />;
            }

            return (
              <SwipeToReply onReply={() => setReplyTo(item.message)}>
                <Bubble
                  message={item.message}
                  viewerId={viewerId}
                  position={item.position}
                  tail={item.position === 'single' || item.position === 'last'}
                  senderName={isGroup ? item.sender?.displayName : null}
                  senderTint={
                    senderTints[senderTintIndex(item.message.senderId, senderTints.length)]
                  }
                  senderAvatarUri={
                    item.sender?.avatarPath ? publicUrl('avatars', item.sender.avatarPath) : null
                  }
                  gutter={isGroup}
                  showsAvatar={item.showsAvatar}
                  attachment={item.attachment}
                  attachmentUri={
                    item.attachment ? (mediaUrls.get(item.attachment.storagePath) ?? null) : null
                  }
                  reactions={item.reactionPills}
                  replyTo={item.replyTo}
                  maxMediaWidth={Math.min(260, width * 0.62)}
                  onLongPress={() => setActionsFor(item.message)}
                  onOpenContact={(userId) => userId && router.push(`/contact/${userId}`)}
                />
              </SwipeToReply>
            );
          }}
        />

        {!atBottom ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest messages"
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            style={{
              position: 'absolute',
              right: spacing.edgeMargin,
              bottom: spacing.edgeMargin,
              width: 40,
              height: 40,
              borderRadius: radii.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.tide.surfaceContainerLowest,
              borderWidth: 1,
              borderColor: colors.tide.outlineVariant,
            }}
          >
            <MaterialIcons name="keyboard-arrow-down" size={iconSizes.lg} color={colors.tide.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </ImageBackground>

      {replyTo ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.stackSm,
            paddingHorizontal: spacing.edgeMargin,
            paddingVertical: spacing.stackSm,
            backgroundColor: colors.tide.surfaceContainer,
            borderLeftWidth: 3,
            borderLeftColor: colors.messaging.accent,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="labelSm" tint={colors.tide.secondary}>
              {replyTo.senderId === viewerId ? 'You' : replyToName}
            </Text>
            <Text variant="bubbleMeta" tint={colors.messaging.meta} numberOfLines={1}>
              {replyTo.body ?? replyTo.kind}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReplyTo(null)} hitSlop={8}>
            <MaterialIcons name="close" size={iconSizes.md} color={colors.tide.onSurfaceVariant} />
          </Pressable>
        </View>
      ) : null}

      {recorder.isRecording ? (
        <VoiceRecorder
          elapsedMs={recorder.elapsedMs}
          locked={recorder.locked}
          onCancel={() => void recorder.cancel()}
          onLock={recorder.lock}
          onStop={() => void finishRecording()}
        />
      ) : (
        <Composer
          value={draft}
          onChangeText={(next) => {
            setDraft(next);
            typingRef.current?.();
          }}
          onSend={send}
          onAttach={() => setSheetOpen(true)}
          onCamera={() => void attach('camera')}
          onMic={() => void startRecording()}
        />
      )}

      <AttachmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={(action) => void attach(action)}
      />

      <Modal
        visible={contactPicker}
        animationType="slide"
        onRequestClose={() => setContactPicker(false)}
      >
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.tide.background }}>
          <View
            style={{
              height: spacing.appBarHeight,
              paddingHorizontal: spacing.edgeMargin,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.stackMd,
              borderBottomWidth: 1,
              borderBottomColor: colors.messaging.separator,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setContactPicker(false)}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={iconSizes.xl} color={colors.tide.primary} />
            </Pressable>
            <Text variant="navTitle" tint={colors.tide.onBackground}>
              Share contact
            </Text>
          </View>

          <ContactPicker
            candidates={contactCandidates}
            search={contactSearch}
            onSearch={setContactSearch}
            onToggle={shareContact}
          />
        </SafeAreaView>
      </Modal>

      <MessageActions
        visible={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        onReact={(emoji) => actionsFor && react(actionsFor, emoji)}
        onAction={(action) => actionsFor && runAction(actionsFor, action)}
      />
    </SafeAreaView>
  );
}
