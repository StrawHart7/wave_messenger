import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Screen, Text } from '../../components/ui';
import { clearChatMedia, storageUsage } from '../../db/attachments';
import { listChats } from '../../db/chats';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { formatBytes } from '../../services/attachments';
import { storageBreakdown, storageShare } from '../../services/settings';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Storage per chat.
 *
 * Sorted by size, never by name: the only reason to open this screen is to find
 * what is worth deleting, and that is never the alphabetically first conversation.
 */
export default function StorageScreen() {
  const { colors, spacing, radii, iconSizes } = useTheme();

  const usage = useLiveQuery(() => storageUsage(), []);
  const chats = useLiveQuery(() => listChats(), []);

  const titles = new Map(chats.map((chat) => [chat.chatId, chat.title]));
  const { rows, totalBytes, totalItems } = storageBreakdown(
    usage.map((row) => ({ ...row, title: titles.get(row.chatId) ?? 'Unknown chat' })),
  );

  const clear = (chatId: string, title: string) => {
    Alert.alert('Clear media', `Remove the cached media for "${title}"? Messages stay.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearChatMedia(chatId) },
    ]);
  };

  return (
    <Screen
      title="Storage and data"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin * 1.5 }}>
        <SettingsCard>
          <SettingsRow
            icon="pie-chart"
            label="Media on this device"
            description={`${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
            value={formatBytes(totalBytes)}
            separator={false}
          />
        </SettingsCard>

        {rows.length === 0 ? (
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center' }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              No media stored yet.
            </Text>
          </View>
        ) : (
          <SettingsCard title="By chat">
            {rows.map((row, index) => (
              <View key={row.chatId}>
                <SettingsRow
                  label={row.title}
                  description={`${row.items} ${row.items === 1 ? 'item' : 'items'}`}
                  value={formatBytes(row.bytes)}
                  separator={index < rows.length - 1}
                  onPress={() => clear(row.chatId, row.title)}
                />
                {/* The bar is the comparison the numbers alone do not give. */}
                <View
                  style={{
                    height: 3,
                    marginHorizontal: spacing.edgeMargin,
                    marginBottom: spacing.stackSm,
                    borderRadius: radii.full,
                    backgroundColor: colors.tide.surfaceVariant,
                  }}
                >
                  <View
                    style={{
                      width: `${storageShare(row.bytes, totalBytes) * 100}%`,
                      height: '100%',
                      borderRadius: radii.full,
                      backgroundColor: colors.messaging.accent,
                    }}
                  />
                </View>
              </View>
            ))}
          </SettingsCard>
        )}
      </ScrollView>
    </Screen>
  );
}
