-- Storage buckets and their access rules.
--
-- avatars is public-read: profile pictures are shown in chat lists and headers, and
-- signing every one of them turns a 9-row list into 9 network round-trips. The
-- privacy setting that hides an avatar works by nulling the *path* in
-- public_profiles, so a hidden avatar is never discoverable in the first place.
--
-- media and status are private; the client mints short-lived signed URLs.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('media', 'media', false),
  ('status', 'status', false)
on conflict (id) do nothing;

-- avatars -------------------------------------------------------------------
-- Objects are keyed `<user-id>/<file>`, so ownership is the first path segment.

create policy "avatars are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "a user writes their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "a user replaces their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "a user deletes their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- media ---------------------------------------------------------------------
-- Objects are keyed `<chat-id>/<message-id>/<file>`: membership of the chat in the
-- first path segment is the whole access rule.

create policy "chat members read chat media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'media'
    and public.is_chat_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat members upload chat media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and public.is_chat_member(((storage.foldername(name))[1])::uuid)
  );

-- status --------------------------------------------------------------------
-- Keyed `<author-id>/<file>`; readable by people who share a chat with the author.

create policy "contacts read status media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'status'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_chat_with(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "a user uploads their own status media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'status'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "a user deletes their own status media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'status'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
