import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Attachment } from '../../services/attachments';
import { barHeights, formatDuration, formatSpeed, nextSpeed, playbackProgress } from '../../services/waveform';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';

/**
 * A voice note: play button, waveform, duration and a speed chip.
 *
 * Bars ahead of the playhead are dimmed and bars behind it are solid — that single
 * cue is what makes a waveform read as a progress bar rather than decoration.
 */
export function VoiceNote({ attachment, uri, tint }: { attachment: Attachment; uri: string | null; tint: string }) {
  const { colors, radii, spacing } = useTheme();
  const [speed, setSpeed] = useState(1);

  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);

  const durationMs = attachment.durationMs ?? (status.duration ? status.duration * 1000 : 0);
  const positionMs = (status.currentTime ?? 0) * 1000;
  const progress = playbackProgress(positionMs, durationMs);
  const waveform = attachment.waveform ?? new Array(14).fill(30);
  const heights = barHeights(waveform);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Restart from the beginning once it has run to the end.
    if (progress >= 1) player.seekTo(0);
    player.play();
  };

  const changeSpeed = () => {
    const next = nextSpeed(speed);
    setSpeed(next);
    player.setPlaybackRate(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd, minWidth: 240 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
        onPress={toggle}
        disabled={!uri}
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.messaging.accent,
          opacity: uri ? 1 : 0.5,
        }}
      >
        <MaterialIcons
          name={status.playing ? 'pause' : 'play-arrow'}
          size={24}
          color={colors.messaging.onAccent}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 }}>
          {heights.map((height, index) => (
            <View
              key={index}
              style={{
                width: 4,
                height,
                borderRadius: radii.full,
                backgroundColor: tint,
                opacity: index / heights.length <= progress ? 1 : 0.4,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <Text variant="timestamp" tint={tint}>
            {formatDuration(status.playing || progress > 0 ? positionMs : durationMs)}
          </Text>

          <Pressable accessibilityRole="button" accessibilityLabel="Playback speed" onPress={changeSpeed} hitSlop={8}>
            <Text variant="bubbleMeta" tint={tint} style={{ opacity: speed === 1 ? 0.6 : 1 }}>
              {formatSpeed(speed)}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
