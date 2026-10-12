# Ruminant

Turn reading into a habit of inquiry — one chapter, one question, one insight at a time.

Read wherever you like: Kindle, paper, anywhere. Ruminant is where you think about it. Add a book
by typing its title and chapters (or import an EPUB to fill them in). Before you start, write what
you want from the book; as you go, jot a few notes per chapter; when you finish, write what you'll
keep. Export everything as Markdown.

## Setup

Requires Node and a Supabase project (schema in [context.md](context.md)).

Create `.env` (or `.env.local`):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_KEY=<anon key>
```

```
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run format`.

## Structure

```
src/
  App.jsx                    Routes: /sign-in, / (library), /books/:bookId (workspace)
  components/
    AppHeader.jsx            Shared header: wordmark (home), breadcrumb, page actions, account menu
    ConfirmDialog.jsx        Confirmation for destructive actions
    Login.jsx                Magic-link sign-in
    Home.jsx                 Library: book list with progress, add or import a book
    library/
      AddBookForm.jsx        Add a book by title, author and chapter list
    book/
      BookWorkspace.jsx      One book: question, chapters, takeaway; open chapter is ?chapter=<id>
      BookPrompt.jsx         The book's question or takeaway, autosaved
      ChapterCard.jsx        One chapter's notes, and Next
      WritingArea.jsx        Borderless writing field and save status, shared by both
      ChapterListEditor.jsx  Rename, reorder, add and remove chapters
      EditBookDialog.jsx     Edit title and author, or delete the book
  hooks/
    useBooks / useBook / useChapters   Data loading
    useAutosave              Debounced save with retry and unsaved-changes warning
    useDocumentTitle         Browser tab title per page
  lib/
    booksApi.js              Supabase queries
    bookImport.js            Create a book from typed details or an EPUB; seed chapters
    epubService.js           EPUB metadata, cover and TOC extraction (epub.js)
    bookNotes.js             Chapter notes helpers and Markdown export
    formatTitle.js           Tidies all-caps EPUB titles ("PART ONE  YES" → "Part One · Yes")
```

## Notes

- Colours are CSS variables in [src/theme.css](src/theme.css) with light and dark values; use
  `cleanTheme` from `src/constants/theme.js` rather than hex codes. Dark mode is the `dark` class
  on `<html>` (Chakra's components follow it too), toggled by the sun/moon button in the
  header (it follows the OS until first used).
- Writing autosaves 1 second after the last edit. A failed save shows a Retry
  button, and the browser warns before closing the tab while changes are unsaved.
- The book's question and takeaway are `books.question` and `books.takeaway`; chapter notes are
  `chapters.markdown_content`. Run the SQL files in [supabase/migrations/](supabase/migrations/),
  in order, in the Supabase SQL editor.
- The EPUB file itself is no longer stored; only the cover goes to the `covers` bucket, under
  `<user id>/`.
