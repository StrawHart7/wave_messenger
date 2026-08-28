import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { SettingsCard, SettingsRow } from '../../components/settings/SettingsCard';
import { Screen, Text } from '../../components/ui';
import { FONT_SCALES, WALLPAPERS, fontScaleLabel, themeLabel } from '../../services/settings';
import { useSettings } from '../../stores/settings';
import { useTheme } from '../../theme/ThemeProvider';

const SCALES: (keyof typeof FONT_SCALES)[] = ['small', 'medium', 'large'];

export default function ChatSettingsScreen() {
  const { colors, spacing, radii, iconSizes, preference, setPreference } = useTheme();

  const chat = useSettings((s) => s.chat);
  const setChat = useSettings((s) => s.setChat);

  return (
    <Screen
      title="Chats"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.edgeMargin, gap: spacing.edgeMargin * 1.5 }}>
        <SettingsCard title="Display">
          <SettingsRow
            icon="brightness-6"
            label="Theme"
            value={themeLabel(preference)}
            chevron
            onPress={() => {
              void Haptics.selectionAsync();
              setPreference(preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system');
            }}
          />
          <SettingsRow
            icon="format-size"
            label="Font size"
            value={fontScaleLabel(chat.fontScale)}
            chevron
            separator={false}
            onPress={() => {
              const index = SCALES.indexOf(chat.fontScale);
              void setChat({ fontScale: SCALES[(index + 1) % SCALES.length]! });
            }}
          />
        </SettingsCard>

        <View style={{ gap: spacing.stackSm }}>
          <Text
            variant="labelSm"
            tint={colors.tide.onSurfaceVariant}
            style={{ paddingHorizontal: spacing.edgeMargin, textTransform: 'uppercase', letterSpacing: 1 }}
          >
            Wallpaper
          </Text>

          {/* Solid tints rather than photographs: a set of images would add
              megabytes to the bundle for something most people change once. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.stackMd }}>
            {WALLPAPERS.map((option) => {
              const selected = (chat.wallpaper ?? 'default') === option.key;
              const tint =
                option.tintIndex === null
                  ? colors.messaging.wallpaper
                  : (colors.messaging.statusBackgrounds[option.tintIndex] ?? colors.messaging.wallpaper);

              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} wallpaper`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    void setChat({ wallpaper: option.key === 'default' ? null : option.key });
                  }}
                  style={{ alignItems: 'center', gap: spacing.stackXs }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 96,
                      borderRadius: radii.lg,
                      backgroundColor: tint,
                      borderWidth: selected ? 3 : 1,
                      borderColor: selected ? colors.messaging.accent : colors.messaging.separator,
                    }}
                  />
                  <Text variant="timestamp" tint={colors.tide.onSurfaceVariant}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <SettingsCard title="Composing">
          <SettingsRow
            icon="keyboard-return"
            label="Enter is send"
            description="The return key sends the message instead of adding a new line."
            toggle={chat.enterToSend}
            onToggle={(next) => void setChat({ enterToSend: next })}
            separator={false}
          />
        </SettingsCard>
      </ScrollView>
    </Screen>
  );
}
