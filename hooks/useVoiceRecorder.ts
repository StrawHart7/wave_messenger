import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_VOICE_MS } from '../services/attachments';
import { downsample, meteringToAmplitude, type Waveform } from '../services/waveform';

export type RecordingResult = {
  uri: string;
  durationMs: number;
  waveform: Waveform;
};

/**
 * Voice-note recording, and the metering samples that become the waveform.
 *
 * Amplitudes are collected during the recording rather than analysed afterwards:
 * decoding the finished file to draw 14 bars would mean shipping an audio-analysis
 * dependency to compute something the recorder already reports for free.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 100);

  const [locked, setLocked] = useState(false);
  const samples = useRef<number[]>([]);

  // Metering arrives with the recorder state; collect it as it comes.
  useEffect(() => {
    if (state.isRecording && typeof state.metering === 'number') {
      samples.current.push(meteringToAmplitude(state.metering));
    }
  }, [state.isRecording, state.metering]);

  const start = useCallback(async (): Promise<boolean> => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return false;

    // Recording on iOS is silent unless the session allows it explicitly.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    samples.current = [];
    setLocked(false);

    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  /** Stops and returns the note, or null if it was too short to be intentional. */
  const stop = useCallback(async (): Promise<RecordingResult | null> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });

    // The recorder's own duration, not a wall-clock difference: a backgrounded app
    // or an interrupted session makes those two disagree by seconds.
    const durationMs = Math.min(recorder.getStatus().durationMillis, MAX_VOICE_MS);
    const uri = recorder.uri;
    setLocked(false);

    // A tap that grazes the mic button should not send a quarter-second of silence.
    if (!uri || durationMs < 500) return null;

    return { uri, durationMs, waveform: downsample(samples.current) };
  }, [recorder]);

  const cancel = useCallback(async (): Promise<void> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    samples.current = [];
    setLocked(false);
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    elapsedMs: state.durationMillis,
    locked,
    lock: () => setLocked(true),
    start,
    stop,
    cancel,
  };
}
