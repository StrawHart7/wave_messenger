import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { TextPrompt } from '../../components/group/TextPrompt';
import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Avatar, Screen, Text } from '../../components/ui';
import { publicUrl, uploadAvatar } from '../../services/media';
import { formatE164ForDisplay } from '../../services/phone';
import { updateAbout, updateProfileFields } from '../../services/privacySync';
import { MAX_ABOUT_LENGTH, normalizeAbout } from '../../services/settings';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

type Field = 'name' | 'about' | null;

const DEFAULT_ABOUT = 'Hey there! I am using Wave.';

export default function ProfileSettingsScreen() {
  const { colors, spacing, radii, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const phone = useSession((s) => s.phone);
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);

  const [editing, setEditing] = useState<Field>(null);

  const changeAvatar = useCallback(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;

    try {
      const path = await uploadAvatar(viewerId, picked.assets[0].uri);
      await updateProfileFields(viewerId, { avatarPath: path });
      if (profile) setProfile({ ...profile, avatarPath: path });
    } catch {
      Alert.alert('Not saved', 'Your photo could not be uploaded. Check your connection.');
    }
  }, [viewerId, profile, setProfile]);

  const save = useCallback(
    (field: Exclude<Field, null>, value: string) => {
      setEditing(null);

      if (field === 'name') {
        const displayName = value.trim();
        void updateProfileFields(viewerId, { displayName })
          .then(() => profile && setProfile({ ...profile, displayName }))
          .catch(() => Alert.alert('Not saved', 'Check your connection and try again.'));
        return;
      }

      const about = normalizeAbout(value);
      void updateAbout(viewerId, about)
        .then(() => profile && setProfile({ ...profile, about }))
        .catch(() => Alert.alert('Not saved', 'Check your connection and try again.'));
    },
    [viewerId, profile, setProfile],
  );

  return (
    <Screen
      title="Profile"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin * 1.5 }}>
        <View style={{ alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change your photo"
            onPress={() => void changeAvatar()}
          >
            <Avatar
              uri={profile?.avatarPath ? publicUrl('avatars', profile.avatarPath) : null}
              name={profile?.displayName ?? ''}
              size="xl"
            />
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 32,
                height: 32,
                borderRadius: radii.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.tide.primaryContainer,
                borderWidth: 2,
                borderColor: colors.tide.background,
              }}
            >
              <MaterialIcons name="photo-camera" size={16} color={colors.tide.onPrimaryContainer} />
            </View>
          </Pressable>
        </View>

        <SettingsCard>
          <SettingsRow
            icon="person"
            label="Name"
            description={profile?.displayName ?? ''}
            chevron
            onPress={() => setEditing('name')}
          />
          <SettingsRow
            icon="info"
            label="About"
            description={profile?.about ?? DEFAULT_ABOUT}
            chevron
            onPress={() => setEditing('about')}
          />
          {/* The number is not editable: it is the account, not a field on it. */}
          <SettingsRow
            icon="phone"
            label="Phone"
            description={phone ? formatE164ForDisplay(phone) : ''}
            separator={false}
          />
        </SettingsCard>

        <Text variant="timestamp" tint={colors.messaging.metaDim} style={{ textAlign: 'center' }}>
          Your name and photo are visible to people according to your privacy settings.
        </Text>
      </ScrollView>

      <TextPrompt
        visible={editing !== null}
        title={editing === 'name' ? 'Your name' : 'About'}
        initialValue={(editing === 'name' ? profile?.displayName : profile?.about) ?? ''}
        maxLength={editing === 'about' ? MAX_ABOUT_LENGTH : 40}
        onCancel={() => setEditing(null)}
        onConfirm={(value) => editing && save(editing, value)}
      />
    </Screen>
  );
}
