/**
 * The local SQLite schema — the store the UI actually reads from.
 *
 * It is not a mirror of Postgres: it carries the fields a screen renders plus the
 * outbox state Postgres knows nothing about (`state`, `attempts`, `client_id` as the
 * primary key). Messages are keyed by client_id precisely because a message exists
 * locally before the server has ever seen it.
 */

export const SCHEMA_VERSION = 5;

export const MIGRATIONS: string[] = [
  // v1 — chats, messages, receipts and the local profile cache.
  `
  create table if not exists profiles (
    id text primary key,
    display_name text not null default '',
    avatar_path text,
    about text,
    last_seen_at integer,
    is_online integer not null default 0
  );

  create table if not exists chats (
    id text primary key,
    kind text not null,
    title text not null default '',
    avatar_path text,
    -- Per-member state, denormalised onto the row since the local db is single-user.
    unread_count integer not null default 0,
    pinned integer not null default 0,
    archived integer not null default 0,
    muted_until integer,
    last_read_at integer not null default 0,
    last_message_at integer not null default 0
  );

  create index if not exists chats_last_message_idx on chats (last_message_at desc);

  create table if not exists chat_members (
    chat_id text not null,
    user_id text not null,
    role text not null default 'member',
    primary key (chat_id, user_id)
  );

  create table if not exists messages (
    client_id text primary key,
    id text unique,
    chat_id text not null,
    sender_id text not null,
    kind text not null default 'text',
    body text,
    reply_to_id text,
    created_at integer not null,
    deleted_at integer,
    -- pending | sent | delivered | read | failed
    state text not null default 'pending',
    attempts integer not null default 0,
    -- Set when the row came from the server rather than a local send.
    remote integer not null default 0
  );

  create index if not exists messages_chat_created_idx on messages (chat_id, created_at desc);
  create index if not exists messages_outbox_idx on messages (state, created_at) where state in ('pending', 'failed');

  create table if not exists receipts (
    message_id text not null,
    user_id text not null,
    delivered_at integer,
    read_at integer,
    primary key (message_id, user_id)
  );

  create table if not exists meta (
    key text primary key,
    value text
  );
  `,

  // v2 — attachments and reactions.
  `
  create table if not exists attachments (
    id text primary key,
    message_client_id text not null,
    message_id text,
    chat_id text not null,
    storage_path text not null,
    thumbnail_path text,
    mime_type text not null,
    byte_size integer not null default 0,
    width integer,
    height integer,
    duration_ms integer,
    -- JSON array of 0-100 amplitudes; SQLite has no array type and a voice note
    -- carries exactly one waveform, so a column beats a side table here.
    waveform text,
    -- file:// URI while the upload is in flight, so the bubble renders immediately.
    local_uri text,
    upload_progress real not null default 0
  );

  create index if not exists attachments_message_idx on attachments (message_client_id);

  create table if not exists reactions (
    message_id text not null,
    user_id text not null,
    emoji text not null,
    created_at integer not null,
    -- One reaction per person per message, mirroring the Postgres primary key.
    primary key (message_id, user_id)
  );

  create index if not exists reactions_message_idx on reactions (message_id);
  `,

  // v3 — what a group needs that a direct chat never did.
  `
  alter table chats add column description text;
  alter table chats add column created_by text;
  -- The viewer's own role in this chat, denormalised: the local database is
  -- single-user, and every screen that asks "may I do this?" asks about them.
  alter table chats add column my_role text not null default 'member';

  alter table profiles add column phone text;
  alter table chat_members add column joined_at integer not null default 0;
  `,

  // v4 — status. Expiry is stored as an absolute deadline rather than a TTL so a
  // device whose clock is wrong is wrong once, not compounding on every read.
  `
  create table if not exists status_posts (
    id text primary key,
    author_id text not null,
    kind text not null,
    storage_path text,
    caption text,
    background_color text,
    created_at integer not null,
    expires_at integer not null,
    duration_ms integer,
    -- Whether *this* device's owner has seen it; a single-user database, so one column.
    viewed integer not null default 0,
    local_uri text,
    -- pending | sent | failed, mirroring the message outbox.
    state text not null default 'sent'
  );

  create index if not exists status_posts_author_idx on status_posts (author_id, created_at desc);
  create index if not exists status_posts_expiry_idx on status_posts (expires_at);

  -- Only ever populated for the viewer's own posts: nobody else's viewer list is
  -- readable, so caching one would just be caching an empty set.
  create table if not exists status_views (
    status_id text not null,
    viewer_id text not null,
    viewed_at integer not null,
    primary key (status_id, viewer_id)
  );
  `,

  // v5 — call history. The peer is denormalised onto the row: a call to someone
  // who later leaves the group, or whose profile is gone, still has to say who it
  // was with a year later.
  `
  create table if not exists calls (
    id text primary key,
    chat_id text not null,
    peer_id text not null,
    kind text not null,
    direction text not null,
    status text not null,
    started_at integer not null,
    answered_at integer,
    ended_at integer
  );

  create index if not exists calls_started_idx on calls (started_at desc);
  `,
];
