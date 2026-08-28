import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ChatRow } from '../../components/chat/ChatRow';
import { Avatar, ListRow, Pill, Text } from '../../components/ui';
import { Screen } from '../../components/ui/Screen';
import { TextField } from '../../components/ui/TextField';
import { useArchivedCount, useChats } from '../../hooks/useChats';
import { setChatFlags } from '../../db/chats';
import { publicUrl } from '../../services/media';
import type { ChatFilter } from '../../services/chatList';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

const FILTERS: { key: ChatFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'groups', label: 'Groups' },
];

export default function ChatsScreen() {
  const { colors, spacing, radii, iconSizes, elevation } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const [filter, setFilter] = useState<ChatFilter>('all');
  const [search, setSearch] = useState('');

  const chats = useChats({ filter, search });
  const archivedCount = useArchivedCount();

  return (
    <Screen
      title="Chats"
      leading={<Avatar name="Wave" size="sm" />}
      trailing={
        <MaterialIcons name="photo-camera" size={iconSizes.xl} color={colors.tide.primary} />
      }
    >
      <View style={{ paddingHorizontal: spacing.edgeMargin, paddingTop: spacing.stackMd, gap: spacing.stackMd }}>
        <TextField
          appearance="row"
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          containerStyle={{
            height: 40,
            borderRadius: radii.full,
            borderBottomWidth: 0,
            backgroundColor: colors.tide.surfaceContainer,
          }}
          leading={
            <MaterialIcons
              name="search"
              size={iconSizes.md}
              color={colors.tide.onSurfaceVariant}
              style={{ marginLeft: spacing.stackMd }}
            />
          }
        />

        <View style={{ flexDirection: 'row', gap: spacing.stackSm }}>
          {FILTERS.map(({ key, label }) => (
            <Pill key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />
          ))}
        </View>
      </View>

      <FlashList
        data={chats}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={{ paddingBottom: spacing.avatarXl }}
        ListHeaderComponent={
          archivedCount > 0 ? (
            <ListRow
              height={56}
              onPress={() => router.push('/archived')}
              leading={
                <View style={{ width: spacing.avatarLg, alignItems: 'center' }}>
                  <MaterialIcons name="archive" size={iconSizes.lg} color={colors.tide.onSurfaceVariant} />
                </View>
              }
            >
              <Text variant="chatName" tint={colors.tide.onBackground}>
                Archived
              </Text>
            </ListRow>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: spacing.avatarXl }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              No chats yet
            </Text>
            <Text variant="sectionHeader" tint={colors.messaging.metaDim} style={{ marginTop: spacing.stackXs }}>
              Tap the button below to start one
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatRow
            summary={item}
            viewerId={viewerId}
            avatarUri={item.avatarPath ? publicUrl('avatars', item.avatarPath) : null}
            onPress={() => router.push(`/chat/${item.chatId}`)}
            onLongPress={() => setChatFlags(item.chatId, { pinned: !item.pinned })}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New chat"
        onPress={() => router.push('/new-chat')}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: spacing.edgeMargin,
            bottom: spacing.edgeMargin,
            width: 56,
            height: 56,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.messaging.accentPressed : colors.messaging.accent,
          },
          elevation.floating,
        ]}
      >
        <MaterialIcons name="chat" size={iconSizes.tab} color={colors.messaging.onAccent} />
      </Pressable>
    </Screen>
  );
}
