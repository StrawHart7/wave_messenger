import { MaterialIcons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bubble, ChatChip, UnreadDivider } from '../../components/chat/Bubble';
import { Composer } from '../../components/chat/Composer';
import { Avatar, Text } from '../../components/ui';
import { getChat, markChatRead } from '../../db/chats';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useMessages } from '../../hooks/useMessages';
import { publicUrl } from '../../services/media';
import { presenceLabel, subscribeToChatPresence } from '../../services/realtime/presence';
import { sendReadReceipts } from '../../services/realtime/messages';
import { draftMessage, enqueue } from '../../services/sync/outbox';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

const wallpaperTile = require('../../assets/chat-wallpaper-tile.png');

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ?? '';
  const { colors, spacing, radii, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const chat = useLiveQuery(() => getChat(chatId), [chatId]);
  const { items, loadOlder, hasMore } = useMessages(chatId, viewerId, chat?.kind === 'group');

  const [draft, setDraft] = useState('');
  const [presence, setPresence] = useState<{ typing: string[]; online: string[] }>({ typing: [], online: [] });
  const [atBottom, setAtBottom] = useState(true);
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
    enqueue(draftMessage({ chatId, senderId: viewerId, body }));
    setDraft('');
    listRef.current?.scrollToEnd({ animated: true });
  }, [draft, chatId, viewerId]);

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
              <Bubble
                message={item.message}
                viewerId={viewerId}
                position={item.position}
                tail={item.position === 'single' || item.position === 'last'}
              />
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

      <Composer
        value={draft}
        onChangeText={(next) => {
          setDraft(next);
          typingRef.current?.();
        }}
        onSend={send}
      />
    </SafeAreaView>
  );
}
