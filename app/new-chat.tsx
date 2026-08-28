import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ContactPicker } from '../components/group/ContactPicker';
import { ListRow, Screen, Text } from '../components/ui';
import { useKnownProfiles } from '../hooks/useMembers';
import { findOrCreateDirectChat } from '../services/chatSync';
import { syncContacts } from '../services/contactSync';
import { filterCandidates, type PickerCandidate } from '../services/groups';
import { useSession } from '../stores/session';
import { useTheme } from '../theme/ThemeProvider';

/**
 * "New chat": the people this device knows, with the group and contact entry points
 * above them — the same order the reference chat list uses behind its FAB.
 */
export default function NewChatScreen() {
  const { colors, spacing, radii, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState(false);

  const known = useKnownProfiles([viewerId]);
  const candidates = useMemo(() => filterCandidates(known, { query: search }), [known, search]);

  // The address book is matched here rather than at startup: this is the screen
  // where a contacts permission prompt makes sense to the person seeing it, and the
  // matches land in SQLite, so the list below fills in on its own.
  useEffect(() => {
    void syncContacts().catch(() => {});
  }, []);

  const open = useCallback(
    async (candidate: PickerCandidate) => {
      if (opening) return;
      setOpening(true);
      try {
        const chatId = await findOrCreateDirectChat(viewerId, {
          userId: candidate.userId,
          displayName: candidate.displayName,
          avatarPath: candidate.avatarPath,
        });
        router.dismissTo(`/chat/${chatId}`);
      } catch {
        Alert.alert('Could not open the chat', 'Check your connection and try again.');
      } finally {
        setOpening(false);
      }
    },
    [opening, viewerId],
  );

  return (
    <Screen
      title="New chat"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ContactPicker
        candidates={candidates}
        search={search}
        onSearch={setSearch}
        onToggle={(candidate) => void open(candidate)}
        header={
          <View>
            <ListRow
              onPress={() => router.push('/new-group')}
              leading={<ActionCircle icon="group" background={colors.messaging.accent} foreground={colors.messaging.onAccent} radius={radii.full} size={spacing.avatarLg} />}
            >
              <Text variant="chatName" tint={colors.tide.onBackground}>
                New group
              </Text>
            </ListRow>

            <ListRow
              onPress={() => Alert.alert('Not yet', 'Adding a contact by number arrives in a later phase.')}
              leading={<ActionCircle icon="person-add" background={colors.messaging.accent} foreground={colors.messaging.onAccent} radius={radii.full} size={spacing.avatarLg} />}
            >
              <Text variant="chatName" tint={colors.tide.onBackground}>
                New contact
              </Text>
            </ListRow>

            <View style={{ paddingHorizontal: spacing.edgeMargin, paddingVertical: spacing.stackMd }}>
              <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
                Contacts on Wave
              </Text>
            </View>
          </View>
        }
      />
    </Screen>
  );
}

function ActionCircle({
  icon,
  background,
  foreground,
  radius,
  size,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  background: string;
  foreground: string;
  radius: number;
  size: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
      }}
    >
      <MaterialIcons name={icon} size={22} color={foreground} />
    </View>
  );
}
