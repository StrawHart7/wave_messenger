import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text, TextField } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * A single-field dialog.
 *
 * `Alert.prompt` exists on iOS only — on Android it is undefined, so a rename built
 * on it silently does nothing on half the devices. This is the cross-platform
 * equivalent, and it is small enough not to justify a dialog library.
 */
export function TextPrompt({
  visible,
  title,
  initialValue = '',
  placeholder,
  maxLength,
  confirmLabel = 'Save',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  maxLength?: number;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { colors, spacing } = useTheme();

  // The body only exists while the dialog is open, so its state initialises from
  // `initialValue` on mount. Syncing it back with an effect would re-render every
  // open and fight whatever the user has already typed.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.edgeMargin * 2,
          backgroundColor: colors.tide.inverseSurface + '66',
        }}
      >
        {visible ? (
          <PromptBody
            title={title}
            initialValue={initialValue}
            placeholder={placeholder}
            maxLength={maxLength}
            confirmLabel={confirmLabel}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        ) : null}
      </Pressable>
    </Modal>
  );
}

function PromptBody({
  title,
  initialValue,
  placeholder,
  maxLength,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { colors, spacing, radii } = useTheme();
  const [value, setValue] = useState(initialValue);
  const empty = value.trim().length === 0;

  return (
    <Pressable
      // Swallows the tap so pressing inside the card does not dismiss it.
      onPress={() => {}}
      style={{
        width: '100%',
        padding: spacing.edgeMargin,
        gap: spacing.stackMd,
        borderRadius: radii.xl,
        backgroundColor: colors.tide.surfaceContainerLowest,
      }}
    >
      <Text variant="navTitle" tint={colors.tide.onBackground}>
        {title}
      </Text>

      <TextField value={value} onChangeText={setValue} placeholder={placeholder} maxLength={maxLength} autoFocus />

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.edgeMargin }}>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
          <Text variant="buttonText" tint={colors.tide.onSurfaceVariant}>
            Cancel
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onConfirm(value)} disabled={empty} hitSlop={8}>
          <Text variant="buttonText" tint={empty ? colors.tide.outline : colors.tide.primary}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
