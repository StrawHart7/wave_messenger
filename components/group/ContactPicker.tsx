import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';

import { Avatar, ListRow, Text, TextField } from '../ui';
import type { PickerCandidate } from '../../services/groups';
import { publicUrl } from '../../services/media';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The searchable people list behind every "choose someone" screen.
 *
 * It reads whatever the caller hands it — the local profile cache, never the
 * network — so the screen paints instantly and search filters an array rather than
 * issuing a query per keystroke.
 */
export function ContactPicker({
  candidates,
  search,
  onSearch,
  selectedIds,
  onToggle,
  header,
  emptyLabel = 'No contacts on Wave yet.',
}: {
  candidates: PickerCandidate[];
  search: string;
  onSearch: (value: string) => void;
  /** Omitted for a single-select list, which shows no checkmarks. */
  selectedIds?: string[];
  onToggle: (candidate: PickerCandidate) => void;
  header?: React.ReactNode;
  emptyLabel?: string;
}) {
  const { colors, spacing, radii, iconSizes } = useTheme();
  const selected = new Set(selectedIds ?? []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.edgeMargin, paddingVertical: spacing.stackMd }}>
        <TextField
          appearance="row"
          value={search}
          onChangeText={onSearch}
          placeholder="Search name or number"
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
      </View>

      <FlashList
        data={candidates}
        keyExtractor={(candidate) => candidate.userId}
        ListHeaderComponent={header ? <>{header}</> : null}
        ListEmptyComponent={
          <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center' }}>
            <Text variant="chatName" tint={colors.tide.onSurfaceVariant}>
              {emptyLabel}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            onPress={() => onToggle(item)}
            leading={
              <View>
                <Avatar
                  uri={item.avatarPath ? publicUrl('avatars', item.avatarPath) : null}
                  name={item.displayName}
                  size="lg"
                />
                {selected.has(item.userId) ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 18,
                      height: 18,
                      borderRadius: radii.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.messaging.accent,
                      borderWidth: 2,
                      borderColor: colors.tide.background,
                    }}
                  >
                    <MaterialIcons name="check" size={10} color={colors.messaging.onAccent} />
                  </View>
                ) : null}
              </View>
            }
          >
            <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
              {item.displayName}
            </Text>
            {item.about ? (
              <Text
                variant="sectionHeader"
                tint={colors.tide.onSurfaceVariant}
                numberOfLines={1}
                style={{ marginTop: 2 }}
              >
                {item.about}
              </Text>
            ) : null}
          </ListRow>
        )}
      />
    </View>
  );
}
