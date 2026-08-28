/**
 * Device-local preferences: wallpaper, notification toggles, chat behaviour.
 *
 * These are deliberately *not* on the server. A wallpaper is a property of this
 * phone, not of the account — syncing it would mean a tablet inheriting a choice
 * made for a small screen, and it would put a row in Postgres behind every taste
 * decision. Privacy settings are the opposite and live only on the server.
 */
import {
  DEFAULT_CHAT_PREFS,
  DEFAULT_NOTIFICATIONS,
  type ChatPrefs,
  type NotificationPrefs,
} from './settings';
import { storage } from './storage';

const CHAT_KEY = 'wave.prefs.chat';
const NOTIFICATIONS_KEY = 'wave.prefs.notifications';

/**
 * Merges over the defaults rather than replacing them: a preferences blob written
 * by an older version is missing whatever was added since, and a missing key must
 * read as its default, not as `undefined`.
 */
async function read<T extends object>(key: string, fallback: T): Promise<T> {
  const raw = await storage.get(key);
  if (!raw) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function loadChatPrefs(): Promise<ChatPrefs> {
  return read(CHAT_KEY, DEFAULT_CHAT_PREFS);
}

export async function saveChatPrefs(prefs: ChatPrefs): Promise<void> {
  await storage.set(CHAT_KEY, JSON.stringify(prefs));
}

export function loadNotificationPrefs(): Promise<NotificationPrefs> {
  return read(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS);
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await storage.set(NOTIFICATIONS_KEY, JSON.stringify(prefs));
}

/** Test seam and "reset app" path. */
export async function clearPreferences(): Promise<void> {
  await storage.remove(CHAT_KEY);
  await storage.remove(NOTIFICATIONS_KEY);
}
