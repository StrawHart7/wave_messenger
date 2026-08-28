-- Wave Messenger — groups: closing two privilege holes left by 0001, and making
-- membership changes narrate themselves.
--
-- Everything here is server-side on purpose. "Admin only" that lives in the UI is
-- not a permission, it is a suggestion: the client is the attacker's machine.

-- ---------------------------------------------------------------------------
-- Hole 1 — self-promotion.
--
-- 0001's "a member updates only their own row" policy lets a member update their
-- own chat_members row, which includes `role`. Any member could make themselves an
-- admin with one PATCH. RLS cannot compare OLD and NEW inside a policy, so the
-- comparison happens in a trigger and the policy stays as the coarse gate.
-- ---------------------------------------------------------------------------

create or replace function public.guard_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_chat_admin(new.chat_id) then
      raise exception 'only an admin may change a member''s role'
        using errcode = 'insufficient_privilege';
    end if;

    -- An admin demoting themselves while they are the only admin leaves a group
    -- nobody can ever administer again: no renames, no adds, no removals.
    if old.role = 'admin'
       and new.user_id = auth.uid()
       and (select count(*) from public.chat_members
             where chat_id = new.chat_id and role = 'admin') = 1
       and (select count(*) from public.chat_members where chat_id = new.chat_id) > 1
    then
      raise exception 'promote another admin before stepping down'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

create trigger chat_members_guard_role
  before update on public.chat_members
  for each row execute function public.guard_member_role_change();

-- ---------------------------------------------------------------------------
-- Hole 2 — the creator's permanent key.
--
-- 0001 let `created_by` add members forever, so an admin who was demoted could
-- still add people to a group they no longer administer. The creator now only has
-- that right until they are a member themselves, which is the single insert that
-- seeds the group.
-- ---------------------------------------------------------------------------

drop policy "admins and creators add members" on public.chat_members;

create policy "admins add members, the creator seeds the group"
  on public.chat_members for insert
  to authenticated
  with check (
    public.is_chat_admin(chat_id)
    or exists (
      select 1 from public.chats c
      where c.id = chat_id
        and c.created_by = auth.uid()
        and not public.is_chat_member(c.id, auth.uid())
    )
  );

-- The last admin cannot walk out of a group that still has people in it, for the
-- same reason they cannot demote themselves.
create or replace function public.guard_last_admin_exit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin'
     and (select count(*) from public.chat_members
           where chat_id = old.chat_id and role = 'admin') = 1
     and (select count(*) from public.chat_members where chat_id = old.chat_id) > 1
     and exists (select 1 from public.chats c where c.id = old.chat_id and c.kind = 'group')
  then
    raise exception 'promote another admin before leaving'
      using errcode = 'insufficient_privilege';
  end if;

  return old;
end;
$$;

create trigger chat_members_guard_last_admin
  before delete on public.chat_members
  for each row execute function public.guard_last_admin_exit();

-- ---------------------------------------------------------------------------
-- Membership changes as system messages.
--
-- Written by the database rather than the client for two reasons: everyone sees
-- exactly the same sentence, and the person being removed still gets one — they
-- are no longer running any code that could have written it for themselves.
--
-- The text is baked at write time. A removed member has to stay named in the
-- history after their membership row is gone.
-- ---------------------------------------------------------------------------

create or replace function public.display_name_of(target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(display_name, ''), 'Someone') from public.profiles where id = target;
$$;

create or replace function public.post_system_message(target_chat uuid, actor uuid, text_body text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.messages (chat_id, sender_id, kind, body, client_id)
  values (target_chat, actor, 'system', text_body, gen_random_uuid());
$$;

create or replace function public.narrate_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  chat_kind text;
begin
  select kind into chat_kind from public.chats where id = coalesce(new.chat_id, old.chat_id);
  -- A direct chat has no membership story to tell.
  if chat_kind is distinct from 'group' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    -- The creator seeding themselves is the group coming into existence.
    if actor = new.user_id then
      if exists (select 1 from public.chats c where c.id = new.chat_id and c.created_by = new.user_id)
         and not exists (select 1 from public.messages m where m.chat_id = new.chat_id)
      then
        perform public.post_system_message(
          new.chat_id, new.user_id,
          public.display_name_of(new.user_id) || ' created this group');
      else
        perform public.post_system_message(
          new.chat_id, new.user_id,
          public.display_name_of(new.user_id) || ' joined');
      end if;
    else
      perform public.post_system_message(
        new.chat_id, coalesce(actor, new.user_id),
        public.display_name_of(coalesce(actor, new.user_id)) || ' added ' || public.display_name_of(new.user_id));
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if actor is null or actor = old.user_id then
      perform public.post_system_message(
        old.chat_id, old.user_id, public.display_name_of(old.user_id) || ' left');
    else
      perform public.post_system_message(
        old.chat_id, actor,
        public.display_name_of(actor) || ' removed ' || public.display_name_of(old.user_id));
    end if;
    return old;
  end if;

  -- UPDATE: only a role change is worth a line in the thread.
  if new.role is distinct from old.role then
    perform public.post_system_message(
      new.chat_id, coalesce(actor, new.user_id),
      public.display_name_of(coalesce(actor, new.user_id))
        || case when new.role = 'admin' then ' made ' else ' dismissed ' end
        || public.display_name_of(new.user_id)
        || case when new.role = 'admin' then ' an admin' else ' as admin' end);
  end if;

  return new;
end;
$$;

-- After, not before: the message must not exist if the membership write is refused.
create trigger chat_members_narrate_insert
  after insert on public.chat_members
  for each row execute function public.narrate_membership_change();

create trigger chat_members_narrate_update
  after update on public.chat_members
  for each row execute function public.narrate_membership_change();

-- The delete trigger runs after the row is gone, so the "last admin" guard above
-- has already had its say.
create trigger chat_members_narrate_delete
  after delete on public.chat_members
  for each row execute function public.narrate_membership_change();

create or replace function public.narrate_group_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.kind is distinct from 'group' or actor is null then
    return new;
  end if;

  if new.subject is distinct from old.subject then
    perform public.post_system_message(
      new.id, actor,
      public.display_name_of(actor) || ' changed the subject to "' || new.subject || '"');
  end if;

  if new.icon_path is distinct from old.icon_path then
    perform public.post_system_message(
      new.id, actor, public.display_name_of(actor) || ' changed this group''s icon');
  end if;

  return new;
end;
$$;

create trigger chats_narrate_group_change
  after update on public.chats
  for each row execute function public.narrate_group_change();

-- ---------------------------------------------------------------------------
-- Group icons.
--
-- They live in the avatars bucket keyed by *chat* id: the object belongs to the
-- group, not to whichever admin last changed it. The uuid cast is guarded — the
-- bucket also holds user-id folders, and casting one of those in a policy that is
-- evaluated for every object would error rather than simply not match.
-- ---------------------------------------------------------------------------

create or replace function public.is_group_icon_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (storage.foldername(object_name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_chat_admin(((storage.foldername(object_name))[1])::uuid);
$$;

create policy "admins write their group icon"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and public.is_group_icon_path(name));

create policy "admins replace their group icon"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and public.is_group_icon_path(name));

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Without this a rename or a new group icon only appears after a cold start.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.chats;
alter table public.chats replica identity full;
alter table public.chat_members replica identity full;
