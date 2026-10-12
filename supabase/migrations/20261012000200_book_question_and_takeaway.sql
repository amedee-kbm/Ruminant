-- The question ("what do I want from this?") and takeaway ("what will I keep?") now belong
-- to the whole book. Each chapter just has notes, in chapters.markdown_content.
--
-- Chapters' old questions are folded into the top of their notes before the column is
-- dropped, so nothing written is lost. Safe to run more than once.

alter table public.books
  add column if not exists question text,
  add column if not exists takeaway text;

do $$
declare
  question_type text;
  questions_sql text;
begin
  select data_type into question_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'chapters' and column_name = 'pre_questions';

  if question_type is null then
    return; -- already migrated
  end if;

  -- The column was created as jsonb in some setups and text[] in others
  questions_sql := case
    when question_type = 'jsonb' then
      '(select string_agg(q, E''\n'') from jsonb_array_elements_text(
          case when jsonb_typeof(pre_questions) = ''array'' then pre_questions else ''[]''::jsonb end) q)'
    else
      'array_to_string(pre_questions, E''\n'')'
  end;

  execute format(
    'update public.chapters
       set markdown_content = concat_ws(E''\n\n'', ''Question: '' || q.text, nullif(markdown_content, ''''))
     from (select id, nullif(trim(%s), '''') as text from public.chapters) q
     where q.id = chapters.id and q.text is not null',
    questions_sql
  );

  alter table public.chapters drop column pre_questions;
end $$;
