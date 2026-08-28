import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '../../components/ui';
import { OtpInput } from '../../components/ui/OtpInput';
import { Screen } from '../../components/ui/Screen';
import { sendOtp, verifyOtp } from '../../services/auth';
import { formatE164ForDisplay, formatResendCountdown, isCompleteOtp } from '../../services/phone';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

const RESEND_SECONDS = 60;

export default function OtpScreen() {
  const { colors, spacing, radii, iconSizes } = useTheme();
  const phone = useSession((s) => s.phone);
  const setProfile = useSession((s) => s.setProfile);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const submit = useCallback(
    async (value: string) => {
      if (!phone) return;
      setVerifying(true);
      try {
        const profile = await verifyOtp(phone, value);
        if (profile) {
          setProfile(profile);
          router.replace('/');
        } else {
          router.replace('/profile-setup');
        }
      } catch (error) {
        Alert.alert('Wrong code', error instanceof Error ? error.message : String(error));
        setCode('');
      } finally {
        setVerifying(false);
      }
    },
    [phone, setProfile],
  );

  const resend = async () => {
    if (!phone) return;
    try {
      await sendOtp(phone);
      setSecondsLeft(RESEND_SECONDS);
    } catch (error) {
      Alert.alert('Could not resend', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Screen
      title="Verify"
      titleTint={colors.tide.onBackground}
      barHeight={spacing.listItemHeight}
      separator={false}
      leading={
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={iconSizes.xl} color={colors.tide.primary} />
        </Pressable>
      }
    >
      <View style={{ flex: 1, paddingHorizontal: spacing.edgeMargin, paddingTop: spacing.edgeMargin * 2 }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.edgeMargin * 2 }}>
          <Text variant="navTitle" tint={colors.tide.onBackground} style={{ fontSize: 24, lineHeight: 30 }}>
            Enter OTP
          </Text>
          <Text
            variant="sectionHeader"
            tint={colors.tide.onSurfaceVariant}
            style={{ textAlign: 'center', marginTop: spacing.stackSm }}
          >
            We&apos;ve sent a 6-digit code to
          </Text>
          <Text variant="chatName" tint={colors.tide.onBackground}>
            {phone ? formatE164ForDisplay(phone) : ''}
          </Text>
        </View>

        <OtpInput
          value={code}
          // Autofilled codes arrive complete, so submit on completion rather than
          // making the user reach for a button that is only ever tapped once.
          onChange={(next) => {
            setCode(next);
            if (isCompleteOtp(next) && !verifying) void submit(next);
          }}
          editable={!verifying}
        />

        <View
          style={{
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.stackSm,
            marginTop: spacing.edgeMargin * 2,
            paddingVertical: 10,
            paddingHorizontal: spacing.edgeMargin * 1.25,
            borderRadius: radii.full,
            borderWidth: 1,
            borderColor: colors.tide.secondaryContainer,
          }}
        >
          <MaterialIcons name="sms" size={iconSizes.sm} color={colors.tide.secondary} />
          <Text variant="labelSm" tint={colors.tide.secondary}>
            {verifying ? 'Verifying…' : 'Waiting for SMS…'}
          </Text>
        </View>

        <View style={{ marginTop: 'auto', alignItems: 'center', paddingBottom: spacing.edgeMargin * 2 }}>
          <Text variant="sectionHeader" tint={colors.tide.onSurfaceVariant}>
            Didn&apos;t receive code?
          </Text>
          <Pressable accessibilityRole="button" disabled={secondsLeft > 0} onPress={resend} hitSlop={8}>
            <Text
              variant="buttonText"
              tint={colors.tide.primary}
              style={{ marginTop: spacing.stackMd, opacity: secondsLeft > 0 ? 0.6 : 1 }}
            >
              {secondsLeft > 0 ? `Resend code in ${formatResendCountdown(secondsLeft)}` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
