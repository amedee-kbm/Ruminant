# App Name: Ruminant

Ruminant: Turn reading into a habit of inquiry — one chapter, one question, one insight at a time.

## Features

* Upload EPUB files. Automatically extract each chapter into its own editable note file.
* Prepare with questions. Set the key questions or goals you want to explore before you read a chapter.
* Read in-app. Read chapters inside Ruminant; select any passage and turn it into a reflection prompt.
* Reflect thoughtfully. Answer your initial questions, capture insights, and add free-form notes as you go.
* Review effortlessly. Generate a concise summary that concatenates all your chapter notes.
* Export anywhere. Download your work as Markdown or plain text.

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
  epub_path text,
  cover_url text,
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
  CONSTRAINT chapters_pkey PRIMARY KEY (id),
  CONSTRAINT chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE,
  CONSTRAINT chapters_book_chapter_unique UNIQUE (book_id, chapter_index),
  CONSTRAINT chapters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  chapter_id uuid NOT NULL,
  question_text text NOT NULL,
  cfi text,
  highlight_text text,
  source USER-DEFINED DEFAULT 'initial'::question_source,
  user_id uuid NOT NULL,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id),
  CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.reflections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  chapter_id uuid NOT NULL,
  question_id uuid,
  reflection_text text NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT reflections_pkey PRIMARY KEY (id),
  CONSTRAINT reflections_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id),
  CONSTRAINT reflections_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT reflections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.summaries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  book_id uuid NOT NULL,
  combined_text text NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT summaries_pkey PRIMARY KEY (id),
  CONSTRAINT summaries_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id),
  CONSTRAINT summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```
