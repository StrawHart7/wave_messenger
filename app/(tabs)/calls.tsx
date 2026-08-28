import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Avatar, ListRow, Text } from '../../components/ui';
import { Screen } from '../../components/ui/Screen';
import { useCallHistory } from '../../hooks/useCalls';
import { placeCall } from '../../services/callFlow';
import {
  historyIcon,
  historySubtitle,
  isLive,
  isMissed,
  type CallKind,
  type CallRecord,
} from '../../services/calls';
import { publicUrl } from '../../services/media';
import { NO_WEBRTC_MESSAGE, isWebrtcAvailable } from '../../services/webrtc';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

export default function CallsScreen() {
  const { colors, spacing, radii, iconSizes, elevation } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const profile = useSession((s) => s.profile);

  const history = useCallHistory();

  const redial = useCallback(
    async (record: CallRecord, kind: CallKind) => {
      if (!isWebrtcAvailable()) {
        Alert.alert('Not available here', NO_WEBRTC_MESSAGE);
        return;
      }

      try {
        const callId = await placeCall({
          selfId: viewerId,
          selfName: profile?.displayName ?? '',
          selfAvatarPath: profile?.avatarPath ?? null,
          chatId: record.chatId,
          peerId: record.peerId,
          peerName: record.peerName,
          peerAvatarPath: record.peerAvatarPath,
          kind,
        });
        router.push(`/call/${callId}`);
      } catch {
        Alert.alert('Could not start the call', 'Check your connection and try again.');
      }
    },
    [viewerId, profile],
  );

  return (
    <Screen
      title="Calls"
      leading={
        <Avatar
          uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
          name={profile?.displayName ?? ''}
          size="sm"
        />
      }
      barHeight={spacing.listItemHeight}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New call"
          onPress={() => router.push('/new-chat')}
          hitSlop={8}
        >
          <MaterialIcons name="add-call" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <FlashList
        data={history}
        keyExtractor={(record) => record.id}
        ListHeaderComponent={
          history.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.edgeMargin, paddingVertical: spacing.stackSm }}>
              <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
                Recent
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center', gap: spacing.stackSm }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              No calls yet.
            </Text>
            {!isWebrtcAvailable() ? (
              <Text
                variant="sectionHeader"
                tint={colors.messaging.metaDim}
                style={{ textAlign: 'center' }}
              >
                {NO_WEBRTC_MESSAGE}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const missed = isMissed(item);
          const ongoing = isLive(item.status) && item.status !== 'ringing';

          return (
            <ListRow
              onPress={() => (ongoing ? router.push(`/call/${item.id}`) : void redial(item, item.kind))}
              leading={
                <Avatar
                  uri={item.peerAvatarPath ? publicUrl('avatars', item.peerAvatarPath) : null}
                  name={item.peerName}
                  size="lg"
                />
              }
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.kind === 'video' ? 'Video call' : 'Voice call'}
                  onPress={() => void redial(item, item.kind)}
                  hitSlop={8}
                >
                  <MaterialIcons
                    name={item.kind === 'video' ? 'videocam' : 'call'}
                    size={iconSizes.lg}
                    color={colors.tide.primary}
                  />
                </Pressable>
              }
            >
              <Text
                variant="chatName"
                tint={missed ? colors.tide.error : colors.tide.onBackground}
                numberOfLines={1}
              >
                {item.peerName}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.stackXs,
                  marginTop: spacing.stackXs,
                }}
              >
                <MaterialIcons
                  name={historyIcon(item)}
                  size={14}
                  color={missed ? colors.tide.error : colors.tide.onSurfaceVariant}
                />
                <Text variant="timestamp" tint={colors.tide.onSurfaceVariant} numberOfLines={1}>
                  {historySubtitle(item)}
                </Text>
              </View>
            </ListRow>
          );
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a call"
        onPress={() => router.push('/new-chat')}
        style={[
          {
            position: 'absolute',
            right: spacing.edgeMargin,
            bottom: spacing.edgeMargin,
            width: 56,
            height: 56,
            borderRadius: radii.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.messaging.accent,
          },
          elevation.floating,
        ]}
      >
        <MaterialIcons name="add-call" size={iconSizes.xl} color={colors.messaging.onAccent} />
      </Pressable>
    </Screen>
  );
}