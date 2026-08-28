import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { QUICK_REACTIONS } from '../../services/reactions';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type MessageAction = 'reply' | 'forward' | 'copy' | 'star' | 'delete' | 'info';

const ACTIONS: { key: MessageAction; label: string; icon: IconName; destructive?: boolean }[] = [
  { key: 'reply', label: 'Reply', icon: 'reply' },
  { key: 'forward', label: 'Forward', icon: 'forward' },
  { key: 'copy', label: 'Copy', icon: 'content-copy' },
  { key: 'star', label: 'Star', icon: 'star' },
  { key: 'info', label: 'Info', icon: 'info' },
  { key: 'delete', label: 'Delete', icon: 'delete', destructive: true },
];

/**
 * Long-press overlay: the emoji bar above, the action list below, everything else
 * dimmed. Rendered as a modal rather than in place so it escapes the list's clipping
 * and cannot be scrolled away from the message it belongs to.
 */
export function MessageActions({
  visible,
  onClose,
  onReact,
  onAction,
  currentEmoji,
}: {
  visible: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onAction: (action: MessageAction) => void;
  currentEmoji?: string | null;
}) {
  const { colors, radii, spacing, elevation } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.edgeMargin,
        }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 320, gap: spacing.stackMd }}>
          <View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.stackMd,
                paddingVertical: spacing.stackSm,
                borderRadius: radii.full,
                backgroundColor: colors.tide.surfaceContainerLowest,
              },
              elevation.floating,
            ]}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`React ${emoji}`}
                onPress={() => {
                  onClose();
                  onReact(emoji);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: currentEmoji === emoji ? colors.tide.surfaceVariant : 'transparent',
                }}
              >
                <Text variant="navTitle" tint={colors.tide.onSurface} style={{ fontSize: 22 }}>
                  {emoji}
                </Text>
              </Pressable>
            ))}
            <MaterialIcons name="add" size={22} color={colors.tide.onSurfaceVariant} />
          </View>

          <View
            style={[
              {
                borderRadius: radii.xl,
                backgroundColor: colors.tide.surfaceContainerLowest,
                overflow: 'hidden',
              },
              elevation.floating,
            ]}
          >
            {ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onAction(action.key);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.edgeMargin,
                  height: 48,
                  backgroundColor: pressed ? colors.tide.surfaceVariant : 'transparent',
                })}
              >
                <Text
                  variant="buttonText"
                  tint={action.destructive ? colors.tide.error : colors.tide.onSurface}
                >
                  {action.label}
                </Text>
                <MaterialIcons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? colors.tide.error : colors.tide.onSurfaceVariant}
                />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
