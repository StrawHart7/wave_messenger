import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { PrimaryButton, Text } from '../../components/ui';
import { CountryPicker } from '../../components/auth/CountryPicker';
import { Screen } from '../../components/ui/Screen';
import { TextField } from '../../components/ui/TextField';
import { sendOtp } from '../../services/auth';
import {
  DEFAULT_COUNTRY,
  formatNational,
  isValidNational,
  toE164,
  type Country,
} from '../../services/phone';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

export default function PhoneEntryScreen() {
  const { colors, spacing, iconSizes } = useTheme();
  const setPendingPhone = useSession((s) => s.setPendingPhone);

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const valid = useMemo(() => isValidNational(national, country), [national, country]);

  const submit = async () => {
    const e164 = toE164(national, country);
    setSending(true);
    try {
      await sendOtp(e164);
      setPendingPhone(e164);
      router.push('/otp');
    } catch (error) {
      Alert.alert('Could not send the code', error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      title="Phone number"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      separator={false}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.edgeMargin, paddingTop: spacing.stackMd * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          variant="messageBody"
          tint={colors.tide.onSurfaceVariant}
          style={{ textAlign: 'center', marginBottom: spacing.edgeMargin * 2.5 }}
        >
          Please confirm your country code and enter your phone number.
        </Text>

        <View
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.tide.outlineVariant,
            backgroundColor: colors.tide.surfaceContainerLowest,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerOpen(true)}
            style={{
              height: 56,
              paddingHorizontal: spacing.edgeMargin,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: colors.tide.outlineVariant,
            }}
          >
            <Text variant="navTitle" tint={colors.tide.primary}>
              {country.name}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={iconSizes.xl}
              color={colors.tide.onSurfaceVariant}
            />
          </Pressable>

          <TextField
            appearance="row"
            value={formatNational(national, country)}
            onChangeText={setNational}
            placeholder="Phone number"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            containerStyle={{ borderBottomWidth: 0 }}
            leading={
              <View
                style={{
                  width: 76,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRightWidth: 1,
                  borderRightColor: colors.tide.outlineVariant,
                }}
              >
                <Text variant="navTitle" tint={colors.tide.onSurfaceVariant}>
                  {country.dial}
                </Text>
              </View>
            }
          />
        </View>

        <Text
          variant="labelSm"
          tint={colors.tide.onSurfaceVariant}
          style={{ textAlign: 'center', marginTop: spacing.edgeMargin * 2, lineHeight: 18 }}
        >
          Carrier SMS charges may apply. By tapping “Next”, you agree to our Terms of Service and
          Privacy Policy.
        </Text>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.edgeMargin, paddingBottom: spacing.edgeMargin * 2 }}>
        <PrimaryButton
          label={sending ? 'Sending…' : 'Next'}
          disabled={!valid || sending}
          onPress={submit}
          style={{ height: 56, width: '100%' }}
        />
      </View>

      <CountryPicker
        visible={pickerOpen}
        selected={country}
        onSelect={(next) => {
          setCountry(next);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}
