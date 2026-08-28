import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Avatar, ListRow, Screen, Text } from '../../components/ui';
import { listBlocked } from '../../db/blocks';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { publicUrl } from '../../services/media';
import { pullBlocked, unblockUser } from '../../services/privacySync';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

export default function BlockedScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const blocked = useLiveQuery(() => listBlocked(), []);

  useEffect(() => {
    void pullBlocked().catch(() => {});
  }, []);

  const unblock = (userId: string, name: string) => {
    Alert.alert('Unblock', `Unblock ${name}? They will be able to message and call you again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => {
          void unblockUser(viewerId, userId).catch(() =>
            Alert.alert('Not saved', 'Check your connection and try again.'),
          );
        },
      },
    ]);
  };

  return (
    <Screen
      title="Blocked contacts"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <FlashList
        data={blocked}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center', gap: spacing.stackSm }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              Nobody is blocked.
            </Text>
            <Text variant="sectionHeader" tint={colors.messaging.metaDim} style={{ textAlign: 'center' }}>
              Blocked people cannot message or call you, and cannot see your photo, about or last seen.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            onPress={() => unblock(item.userId, item.displayName)}
            leading={
              <Avatar
                uri={item.avatarPath ? publicUrl('avatars', item.avatarPath) : null}
                name={item.displayName}
                size="lg"
              />
            }
            trailing={
              <Text variant="buttonText" tint={colors.tide.primary}>
                Unblock
              </Text>
            }
          >
            <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
              {item.displayName}
            </Text>
          </ListRow>
        )}
      />
    </Screen>
  );
}
