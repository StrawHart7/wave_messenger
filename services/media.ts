import { assertSupabaseConfigured, supabase } from './supabase';

/**
 * Uploads go to Storage and we keep the *path*, never a signed URL — URLs expire,
 * paths do not, and the client mints a fresh URL when it needs to display one.
 */
export const BUCKETS = {
  avatars: 'avatars',
  media: 'media',
  status: 'status',
} as const;

export async function uploadLocalObject(bucket: string, path: string, localUri: string, contentType: string) {
  assertSupabaseConfigured();

  // React Native's fetch can read a file:// URI into a blob; this avoids pulling in
  // a base64 round-trip for what can be a large image.
  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  return path;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  return uploadLocalObject(BUCKETS.avatars, path, localUri, `image/${extension === 'png' ? 'png' : 'jpeg'}`);
}

/** Public URL for a stored object. Avatars live in a public bucket; chat media does not. */
export function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
