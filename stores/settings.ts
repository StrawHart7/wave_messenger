import { create } from 'zustand';

import { loadChatPrefs, loadNotificationPrefs, saveChatPrefs, saveNotificationPrefs } from '../services/preferences';
import { fetchPrivacy, updatePrivacy } from '../services/privacySync';
import {
  DEFAULT_CHAT_PREFS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  type ChatPrefs,
  type NotificationPrefs,
  type PrivacySettings,
} from '../services/settings';

/**
 * Two kinds of settings, kept apart on purpose.
 *
 * `privacy` is server state: it decides what other people can see, so the server
 * owns it and this is a cache of what the server said. `chat` and `notifications`
 * are device state and never leave the phone.
 *
 * Privacy writes are optimistic *and* reverted on failure. Showing "Nobody" for a
 * setting the server refused would be the worst possible lie for this screen to
 * tell — someone would rely on it.
 */
type SettingsState = {
  privacy: PrivacySettings;
  chat: ChatPrefs;
  notifications: NotificationPrefs;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  setPrivacy: (userId: string, patch: Partial<PrivacySettings>) => Promise<void>;
  setChat: (patch: Partial<ChatPrefs>) => Promise<void>;
  setNotifications: (patch: Partial<NotificationPrefs>) => Promise<void>;
};

export const useSettings = create<SettingsState>((set, get) => ({
  privacy: DEFAULT_PRIVACY,
  chat: DEFAULT_CHAT_PREFS,
  notifications: DEFAULT_NOTIFICATIONS,
  loaded: false,

  load: async (userId) => {
    const [chat, notifications] = await Promise.all([loadChatPrefs(), loadNotificationPrefs()]);
    set({ chat, notifications });

    // Device preferences are applied whether or not the network answers.
    const privacy = await fetchPrivacy(userId).catch(() => get().privacy);
    set({ privacy, loaded: true });
  },

  setPrivacy: async (userId, patch) => {
    const previous = get().privacy;
    set({ privacy: { ...previous, ...patch } });

    try {
      await updatePrivacy(userId, patch);
    } catch (error) {
      set({ privacy: previous });
      throw error;
    }
  },

  setChat: async (patch) => {
    const next = { ...get().chat, ...patch };
    set({ chat: next });
    await saveChatPrefs(next);
  },

  setNotifications: async (patch) => {
    const next = { ...get().notifications, ...patch };
    set({ notifications: next });
    await saveNotificationPrefs(next);
  },
}));
