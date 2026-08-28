/**
 * Design tokens — mirrored from design-reference/tide_system/DESIGN.md.
 *
 * This file is the ONLY place a raw color, radius, spacing or type value may appear.
 * If you need a literal anywhere else, add a token here instead.
 *
 * Two families live side by side, exactly as the reference screens use them:
 *  - `tide`      the Material-style semantic set (surfaces, on-surfaces, outlines)
 *  - `messaging` the WhatsApp-class semantics layered on top (bubbles, ticks, wallpaper)
 * Chrome comes from `tide`; anything conversation-specific comes from `messaging`.
 */

export type TideColors = {
  background: string;
  onBackground: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  primaryFixed: string;
  primaryFixedDim: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
};

export type MessagingColors = {
  accent: string;
  accentPressed: string;
  onAccent: string;
  bubbleOutgoing: string;
  bubbleIncoming: string;
  bubbleText: string;
  meta: string;
  metaDim: string;
  tickPending: string;
  tickSent: string;
  tickRead: string;
  wallpaper: string;
  separator: string;
  link: string;
};

const tideLight: TideColors = {
  background: '#f5faff',
  onBackground: '#131d23',
  surface: '#f5faff',
  surfaceDim: '#d1dbe4',
  surfaceBright: '#f5faff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eaf5fe',
  surfaceContainer: '#e5eff8',
  surfaceContainerHigh: '#dfeaf2',
  surfaceContainerHighest: '#d9e4ec',
  surfaceVariant: '#d9e4ec',
  onSurface: '#131d23',
  onSurfaceVariant: '#3c4a3d',
  inverseSurface: '#283238',
  inverseOnSurface: '#e8f2fb',
  outline: '#6c7b6b',
  outlineVariant: '#bbcbb9',
  primary: '#006d2f',
  onPrimary: '#ffffff',
  primaryContainer: '#25d366',
  onPrimaryContainer: '#005523',
  inversePrimary: '#3de273',
  primaryFixed: '#66ff8e',
  primaryFixedDim: '#3de273',
  secondary: '#006686',
  onSecondary: '#ffffff',
  secondaryContainer: '#68cffe',
  onSecondaryContainer: '#005773',
  tertiary: '#006d33',
  onTertiary: '#ffffff',
  tertiaryContainer: '#3bd172',
  onTertiaryContainer: '#005426',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
};

/**
 * Dark set. The reference HTML expresses dark mode through `dark:` utilities that
 * reuse the inverse ends of the Tide ramp (app bar -> on-background, text ->
 * inverse-on-surface, accent -> primary-fixed), so the mapping below follows that
 * usage rather than inventing a second palette.
 */
const tideDark: TideColors = {
  background: '#131d23',
  onBackground: '#e8f2fb',
  surface: '#131d23',
  surfaceDim: '#0d161b',
  surfaceBright: '#283238',
  surfaceContainerLowest: '#0b1418',
  surfaceContainerLow: '#1a242a',
  surfaceContainer: '#1e2830',
  surfaceContainerHigh: '#283238',
  surfaceContainerHighest: '#323c42',
  surfaceVariant: '#283238',
  onSurface: '#e8f2fb',
  onSurfaceVariant: '#bbcbb9',
  inverseSurface: '#e8f2fb',
  inverseOnSurface: '#131d23',
  outline: '#6c7b6b',
  outlineVariant: '#3c4a3d',
  primary: '#66ff8e',
  onPrimary: '#002109',
  primaryContainer: '#005322',
  onPrimaryContainer: '#66ff8e',
  inversePrimary: '#006d2f',
  primaryFixed: '#66ff8e',
  primaryFixedDim: '#3de273',
  secondary: '#70d2ff',
  onSecondary: '#001e2b',
  secondaryContainer: '#004d66',
  onSecondaryContainer: '#c0e8ff',
  tertiary: '#4ee07f',
  onTertiary: '#00210b',
  tertiaryContainer: '#005225',
  onTertiaryContainer: '#6efe98',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
};

/** Conversation semantics. Fixed across themes except where a dark value is named. */
const messagingLight: MessagingColors = {
  /** Vivid green. FAB, unread badges, active toggles, online dot, send button. */
  accent: '#25D366',
  accentPressed: '#1FAD55',
  onAccent: '#ffffff',
  bubbleOutgoing: '#D9FDD3',
  bubbleIncoming: '#FFFFFF',
  bubbleText: '#131d23',
  /** Timestamps, snippet text, "last seen" lines. */
  meta: '#54656F',
  metaDim: '#8696A0',
  tickPending: '#8696A0',
  tickSent: '#8696A0',
  tickRead: '#53BDEB',
  wallpaper: '#EFEAE2',
  separator: '#E9EDEF',
  link: '#027EB5',
};

const messagingDark: MessagingColors = {
  accent: '#25D366',
  accentPressed: '#1FAD55',
  onAccent: '#ffffff',
  bubbleOutgoing: '#005C4B',
  bubbleIncoming: '#202C33',
  bubbleText: '#e8f2fb',
  meta: '#8696A0',
  metaDim: '#667781',
  tickPending: '#8696A0',
  tickSent: '#8696A0',
  tickRead: '#53BDEB',
  wallpaper: '#0B141A',
  separator: '#232D36',
  link: '#53BDEB',
};

export type Palette = { tide: TideColors; messaging: MessagingColors };

export const palettes: Record<'light' | 'dark', Palette> = {
  light: { tide: tideLight, messaging: messagingLight },
  dark: { tide: tideDark, messaging: messagingDark },
};

export type ColorScheme = keyof typeof palettes;

/** Type roles. `weight` maps to a loaded Be Vietnam Pro face — see theme/fonts.ts. */
export const typography = {
  navTitle: { fontSize: 17, lineHeight: 22, weight: '600' },
  chatName: { fontSize: 16, lineHeight: 20, weight: '500' },
  messageBody: { fontSize: 15, lineHeight: 20, weight: '400' },
  timestamp: { fontSize: 11, lineHeight: 14, weight: '400' },
  labelSm: { fontSize: 12, lineHeight: 16, weight: '500', letterSpacing: 0.24 },
  buttonText: { fontSize: 14, lineHeight: 18, weight: '600' },
  sectionHeader: { fontSize: 13, lineHeight: 18, weight: '400' },
} as const;

export type TypeRole = keyof typeof typography;

/** 4/8 baseline grid. */
export const spacing = {
  edgeMargin: 16,
  stackXs: 4,
  stackSm: 8,
  stackMd: 12,
  bubblePaddingH: 12,
  bubblePaddingV: 8,
  listItemHeight: 72,
  appBarHeight: 60,
  avatarLg: 48,
  avatarSm: 32,
  avatarXl: 96,
  avatarGroupRow: 40,
  statusDot: 14,
} as const;

export const radii = {
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  /** Message bubbles only — the reference is explicit about 7.5. */
  bubble: 7.5,
  /** The corner adjacent to the screen edge when a bubble carries a tail. */
  bubbleTail: 2,
  search: 10,
  full: 9999,
} as const;

/**
 * Depth comes from tonal layers and hairlines, not shadows. The FAB and modals are
 * the only elements permitted an actual shadow.
 */
export const elevation = {
  hairline: 1,
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

/** Icons are 1.7px stroke, rounded caps; filled only for an active tab. */
export const iconSizes = {
  sm: 18,
  md: 20,
  lg: 22,
  xl: 24,
  tab: 26,
} as const;
