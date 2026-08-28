import { setStorageDriver, type StorageDriver } from '../storage';
import {
  clearPreferences,
  loadChatPrefs,
  loadNotificationPrefs,
  saveChatPrefs,
  saveNotificationPrefs,
} from '../preferences';
import {
  AUDIENCES,
  DEFAULT_CHAT_PREFS,
  DEFAULT_NOTIFICATIONS,
  FONT_SCALES,
  MAX_ABOUT_LENGTH,
  WALLPAPERS,
  audienceLabel,
  fontScaleLabel,
  nextAudience,
  normalizeAbout,
  showsTypingFrom,
  storageBreakdown,
  storageShare,
  themeLabel,
  wallpaperFor,
} from '../settings';

describe('privacy audiences', () => {
  it('labels each audience the way the reference does', () => {
    expect(audienceLabel('everyone')).toBe('Everyone');
    expect(audienceLabel('contacts')).toBe('My contacts');
    expect(audienceLabel('nobody')).toBe('Nobody');
  });

  it('cycles through every audience and wraps', () => {
    expect(nextAudience('everyone')).toBe('contacts');
    expect(nextAudience('contacts')).toBe('nobody');
    expect(nextAudience('nobody')).toBe('everyone');
  });

  it('cycles through all three without repeating', () => {
    const seen = new Set<string>();
    let audience = AUDIENCES[0]!;
    for (let step = 0; step < AUDIENCES.length; step += 1) {
      seen.add(audience);
      audience = nextAudience(audience);
    }
    expect(seen.size).toBe(AUDIENCES.length);
    expect(audience).toBe(AUDIENCES[0]);
  });
});

describe('typing reciprocity', () => {
  it('shows a typing indicator only when both sides have them on', () => {
    expect(showsTypingFrom(true, true)).toBe(true);
    expect(showsTypingFrom(true, false)).toBe(false);
    expect(showsTypingFrom(false, true)).toBe(false);
    expect(showsTypingFrom(false, false)).toBe(false);
  });
});

describe('about', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeAbout('  Hey   there  ')).toBe('Hey there');
  });

  it('truncates at the limit', () => {
    expect(normalizeAbout('x'.repeat(400))).toHaveLength(MAX_ABOUT_LENGTH);
  });
});

describe('storage usage', () => {
  const usage = [
    { chatId: 'a', title: 'Anna', bytes: 100, items: 2 },
    { chatId: 'b', title: 'Design crew', bytes: 900, items: 11 },
    { chatId: 'c', title: 'David', bytes: 500, items: 4 },
  ];

  it('sorts by size, because that is what the screen is for', () => {
    expect(storageBreakdown(usage).rows.map((row) => row.chatId)).toEqual(['b', 'c', 'a']);
  });

  it('totals bytes and items', () => {
    const { totalBytes, totalItems } = storageBreakdown(usage);
    expect(totalBytes).toBe(1500);
    expect(totalItems).toBe(17);
  });

  it('does not mutate the input', () => {
    const copy = [...usage];
    storageBreakdown(usage);
    expect(usage).toEqual(copy);
  });

  it('computes a clamped share, and survives an empty total', () => {
    expect(storageShare(500, 1000)).toBe(0.5);
    expect(storageShare(5, 0)).toBe(0);
    expect(storageShare(2000, 1000)).toBe(1);
  });

  it('totals nothing for an empty list', () => {
    expect(storageBreakdown([])).toEqual({ rows: [], totalBytes: 0, totalItems: 0 });
  });
});

describe('appearance', () => {
  it('names theme preferences', () => {
    expect(themeLabel('system')).toBe('System default');
    expect(themeLabel('light')).toBe('Light');
    expect(themeLabel('dark')).toBe('Dark');
  });

  it('capitalises font-scale labels and keeps medium at 1', () => {
    expect(fontScaleLabel('small')).toBe('Small');
    expect(FONT_SCALES.medium).toBe(1);
    expect(FONT_SCALES.small).toBeLessThan(FONT_SCALES.medium);
    expect(FONT_SCALES.large).toBeGreaterThan(FONT_SCALES.medium);
  });

  it('falls back to the default wallpaper for an unknown key', () => {
    expect(wallpaperFor('teal').label).toBe('Teal');
    expect(wallpaperFor(null).key).toBe('default');
    expect(wallpaperFor('a-wallpaper-that-was-removed').key).toBe('default');
  });

  it('gives the default wallpaper no tint, so it uses the tile', () => {
    expect(WALLPAPERS[0]?.tintIndex).toBeNull();
  });
});

describe('preferences storage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    const driver: StorageDriver = {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => void store.set(key, value),
      remove: async (key) => void store.delete(key),
    };
    setStorageDriver(driver);
  });

  afterEach(() => setStorageDriver());

  it('returns defaults when nothing has been saved', async () => {
    await expect(loadChatPrefs()).resolves.toEqual(DEFAULT_CHAT_PREFS);
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATIONS);
  });

  it('round-trips what was saved', async () => {
    await saveChatPrefs({ wallpaper: 'teal', enterToSend: true, fontScale: 'large' });
    await expect(loadChatPrefs()).resolves.toEqual({
      wallpaper: 'teal',
      enterToSend: true,
      fontScale: 'large',
    });
  });

  it('fills in keys an older version never wrote', async () => {
    // A blob saved before `fontScale` existed must not read it back as undefined.
    store.set('wave.prefs.chat', JSON.stringify({ wallpaper: 'plum' }));
    await expect(loadChatPrefs()).resolves.toEqual({
      ...DEFAULT_CHAT_PREFS,
      wallpaper: 'plum',
    });
  });

  it('falls back to defaults on a corrupted blob rather than throwing', async () => {
    store.set('wave.prefs.notifications', 'not json');
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATIONS);

    store.set('wave.prefs.notifications', 'null');
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATIONS);
  });

  it('clears back to defaults', async () => {
    await saveNotificationPrefs({ ...DEFAULT_NOTIFICATIONS, calls: false });
    await clearPreferences();
    await expect(loadNotificationPrefs()).resolves.toEqual(DEFAULT_NOTIFICATIONS);
  });
});
