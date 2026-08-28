import { useEffect, useState } from 'react';

import { BUCKETS, signedUrl } from '../services/media';
import { isSupabaseConfigured } from '../services/supabase';

const TTL_SECONDS = 3600;
/** Refreshed a minute early, so a URL never expires mid-render. */
const REFRESH_MARGIN_MS = 60_000;

type CacheEntry = { url: string; expiresAt: number };

/**
 * Signed URLs for private chat media, cached across screens.
 *
 * The cache is module-level rather than per-component on purpose: the same photo
 * appears in the conversation and again in the info screen's media strip, and
 * signing it twice costs a round trip to produce a string we already have.
 */
const cache = new Map<string, CacheEntry>();

export function useSignedUrls(paths: string[], bucket: string = BUCKETS.media): Map<string, string> {
  const key = paths.join(',');
  const [urls, setUrls] = useState<Map<string, string>>(() => resolveFromCache(paths));

  useEffect(() => {
    if (!isSupabaseConfigured || paths.length === 0) return;
    let cancelled = false;

    const now = Date.now();
    const missing = paths.filter((path) => {
      const entry = cache.get(path);
      return !entry || entry.expiresAt - REFRESH_MARGIN_MS < now;
    });

    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async (path) => {
        try {
          const url = await signedUrl(bucket, path, TTL_SECONDS);
          cache.set(path, { url, expiresAt: Date.now() + TTL_SECONDS * 1000 });
        } catch {
          // A media object that cannot be signed renders as a placeholder; it is
          // not worth failing the screen over.
        }
      }),
    ).then(() => {
      if (!cancelled) setUrls(resolveFromCache(paths));
    });

    return () => {
      cancelled = true;
    };
    // `key` is the stable identity of the path list; the array itself is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, bucket]);

  return urls;
}

function resolveFromCache(paths: string[]): Map<string, string> {
  const now = Date.now();
  const resolved = new Map<string, string>();
  for (const path of paths) {
    const entry = cache.get(path);
    if (entry && entry.expiresAt > now) resolved.set(path, entry.url);
  }
  return resolved;
}
