import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';

import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Screen } from '../../components/ui';
import { listBlocked } from '../../db/blocks';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import {
  LAST_SEEN_NOTE,
  READ_RECEIPTS_NOTE,
  TYPING_NOTE,
  audienceLabel,
  nextAudience,
  type PrivacyAudience,
  type PrivacySettings,
} from '../../services/settings';
import { useSession } from '../../stores/session';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Privacy.
 *
 * Every row here is a mirror of a rule in 0006_privacy.sql. Turning "Last seen" to
 * Nobody does not hide a label — a trigger refuses to store the value at all, and
 * the view stops serving anyone else's to you in return. The copy under each row
 * says so, because a privacy setting whose behaviour is a surprise is worse than
 * no setting.
 */
export default function PrivacyScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const privacy = useSettings((s) => s.privacy);
  const setPrivacy = useSettings((s) => s.setPrivacy);
  const blocked = useLiveQuery(() => listBlocked(), []);

  const apply = useCallback(
    (patch: Partial<PrivacySettings>) => {
      void Haptics.selectionAsync();
      void setPrivacy(viewerId, patch).catch(() =>
        Alert.alert('Not saved', 'That setting could not be changed. Check your connection.'),
      );
    },
    [viewerId, setPrivacy],
  );

  const cycle = useCallback(
    (key: 'lastSeen' | 'avatar' | 'about', current: PrivacyAudience) => {
      apply({ [key]: nextAudience(current) } as Partial<PrivacySettings>);
    },
    [apply],
  );

  return (
    <Screen
      title="Privacy"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin * 1.5 }}>
        <SettingsCard title="Who can see my personal info">
          <SettingsRow
            label="Last seen and online"
            description={LAST_SEEN_NOTE}
            value={audienceLabel(privacy.lastSeen)}
            chevron
            onPress={() => cycle('lastSeen', privacy.lastSeen)}
          />
          <SettingsRow
            label="Profile photo"
            value={audienceLabel(privacy.avatar)}
            chevron
            onPress={() => cycle('avatar', privacy.avatar)}
          />
          <SettingsRow
            label="About"
            value={audienceLabel(privacy.about)}
            chevron
            separator={false}
            onPress={() => cycle('about', privacy.about)}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            label="Read receipts"
            description={READ_RECEIPTS_NOTE}
            toggle={privacy.readReceipts}
            onToggle={(next) => apply({ readReceipts: next })}
          />
          <SettingsRow
            label="Typing indicators"
            description={TYPING_NOTE}
            toggle={privacy.typingIndicators}
            onToggle={(next) => apply({ typingIndicators: next })}
            separator={false}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            label="Blocked contacts"
            value={blocked.length === 0 ? 'None' : String(blocked.length)}
            valueTint={blocked.length === 0 ? undefined : colors.tide.error}
            chevron
            separator={false}
            onPress={() => router.push('/settings/blocked')}
          />
        </SettingsCard>
      </ScrollView>
    </Screen>
  );
}
