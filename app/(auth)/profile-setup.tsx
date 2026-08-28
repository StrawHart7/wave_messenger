import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';

import { PrimaryButton, Text } from '../../components/ui';
import { Screen } from '../../components/ui/Screen';
import { TextField } from '../../components/ui/TextField';
import { createOrUpdateProfile } from '../../services/auth';
import { uploadAvatar } from '../../services/media';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

export default function ProfileSetupScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const userId = useSession((s) => s.userId);
  const phone = useSession((s) => s.phone);
  const setProfile = useSession((s) => s.setProfile);

  const [name, setName] = useState('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) setLocalAvatar(result.assets[0].uri);
  };

  const submit = async () => {
    if (!userId || !phone) return;
    setSaving(true);
    try {
      const avatarPath = localAvatar ? await uploadAvatar(userId, localAvatar) : null;
      const profile = await createOrUpdateProfile({ userId, e164: phone, displayName: name, avatarPath });
      setProfile(profile);
      router.replace('/');
    } catch (error) {
      Alert.alert('Could not save your profile', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title="Profile info"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      separator={false}
    >
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.edgeMargin }}>
        <Text
          variant="messageBody"
          tint={colors.tide.onSurfaceVariant}
          style={{ textAlign: 'center', marginBottom: spacing.edgeMargin * 2 }}
        >
          Please provide your name and an optional profile photo.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a profile photo"
          onPress={pickAvatar}
          style={{ marginBottom: spacing.edgeMargin * 3 }}
        >
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: colors.tide.surfaceVariant,
              borderWidth: 2,
              borderColor: colors.tide.outlineVariant,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {localAvatar ? (
              <Image source={{ uri: localAvatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <MaterialIcons name="person" size={64} color={colors.tide.onSurfaceVariant} />
            )}
          </View>

          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.tide.primary,
              borderWidth: 4,
              borderColor: colors.tide.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="photo-camera" size={iconSizes.md} color={colors.tide.onPrimary} />
          </View>
        </Pressable>

        <TextField
          appearance="underline"
          value={name}
          onChangeText={setName}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          focused={focused}
          placeholder="Type your name here"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={25}
          containerStyle={{ width: '100%', maxWidth: 320 }}
        />

        <View style={{ marginTop: 'auto', paddingBottom: spacing.edgeMargin * 2.5 }}>
          <PrimaryButton
            label={saving ? 'Saving…' : 'Next'}
            disabled={name.trim().length === 0 || saving}
            onPress={submit}
          />
        </View>
      </View>
    </Screen>
  );
}
