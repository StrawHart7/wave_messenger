-- Wave Messenger — initial schema.
--
-- Rule for this file and every migration after it: a table ships with its RLS
-- policies in the same migration. The core predicate throughout is "the caller is a
-- member of the chat this row hangs off", expressed once as is_chat_member().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique not null,
  -- sha256 of the E.164 number; contact sync matches on this so the client never
  -- uploads a plaintext address book.
  phone_hash text unique not null,
  display_name text not null default '',
  avatar_path text,
  about text not null default 'Hey there! I am using Wave.',
  last_seen_at timestamptz not null default now(),
  is_online boolean not null default false,
  -- Privacy settings are enforced server-side (see the profile read policy and
  -- the presence view below), not just hidden in the UI.
  privacy_last_seen text not null default 'everyone'
    check (privacy_last_seen in ('everyone', 'contacts', 'nobody')),
  privacy_avatar text not null default 'everyone'
    check (privacy_avatar in ('everyone', 'contacts', 'nobody')),
  privacy_about text not null default 'everyone'
    check (privacy_about in ('everyone', 'contacts', 'nobody')),
  read_receipts_enabled boolean not null default true,
  typing_indicators_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_phone_hash_idx on public.profiles (phone_hash);

-- ---------------------------------------------------------------------------
-- chats and membership
-- ---------------------------------------------------------------------------

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  -- Group-only fields; null for direct chats.
  subject text,
  description text,
  icon_path text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Denormalised so the chat list can sort without touching messages.
  last_message_at timestamptz not null default now(),
  constraint group_has_subject check (kind <> 'group' or subject is not null)
);

create index chats_last_message_at_idx on public.chats (last_message_at desc);

create table public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  -- Per-member chat state.
  muted_until timestamptz,
  pinned boolean not null default false,
  archived boolean not null default false,
  last_read_at timestamptz not null default 'epoch',
  primary key (chat_id, user_id)
);

create index chat_members_user_idx on public.chat_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can look at chat_members without
-- recursing through chat_members' own policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_chat_member(target_chat uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = target_chat and user_id = target_user
  );
$$;

create or replace function public.is_chat_admin(target_chat uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = target_chat and user_id = target_user and role = 'admin'
  );
$$;

-- Two users "share a chat" if they are both members of any one chat. This is the
-- contact relationship the privacy settings key off.
create or replace function public.shares_chat_with(other_user uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_members mine
    join public.chat_members theirs on theirs.chat_id = mine.chat_id
    where mine.user_id = target_user and theirs.user_id = other_user
  );
$$;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text'
    check (kind in ('text', 'image', 'video', 'voice', 'document', 'contact', 'location', 'sticker', 'system')),
  body text,
  -- Set when this message is a reply; kept as a plain FK so a deleted original
  -- leaves the quote intact rather than cascading.
  reply_to_id uuid references public.messages (id) on delete set null,
  -- The client generates this so an optimistic insert can be reconciled with the
  -- row that comes back over realtime.
  client_id uuid not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (chat_id, client_id)
);

create index messages_chat_created_idx on public.messages (chat_id, created_at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  duration_ms integer,
  -- Voice note waveform, stored as a small array of 0-100 amplitudes.
  waveform smallint[],
  created_at timestamptz not null default now()
);

create index attachments_message_idx on public.attachments (message_id);

