import { db, mutate } from './client';
import type { CallDirection, CallKind, CallRecord, CallStatus } from '../services/calls';

type Row = {
  id: string;
  chat_id: string;
  peer_id: string;
  kind: string;
  direction: string;
  status: string;
  started_at: number;
  answered_at: number | null;
  ended_at: number | null;
  display_name: string | null;
  avatar_path: string | null;
};

function toRecord(row: Row): CallRecord {
  return {
    id: row.id,
    chatId: row.chat_id,
    peerId: row.peer_id,
    peerName: row.display_name ?? '',
    peerAvatarPath: row.avatar_path,
    kind: row.kind as CallKind,
    direction: row.direction as CallDirection,
    status: row.status as CallStatus,
    startedAt: row.started_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
  };
}

/** The Calls tab, joined against the profile cache in one query. */
export function listCalls(limit = 100): CallRecord[] {
  return db()
    .getAllSync<Row>(
      `select c.*, p.display_name, p.avatar_path
         from calls c
         left join profiles p on p.id = c.peer_id
        order by c.started_at desc
        limit ?`,
      [limit],
    )
    .map(toRecord);
}

export function getCall(callId: string): CallRecord | null {
  const row = db().getFirstSync<Row>(
    `select c.*, p.display_name, p.avatar_path
       from calls c left join profiles p on p.id = c.peer_id
      where c.id = ?`,
    [callId],
  );
  return row ? toRecord(row) : null;
}

export function upsertCall(call: {
  id: string;
  chatId: string;
  peerId: string;
  kind: CallKind;
  direction: CallDirection;
  status: CallStatus;
  startedAt: number;
  answeredAt?: number | null;
  endedAt?: number | null;
}): void {
  mutate(() => {
    db().runSync(
      `insert into calls (id, chat_id, peer_id, kind, direction, status, started_at, answered_at, ended_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         status = excluded.status,
         answered_at = coalesce(excluded.answered_at, calls.answered_at),
         ended_at = coalesce(excluded.ended_at, calls.ended_at)`,
      [
        call.id,
        call.chatId,
        call.peerId,
        call.kind,
        call.direction,
        call.status,
        call.startedAt,
        call.answeredAt ?? null,
        call.endedAt ?? null,
      ],
    );
  });
}

export function setCallStatus(
  callId: string,
  status: CallStatus,
  timestamps: { answeredAt?: number; endedAt?: number } = {},
): void {
  mutate(() => {
    db().runSync(
      `update calls set status = ?,
         answered_at = coalesce(?, answered_at),
         ended_at = coalesce(?, ended_at)
       where id = ?`,
      [status, timestamps.answeredAt ?? null, timestamps.endedAt ?? null, callId],
    );
  });
}

export function deleteCall(callId: string): void {
  mutate(() => {
    db().runSync('delete from calls where id = ?', [callId]);
  });
}

export function clearCallHistory(): void {
  mutate(() => {
    db().runSync('delete from calls');
  });
}
