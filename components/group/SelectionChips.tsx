import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Text } from '../ui';
import type { PickerCandidate } from '../../services/groups';
import { publicUrl } from '../../services/media';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The horizontal strip of who is already selected.
 *
 * It scrolls rather than wrapping: a wrapping strip changes height as people are
 * added, which pushes the list under the user's finger mid-tap.
 */
export function SelectionChips({
  selected,
  onRemove,
}: {
  selected: PickerCandidate[];
  onRemove: (userId: string) => void;
}) {
  const { colors, spacing, radii } = useTheme();

  if (selected.length === 0) return null;

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.messaging.separator }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.edgeMargin,
          paddingVertical: spacing.stackMd,
          gap: spacing.stackSm,
        }}
      >
        {selected.map((candidate) => (
          <Pressable
            key={candidate.userId}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${candidate.displayName}`}
            onPress={() => onRemove(candidate.userId)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.stackSm,
              paddingRight: spacing.stackMd,
              paddingLeft: spacing.stackXs,
              paddingVertical: spacing.stackXs,
              borderRadius: radii.full,
              backgroundColor: colors.tide.surfaceContainer,
            }}
          >
            <Avatar
              uri={candidate.avatarPath ? publicUrl('avatars', candidate.avatarPath) : null}
              name={candidate.displayName}
              size="sm"
            />
            <Text variant="labelSm" tint={colors.tide.onSurface} numberOfLines={1}>
              {candidate.displayName}
            </Text>
            <MaterialIcons name="close" size={14} color={colors.tide.onSurfaceVariant} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
