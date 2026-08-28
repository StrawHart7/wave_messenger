import { View } from 'react-native';

import { Avatar, ListRow, Text } from '../ui';
import type { GroupMember } from '../../services/groups';
import { publicUrl } from '../../services/media';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One participant. The admin badge is a chip at the end of the name line, not a
 * prefix — the name is what people scan for, and a badge in front pushes every name
 * to a different left edge.
 */
export function MemberRow({
  member,
  viewerId,
  onPress,
  onLongPress,
}: {
  member: GroupMember;
  viewerId: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing, radii } = useTheme();
  const isYou = member.userId === viewerId;

  return (
    <ListRow
      height={64}
      onPress={onPress}
      onLongPress={onLongPress}
      leading={
        <Avatar
          uri={member.avatarPath ? publicUrl('avatars', member.avatarPath) : null}
          name={member.displayName}
          size="groupRow"
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm }}>
        <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1} style={{ flexShrink: 1 }}>
          {isYou ? 'You' : member.displayName}
        </Text>

        {member.role === 'admin' ? (
          <View
            style={{
              paddingHorizontal: spacing.stackSm,
              paddingVertical: 1,
              borderRadius: radii.sm,
              backgroundColor: colors.tide.surfaceVariant,
            }}
          >
            <Text variant="bubbleMeta" tint={colors.tide.onSurfaceVariant}>
              Group Admin
            </Text>
          </View>
        ) : null}
      </View>

      {member.about ? (
        <Text
          variant="timestamp"
          tint={colors.tide.onSurfaceVariant}
          numberOfLines={1}
          style={{ marginTop: 2 }}
        >
          {member.about}
        </Text>
      ) : null}
    </ListRow>
  );
}
