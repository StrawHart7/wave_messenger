import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../components/ui';
import {
  MAX_CAPTION_LENGTH,
  isPostable,
  nextBackground,
  type StatusKind,
} from '../../services/status';
import { postStatus } from '../../services/statusSync';
import { useSession } from '../../stores/session';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The status composer, in its two shapes: text on a colour, or a caption over a
 * photo or video.
 *
 * One screen rather than two because the difference is the background and the
 * keyboard behaviour — everything else, from the post button to the character
 * budget to the failure handling, is identical.
 */
export default function ComposeStatusScreen() {
  const params = useLocalSearchParams<{ kind?: string; uri?: string; durationMs?: string }>();
  const kind = (params.kind === 'video' || params.kind === 'image' ? params.kind : 'text') as StatusKind;
  const localUri = params.uri && params.uri.length > 0 ? params.uri : null;
  const durationMs = params.durationMs ? Number(params.durationMs) : null;

  const { colors, spacing, radii, iconSizes, type } = useTheme();
  const viewerId = useSession((s) => s.userId) ?? '';

  const backgrounds = colors.messaging.statusBackgrounds;
  const [background, setBackground] = useState(backgrounds[0] ?? colors.messaging.accent);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const ready = isPostable({ kind, caption, localUri });

  const post = useCallback(async () => {
    if (!ready || posting || !viewerId) return;
    setPosting(true);

    try {
      await postStatus({
        authorId: viewerId,
        kind,
        localUri,
        caption: caption.trim().length > 0 ? caption.trim() : null,
        backgroundColor: kind === 'text' ? background : null,
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
      });
      router.back();
    } catch {
      Alert.alert('Could not post', 'Your status was not published. Check your connection and try again.');
    } finally {
      setPosting(false);
    }
  }, [ready, posting, viewerId, kind, localUri, caption, background, durationMs]);

  const isText = kind === 'text';

  return (
    <View style={{ flex: 1, backgroundColor: isText ? background : colors.tide.inverseSurface }}>
      {/* Media sits full-bleed behind the chrome, exactly as it will in the viewer. */}
      {localUri ? (
        <Image
          source={{ uri: localUri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="contain"
        />
      ) : null}

      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.edgeMargin,
            height: spacing.appBarHeight,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name="close" size={iconSizes.xl} color={colors.messaging.onStatusOverlay} />
          </Pressable>

          {isText ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change background colour"
              onPress={() => setBackground((current) => nextBackground(current, backgrounds))}
              hitSlop={8}
            >
              <MaterialIcons name="palette" size={iconSizes.lg} color={colors.messaging.onStatusOverlay} />
            </Pressable>
          ) : null}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: isText ? 'center' : 'flex-end' }}
        >
          {isText ? (
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Type a status"
              placeholderTextColor={colors.messaging.statusRingViewed}
              multiline
              autoFocus
              maxLength={MAX_CAPTION_LENGTH}
              style={[
                type('heroTitle'),
                {
                  color: colors.messaging.onStatusOverlay,
                  textAlign: 'center',
                  paddingHorizontal: spacing.edgeMargin * 2,
                },
              ]}
            />
          ) : (
            <View
              style={{
                margin: spacing.edgeMargin,
                paddingHorizontal: spacing.edgeMargin,
                paddingVertical: spacing.stackSm,
                borderRadius: radii.composer,
                backgroundColor: colors.messaging.statusOverlay,
              }}
            >
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption…"
                placeholderTextColor={colors.messaging.statusRingViewed}
                multiline
                maxLength={MAX_CAPTION_LENGTH}
                style={[type('composer'), { color: colors.messaging.onStatusOverlay, maxHeight: 120 }]}
              />
            </View>
          )}
        </KeyboardAvoidingView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.edgeMargin,
            paddingBottom: spacing.stackMd,
          }}
        >
          <Text variant="labelSm" tint={colors.messaging.onStatusOverlay}>
            {MAX_CAPTION_LENGTH - caption.length}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post status"
            disabled={!ready || posting}
            onPress={() => void post()}
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: ready ? colors.messaging.accent : colors.tide.surfaceVariant,
            }}
          >
            {posting ? (
              <ActivityIndicator color={colors.messaging.onAccent} />
            ) : (
              <MaterialIcons name="send" size={iconSizes.xl} color={colors.messaging.onAccent} />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
