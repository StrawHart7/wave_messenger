import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type AttachmentAction = 'gallery' | 'camera' | 'document' | 'contact' | 'location' | 'poll';

/**
 * The attachment grid. Each tile keeps its own colour — that is how people find
 * "Camera" without reading the labels, and it is the one place in the app where
 * colour is decorative rather than semantic.
 */
const ACTIONS: { key: AttachmentAction; label: string; icon: IconName; tone: 'primary' | 'secondary' | 'tertiary' | 'error' }[] = [
  { key: 'gallery', label: 'Gallery', icon: 'photo-library', tone: 'secondary' },
  { key: 'camera', label: 'Camera', icon: 'photo-camera', tone: 'error' },
  { key: 'document', label: 'Document', icon: 'insert-drive-file', tone: 'primary' },
  { key: 'contact', label: 'Contact', icon: 'person', tone: 'tertiary' },
  { key: 'location', label: 'Location', icon: 'location-on', tone: 'secondary' },
  { key: 'poll', label: 'Poll', icon: 'poll', tone: 'primary' },
];

export function AttachmentSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AttachmentAction) => void;
}) {
  const { colors, radii, spacing } = useTheme();

  const toneColor = (tone: 'primary' | 'secondary' | 'tertiary' | 'error') => {
    switch (tone) {
      case 'secondary':
        return colors.tide.secondaryContainer;
      case 'tertiary':
        return colors.tide.tertiaryContainer;
      case 'error':
        return colors.tide.errorContainer;
      case 'primary':
      default:
        return colors.tide.primaryContainer;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
      >
        {/* Stop presses inside the sheet from closing it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.tide.surfaceContainerLowest,
            borderTopLeftRadius: radii.xl * 2,
            borderTopRightRadius: radii.xl * 2,
            paddingHorizontal: spacing.edgeMargin,
            paddingTop: spacing.edgeMargin,
            paddingBottom: spacing.edgeMargin * 2.5,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: radii.full,
              backgroundColor: colors.tide.outlineVariant,
              marginBottom: spacing.edgeMargin,
            }}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.edgeMargin }}>
            {ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onSelect(action.key);
                }}
                style={{ width: '33.33%', alignItems: 'center', gap: spacing.stackSm }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radii.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: toneColor(action.tone),
                  }}
                >
                  <MaterialIcons name={action.icon} size={26} color={colors.tide.onSurface} />
                </View>
                <Text variant="labelSm" tint={colors.tide.onSurfaceVariant}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
