/* eslint-disable react-hooks/use-memo, react-hooks/exhaustive-deps --
   A generic live query cannot have a literal dependency array, and `query` is a
   fresh closure on every render by design: what it depends on is the caller's
   `deps`, plus the database revision. */
import { useMemo, useSyncExternalStore } from 'react';

import { getRevision, subscribe } from '../db/client';

/**
 * Re-runs a SQLite query whenever anything writes to the database.
 *
 * This is the whole bridge between the store and React. `useSyncExternalStore` is
 * the right primitive here: the database *is* an external store, and reading it
 * during render (rather than copying the result into state inside an effect) means
 * a write and its render land in the same commit — no flash of stale data.
 *
 * It is deliberately blunt: any write re-runs every live query. The queries are
 * local, indexed and measured in microseconds, and tracking which tables a query
 * touched buys nothing until a screen actually stutters.
 */
export function useLiveQuery<T>(query: () => T, deps: unknown[] = []): T {
  const revision = useSyncExternalStore(subscribe, getRevision, getRevision);
  return useMemo(() => query(), [revision, ...deps]);
}
