import type { Attachment } from '../services/attachments';
import type { Reaction } from '../services/reactions';
import { db, mutate } from './client';

type AttachmentRow = {
  id: string;
  message_client_id: string;
  message_id: string | null;
  chat_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  waveform: string | null;
  local_uri: string | null;
  upload_progress: number;
};

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    messageId: row.message_client_id,
    chatId: row.chat_id,
    storagePath: row.storage_path,
    thumbnailPath: row.thumbnail_path,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    waveform: row.waveform ? (JSON.parse(row.waveform) as number[]) : null,
    localUri: row.local_uri,
    uploadProgress: row.upload_progress,
  };
}

/** Attachments for a page of messages, keyed by the message's client id. */
export function attachmentsFor(messageClientIds: string[]): Map<string, Attachment> {
  if (messageClientIds.length === 0) return new Map();

  const placeholders = messageClientIds.map(() => '?').join(',');
  const rows = db().getAllSync<AttachmentRow>(
    `select * from attachments where message_client_id in (${placeholders})`,
    messageClientIds,
  );

  return new Map(rows.map((row) => [row.message_client_id, toAttachment(row)]));
}

export function upsertAttachment(attachment: Attachment & { id: string }): void {
  mutate(() => {
    db().runSync(
      `insert into attachments
         (id, message_client_id, chat_id, storage_path, thumbnail_path, mime_type, byte_size,
          width, height, duration_ms, waveform, local_uri, upload_progress)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         storage_path = excluded.storage_path,
         thumbnail_path = coalesce(excluded.thumbnail_path, attachments.thumbnail_path),
         upload_progress = excluded.upload_progress,
         local_uri = excluded.local_uri`,
      [
        attachment.id,
        attachment.messageId,
        attachment.chatId,
        attachment.storagePath,
        attachment.thumbnailPath,
        attachment.mimeType,
        attachment.byteSize,
        attachment.width,
        attachment.height,
        attachment.durationMs,
        attachment.waveform ? JSON.stringify(attachment.waveform) : null,
        attachment.localUri,
        attachment.uploadProgress,
      ],
    );
  });
}

export function setUploadProgress(attachmentId: string, progress: number): void {
  mutate(() => {
    db().runSync('update attachments set upload_progress = ? where id = ?', [progress, attachmentId]);
  });
}

/** The local file is only dropped once the remote copy exists. */
export function clearLocalUri(attachmentId: string): void {
  mutate(() => {
    db().runSync('update attachments set local_uri = null, upload_progress = 1 where id = ?', [
      attachmentId,
    ]);
  });
}

// --- reactions --------------------------------------------------------------

export function reactionsFor(messageIds: string[]): Map<string, Reaction[]> {
  if (messageIds.length === 0) return new Map();

  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db().getAllSync<{
    message_id: string;
    user_id: string;
    emoji: string;
    created_at: number;
  }>(`select * from reactions where message_id in (${placeholders}) order by created_at asc`, messageIds);

  const grouped = new Map<string, Reaction[]>();
  for (const row of rows) {
    const list = grouped.get(row.message_id) ?? [];
    list.push({
      messageId: row.message_id,
      userId: row.user_id,
      emoji: row.emoji,
      createdAt: row.created_at,
    });
    grouped.set(row.message_id, list);
  }
  return grouped;
}

/** Insert or move — the primary key enforces one reaction per person. */
export function setReaction(reaction: Reaction): void {
  mutate(() => {
    db().runSync(
      `insert into reactions (message_id, user_id, emoji, created_at)
       values (?, ?, ?, ?)
       on conflict (message_id, user_id) do update set
         emoji = excluded.emoji,
         created_at = excluded.created_at`,
      [reaction.messageId, reaction.userId, reaction.emoji, reaction.createdAt],
    );
  });
}

export function removeReaction(messageId: string, userId: string): void {
  mutate(() => {
    db().runSync('delete from reactions where message_id = ? and user_id = ?', [messageId, userId]);
  });
}
