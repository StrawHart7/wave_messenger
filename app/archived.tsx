import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ChatRow } from '../components/chat/ChatRow';
import { Screen, Text } from '../components/ui';
import { setChatFlags } from '../db/chats';
import { useChats } from '../hooks/useChats';
import { useSession } from '../stores/session';
import { useTheme } from '../theme/ThemeProvider';

/** Archived chats. The chat list has linked here since phase 3; this is the target. */
export default function ArchivedScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';
  const chats = useChats({ filter: 'all', search: '', archived: true });

  return (
    <Screen
      title="Archived"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <FlashList
        data={chats}
        keyExtractor={(item) => item.chatId}
        ListEmptyComponent={
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center' }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              No archived chats.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatRow
            summary={item}
            viewerId={viewerId}
            onPress={() => router.push(`/chat/${item.chatId}`)}
            onLongPress={() => setChatFlags(item.chatId, { archived: false })}
          />
        )}
      />
    </Screen>
  );
}
