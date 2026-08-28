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
  /**
   * Sender name colours in a group. A ring rather than a semantic slot: the index
   * is derived from the sender id so one person keeps one colour everywhere.
   */
  senderTints: string[];
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
  // The first three are the reference's own group-name colours (on-*-container);
  // the rest extend the ring at the same darkness so no sender reads louder.
  senderTints: ['#005773', '#005426', '#93000a', '#6d4c00', '#5b3fa0', '#00629b', '#8a3324', '#004d40'],
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
  senderTints: ['#c0e8ff', '#6efe98', '#ffdad6', '#ffd699', '#d0bcff', '#9ecaff', '#ffb59d', '#70efde'],
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
  /** Inside a bubble the reference runs looser than a list row: 15/22. */
  bubbleBody: { fontSize: 15, lineHeight: 22, weight: '400' },
  /** The timestamp tucked into the bubble corner is a size smaller than a list one. */
  bubbleMeta: { fontSize: 10, lineHeight: 13, weight: '400' },
  /** Date separators and system notices. */
  chip: { fontSize: 11, lineHeight: 15, weight: '500' },
  composer: { fontSize: 16, lineHeight: 21, weight: '400' },
  /** The name under an info screen's hero avatar. */
  heroTitle: { fontSize: 22, lineHeight: 28, weight: '600' },
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
  /** Conversation geometry, from the polished reference. */
  bubbleMaxWidthRatio: 0.82,
  bubbleTailSize: 8,
  composerMinHeight: 44,
  composerActionSize: 44,
  /** Group geometry: the avatar in the conversation gutter and the header stack. */
  avatarBubbleGutter: 32,
  avatarStack: 36,
  /** Group info: quick-action circles and the shared-media thumbnails. */
  quickActionSize: 48,
  mediaThumb: 80,
  /** The collapsing hero on a contact / group info screen. */
  heroHeight: 220,
  heroCollapsedHeight: 60,
} as const;

export const radii = {
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  /**
   * Bubbles are 12px in the polished conversation reference, not the 7.5px named in
   * DESIGN.md's prose. The screens are the visual source of truth, so 12 wins.
   */
  bubble: 12,
  /** The tail corner — top-right outgoing, top-left incoming. */
  bubbleTail: 2,
  /** Media inside a bubble, inset by the 3px bubble padding. */
  bubbleMedia: 9,
  composer: 24,
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
