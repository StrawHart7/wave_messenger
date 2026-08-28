/**
 * Voice-note waveform maths. Pure — the recorder feeds it metering samples, the
 * bubble renders whatever comes out, and neither needs a device to test.
 */

/** Bars drawn in a bubble. The reference draws 14 in a 240px-min bubble. */
export const WAVEFORM_BARS = 14;

/** Amplitudes are stored 0-100 so they survive a trip through Postgres as smallint[]. */
export type Waveform = number[];

/**
 * Downsamples an arbitrary number of metering samples to a fixed bar count by
 * averaging each bucket. Averaging rather than sampling every nth value is what
 * stops a long recording from looking like noise: a peak in a bucket the sampler
 * skipped would simply vanish.
 */
export function downsample(samples: number[], bars = WAVEFORM_BARS): Waveform {
  if (samples.length === 0) return new Array(bars).fill(0);
  if (samples.length <= bars) {
    // Pad short recordings rather than stretching them — a half-second note should
    // read as a few bars, not a full-width waveform.
    return [...samples.map(clampAmplitude), ...new Array(bars - samples.length).fill(0)];
  }

  const bucketSize = samples.length / bars;
  const result: Waveform = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const start = Math.floor(bar * bucketSize);
    const end = Math.max(start + 1, Math.floor((bar + 1) * bucketSize));
    const bucket = samples.slice(start, end);
    const mean = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
    result.push(clampAmplitude(mean));
  }

  return result;
}

function clampAmplitude(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * expo-audio reports metering in dBFS: 0 is clipping, -160 is silence. Mapping that
 * straight to a height makes every bar look full, because speech sits in the top
 * 40dB. Anchoring the floor at -50dB is what gives the reference's visible dynamics.
 */
export function meteringToAmplitude(db: number, floorDb = -50): number {
  if (!Number.isFinite(db)) return 0;
  const normalized = (db - floorDb) / -floorDb;
  return clampAmplitude(normalized * 100);
}

/** "0:14", "1:07" — voice-note duration and the recording timer. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Bar heights in px for a given track height, with a visible minimum. */
export function barHeights(waveform: Waveform, trackHeight = 28, minHeight = 4): number[] {
  return waveform.map((amplitude) => minHeight + (amplitude / 100) * (trackHeight - minHeight));
}

/** How far through the note playback is, 0-1, for colouring played bars. */
export function playbackProgress(positionMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, positionMs / durationMs));
}

/** Playback speed cycles 1x -> 1.5x -> 2x -> 1x, as WhatsApp's chip does. */
export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

export function nextSpeed(current: number): number {
  const index = PLAYBACK_SPEEDS.indexOf(current as (typeof PLAYBACK_SPEEDS)[number]);
  return PLAYBACK_SPEEDS[(index + 1) % PLAYBACK_SPEEDS.length]!;
}

export function formatSpeed(speed: number): string {
  return `${speed}×`;
}
