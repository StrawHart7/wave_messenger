import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { ContactPicker } from '../components/group/ContactPicker';
import { SelectionChips } from '../components/group/SelectionChips';
import { Avatar, Screen, Text, TextField } from '../components/ui';
import { useKnownProfiles } from '../hooks/useMembers';
import {
  MAX_SUBJECT_LENGTH,
  canCreateGroup,
  filterCandidates,
  selectionLabel,
  type PickerCandidate,
} from '../services/groups';
import { createGroup } from '../services/groupSync';
import { uploadLocalObject, BUCKETS } from '../services/media';
import { useSession } from '../stores/session';
import { useTheme } from '../theme/ThemeProvider';

type Step = 'participants' | 'details';

/**
 * Group creation, as WhatsApp does it: choose people, then name the group.
 *
 * Both steps live in one route rather than two. The alternative is serialising the
 * selection through navigation params and rebuilding it on the way back, which is a
 * lot of machinery for a back button that already works.
 */
export default function NewGroupScreen() {
  const { colors, spacing, radii, iconSizes, elevation } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const [step, setStep] = useState<Step>('participants');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PickerCandidate[]>([]);
  const [subject, setSubject] = useState('');
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const known = useKnownProfiles([viewerId]);
  const candidates = useMemo(() => filterCandidates(known, { query: search }), [known, search]);
  const selectedIds = selected.map((candidate) => candidate.userId);

  const toggle = useCallback((candidate: PickerCandidate) => {
    setSelected((current) =>
      current.some((entry) => entry.userId === candidate.userId)
        ? current.filter((entry) => entry.userId !== candidate.userId)
        : [...current, candidate],
    );
  }, []);

  const pickIcon = useCallback(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!picked.canceled && picked.assets[0]) setIconUri(picked.assets[0].uri);
  }, []);

  const create = useCallback(async () => {
    if (!canCreateGroup({ subject, memberIds: selectedIds }) || creating) return;
    setCreating(true);

    try {
      // The icon is uploaded under the creator's own folder before the group
      // exists: the group-icon storage policy needs a chat id and an admin role,
      // neither of which exist yet at this point.
      let iconPath: string | null = null;
      if (iconUri) {
        const extension = iconUri.split('.').pop()?.toLowerCase() === 'png' ? 'png' : 'jpg';
        iconPath = await uploadLocalObject(
          BUCKETS.avatars,
          `${viewerId}/group-${Date.now()}.${extension}`,
          iconUri,
          `image/${extension === 'png' ? 'png' : 'jpeg'}`,
        );
      }

      const chatId = await createGroup({ creatorId: viewerId, subject, memberIds: selectedIds, iconPath });
      router.dismissTo(`/chat/${chatId}`);
    } catch {
      Alert.alert('Could not create the group', 'Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }, [subject, selectedIds, creating, iconUri, viewerId]);

  const ready = canCreateGroup({ subject, memberIds: selectedIds });

  return (
    <Screen
      title={step === 'participants' ? 'New group' : 'Group details'}
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (step === 'details' ? setStep('participants') : router.back())}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
      trailing={
        <Text variant="labelSm" tint={colors.tide.onSurfaceVariant}>
          {step === 'participants' ? selectionLabel(selected.length) : ''}
        </Text>
      }
    >
      {step === 'participants' ? (
        <View style={{ flex: 1 }}>
          <SelectionChips
            selected={selected}
            onRemove={(userId) =>
              setSelected((current) => current.filter((entry) => entry.userId !== userId))
            }
          />

          <ContactPicker
            candidates={candidates}
            search={search}
            onSearch={setSearch}
            selectedIds={selectedIds}
            onToggle={toggle}
          />

          {selected.length > 0 ? (
            <Fab
              icon="arrow-forward"
              label="Continue"
              onPress={() => setStep('details')}
              background={colors.messaging.accent}
              foreground={colors.messaging.onAccent}
              shadow={elevation.floating}
              spacingValue={spacing.edgeMargin}
              radius={radii.full}
            />
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1, padding: spacing.edgeMargin, gap: spacing.edgeMargin }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.edgeMargin }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose group icon" onPress={() => void pickIcon()}>
              <Avatar uri={iconUri} name={subject} size="lg" />
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 20,
                  height: 20,
                  borderRadius: radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.tide.primaryContainer,
                }}
              >
                <MaterialIcons name="photo-camera" size={12} color={colors.tide.onPrimaryContainer} />
              </View>
            </Pressable>

            <View style={{ flex: 1 }}>
              <TextField
                value={subject}
                onChangeText={setSubject}
                placeholder="Group subject"
                maxLength={MAX_SUBJECT_LENGTH}
                autoFocus
              />
            </View>

            <Text variant="labelSm" tint={colors.tide.onSurfaceVariant}>
              {MAX_SUBJECT_LENGTH - subject.length}
            </Text>
          </View>

          <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
            {selected.length === 1 ? '1 participant' : `${selected.length} participants`}
          </Text>

          <SelectionChips
            selected={selected}
            onRemove={(userId) =>
              setSelected((current) => current.filter((entry) => entry.userId !== userId))
            }
          />

          <View style={{ flex: 1 }} />

          <Pressable
            accessibilityRole="button"
            disabled={!ready || creating}
            onPress={() => void create()}
            style={{
              height: spacing.composerActionSize + 4,
              borderRadius: radii.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ready ? colors.messaging.accent : colors.tide.surfaceVariant,
            }}
          >
            {creating ? (
              <ActivityIndicator color={colors.messaging.onAccent} />
            ) : (
              <Text
                variant="buttonText"
                tint={ready ? colors.messaging.onAccent : colors.tide.onSurfaceVariant}
              >
                Create group
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function Fab({
  icon,
  label,
  onPress,
  background,
  foreground,
  shadow,
  spacingValue,
  radius,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  background: string;
  foreground: string;
  shadow: object;
  spacingValue: number;
  radius: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        {
          position: 'absolute',
          right: spacingValue,
          bottom: spacingValue,
          width: 56,
          height: 56,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
        },
        shadow,
      ]}
    >
      <MaterialIcons name={icon} size={24} color={foreground} />
    </Pressable>
  );
}
