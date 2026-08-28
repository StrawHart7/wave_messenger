import { setStorageDriver, storage, type StorageDriver } from '../storage';

function memoryDriver(): StorageDriver & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

describe('storage seam', () => {
  afterEach(() => setStorageDriver());

  it('routes every call through the installed driver', async () => {
    const driver = memoryDriver();
    setStorageDriver(driver);

    await storage.set('theme.preference', 'dark');
    expect(await storage.get('theme.preference')).toBe('dark');
    expect(driver.data.get('theme.preference')).toBe('dark');

    await storage.remove('theme.preference');
    expect(await storage.get('theme.preference')).toBeNull();
  });

  it('returns null for an unknown key rather than throwing', async () => {
    setStorageDriver(memoryDriver());
    expect(await storage.get('nope')).toBeNull();
  });
});
