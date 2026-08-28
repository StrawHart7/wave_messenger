import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './schema';

/**
 * One connection for the whole app, opened lazily.
 *
 * Everything that mutates goes through `mutate()`, which bumps a revision and
 * notifies subscribers. That is the entire reactivity mechanism: SQLite is the
 * source of truth, and screens re-query when the revision changes. No observable
 * layer, no query cache to invalidate, no second copy of the data to keep in step.
 */

let database: SQLite.SQLiteDatabase | null = null;

export function db(): SQLite.SQLiteDatabase {
  if (!database) {
    database = SQLite.openDatabaseSync('wave.db');
    database.execSync('pragma journal_mode = WAL; pragma foreign_keys = on;');
    migrate(database);
  }
  return database;
}

function migrate(connection: SQLite.SQLiteDatabase): void {
  const row = connection.getFirstSync<{ user_version: number }>('pragma user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    connection.execSync(MIGRATIONS[version]!);
  }

  if (current < MIGRATIONS.length) {
    connection.execSync(`pragma user_version = ${MIGRATIONS.length}`);
  }
}

// --- reactivity -------------------------------------------------------------

type Listener = () => void;

const listeners = new Set<Listener>();
let revision = 0;

/** Subscribe to any local write. Returns the unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRevision(): number {
  return revision;
}

/** Run a write and notify. Every mutation in db/ funnels through here. */
export function mutate<T>(work: () => T): T {
  const result = work();
  revision += 1;
  listeners.forEach((listener) => listener());
  return result;
}

/** Test seam — drops the connection so a fresh in-memory db can be opened. */
export function resetForTests(): void {
  database = null;
  listeners.clear();
  revision = 0;
}
