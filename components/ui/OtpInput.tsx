import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { OTP_LENGTH, digitsOnly } from '../../services/phone';
import { Text } from './Text';

/**
 * Six boxes over one hidden input. Splitting the value across six real inputs is
 * what makes paste, autofill and hardware backspace misbehave; a single field with
 * a drawn representation keeps SMS autofill (`oneTimeCode`) working.
 */
export function OtpInput({
  value,
  onChange,
  autoFocus = true,
  editable = true,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  const { colors, radii, spacing, type } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = digitsOnly(value).slice(0, OTP_LENGTH);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <Pressable
      accessibilityLabel="Verification code"
      onPress={() => inputRef.current?.focus()}
      style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.stackMd }}
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => {
        const filled = index < digits.length;
        const isCaret = focused && index === digits.length;

        return (
          <View
            key={index}
            style={{
              width: 46,
              height: 56,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isCaret ? colors.tide.surface : colors.tide.surfaceContainer,
              borderWidth: isCaret ? 2 : 1,
              borderColor: isCaret ? colors.tide.primary : colors.tide.outlineVariant,
            }}
          >
            {filled ? (
              <Text variant="navTitle" tint={colors.tide.onBackground}>
                {digits[index]}
              </Text>
            ) : isCaret ? (
              <View style={{ width: 2, height: 24, backgroundColor: colors.tide.primary }} />
            ) : null}
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={(next) => onChange(digitsOnly(next).slice(0, OTP_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        // Off-screen rather than opacity:0 — a zero-opacity input still shows a
        // caret and selection handles on Android.
        style={[type('messageBody'), { position: 'absolute', width: 1, height: 1, opacity: 0, left: -1000 }]}
      />
    </Pressable>
  );
}
