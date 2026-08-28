/**
 * Attachment rules: what kind a file is, where it is stored, how big it may be and
 * how it reads in the UI. Pure — the upload itself lives in services/sync/uploads.ts.
 */
import type { LocalMessage } from './messageState';

export type AttachmentKind = Extract<
  LocalMessage['kind'],
  'image' | 'video' | 'voice' | 'document' | 'sticker'
>;

export type Attachment = {
  id: string;
  messageId: string;
  chatId: string;
  /** Storage path, never a URL — URLs expire, paths do not. */
  storagePath: string;
  thumbnailPath: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[] | null;
  /** Local file:// URI while the upload is in flight, so the bubble renders at once. */
  localUri: string | null;
  uploadProgress: number;
};

/** Caps, chosen to keep a send on a slow connection under a minute. */
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const MAX_VOICE_MS = 15 * 60 * 1000;

/** Longest edge after client-side compression. */
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_QUALITY = 0.7;

export function kindForMime(mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return mimeType === 'image/webp' ? 'sticker' : 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'voice';
  return 'document';
}

export function maxBytesFor(kind: AttachmentKind): number {
  switch (kind) {
    case 'image':
    case 'sticker':
      return MAX_IMAGE_BYTES;
    case 'video':
      return MAX_VIDEO_BYTES;
    case 'voice':
      return MAX_IMAGE_BYTES;
    case 'document':
    default:
      return MAX_DOCUMENT_BYTES;
  }
}

export function exceedsLimit(kind: AttachmentKind, byteSize: number): boolean {
  return byteSize > maxBytesFor(kind);
}

/**
 * `<chat-id>/<message-id>/<file>`. The first segment is the whole storage policy:
 * membership of that chat is what grants read and write.
 */
export function storagePathFor(chatId: string, messageId: string, fileName: string): string {
  return `${chatId}/${messageId}/${sanitizeFileName(fileName)}`;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'file';
}

export function extensionFor(mimeType: string, fallback = 'bin'): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
  };
  return known[mimeType] ?? mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') ?? fallback;
}

/** "1.4 MB". Binary units, one decimal, because that is what file managers show. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Bubble dimensions for a media attachment, capped so a panorama does not take over
 * the screen and a tall photo does not push the composer off it.
 */
export function mediaBubbleSize(
  width: number | null,
  height: number | null,
  maxWidth: number,
  maxHeight = 320,
): { width: number; height: number } {
  if (!width || !height) return { width: maxWidth, height: Math.min(maxWidth, maxHeight) };

  const ratio = height / width;
  let renderWidth = Math.min(width, maxWidth);
  let renderHeight = renderWidth * ratio;

  if (renderHeight > maxHeight) {
    renderHeight = maxHeight;
    renderWidth = renderHeight / ratio;
  }

  return { width: Math.round(renderWidth), height: Math.round(renderHeight) };
}

/** "PDF · 1.4 MB" — the second line of a document card. */
export function documentSubtitle(mimeType: string, byteSize: number): string {
  return `${extensionFor(mimeType).toUpperCase()} · ${formatBytes(byteSize)}`;
}
