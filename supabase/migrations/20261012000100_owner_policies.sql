-- Let each user create, read, update and delete their own books, chapters and covers.
-- Without a delete policy, Supabase silently deletes nothing (no error), which is why
-- deleting a book or removing a chapter could appear to do nothing.
-- Safe to run more than once. These policies only add access to rows the user owns.

alter table public.books enable row level security;
alter table public.chapters enable row level security;

drop policy if exists "Owners manage their books" on public.books;
create policy "Owners manage their books" on public.books
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners manage their chapters" on public.chapters;
create policy "Owners manage their chapters" on public.chapters
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Covers are stored under <user id>/..., so the first folder identifies the owner
drop policy if exists "Owners delete their covers" on storage.objects;
create policy "Owners delete their covers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
