# App Name: Ruminant

Ruminant: Turn reading into a habit of inquiry — one chapter, one question, one insight at a time.

## Features

- Read anywhere. There's no in-app reader; Ruminant is for thinking about what you read.
- Add a book by typing its title and chapters, or import an EPUB to fill them in (the file isn't kept).
- Before you start, write what you want from the book.
- As you read, jot a few notes per chapter.
- When you finish, write what you'll keep.
- Export everything as Markdown.

## Schema

```
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.books (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  author text,
  cover_url text,
  question text,                  -- what the reader wants from the book
  takeaway text,                  -- what they'll keep
  CONSTRAINT books_pkey PRIMARY KEY (id),
  CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chapters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  chapter_index bigint NOT NULL,
  title text,
  locator text NOT NULL,
  user_id uuid NOT NULL,
  -- Added by later migrations; the app reads/writes these (exact types not recorded here):
  markdown_content text,          -- the chapter's notes
  locator_normalized text,        -- optional; upsert target with book_id if a unique constraint exists
  CONSTRAINT chapters_pkey PRIMARY KEY (id),
  CONSTRAINT chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE,
  CONSTRAINT chapters_book_chapter_unique UNIQUE (book_id, chapter_index),
  CONSTRAINT chapters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

The `questions`, `reflections` and `summaries` tables, `books.epub_path` and
`chapters.pre_questions` are dropped by the SQL files in [supabase/migrations/](supabase/migrations/).
Covers live in the `covers` storage bucket.
