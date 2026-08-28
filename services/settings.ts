/**
 * Settings rules — pure. What each privacy audience means, what the toggles claim,
 * and how storage usage is summarised.
 *
 * The important thing this file does *not* do is decide anything: every privacy
 * setting here is a mirror of a rule enforced in Postgres. A label computed in the
 * client is a description of the server's behaviour, never the behaviour itself.
 */

export type PrivacyAudience = 'everyone' | 'contacts' | 'nobody';

export const AUDIENCES: PrivacyAudience[] = ['everyone', 'contacts', 'nobody'];

export type PrivacySettings = {
  lastSeen: PrivacyAudience;
  avatar: PrivacyAudience;
  about: PrivacyAudience;
  readReceipts: boolean;
  typingIndicators: boolean;
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  lastSeen: 'everyone',
  avatar: 'everyone',
  about: 'everyone',
  readReceipts: true,
  typingIndicators: true,
};

export function audienceLabel(audience: PrivacyAudience): string {
  switch (audience) {
    case 'everyone':
      return 'Everyone';
    case 'contacts':
      return 'My contacts';
    case 'nobody':
      return 'Nobody';
  }
}

export function nextAudience(current: PrivacyAudience): PrivacyAudience {
  const index = AUDIENCES.indexOf(current);
  return AUDIENCES[(index + 1) % AUDIENCES.length] ?? 'everyone';
}

/**
 * Read receipts are mutual, and the copy has to say so: turning them off stops you
 * receiving them as well as sending them. Groups are exempt, as in WhatsApp.
 */
export const READ_RECEIPTS_NOTE =
  "If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.";

export const TYPING_NOTE =
  "If turned off, you won't send typing indicators, and you won't see anyone else's.";

/**
 * Hiding your last seen hides theirs too — the reciprocity is what stops the
 * setting being a one-way mirror, and it is enforced in Postgres, not here.
 */
export const LAST_SEEN_NOTE =
  "If you don't share your last seen and online, you won't be able to see other people's.";

export type NotificationPrefs = {
  messages: boolean;
  groups: boolean;
  calls: boolean;
  status: boolean;
  /** In-app sounds for messages sent and received. */
  inAppSounds: boolean;
  vibrate: boolean;
};

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  messages: true,
  groups: true,
  calls: true,
  status: false,
  inAppSounds: true,
  vibrate: true,
};

export type ChatPrefs = {
  /** Wallpaper key, or null for the default tile. */
  wallpaper: string | null;
  /** Return key sends instead of inserting a newline. */
  enterToSend: boolean;
  fontScale: 'small' | 'medium' | 'large';
};

export const DEFAULT_CHAT_PREFS: ChatPrefs = {
  wallpaper: null,
  enterToSend: false,
  fontScale: 'medium',
};

export const FONT_SCALES: Record<ChatPrefs['fontScale'], number> = {
  small: 0.9,
  medium: 1,
  large: 1.15,
};

export function fontScaleLabel(scale: ChatPrefs['fontScale']): string {
  return scale.charAt(0).toUpperCase() + scale.slice(1);
}

export type ThemePreference = 'system' | 'light' | 'dark';

export function themeLabel(preference: ThemePreference): string {
  return preference === 'system' ? 'System default' : preference === 'light' ? 'Light' : 'Dark';
}

/** The "about" line under a name. Long enough to be a sentence, not a biography. */
export const MAX_ABOUT_LENGTH = 139;

export function normalizeAbout(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ABOUT_LENGTH);
}

export type ChatStorageUsage = {
  chatId: string;
  title: string;
  bytes: number;
  items: number;
};

/**
 * Storage per chat, largest first, with the total.
 *
 * Sorted by size rather than by name: the entire reason to open this screen is to
 * find what is worth deleting, and that is never the alphabetically first chat.
 */
export function storageBreakdown(usage: ChatStorageUsage[]): {
  rows: ChatStorageUsage[];
  totalBytes: number;
  totalItems: number;
} {
  const rows = [...usage].sort((a, b) => b.bytes - a.bytes);
  return {
    rows,
    totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    totalItems: rows.reduce((sum, row) => sum + row.items, 0),
  };
}

/** A 0..1 share of the total, for the bar next to each row. */
export function storageShare(bytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.min(Math.max(bytes / totalBytes, 0), 1);
}

export type WallpaperOption = {
  key: string;
  label: string;
  /** Index into `colors.messaging.statusBackgrounds`, or null for the default tile. */
  tintIndex: number | null;
};

/**
 * Wallpapers are solid tints rather than images: shipping a set of photographs
 * would add megabytes to the bundle for something most people change once.
 */
export const WALLPAPERS: WallpaperOption[] = [
  { key: 'default', label: 'Default', tintIndex: null },
  { key: 'teal', label: 'Teal', tintIndex: 1 },
  { key: 'forest', label: 'Forest', tintIndex: 0 },
  { key: 'plum', label: 'Plum', tintIndex: 2 },
  { key: 'clay', label: 'Clay', tintIndex: 3 },
  { key: 'indigo', label: 'Indigo', tintIndex: 4 },
  { key: 'amber', label: 'Amber', tintIndex: 5 },
  { key: 'slate', label: 'Slate', tintIndex: 6 },
];

export function wallpaperFor(key: string | null): WallpaperOption {
  return WALLPAPERS.find((option) => option.key === key) ?? WALLPAPERS[0]!;
}

/**
 * Whether a typing indicator from this peer should be shown.
 *
 * Reciprocal, like read receipts: switching yours off switches theirs off for you.
 * A broadcast payload cannot be filtered server-side the way a table row can, so
 * this is the honest enforcement point — and it is why the setting also stops the
 * outgoing broadcast rather than only hiding the incoming one.
 */
export function showsTypingFrom(mine: boolean, theirs: boolean): boolean {
  return mine && theirs;
}
