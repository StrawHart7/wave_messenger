import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable } from 'react-native';

import { ContactPicker } from '../components/group/ContactPicker';
import { SelectionChips } from '../components/group/SelectionChips';
import { Screen, Text } from '../components/ui';
import { useKnownProfiles, useMembers } from '../hooks/useMembers';
import { MAX_MEMBERS, filterCandidates, type PickerCandidate } from '../services/groups';
import { addMembers } from '../services/groupSync';
import { useSession } from '../stores/session';
import { useTheme } from '../theme/ThemeProvider';

/** Adding to an existing group. The server refuses this for a non-admin regardless. */
export default function AddMembersScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const groupId = chatId ?? '';
  const { colors, spacing, iconSizes } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PickerCandidate[]>([]);
  const [adding, setAdding] = useState(false);

  const members = useMembers(groupId, viewerId);
  const known = useKnownProfiles();
  // The membership array is rebuilt every render; its *content* is the identity
  // the memo should key off, so it is collapsed to a string first.
  const alreadyIn = members.map((member) => member.userId).join(',');

  const candidates = useMemo(
    () => filterCandidates(known, { query: search, excluded: alreadyIn.split(',') }),
    [known, search, alreadyIn],
  );

  const room = MAX_MEMBERS - members.length;

  const confirm = useCallback(async () => {
    if (selected.length === 0 || adding) return;
    setAdding(true);
    try {
      await addMembers(groupId, selected.map((candidate) => candidate.userId), viewerId);
      router.back();
    } catch {
      Alert.alert('Could not add', 'Only group admins can add participants.');
    } finally {
      setAdding(false);
    }
  }, [selected, adding, groupId, viewerId]);

  return (
    <Screen
      title="Add members"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
      trailing={
        selected.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void confirm()} hitSlop={8}>
            {adding ? (
              <ActivityIndicator color={colors.tide.primary} />
            ) : (
              <Text variant="buttonText" tint={colors.tide.primary}>
                Add
              </Text>
            )}
          </Pressable>
        ) : null
      }
    >
      <SelectionChips
        selected={selected}
        onRemove={(userId) => setSelected((current) => current.filter((entry) => entry.userId !== userId))}
      />

      <ContactPicker
        candidates={candidates}
        search={search}
        onSearch={setSearch}
        selectedIds={selected.map((candidate) => candidate.userId)}
        onToggle={(candidate) =>
          setSelected((current) => {
            if (current.some((entry) => entry.userId === candidate.userId)) {
              return current.filter((entry) => entry.userId !== candidate.userId);
            }
            if (current.length >= room) {
              Alert.alert('Group is full', `A group holds at most ${MAX_MEMBERS} participants.`);
              return current;
            }
            return [...current, candidate];
          })
        }
        emptyLabel="Everyone you know is already in this group."
      />
    </Screen>
  );
}
