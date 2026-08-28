import { MaterialIcons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ImageBackground, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttachmentSheet, type AttachmentAction } from '../../components/chat/AttachmentSheet';
import { Bubble, ChatChip, UnreadDivider } from '../../components/chat/Bubble';
import { Composer } from '../../components/chat/Composer';
import { MessageActions, type MessageAction } from '../../components/chat/MessageActions';
import { SwipeToReply } from '../../components/chat/SwipeToReply';
import { VoiceRecorder } from '../../components/chat/VoiceRecorder';
import { Avatar, Text } from '../../components/ui';
import { removeReaction, setReaction } from '../../db/attachments';
import { getChat, markChatRead } from '../../db/chats';
import { markDeleted } from '../../db/messages';
import { useConversation } from '../../hooks/useConversation';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { kindForMime } from '../../services/attachments';
import type { LocalMessage } from '../../services/messageState';
import { publicUrl } from '../../services/media';
import { sendReadReceipts } from '../../services/realtime/messages';
import { presenceLabel, subscribeToChatPresence } from '../../services/realtime/presence';
import { toggle } from '../../services/reactions';
import { draftMessage, enqueue } from '../../services/sync/outbox';
import { compressImage, sendMedia } from '../../services/sync/uploads';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

const wallpaperTile = require('../../assets/chat-wallpaper-tile.png');

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ?? '';
  const { colors, spacing, radii, iconSizes } = useTheme();
  const { width } = useWindowDimensions();
  const viewerId = useSession((s) => s.userId) ?? '';

  const chat = useLiveQuery(() => getChat(chatId), [chatId]);
  const { items, loadOlder, hasMore } = useConversation(chatId, viewerId, chat?.kind === 'group');
  const recorder = useVoiceRecorder();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [presence, setPresence] = useState<{ typing: string[]; online: string[] }>({ typing: [], online: [] });
  const [atBottom, setAtBottom] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<LocalMessage | null>(null);
  const typingRef = useRef<(() => void) | null>(null);
  const listRef = useRef<FlashListRef<(typeof items)[number]>>(null);

  // Opening the conversation is what clears the badge and sends read receipts.
  useEffect(() => {
    if (!chatId || !viewerId) return;
    markChatRead(chatId, viewerId);
    void sendReadReceipts(chatId, viewerId);
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

  const subtitle = presenceLabel({
    typing: presence.typing.length > 0,
    online: presence.online.some((userId) => userId !== viewerId),
    lastSeenAt: null,
  });

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

        <Avatar
          uri={chat?.avatarPath ? publicUrl('avatars', chat.avatarPath) : null}
          name={chat?.title ?? ''}
          size="sm"
        />

        <View style={{ flex: 1 }}>
          <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
            {chat?.title ?? ''}
          </Text>
          {subtitle ? (
            <Text variant="bubbleMeta" tint={colors.messaging.meta}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Video call" hitSlop={8}>
          <MaterialIcons name="videocam" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Voice call" hitSlop={8}>
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
          renderItem={({ item }) => {
            if (item.type === 'date') return <ChatChip label={item.label} />;
            if (item.type === 'unread') return <UnreadDivider count={item.count} />;

            return (
              <SwipeToReply onReply={() => setReplyTo(item.message)}>
                <Bubble
                  message={item.message}
                  viewerId={viewerId}
                  position={item.position}
                  tail={item.position === 'single' || item.position === 'last'}
                  attachment={item.attachment}
                  reactions={item.reactionPills}
                  replyTo={item.replyTo}
                  maxMediaWidth={Math.min(260, width * 0.62)}
                  onLongPress={() => setActionsFor(item.message)}
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
              {replyTo.senderId === viewerId ? 'You' : (chat?.title ?? '')}
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

      <MessageActions
        visible={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        onReact={(emoji) => actionsFor && react(actionsFor, emoji)}
        onAction={(action) => actionsFor && runAction(actionsFor, action)}
      />
    </SafeAreaView>
  );
}
