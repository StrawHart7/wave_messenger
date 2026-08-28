import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { StatusAvatar } from '../../components/status/StatusAvatar';
import { Avatar, ListRow, Text } from '../../components/ui';
import { Screen } from '../../components/ui/Screen';
import { useStatusHousekeeping, useStatusRings } from '../../hooks/useStatus';
import { publicUrl } from '../../services/media';
import { myStatusSubtitle, statusTime, type StatusRing } from '../../services/status';
import { pullStatus } from '../../services/statusSync';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

export default function UpdatesScreen() {
  const { colors, spacing, radii, iconSizes, elevation } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const profile = useSession((s) => s.profile);

  const { recent, viewed, mine, now } = useStatusRings(viewerId);
  const [showViewed, setShowViewed] = useState(true);

  useStatusHousekeeping();

  useEffect(() => {
    if (!viewerId) return;
    void pullStatus(viewerId).catch(() => {});
  }, [viewerId]);

  const capture = useCallback(async (fromCamera: boolean) => {
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });

    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];

    router.push({
      pathname: '/status/compose',
      params: {
        kind: asset.type === 'video' ? 'video' : 'image',
        uri: asset.uri,
        durationMs: asset.duration ? String(Math.round(asset.duration)) : '',
      },
    });
  }, []);

  const openMine = useCallback(() => {
    if (mine.length === 0) router.push({ pathname: '/status/compose', params: { kind: 'text' } });
    else router.push(`/status/${viewerId}`);
  }, [mine.length, viewerId]);

  return (
    <Screen
      title="Updates"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Avatar
          uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
          name={profile?.displayName ?? ''}
          size="sm"
        />
      }
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Camera"
          onPress={() => void capture(true)}
          hitSlop={8}
        >
          <MaterialIcons name="photo-camera" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.edgeMargin * 6 }}>
        <SectionHeader label="Status" />

        <ListRow
          onPress={openMine}
          separator={false}
          leading={
            <View>
              {mine.length > 0 ? (
                <StatusAvatar
                  uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
                  name={profile?.displayName ?? ''}
                  viewed
                />
              ) : (
                <Avatar
                  uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
                  name={profile?.displayName ?? ''}
                  size="lg"
                />
              )}

              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 24,
                  height: 24,
                  borderRadius: radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.tide.primaryContainer,
                  borderWidth: 2,
                  borderColor: colors.tide.background,
                }}
              >
                <MaterialIcons name="add" size={14} color={colors.tide.onPrimary} />
              </View>
            </View>
          }
        >
          <Text variant="chatName" tint={colors.tide.onBackground}>
            My status
          </Text>
          <Text
            variant="sectionHeader"
            tint={colors.tide.onSurfaceVariant}
            numberOfLines={1}
            style={{ marginTop: spacing.stackXs }}
          >
            {myStatusSubtitle(mine, now)}
          </Text>
        </ListRow>

        {recent.length > 0 ? <SectionHeader label="Recent updates" /> : null}
        {recent.map((ring) => (
          <RingRow key={ring.authorId} ring={ring} now={now} />
        ))}

        {viewed.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowViewed((value) => !value)}
            style={{
              paddingHorizontal: spacing.edgeMargin,
              paddingVertical: spacing.stackSm,
              marginTop: spacing.stackMd,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
              Viewed updates
            </Text>
            <MaterialIcons
              name={showViewed ? 'expand-less' : 'expand-more'}
              size={iconSizes.md}
              color={colors.tide.onSurfaceVariant}
            />
          </Pressable>
        ) : null}

        {showViewed
          ? viewed.map((ring) => <RingRow key={ring.authorId} ring={ring} now={now} />)
          : null}

        {recent.length === 0 && viewed.length === 0 ? (
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center' }}>
            <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
              No recent updates from your contacts.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Text status on the small button, camera on the large one — the reference
          pairs them this way, and the camera is the one people reach for. */}
      <View
        style={{
          position: 'absolute',
          right: spacing.edgeMargin,
          bottom: spacing.edgeMargin,
          alignItems: 'center',
          gap: spacing.edgeMargin,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Write a status"
          onPress={() => router.push({ pathname: '/status/compose', params: { kind: 'text' } })}
          style={[
            {
              width: 40,
              height: 40,
              borderRadius: radii.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.tide.surfaceContainerHigh,
            },
            elevation.floating,
          ]}
        >
          <MaterialIcons name="edit" size={iconSizes.md} color={colors.tide.onSurfaceVariant} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a photo status"
          onPress={() => void capture(false)}
          style={[
            {
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
          <MaterialIcons name="photo-camera" size={iconSizes.xl} color={colors.messaging.onAccent} />
        </Pressable>
      </View>
    </Screen>
  );
}

function SectionHeader({ label }: { label: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.edgeMargin, paddingVertical: spacing.stackMd }}>
      <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
        {label}
      </Text>
    </View>
  );
}

function RingRow({ ring, now }: { ring: StatusRing; now: number }) {
  const { colors, spacing } = useTheme();

  return (
    <ListRow
      onPress={() => router.push(`/status/${ring.authorId}`)}
      style={ring.allViewed ? { opacity: 0.7 } : undefined}
      leading={
        <StatusAvatar
          uri={ring.avatarPath ? publicUrl('avatars', ring.avatarPath) : null}
          name={ring.displayName}
          viewed={ring.allViewed}
        />
      }
    >
      <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
        {ring.displayName}
      </Text>
      <Text
        variant="timestamp"
        tint={colors.tide.onSurfaceVariant}
        numberOfLines={1}
        style={{ marginTop: spacing.stackXs }}
      >
        {statusTime(ring.latestAt, now)}
      </Text>
    </ListRow>
  );
}
