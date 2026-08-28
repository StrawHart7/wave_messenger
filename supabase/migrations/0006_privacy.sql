-- Wave Messenger — privacy, enforced where it counts.
--
-- The rule this migration exists to satisfy: hiding something must stop the data
-- leaving the server, not hide a label in the UI. 0001 got the *reads* right —
-- public_profiles nulls avatar, about and last-seen per the owner's setting. Three
-- things it did not get right are fixed here.

-- ---------------------------------------------------------------------------
-- 1. Blocking.
--
-- The contact screen has had a "Block" row since phase 5 that did nothing, on the
-- grounds that a block living only on one device is theatre. This is the table
-- that makes it real.
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Only the blocker can see or change their own list. The blocked party must never
-- be able to learn that they were blocked — that is the entire point of the
-- feature, and a readable row would give it away.
create policy "a user reads their own block list"
  on public.blocks for select
  to authenticated
  using (blocker_id = auth.uid());

create policy "a user blocks on their own behalf"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

create policy "a user unblocks on their own behalf"
  on public.blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- SECURITY DEFINER so a policy can ask the question without the asker being able
-- to read the row that answers it.
create or replace function public.is_blocked(author uuid, viewer uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = viewer and blocked_id = author)
       or (blocker_id = author and blocked_id = viewer)
  );
$$;

-- Blocking cuts the "contact" relationship, so every privacy setting keyed on
-- `contacts` closes for a blocked pair without any of them being changed.
create or replace function public.shares_chat_with(other_user uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.is_blocked(other_user, target_user)
    and exists (
      select 1
      from public.chat_members mine
      join public.chat_members theirs on theirs.chat_id = mine.chat_id
      where mine.user_id = target_user and theirs.user_id = other_user
    );
$$;

-- A blocked person cannot put a message in front of you. Enforced on insert, so
-- the message never exists rather than being filtered on the way out.
drop policy "members send messages as themselves" on public.messages;

create policy "members send messages as themselves, unless blocked"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1
      from public.chat_members other
      join public.chats c on c.id = other.chat_id
      where other.chat_id = messages.chat_id
        and c.kind = 'direct'
        and other.user_id <> auth.uid()
        and public.is_blocked(other.user_id, auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Presence, enforced rather than described.
--
-- public_profiles nulls `is_online` for viewers who may not see it, which is the
-- read side. But the client is what writes it, and a client that ignores its own
-- setting would happily keep publishing presence. This trigger means the value
-- never lands in the first place.
-- ---------------------------------------------------------------------------

create or replace function public.guard_presence_write()
returns trigger
language plpgsql
as $$
begin
  if new.privacy_last_seen = 'nobody' then
    new.is_online := false;
    new.last_seen_at := old.last_seen_at;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_presence
  before update on public.profiles
  for each row execute function public.guard_presence_write();

-- ---------------------------------------------------------------------------
-- 3. Reciprocity.
--
-- WhatsApp's rule, and the reason the settings are worth having: if you hide your
-- last seen, you do not get to see anyone else's. Without this the setting is a
-- one-way mirror, which is a worse product and a worse bargain.
--
-- `typing_indicators_enabled` joins the view so the client can honour the same
-- reciprocity for typing. Broadcast payloads cannot be filtered per-subscriber the
-- way a table row can, which is exactly why the setting also stops the *outgoing*
-- broadcast in services/realtime/presence.ts — see that file's comment.
-- ---------------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = true) as
select
  p.id,
  p.display_name,
  p.phone_hash,
  case
    when p.id = auth.uid() then p.avatar_path
    when public.is_blocked(p.id) then null
    when p.privacy_avatar = 'everyone' then p.avatar_path
    when p.privacy_avatar = 'contacts' and public.shares_chat_with(p.id) then p.avatar_path
    else null
  end as avatar_path,
  case
    when p.id = auth.uid() then p.about
    when public.is_blocked(p.id) then null
    when p.privacy_about = 'everyone' then p.about
    when p.privacy_about = 'contacts' and public.shares_chat_with(p.id) then p.about
    else null
  end as about,
  case
    when p.id = auth.uid() then p.last_seen_at
    when public.is_blocked(p.id) then null
    -- Reciprocity: a viewer who hides their own last seen sees nobody else's.
    when (select v.privacy_last_seen from public.profiles v where v.id = auth.uid()) = 'nobody' then null
    when p.privacy_last_seen = 'everyone' then p.last_seen_at
    when p.privacy_last_seen = 'contacts' and public.shares_chat_with(p.id) then p.last_seen_at
    else null
  end as last_seen_at,
  case
    when p.id = auth.uid() then p.is_online
    when public.is_blocked(p.id) then null
    when (select v.privacy_last_seen from public.profiles v where v.id = auth.uid()) = 'nobody' then null
    when p.privacy_last_seen = 'everyone' then p.is_online
    when p.privacy_last_seen = 'contacts' and public.shares_chat_with(p.id) then p.is_online
    else null
  end as is_online,
  p.read_receipts_enabled,
  p.typing_indicators_enabled
from public.profiles p;

-- Read receipts were already one-directional in 0001 (the insert policy refuses a
-- read_at from someone who has them off). The reciprocity is the other half: you
-- cannot read a receipt that someone else wrote, either.
drop policy "members read receipts in their chats" on public.message_receipts;

create policy "members read receipts, if they send them too"
  on public.message_receipts for select
  to authenticated
  using (
    public.is_chat_member(chat_id)
    and (
      user_id = auth.uid()
      -- Groups always exchange read receipts, as in WhatsApp.
      or exists (select 1 from public.chats c where c.id = chat_id and c.kind = 'group')
      or exists (
        select 1 from public.profiles me
        where me.id = auth.uid() and me.read_receipts_enabled
      )
    )
  );
