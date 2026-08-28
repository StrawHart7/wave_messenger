import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InfoRow, InfoSection, QuickActions } from '../../components/group/InfoSection';
import { placeCall } from '../../services/callFlow';
import type { CallKind } from '../../services/calls';
import { findOrCreateDirectChat } from '../../services/chatSync';
import { blockUser, unblockUser } from '../../services/privacySync';
import { NO_WEBRTC_MESSAGE, isWebrtcAvailable } from '../../services/webrtc';
import { useSession } from '../../stores/session';
import { Avatar, Text } from '../../components/ui';
import { isBlocked } from '../../db/blocks';
import { getProfile } from '../../db/profiles';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { formatE164ForDisplay } from '../../services/phone';
import { publicUrl } from '../../services/media';
import { presenceLabel } from '../../services/realtime/presence';
import { useTheme } from '../../theme/ThemeProvider';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * Contact info, with the hero collapsing into the app bar as the page scrolls.
 *
 * The collapse runs on the UI thread through Reanimated rather than on scroll
 * events in JS: a header that lags the finger by a frame is the single most
 * obvious way a React Native screen announces itself as not native.
 */
export default function ContactInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id ?? '';
  const { colors, spacing, iconSizes } = useTheme();
  const profile = useLiveQuery(() => getProfile(userId), [userId]);
  const viewerId = useSession((s) => s.userId) ?? '';
  const me = useSession((s) => s.profile);
  const blocked = useLiveQuery(() => isBlocked(userId), [userId]);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const range = spacing.heroHeight - spacing.heroCollapsedHeight;

  // The big name fades out over the first two thirds of the collapse…
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range * 0.65], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [0, range], [1, 0.85], Extrapolation.CLAMP) },
    ],
  }));

  // …and the app-bar title takes over for the last third, so exactly one name is
  // legible at any point in the scroll.
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [range * 0.65, range], [0, 1], Extrapolation.CLAMP),
  }));

  const openChat = useCallback(() => {
    router.back();
  }, []);

  /**
   * Calling from a contact card. The chat is found or created first: a call is
   * recorded against a chat, and this screen can be reached from a group's member
   * list where no one-to-one chat exists yet.
   */
  const startCall = useCallback(
    async (kind: CallKind) => {
      if (!isWebrtcAvailable()) {
        Alert.alert('Not available here', NO_WEBRTC_MESSAGE);
        return;
      }

      try {
        const chatId = await findOrCreateDirectChat(viewerId, {
          userId,
          displayName: profile?.displayName ?? '',
          avatarPath: profile?.avatarPath ?? null,
        });

        const callId = await placeCall({
          selfId: viewerId,
          selfName: me?.displayName ?? '',
          selfAvatarPath: me?.avatarPath ?? null,
          chatId,
          peerId: userId,
          peerName: profile?.displayName ?? '',
          peerAvatarPath: profile?.avatarPath ?? null,
          kind,
        });
        router.push(`/call/${callId}`);
      } catch {
        Alert.alert('Could not start the call', 'Check your connection and try again.');
      }
    },
    [userId, viewerId, profile, me],
  );

  const toggleBlock = useCallback(() => {
    const action = blocked ? 'Unblock' : 'Block';
    const label = profile?.displayName ?? 'this contact';

    Alert.alert(
      `${action} ${label}`,
      blocked
        ? 'They will be able to message and call you again.'
        : 'They will not be able to message or call you, and will not see your photo, about or last seen. They are not told.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: blocked ? 'default' : 'destructive',
          onPress: () => {
            const run = blocked ? unblockUser : blockUser;
            void run(viewerId, userId).catch(() =>
              Alert.alert('Not saved', 'Check your connection and try again.'),
            );
          },
        },
      ],
    );
  }, [blocked, profile?.displayName, viewerId, userId]);

  const name = profile?.displayName ?? '';
  const status = presenceLabel({
    typing: false,
    online: profile?.isOnline ?? false,
    lastSeenAt: profile?.lastSeenAt ?? null,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.tide.background }}>
      <View
        style={{
          height: spacing.heroCollapsedHeight,
          paddingHorizontal: spacing.edgeMargin,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.stackMd,
          backgroundColor: colors.tide.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.messaging.separator,
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>

        <Animated.View style={[{ flex: 1 }, barTitleStyle]}>
          <Text variant="navTitle" tint={colors.tide.onBackground} numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>
      </View>

      <AnimatedScrollView onScroll={onScroll} scrollEventThrottle={16}>
        <Animated.View
          style={[
            {
              height: spacing.heroHeight,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.stackSm,
              backgroundColor: colors.tide.surfaceContainerLowest,
              borderBottomWidth: 1,
              borderBottomColor: colors.messaging.separator,
            },
            heroStyle,
          ]}
        >
          <Avatar
            uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
            name={name}
            size="xl"
          />
          <Text variant="heroTitle" tint={colors.tide.onBackground}>
            {name}
          </Text>
          {profile?.phone ? (
            <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
              {formatE164ForDisplay(profile.phone)}
            </Text>
          ) : null}

          <QuickActions
            actions={[
              { icon: 'chat', label: 'Message', onPress: openChat },
              { icon: 'call', label: 'Audio', onPress: () => void startCall('voice') },
              { icon: 'videocam', label: 'Video', onPress: () => void startCall('video') },
            ]}
          />
        </Animated.View>

        {status ? (
          <InfoSection title="Status">
            <View style={{ paddingHorizontal: spacing.edgeMargin, paddingBottom: spacing.stackSm }}>
              <Text variant="chatName" tint={colors.tide.onBackground}>
                {status}
              </Text>
            </View>
          </InfoSection>
        ) : null}

        {/* A null "about" here means the contact's privacy setting hid it inside
            public_profiles, not that they cleared it. */}
        {profile?.about ? (
          <InfoSection title="About">
            <View style={{ paddingHorizontal: spacing.edgeMargin, paddingBottom: spacing.stackSm }}>
              <Text variant="chatName" tint={colors.tide.onBackground}>
                {profile.about}
              </Text>
            </View>
          </InfoSection>
        ) : null}

        <InfoSection>
          <InfoRow icon="notifications" label="Mute notifications" chevron />
          <InfoRow icon="image" label="Media, links, and docs" chevron />
          <InfoRow icon="wallpaper" label="Wallpaper" chevron />
        </InfoSection>

        <InfoSection>
          {/* Enforced in 0006_privacy.sql, not here: a blocked person cannot insert
              a message, and the profile view stops serving them your photo, about
              and last seen. A block that only existed on this device would be
              theatre — which is why this row did nothing until the rule existed. */}
          <InfoRow
            icon="block"
            label={blocked ? `Unblock ${name}` : `Block ${name}`}
            tint={colors.tide.error}
            onPress={toggleBlock}
          />
          <InfoRow icon="thumb-down" label={`Report ${name}`} tint={colors.tide.error} />
        </InfoSection>

        <View style={{ height: spacing.edgeMargin * 2 }} />
      </AnimatedScrollView>
    </SafeAreaView>
  );
}
