-- Wave Messenger — calls: narrowing who may write a call's outcome.
--
-- Signalling is not here and never will be: SDP offers and ICE candidates ride a
-- Realtime broadcast channel (services/callSignal.ts). Their entire lifetime is the
-- handshake, and writing each one to a table means a row, a WAL entry and a
-- replication hop for data that is worthless four seconds later. This table holds
-- the history.

-- ---------------------------------------------------------------------------
-- 0001 let any member of the chat update any call row in it. In a group that
-- means someone who was never on the call can mark it ended, or backdate its
-- answer time — rewriting a history row that belongs to two other people.
-- ---------------------------------------------------------------------------

drop policy "members update calls in their chats" on public.calls;

create policy "participants write a call's outcome"
  on public.calls for update
  to authenticated
  using (
    public.is_chat_member(chat_id)
    and (
      initiator_id = auth.uid()
      or exists (
        select 1 from public.call_participants p
        where p.call_id = id and p.user_id = auth.uid()
      )
      -- A callee who never joined still has to be able to record a decline or a
      -- missed call, and by definition has no participant row to prove it with.
      or status = 'ringing'
    )
  )
  with check (public.is_chat_member(chat_id));

-- A call cannot leave a terminal state. Without this, a late-arriving hang-up
-- from the other device can reopen a call that was already written off as missed.
create or replace function public.guard_call_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('ended', 'missed', 'declined') and new.status is distinct from old.status then
    raise exception 'a finished call cannot change state'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger calls_guard_transition
  before update on public.calls
  for each row execute function public.guard_call_transition();

-- ---------------------------------------------------------------------------
-- Cleanup: a call left ringing because both apps died has to stop being "live",
-- or it sits at the top of the history as an ongoing call forever.
-- ---------------------------------------------------------------------------

create or replace function public.expire_stale_calls()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.calls
     set status = 'missed', ended_at = coalesce(ended_at, now())
   where status = 'ringing'
     and started_at < now() - interval '2 minutes';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.expire_stale_calls() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'wave-expire-calls',
      '*/5 * * * *',
      $cron$select public.expire_stale_calls()$cron$
    );
  else
    raise notice
      'pg_cron is not enabled: calls abandoned mid-ring stay marked ringing. Enable pg_cron and re-run this migration.';
  end if;
end;
$$;