create table public.message_receipts (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create index message_receipts_chat_user_idx on public.message_receipts (chat_id, user_id);

create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  chat_id uuid not null references public.chats (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  -- One reaction per person per message, as in the reference UI.
  primary key (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- status (24h posts)
-- ---------------------------------------------------------------------------

create table public.status_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'text')),
  storage_path text,
  caption text,
  background_color text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index status_posts_author_idx on public.status_posts (author_id, created_at desc);
create index status_posts_expiry_idx on public.status_posts (expires_at);

create table public.status_views (
  status_id uuid not null references public.status_posts (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  initiator_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('voice', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'missed', 'declined')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create index calls_chat_started_idx on public.calls (chat_id, started_at desc);

create table public.call_participants (
  call_id uuid not null references public.calls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_receipts enable row level security;
alter table public.reactions enable row level security;
alter table public.status_posts enable row level security;
alter table public.status_views enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

-- profiles ------------------------------------------------------------------
-- Any authenticated user can look up a profile (contact sync needs this), but the
-- privacy-gated columns are stripped by the public_profiles view below.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "a user updates only their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "a user inserts only their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- The client reads this view, never profiles directly: last_seen, avatar and about
-- are nulled out when the owner's setting does not permit the viewer to see them.
create or replace view public.public_profiles
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.phone_hash,
  case
    when p.id = auth.uid() then p.avatar_path
    when p.privacy_avatar = 'everyone' then p.avatar_path
    when p.privacy_avatar = 'contacts' and public.shares_chat_with(p.id) then p.avatar_path
    else null
  end as avatar_path,
  case
    when p.id = auth.uid() then p.about
    when p.privacy_about = 'everyone' then p.about
    when p.privacy_about = 'contacts' and public.shares_chat_with(p.id) then p.about
    else null
  end as about,
  case
    when p.id = auth.uid() then p.last_seen_at
    when p.privacy_last_seen = 'everyone' then p.last_seen_at
    when p.privacy_last_seen = 'contacts' and public.shares_chat_with(p.id) then p.last_seen_at
    else null
  end as last_seen_at,
  case
    when p.id = auth.uid() then p.is_online
    when p.privacy_last_seen = 'everyone' then p.is_online
    when p.privacy_last_seen = 'contacts' and public.shares_chat_with(p.id) then p.is_online
    else null
  end as is_online,
  p.read_receipts_enabled
from public.profiles p;

-- chats ---------------------------------------------------------------------
create policy "members read their chats"
  on public.chats for select
  to authenticated
  using (public.is_chat_member(id));

create policy "a user creates chats they own"
  on public.chats for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "admins update group chats"
  on public.chats for update
  to authenticated
  using (public.is_chat_admin(id) or (kind = 'direct' and public.is_chat_member(id)))
  with check (public.is_chat_admin(id) or (kind = 'direct' and public.is_chat_member(id)));

-- chat_members --------------------------------------------------------------
create policy "members read the membership of their chats"
  on public.chat_members for select
  to authenticated
  using (public.is_chat_member(chat_id));

-- Adding members: the chat creator seeds the membership, after which only admins
-- may add people. A user may always remove themselves (exit group).
create policy "admins and creators add members"
  on public.chat_members for insert
  to authenticated
  with check (
    public.is_chat_admin(chat_id)
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );

create policy "a member updates only their own row"
  on public.chat_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins remove members, anyone removes themselves"
  on public.chat_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_chat_admin(chat_id));

-- messages ------------------------------------------------------------------
create policy "members read messages in their chats"
  on public.messages for select
  to authenticated
  using (public.is_chat_member(chat_id));

create policy "members send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

create policy "a sender edits or deletes their own message"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- attachments ---------------------------------------------------------------
create policy "members read attachments in their chats"
  on public.attachments for select
  to authenticated
  using (public.is_chat_member(chat_id));

create policy "members attach to their own messages"
  on public.attachments for insert
  to authenticated
  with check (
    public.is_chat_member(chat_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.sender_id = auth.uid())
  );

-- message_receipts ----------------------------------------------------------
create policy "members read receipts in their chats"
  on public.message_receipts for select
  to authenticated
  using (public.is_chat_member(chat_id));

-- A receipt is a claim about yourself, and only if you have read receipts on.
create policy "a user writes only their own receipts"
  on public.message_receipts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_chat_member(chat_id)
    and (
      read_at is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.read_receipts_enabled)
    )
  );

create policy "a user updates only their own receipts"
  on public.message_receipts for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      read_at is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.read_receipts_enabled)
    )
  );

-- reactions -----------------------------------------------------------------
create policy "members read reactions in their chats"
  on public.reactions for select
  to authenticated
  using (public.is_chat_member(chat_id));

create policy "a user reacts as themselves"
  on public.reactions for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(chat_id));

create policy "a user changes their own reaction"
  on public.reactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "a user removes their own reaction"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- status --------------------------------------------------------------------
-- Status is visible to people you share a chat with, for 24 hours.
create policy "contacts read unexpired status"
  on public.status_posts for select
  to authenticated
  using (
    expires_at > now()
    and (author_id = auth.uid() or public.shares_chat_with(author_id))
  );

create policy "a user posts their own status"
  on public.status_posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "a user deletes their own status"
  on public.status_posts for delete
  to authenticated
  using (author_id = auth.uid());

-- Only the author sees the full viewer list; a viewer sees their own row.
create policy "authors read their viewers"
  on public.status_views for select
  to authenticated
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.status_posts s where s.id = status_id and s.author_id = auth.uid())
  );

create policy "a viewer records their own view"
  on public.status_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- calls ---------------------------------------------------------------------
create policy "members read calls in their chats"
  on public.calls for select
  to authenticated
  using (public.is_chat_member(chat_id));

create policy "members start calls in their chats"
  on public.calls for insert
  to authenticated
  with check (initiator_id = auth.uid() and public.is_chat_member(chat_id));

create policy "members update calls in their chats"
  on public.calls for update
  to authenticated
  using (public.is_chat_member(chat_id))
  with check (public.is_chat_member(chat_id));

create policy "participants read the participant list"
  on public.call_participants for select
  to authenticated
  using (exists (select 1 from public.calls c where c.id = call_id and public.is_chat_member(c.chat_id)));

create policy "a user joins a call as themselves"
  on public.call_participants for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.calls c where c.id = call_id and public.is_chat_member(c.chat_id))
  );

create policy "a user updates their own participation"
  on public.call_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Keep chats.last_message_at in step so the chat list sorts without a join.
create or replace function public.touch_chat_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end;
$$;

create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_on_message();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_receipts;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.chat_members;
alter publication supabase_realtime add table public.calls;

-- Realtime respects RLS, so a subscriber only receives rows their policies allow.
alter table public.messages replica identity full;
alter table public.message_receipts replica identity full;
alter table public.reactions replica identity full;
