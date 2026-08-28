import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Modal, Pressable, View } from 'react-native';

import { Avatar, Text } from '../ui';
import type { StatusViewer } from '../../db/status';
import { publicUrl } from '../../services/media';
import { statusTime, viewerCountLabel } from '../../services/status';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Who has seen one of your own posts.
 *
 * Shown only to the author — the RLS policy on status_views makes anyone else's
 * query return their own row and nothing more, so there is no other list to show.
 */
export function ViewerSheet({
  visible,
  viewers,
  onClose,
  onDelete,
}: {
  visible: boolean;
  viewers: StatusViewer[];
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { colors, spacing, radii, iconSizes } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.messaging.statusOverlay }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            maxHeight: '60%',
            paddingTop: spacing.stackMd,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            backgroundColor: colors.tide.surfaceContainerLowest,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: spacing.stackSm }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radii.full,
                backgroundColor: colors.tide.outlineVariant,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.edgeMargin,
              paddingBottom: spacing.stackMd,
            }}
          >
            <Text variant="chatName" tint={colors.tide.onBackground}>
              {viewerCountLabel(viewers.length)}
            </Text>

            {onDelete ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Delete status" onPress={onDelete} hitSlop={8}>
                <MaterialIcons name="delete-outline" size={iconSizes.lg} color={colors.tide.error} />
              </Pressable>
            ) : null}
          </View>

          <FlashList
            data={viewers}
            keyExtractor={(viewer) => viewer.userId}
            ListEmptyComponent={
              <View style={{ padding: spacing.edgeMargin * 2, alignItems: 'center' }}>
                <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
                  Nobody has seen this yet.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.stackMd,
                  paddingHorizontal: spacing.edgeMargin,
                  paddingVertical: spacing.stackSm,
                }}
              >
                <Avatar
                  uri={item.avatarPath ? publicUrl('avatars', item.avatarPath) : null}
                  name={item.displayName}
                  size="groupRow"
                />
                <View style={{ flex: 1 }}>
                  <Text variant="chatName" tint={colors.tide.onBackground} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text variant="timestamp" tint={colors.tide.onSurfaceVariant}>
                    {statusTime(item.viewedAt)}
                  </Text>
                </View>
              </View>
            )}
          />

          <View style={{ height: spacing.edgeMargin * 2 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
