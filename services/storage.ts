/**
 * Key-value storage behind a driver seam.
 *
 * The spec calls for MMKV, which is a native module and therefore needs a development
 * build. Until that build exists this is backed by AsyncStorage, which runs anywhere.
 * Swapping in MMKV means replacing `driver` below and nothing else — every caller goes
 * through this async surface, which MMKV satisfies trivially (it is synchronous).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StorageDriver = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

const asyncStorageDriver: StorageDriver = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

let driver: StorageDriver = asyncStorageDriver;

/** Test seam — pass a fake driver, call with no argument to restore the default. */
export function setStorageDriver(next: StorageDriver = asyncStorageDriver): void {
  driver = next;
}

export const storage: StorageDriver = {
  get: (key) => driver.get(key),
  set: (key, value) => driver.set(key, value),
  remove: (key) => driver.remove(key),
};
