import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { SegmentedProgress } from '../../components/status/SegmentedProgress';
import { ViewerSheet } from '../../components/status/ViewerSheet';
import { Avatar, Text } from '../../components/ui';
import { useAuthorRing, useStatusRings, useStatusViewers } from '../../hooks/useStatus';
import { useSignedUrls } from '../../hooks/useSignedUrls';
import { findOrCreateDirectChat } from '../../services/chatSync';
import { BUCKETS, publicUrl } from '../../services/media';
import { advance, entryIndex, replyPreview, segmentDurationMs, statusTime } from '../../services/status';
import { deleteStatus, pullViewers, recordView } from '../../services/statusSync';
import { draftMessage, enqueue } from '../../services/sync/outbox';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The full-screen status viewer.
 *
 * Progress is a Reanimated shared value driven by `withTiming`, with a plain
 * `setTimeout` for the hand-off. The alternative — ticking React state every frame
 * — re-renders the video surface sixty times a second to move a 3px bar, which is
 * exactly the kind of thing that makes a video stutter on a mid-range Android.
 */
export default function StatusViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const authorId = userId ?? '';
  const { colors, spacing, radii, iconSizes, type } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const { rings } = useStatusRings(viewerId);
  const ring = useAuthorRing(authorId, viewerId);
  const isMine = authorId === viewerId;

  // Null means "not chosen yet", so the entry point can be derived during render
  // from whatever the live query has produced rather than set from an effect.
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const progress = useSharedValue(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const remaining = useRef(0);
  // True only while a finger is held down. It is what tells the timer's cleanup
  // whether it is pausing (keep the leftover) or moving on (discard it).
  const holding = useRef(false);

  const posts = ring?.posts ?? [];
  const index = chosenIndex ?? (ring ? entryIndex(ring) : 0);
  const post = posts[index] ?? null;
  const viewers = useStatusViewers(isMine && post ? post.id : null);

  const mediaUrls = useSignedUrls(
    posts.filter((entry) => entry.storagePath && !entry.localUri).map((entry) => entry.storagePath!),
    BUCKETS.status,
  );
  const source = post ? (post.localUri ?? (post.storagePath ? (mediaUrls.get(post.storagePath) ?? null) : null)) : null;

  const player = useVideoPlayer(post?.kind === 'video' ? source : null, (instance) => {
    instance.loop = false;
  });

  const authorIndex = rings.findIndex((entry) => entry.authorId === authorId);

  const goToAuthor = useCallback(
    (direction: 'next' | 'previous') => {
      const target = rings[authorIndex + (direction === 'next' ? 1 : -1)];
      if (!target) {
        router.back();
        return;
      }
      router.replace(`/status/${target.authorId}`);
    },
    [rings, authorIndex],
  );

  const step = useCallback(
    (direction: 'next' | 'previous') => {
      if (!ring) return;

      const result = advance({
        index,
        count: ring.posts.length,
        direction,
        // Your own ring is opened on its own, never as part of the rotation.
        isFirstAuthor: isMine || authorIndex <= 0,
        isLastAuthor: isMine || authorIndex === rings.length - 1,
      });

      if (result.type === 'close') router.back();
      else if (result.type === 'author') goToAuthor(result.direction);
      else setChosenIndex(result.index);
    },
    [ring, index, isMine, authorIndex, rings.length, goToAuthor],
  );

  // The timer for the current segment. Restarted whenever the segment or the pause
  // state changes; `remaining` is what survives a hold.
  useEffect(() => {
    if (!post || paused) return;

    const duration = segmentDurationMs(post);
    const left = remaining.current > 0 ? remaining.current : duration;

    progress.value = 1 - left / duration;
    progress.value = withTiming(1, { duration: left, easing: Easing.linear });
    startedAt.current = Date.now();

    advanceTimer.current = setTimeout(() => {
      remaining.current = 0;
      step('next');
    }, left);

    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
      cancelAnimation(progress);
      // A hold keeps what is left of the segment so the resume picks up where the
      // finger landed; anything else is a new segment, which starts from zero.
      remaining.current = holding.current
        ? Math.max(left - (Date.now() - startedAt.current), 0)
        : 0;
    };
  }, [post, paused, progress, step]);

  // Seeing a post is what records the view — and it is recorded locally first, so
  // the ring greys out on the tap rather than on the round trip.
  useEffect(() => {
    if (!post || isMine || post.viewed) return;
    void recordView(post.id, viewerId).catch(() => {});
  }, [post, isMine, viewerId]);

  // The author's own viewer list is only worth fetching for the post on screen.
  useEffect(() => {
    if (!isMine || !post) return;
    void pullViewers(post.id).catch(() => {});
  }, [isMine, post]);

  useEffect(() => {
    if (post?.kind !== 'video') return;
    if (paused) player.pause();
    else player.play();
  }, [post?.kind, paused, player]);

  const hold = useCallback(() => {
    holding.current = true;
    setPaused(true);
  }, []);

  const release = useCallback(() => {
    holding.current = false;
    setPaused(false);
  }, []);

  const sendReply = useCallback(async () => {
    const body = reply.trim();
    if (body.length === 0 || !post) return;
    setReply('');

    try {
      const chatId = await findOrCreateDirectChat(viewerId, {
        userId: authorId,
        displayName: ring?.displayName ?? '',
        avatarPath: ring?.avatarPath ?? null,
      });

      // The status is quoted as text rather than as a reply_to_id: a status is not
      // a message, and the quote has to survive its 24 hours expiring.
      enqueue(draftMessage({ chatId, senderId: viewerId, body: `↩ ${replyPreview(post)}\n${body}` }));
      router.back();
      router.push(`/chat/${chatId}`);
    } catch {
      Alert.alert('Could not reply', 'Check your connection and try again.');
    }
  }, [reply, post, viewerId, authorId, ring]);

  const remove = useCallback(() => {
    if (!post) return;
    setSheetOpen(false);
    Alert.alert('Delete status', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteStatus(post.id, post.storagePath).catch(() => {});
          router.back();
        },
      },
    ]);
  }, [post]);

  if (!ring || !post) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.tide.inverseSurface,
        }}
      >
        <Text variant="chatName" tint={colors.messaging.onStatusOverlay}>
          This status is no longer available.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ marginTop: 16 }}>
          <Text variant="buttonText" tint={colors.messaging.accent}>
            Close
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: post.kind === 'text' ? (post.backgroundColor ?? colors.tide.inverseSurface) : colors.tide.inverseSurface,
      }}
    >
      {post.kind === 'video' && source ? (
        <VideoView
          player={player}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="contain"
          nativeControls={false}
        />
      ) : post.kind !== 'text' && source ? (
        <Image
          source={{ uri: source }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="contain"
        />
      ) : null}

      {post.kind === 'text' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.edgeMargin * 2 }}>
          <Text variant="heroTitle" tint={colors.messaging.onStatusOverlay} style={{ textAlign: 'center' }}>
            {post.caption ?? ''}
          </Text>
        </View>
      ) : null}

      {/* Tap zones sit under the chrome: a third to go back, the rest to go on. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous status"
          onPress={() => step('previous')}
          onLongPress={hold}
          onPressOut={release}
          delayLongPress={200}
          style={{ width: '33%', height: '100%' }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next status"
          onPress={() => step('next')}
          onLongPress={hold}
          onPressOut={release}
          delayLongPress={200}
          style={{ flex: 1, height: '100%' }}
        />
      </View>

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ paddingHorizontal: spacing.stackMd }} pointerEvents="box-none">
          <SegmentedProgress count={ring.posts.length} index={index} progress={progress} />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.stackMd,
              paddingVertical: spacing.stackMd,
            }}
            pointerEvents="box-none"
          >
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.messaging.onStatusOverlay} />
            </Pressable>

            <Avatar
              uri={ring.avatarPath ? publicUrl('avatars', ring.avatarPath) : null}
              name={ring.displayName}
              size="groupRow"
            />

            <View style={{ flex: 1 }}>
              <Text variant="chatName" tint={colors.messaging.onStatusOverlay} numberOfLines={1}>
                {isMine ? 'My status' : ring.displayName}
              </Text>
              <Text variant="timestamp" tint={colors.messaging.statusRingViewed}>
                {statusTime(post.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        <View style={{ paddingHorizontal: spacing.edgeMargin, gap: spacing.stackMd }} pointerEvents="box-none">
          {/* A caption over media; a text status already *is* its caption. */}
          {post.kind !== 'text' && post.caption ? (
            <View style={{ alignItems: 'center' }} pointerEvents="none">
              <Text
                variant="messageBody"
                tint={colors.messaging.onStatusOverlay}
                style={{
                  paddingHorizontal: spacing.edgeMargin,
                  paddingVertical: spacing.stackSm,
                  borderRadius: radii.full,
                  backgroundColor: colors.messaging.statusOverlay,
                  textAlign: 'center',
                }}
              >
                {post.caption}
              </Text>
            </View>
          ) : null}

          {isMine ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(true)}
              style={{ alignItems: 'center', gap: spacing.stackXs, paddingBottom: spacing.stackMd }}
            >
              <MaterialIcons name="keyboard-arrow-up" size={iconSizes.lg} color={colors.messaging.onStatusOverlay} />
              <Text variant="labelSm" tint={colors.messaging.onStatusOverlay}>
                {viewers.length === 0 ? 'No views yet' : `${viewers.length} seen`}
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.stackMd,
                paddingBottom: spacing.stackMd,
              }}
            >
              <View
                style={{
                  flex: 1,
                  minHeight: spacing.composerMinHeight,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.edgeMargin,
                  borderRadius: radii.composer,
                  borderWidth: 1,
                  borderColor: colors.messaging.statusRingViewed,
                  backgroundColor: colors.messaging.statusOverlay,
                }}
              >
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  placeholder="Reply…"
                  placeholderTextColor={colors.messaging.statusRingViewed}
                  // Typing must not let a segment advance out from under the reply.
                  onFocus={hold}
                  onBlur={release}
                  style={[
                    type('composer'),
                    { color: colors.messaging.onStatusOverlay, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
                  ]}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send reply"
                onPress={() => void sendReply()}
                disabled={reply.trim().length === 0}
                style={{
                  width: spacing.composerActionSize,
                  height: spacing.composerActionSize,
                  borderRadius: radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    reply.trim().length === 0 ? colors.messaging.statusOverlay : colors.messaging.accent,
                }}
              >
                <MaterialIcons name="send" size={iconSizes.lg} color={colors.messaging.onAccent} />
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ViewerSheet
        visible={sheetOpen}
        viewers={viewers}
        onClose={() => setSheetOpen(false)}
        onDelete={remove}
      />
    </View>
  );
}