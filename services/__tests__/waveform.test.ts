import {
  WAVEFORM_BARS,
  barHeights,
  downsample,
  formatDuration,
  formatSpeed,
  meteringToAmplitude,
  nextSpeed,
  playbackProgress,
} from '../waveform';

describe('downsample', () => {
  it('always produces the bar count the bubble draws', () => {
    expect(downsample([], 14)).toHaveLength(14);
    expect(downsample([50], 14)).toHaveLength(14);
    expect(downsample(new Array(500).fill(50), 14)).toHaveLength(14);
    expect(downsample(new Array(500).fill(50))).toHaveLength(WAVEFORM_BARS);
  });

  it('averages a bucket rather than sampling it, so peaks survive', () => {
    // One loud sample in the first half; sampling every nth value could miss it.
    const samples = [100, 0, 0, 0, 0, 0, 0, 0];
    const bars = downsample(samples, 2);
    expect(bars[0]).toBeGreaterThan(0);
  });

  it('pads a short recording instead of stretching it', () => {
    const bars = downsample([80, 60], 6);
    expect(bars).toEqual([80, 60, 0, 0, 0, 0]);
  });

  it('clamps out-of-range and non-finite values', () => {
    expect(downsample([200, -50, Number.NaN], 3)).toEqual([100, 0, 0]);
  });
});

describe('meteringToAmplitude', () => {
  it('maps silence to zero and clipping to full', () => {
    expect(meteringToAmplitude(-50)).toBe(0);
    expect(meteringToAmplitude(0)).toBe(100);
  });

  it('puts speech in the visible middle rather than pinned at the top', () => {
    const speech = meteringToAmplitude(-20);
    expect(speech).toBeGreaterThan(40);
    expect(speech).toBeLessThan(80);
  });

  it('clamps anything below the floor', () => {
    expect(meteringToAmplitude(-160)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('reads as minutes and padded seconds', () => {
    expect(formatDuration(14_000)).toBe('0:14');
    expect(formatDuration(67_000)).toBe('1:07');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('never goes negative', () => {
    expect(formatDuration(-1000)).toBe('0:00');
  });
});

describe('rendering helpers', () => {
  it('gives every bar a visible minimum height', () => {
    const heights = barHeights([0, 50, 100], 28, 4);
    expect(heights[0]).toBe(4);
    expect(heights[2]).toBe(28);
    expect(heights[1]).toBeGreaterThan(4);
  });

  it('reports progress as a clamped fraction', () => {
    expect(playbackProgress(0, 1000)).toBe(0);
    expect(playbackProgress(500, 1000)).toBe(0.5);
    expect(playbackProgress(2000, 1000)).toBe(1);
    expect(playbackProgress(500, 0)).toBe(0);
  });
});

describe('playback speed', () => {
  it('cycles 1 -> 1.5 -> 2 -> 1', () => {
    expect(nextSpeed(1)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
  });

  it('recovers from an unexpected speed', () => {
    expect(nextSpeed(3)).toBe(1);
  });

  it('labels with the multiplication sign the reference uses', () => {
    expect(formatSpeed(1.5)).toBe('1.5×');
  });
});
