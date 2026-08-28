import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COUNTRIES, type Country } from '../../services/phone';
import { useTheme } from '../../theme/ThemeProvider';
import { ListRow } from '../ui/ListRow';
import { Text } from '../ui/Text';

export function CountryPicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Country;
  onSelect: (country: Country) => void;
  onClose: () => void;
}) {
  const { colors, spacing, iconSizes } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.tide.background }}>
        <View
          style={{
            height: spacing.listItemHeight,
            paddingHorizontal: spacing.edgeMargin,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={iconSizes.xl} color={colors.tide.primary} />
          </Pressable>
          <Text variant="navTitle" tint={colors.tide.onBackground} style={{ marginLeft: spacing.edgeMargin }}>
            Choose a country
          </Text>
        </View>

        <ScrollView>
          {COUNTRIES.map((country) => (
            <ListRow
              key={country.code}
              height={56}
              onPress={() => onSelect(country)}
              trailing={
                country.code === selected.code ? (
                  <MaterialIcons name="check" size={iconSizes.lg} color={colors.tide.primary} />
                ) : (
                  <Text variant="messageBody" tint={colors.tide.onSurfaceVariant}>
                    {country.dial}
                  </Text>
                )
              }
            >
              <Text variant="chatName" tint={colors.tide.onBackground}>
                {country.name}
              </Text>
            </ListRow>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
