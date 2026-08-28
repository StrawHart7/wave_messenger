import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Avatar, Screen, Text } from '../../components/ui';
import { signOut } from '../../services/auth';
import { publicUrl } from '../../services/media';
import { useSession } from '../../stores/session';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../theme/ThemeProvider';

export default function SettingsScreen() {
  const { colors, spacing, radii, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const profile = useSession((s) => s.profile);
  const reset = useSession((s) => s.reset);

  const load = useSettings((s) => s.load);
  const loaded = useSettings((s) => s.loaded);

  useEffect(() => {
    if (!viewerId || loaded) return;
    void load(viewerId).catch(() => {});
  }, [viewerId, loaded, load]);

  const confirmSignOut = () => {
    Alert.alert('Log out', 'Your chats stay on this device until you delete the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void signOut()
            .then(() => reset())
            .catch(() => Alert.alert('Could not log out', 'Check your connection and try again.'));
        },
      },
    ]);
  };

  return (
    <Screen
      title="Settings"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit your profile"
          onPress={() => router.push('/settings/profile')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.edgeMargin,
            padding: spacing.edgeMargin,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.messaging.separator,
            backgroundColor: pressed ? colors.tide.surfaceVariant : colors.tide.surfaceContainerLowest,
          })}
        >
          <Avatar
            uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
            name={profile?.displayName ?? ''}
            size="lg"
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
              {profile?.displayName ?? ''}
            </Text>
            <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant} numberOfLines={1}>
              {profile?.about ?? 'Hey there! I am using Wave.'}
            </Text>
          </View>
          <MaterialIcons name="qr-code" size={iconSizes.lg} color={colors.tide.primary} />
        </Pressable>

        <SettingsCard>
          <SettingsRow
            icon="lock"
            iconTint={colors.tide.onPrimary}
            iconBackground={colors.tide.primary}
            label="Privacy"
            chevron
            onPress={() => router.push('/settings/privacy')}
          />
          <SettingsRow
            icon="chat"
            label="Chats"
            description="Theme, wallpaper, font size"
            chevron
            onPress={() => router.push('/settings/chats')}
          />
          <SettingsRow
            icon="notifications"
            iconTint={colors.tide.error}
            label="Notifications"
            chevron
            onPress={() => router.push('/settings/notifications')}
          />
          <SettingsRow
            icon="folder"
            iconTint={colors.tide.secondary}
            label="Storage and data"
            chevron
            separator={false}
            onPress={() => router.push('/settings/storage')}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            icon="logout"
            iconTint={colors.tide.error}
            label="Log out"
            separator={false}
            onPress={confirmSignOut}
          />
        </SettingsCard>

        <Text
          variant="timestamp"
          tint={colors.messaging.metaDim}
          style={{ textAlign: 'center', paddingVertical: spacing.edgeMargin }}
        >
          Wave · built with React Native and Supabase
        </Text>
      </ScrollView>
    </Screen>
  );
}
