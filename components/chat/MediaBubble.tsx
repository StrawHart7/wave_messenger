import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { documentSubtitle, mediaBubbleSize, type Attachment } from '../../services/attachments';
import { formatDuration } from '../../services/waveform';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';

/**
 * Photo or video inside a bubble. While the upload is in flight the local file is
 * shown behind a progress overlay — the picture is on screen the instant it is
 * chosen, which is the whole point of uploading in the background.
 */
export function MediaAttachment({
  attachment,
  uri,
  maxWidth,
  isVideo,
  onPress,
}: {
  attachment: Attachment;
  uri: string | null;
  maxWidth: number;
  isVideo: boolean;
  onPress?: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const size = mediaBubbleSize(attachment.width, attachment.height, maxWidth);
  const source = attachment.localUri ?? uri;
  const uploading = attachment.localUri !== null && attachment.uploadProgress < 1;

  return (
    <Pressable accessibilityRole="imagebutton" onPress={onPress}>
      <View style={{ width: size.width, height: size.height, borderRadius: radii.bubbleMedia, overflow: 'hidden' }}>
        {source ? (
          <Image
            source={{ uri: source }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.tide.surfaceContainerHigh }} />
        )}

        {uploading ? (
          <View
            style={{
              ...StyleSheetAbsoluteFill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          >
            <ActivityIndicator color={colors.messaging.onAccent} />
            <Text variant="bubbleMeta" tint={colors.messaging.onAccent} style={{ marginTop: 4 }}>
              {Math.round(attachment.uploadProgress * 100)}%
            </Text>
          </View>
        ) : null}

        {isVideo && !uploading ? (
          <View style={{ ...StyleSheetAbsoluteFill, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.full,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialIcons name="play-arrow" size={32} color={colors.messaging.onAccent} />
            </View>
          </View>
        ) : null}

        {isVideo && attachment.durationMs ? (
          <View
            style={{
              position: 'absolute',
              left: spacing.stackSm,
              top: spacing.stackSm,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: radii.md,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <Text variant="bubbleMeta" tint={colors.messaging.onAccent}>
              {formatDuration(attachment.durationMs)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Inlined rather than imported so the object is shared across the three overlays. */
const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

export function DocumentAttachment({ attachment, tint }: { attachment: Attachment; tint: string }) {
  const { colors, radii, spacing } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, minWidth: 200 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.tide.surfaceContainerHigh,
        }}
      >
        <MaterialIcons name="insert-drive-file" size={22} color={colors.tide.onSurfaceVariant} />
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="bubbleBody" tint={colors.messaging.bubbleText} numberOfLines={1}>
          {attachment.storagePath.split('/').pop()}
        </Text>
        <Text variant="bubbleMeta" tint={tint}>
          {documentSubtitle(attachment.mimeType, attachment.byteSize)}
        </Text>
      </View>
    </View>
  );
}
