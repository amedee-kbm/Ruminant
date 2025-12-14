-- Fix the chapters table schema
-- Run this SQL in your Supabase SQL editor

-- Step 1: Drop the incorrect foreign key constraint
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_id_fkey;

-- Step 2: Drop the UNIQUE constraint on book_id (allows multiple chapters per book)
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_book_id_key;

-- Step 3: Drop the UNIQUE constraint on chapter_index (we'll make it unique per book instead)
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_chapter_index_key;

-- Step 4: Add the correct foreign key constraint on book_id
ALTER TABLE public.chapters 
  ADD CONSTRAINT chapters_book_id_fkey 
  FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

-- Step 5: Add composite unique constraint (book_id + chapter_index must be unique together)
-- This ensures each chapter index is unique per book, but the same index can exist in different books
ALTER TABLE public.chapters 
  ADD CONSTRAINT chapters_book_chapter_unique 
  UNIQUE (book_id, chapter_index);

he
