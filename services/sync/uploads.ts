import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';

import { clearLocalUri, setUploadProgress, upsertAttachment } from '../../db/attachments';
import { upsertMessage } from '../../db/messages';
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_QUALITY,
  exceedsLimit,
  extensionFor,
  kindForMime,
  storagePathFor,
  type Attachment,
  type AttachmentKind,
} from '../attachments';
import type { LocalMessage } from '../messageState';
import { BUCKETS } from '../media';
import { assertSupabaseConfigured, supabase } from '../supabase';
import { enqueue } from './outbox';

/**
 * Media sending, in the same shape as a text message: the local row and its local
 * file URI exist first, the bubble renders from them immediately, and the upload
 * catches up. A failed upload leaves a retryable message, not a lost photo.
 */

export type PendingMedia = {
  localUri: string;
  mimeType: string;
  byteSize: number;
  fileName: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  waveform?: number[] | null;
};

/**
 * Shrinks an image before it ever reaches the network. A modern phone camera
 * produces 4-12 MB per shot; at 1600px and 70% quality the same photo is a few
 * hundred kilobytes and indistinguishable in a bubble.
 */
export async function compressImage(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri).resize({ width: IMAGE_MAX_DIMENSION });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: result.uri, width: result.width, height: result.height };
}

export type SendMediaResult =
  | { ok: true; message: LocalMessage }
  | { ok: false; reason: 'too-large' | 'not-configured' };

export function sendMedia(input: {
  chatId: string;
  senderId: string;
  media: PendingMedia;
  caption?: string | null;
  kind?: AttachmentKind;
  now?: number;
}): SendMediaResult {
  const kind = input.kind ?? kindForMime(input.media.mimeType);

  if (exceedsLimit(kind, input.media.byteSize)) return { ok: false, reason: 'too-large' };

  const clientId = Crypto.randomUUID();
  const message: LocalMessage = {
    id: null,
    clientId,
    chatId: input.chatId,
    senderId: input.senderId,
    kind,
    body: input.caption ?? null,
    replyToId: null,
    createdAt: input.now ?? Date.now(),
    state: 'pending',
    attempts: 0,
    deletedAt: null,
  };

  const attachment: Attachment & { id: string } = {
    id: Crypto.randomUUID(),
    messageId: clientId,
    chatId: input.chatId,
    storagePath: storagePathFor(
      input.chatId,
      clientId,
      `${Date.now()}.${extensionFor(input.media.mimeType)}`,
    ),
    thumbnailPath: null,
    mimeType: input.media.mimeType,
    byteSize: input.media.byteSize,
    width: input.media.width ?? null,
    height: input.media.height ?? null,
    durationMs: input.media.durationMs ?? null,
    waveform: input.media.waveform ?? null,
    localUri: input.media.localUri,
    uploadProgress: 0,
  };

  upsertMessage(message);
  upsertAttachment(attachment);

  void uploadThenSend(message, attachment);

  return { ok: true, message };
}

/**
 * Upload first, then enqueue the message. The order matters: a message row with no
 * object behind it renders as a broken bubble on the other device, and there is no
 * way to repair it after the fact.
 */
async function uploadThenSend(message: LocalMessage, attachment: Attachment & { id: string }): Promise<void> {
  try {
    assertSupabaseConfigured();

    const response = await fetch(attachment.localUri!);
    const blob = await response.blob();

    setUploadProgress(attachment.id, 0.1);

    const { error } = await supabase.storage
      .from(BUCKETS.media)
      .upload(attachment.storagePath, blob, { contentType: attachment.mimeType, upsert: true });

    if (error) throw error;

    clearLocalUri(attachment.id);
    enqueue(message);
  } catch {
    upsertMessage({ ...message, state: 'failed', attempts: message.attempts + 1 });
  }
}

/** Signed URL for a stored object, since the media bucket is private. */
export async function mediaUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKETS.media).createSignedUrl(storagePath, 3600);
  return error ? null : data.signedUrl;
}
