-- Ruminant no longer has an in-app reader, highlights or generated summaries.
-- A chapter's question lives in chapters.pre_questions and its takeaway in
-- chapters.markdown_content, so these tables and the EPUB file path are unused.
--
-- This permanently deletes data. Check what's there first:
--   select (select count(*) from public.questions)   as questions,
--          (select count(*) from public.reflections) as reflections,
--          (select count(*) from public.summaries)   as summaries;

begin;

drop table if exists public.reflections; -- references questions, so goes first
drop table if exists public.questions;
drop table if exists public.summaries;
drop type if exists public.question_source;

alter table public.books drop column if exists epub_path;

commit;

-- The `books` storage bucket (the uploaded EPUB files) can't be removed from SQL.
-- Delete it in the dashboard: Storage → books → Empty bucket, then Delete bucket.
-- Keep the `covers` bucket; the app still uses it.
