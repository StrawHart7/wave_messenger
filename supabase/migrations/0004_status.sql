-- Wave Messenger — status: the server half of the 24-hour lifetime, and one hole
-- in 0001's view-recording policy.
--
-- The read policy on status_posts already filters `expires_at > now()`, so an
-- expired post is unreadable the second its deadline passes, with no cleanup run
-- required. Everything below is about not accumulating the corpses.

-- ---------------------------------------------------------------------------
-- Hole — recording a view on a status you cannot see.
--
-- 0001's insert policy checks only `viewer_id = auth.uid()`. Any authenticated
-- user could therefore insert a view row for an arbitrary status id: harmless to
-- read, but it puts a stranger's name in an author's viewer list, which is exactly
-- the kind of thing a viewer list must never say.
-- ---------------------------------------------------------------------------

drop policy "a viewer records their own view" on public.status_views;

create policy "a viewer records a view on a status they can see"
  on public.status_views for insert
  to authenticated
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.status_posts s
      where s.id = status_id
        and s.expires_at > now()
        and (s.author_id = auth.uid() or public.shares_chat_with(s.author_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Cleanup.
--
-- Deleting the row is what matters; the storage object is orphaned until the
-- bucket is swept separately, which is a scheduled Edge Function's job rather than
-- something SQL can do.
-- ---------------------------------------------------------------------------

create or replace function public.delete_expired_status()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.status_posts where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.delete_expired_status() from public, anon, authenticated;

-- pg_cron has to be enabled for the project first (Dashboard → Database →
-- Extensions). The block below schedules the sweep when it is available and says
-- so when it is not, rather than failing the migration on a fresh project.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'wave-expire-status',
      '17 * * * *',
      $cron$select public.delete_expired_status()$cron$
    );
  else
    raise notice
      'pg_cron is not enabled: expired status rows stay in the table. They are already unreadable (the read policy filters expires_at), but enable pg_cron and re-run this migration to sweep them.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
--
-- A contact posting while the Updates tab is open should ring their avatar without
-- waiting for the next pull. RLS applies to the stream, so a subscriber is only
-- sent posts they were already allowed to read.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.status_posts;
alter table public.status_posts replica identity full;
