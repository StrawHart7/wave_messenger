import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Screen } from '../../components/ui';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../theme/ThemeProvider';

export default function NotificationSettingsScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const notifications = useSettings((s) => s.notifications);
  const setNotifications = useSettings((s) => s.setNotifications);

  return (
    <Screen
      title="Notifications"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin * 1.5 }}>
        <SettingsCard title="Alerts">
          <SettingsRow
            label="Messages"
            toggle={notifications.messages}
            onToggle={(next) => void setNotifications({ messages: next })}
          />
          <SettingsRow
            label="Groups"
            toggle={notifications.groups}
            onToggle={(next) => void setNotifications({ groups: next })}
          />
          <SettingsRow
            label="Calls"
            toggle={notifications.calls}
            onToggle={(next) => void setNotifications({ calls: next })}
          />
          <SettingsRow
            label="Status updates"
            toggle={notifications.status}
            onToggle={(next) => void setNotifications({ status: next })}
            separator={false}
          />
        </SettingsCard>

        <SettingsCard title="In app">
          <SettingsRow
            label="Sounds"
            toggle={notifications.inAppSounds}
            onToggle={(next) => void setNotifications({ inAppSounds: next })}
          />
          <SettingsRow
            label="Vibrate"
            toggle={notifications.vibrate}
            onToggle={(next) => void setNotifications({ vibrate: next })}
            separator={false}
          />
        </SettingsCard>
      </ScrollView>
    </Screen>
  );
}
