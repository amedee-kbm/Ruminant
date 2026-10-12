## Ruminant — Developer Specification

> **Status:** this is the original build plan and is kept for reference. File names below
> (`MainWorkspaceMockup.jsx`, `BooksCollection.jsx`, `ReadingCanvas.jsx`, `RightPaneTabs.jsx`, …)
> describe the planned structure, not the current code. See the README for the current layout:
> the workspace lives in `src/components/book/` and data access in `src/lib/booksApi.js`.

This document is a sequential, actionable development specification for a single full‑stack developer building the Ruminant reading workspace. It assumes the repository already contains the UI mockup at `src/components/MainWorkspaceMockup.jsx`, a `supabaseClient.js` in `src/`, and the database tables shown in the supplied schema image.

Purpose

- Build a focused EPUB reading workspace implementing SQ3R-style workflows (Survey → Question → Read → Recite → Review).
- MVP behavior: upload/open EPUBs, read and select text, create questions/reflections, persist data per-user in Supabase, generate summaries by concatenating notes/reflections, export summaries.

Constraints & Confirmed Decisions

- Chapter extraction: client-side using `epub.js`.
- Summaries: simple concatenation of notes/reflections (no AI).
- Offline-first: not required for MVP.
- Single developer: spec is ordered to be followed sequentially.

Existing Progress (from repository / attachments)

- `src/components/MainWorkspaceMockup.jsx`: visual mockup and baseline layout.
- `src/supabaseClient.js`: Supabase client present (review and use as single source of truth).
- Database schema: `books`, `chapters`, `questions`, `reflections`, `summaries` (and related tables) are already created as shown in provided schema diagram.

How to use this file

- Follow the numbered Implementation Steps in order. Each step includes: goal, tasks, files to create/edit, acceptance criteria, and an estimate.
- Mark each step done in your workflow when verified.

Implementation Steps (sequential)

1. Project sanity & local dev

- Goal: Ensure repo runs locally and developer tooling is ready.
- Tasks:
  - Confirm `node` and `npm` versions and run `npm install`.
  - Verify `package.json` scripts (`dev`, `build`, `test`, `lint`).
  - Add required dev dependencies if missing: `eslint`, `prettier`, `vitest`, `@testing-library/react`, `@tanstack/react-query`, `epubjs`.
- Files to check/edit: `package.json`, `vite.config.js`, `eslint.config.js`.
- Acceptance:
  - `npm run dev` starts without errors; app loads in browser.
- Estimate: 0.5–1 day

2. Auth integration (Supabase)

- Goal: Provide sign-in/out and session context.
- Tasks:
  - Confirm `src/supabaseClient.js` exports a configured Supabase client.
  - Implement `src/contexts/AuthProvider.jsx` and `src/hooks/useAuth.js` to expose `user`, `signIn`, `signOut`.
  - Use `Login.jsx` for signin UI and wire logout to `Header` / `MainWorkspaceMockup.jsx`.
- Acceptance:
  - Users can sign in and sign out; session persisted across reloads.
- Estimate: 1–2 days

3. Books collection UI & EPUB upload

- Goal: Upload EPUBs to Supabase Storage and list user books.
- Tasks:
  - Implement upload flow in `src/components/BooksCollection.jsx` (or extend existing): file input, validation, progress.
  - Upload to storage: `supabase.storage.from('epubs').upload(path, file)`.
  - Create `books` row with `epub_path`, `title`, `author`, `user_id`.
  - Show uploaded books in a list with basic metadata.
- Acceptance:
  - Upload creates storage file and DB row; book visible in list.
- Estimate: 2–3 days

4. Client-side EPUB parsing & chapter seeding

- Goal: Extract TOC and chapter locators client-side and write to `chapters` table.
- Tasks:
  - Add `src/lib/epubService.js`:
    - `loadEpubBlob(blob)` → initialize `epub.js` from Blob.
    - `extractToc()` → return array: `{ chapter_index, title, href, cfiStart }`.
  - After upload, call `epubService.extractToc()` and insert rows into `chapters` via Supabase client.
- Files to create/edit: `src/lib/epubService.js`, minor changes in upload handler.
- Acceptance:
  - Chapters seeded into DB and visible in sidebar UI.
- Estimate: 2–3 days

5. Reading canvas integration

- Goal: Render EPUB content interactively and support navigation and selection.
- Tasks:
  - Create `src/components/ReadingCanvas.jsx`.
    - Accept props: `signedUrl`, `initialCfi`, `onSelection`.
    - Use `epub.js` to render the book into a container element.
    - Implement `goTo(cfi | href)` to jump to a location.
    - Emit `onSelection({ text, cfi, href })` when user selects text.
  - Use Supabase storage signed URL for viewing: `supabase.storage.from('epubs').createSignedUrl(path, 3600)`.
- Acceptance:
  - Chapters open in viewer; selecting text returns text and a stable locator (CFI or href).
- Estimate: 3–5 days

6. Highlights / Questions / Reflections CRUD

- Goal: Persist annotations and show them in right pane.
- Tasks:
  - Create hooks: `src/hooks/useChapters.js`, `src/hooks/useQuestions.js`, `src/hooks/useReflections.js` (use `react-query`).
  - Create components: `src/components/RightPaneTabs.jsx`, `QuestionCard.jsx`, `ReflectionCard.jsx` with create/edit/delete.
  - When user confirms a selection → open modal to create a question or reflection; insert into `questions` / `reflections` with `cfi` and `highlight_text`.
- Acceptance:
  - Notes persist and render in right pane; clicking a note scrolls viewer to its CFI.
- Estimate: 3–5 days

7. Chapter progress & “mark done”

- Goal: Track per-chapter completion and show progress in sidebar.
- Tasks:
  - Add `status` enum on `chapters` (if not present) or use a separate `chapter_progress` table.
  - Hook `Mark chapter done` button to update DB and UI progress indicator.
- Acceptance:
  - Progress reflects marked chapters and persists.
- Estimate: 0.5–1 day

8. Summary composition and export

- Goal: Generate summaries by concatenating notes/reflections and enable export.
- Tasks:
  - Implement `src/lib/summaryService.js` with `composeSummary({ bookId, chapterId? })`:
    - Fetch questions and reflections grouped by chapter.
    - Format as Markdown: book header, per-chapter headings, bullet points for notes/reflections with timestamps.
  - Persist summary in `summaries` table: `combined_text`, `generated_at`, `book_id`, `user_id`.
  - Implement export UI (`Export` button from header) to download `.md` or `.txt` via Blob.
- Acceptance:
  - Generated summary contains all user notes/reflections and downloads successfully.
- Estimate: 1–2 days

9. Theme persistence & small UX polish

- Goal: Persist chosen color scheme and make UI accessible.
- Tasks:
  - Save preference to `user_settings` table or `auth.user_metadata`.
  - Ensure color contrast and ARIA roles for tablist and modals.
- Acceptance:
  - Theme persists between sessions and basic accessibility checks pass.
- Estimate: 0.5–1 day

10. Security & RLS verification

- Goal: Ensure users can only access their own data.
- Tasks:
  - Verify/add RLS policies for `books`, `chapters`, `questions`, `reflections`, `summaries`:
    - Example: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`.
  - Use signed URLs to avoid public storage exposure.
- Acceptance:
  - Attempts to access other user data are denied.
- Estimate: 1 day

11. Testing

- Goal: Add unit and E2E tests for core flows.
- Tasks:
  - Unit tests: `vitest` + `@testing-library/react` for `summaryService`, hooks, and small components.
  - E2E: Playwright or Cypress to verify upload → open → select → create note → generate summary → download.
  - Add sample test fixture EPUBs under `tests/fixtures/`.
- Acceptance:
  - Key unit tests pass; E2E covers major happy path.
- Estimate: 3–5 days

12. CI/CD and deployment

- Goal: Configure CI and host production site.
- Tasks:
  - Add GitHub Actions workflow: lint, test, build.
  - Use Vercel for frontend; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project env.
  - Do not ship service role key to frontend; keep server-side secrets in functions.
- Acceptance:
  - PR triggers CI; main branch deploys successfully.
- Estimate: 1–2 days

13. Documentation & Handoff

- Goal: Provide README and developer notes.
- Tasks:
  - Document local setup, environment variables, Supabase provisioning steps, and table summary in `README.md`.
  - Keep this `docs/dev-spec.md` in `docs/` for reference.
- Acceptance:
  - Developer can clone and run app locally following README.
- Estimate: 1 day

Acceptance Criteria (MVP)

- [ ] Auth + user session working locally.
- [ ] Upload an EPUB → stored in Supabase and `books` row created.
- [ ] Chapters extracted client-side and seeded into `chapters` table.
- [ ] Reading canvas loads book and selection emits `text + locator`.
- [ ] Create/question/reflection persists and appears in right pane.
- [ ] Generate summary (concat) and export download works.
- [ ] RLS enforces per-user data isolation.

Data Model Notes (reference)

- Tables expected (already present per provided schema image):
  - `books` (id uuid, created_at timestamptz, user_id uuid, title text, author text, epub_path text)
  - `chapters` (id uuid, created_at, book_id uuid, chapter_index int, title text, locator text, user_id uuid)
  - `questions` (id, created_at, chapter_id, question_text, cfi, highlight_text, source, user_id)
  - `reflections` (id, created_at, chapter_id, question_id, reflection_text, user_id)
  - `summaries` (id, generated_at, book_id, combined_text, user_id)

Example SQL snippets

- Create `books` (if needed):

```sql
CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  title text,
  author text,
  epub_path text
);
```

- RLS example for `books`:

```sql
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their books" ON books
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

API & Client Patterns (examples)

- Upload EPUB and seed chapters (client-side flow):
  1. `supabase.storage.from('epubs').upload(path, file)`
  2. Create `books` row with `epub_path` = `path`
  3. Read file blob and pass to `epub.js` to `extractToc()`
  4. Insert `chapters` rows via `supabase.from('chapters').insert([...])`

- Generate summary (client-side):
  - Fetch `questions` and `reflections` for book
  - Format as Markdown and `INSERT` into `summaries`
  - Build a `Blob` and download with `URL.createObjectURL`

File & Component Map (recommended)

- `src/contexts/AuthProvider.jsx` – auth context
- `src/hooks/useAuth.js` – auth helper hook
- `src/lib/epubService.js` – wrapper around `epub.js` (load blob, extract TOC, generate CFI)
- `src/lib/summaryService.js` – compose summaries
- `src/components/ReadingCanvas.jsx` – epub viewer, selection handling
- `src/components/BooksCollection.jsx` – book list and upload
- `src/components/RightPaneTabs.jsx` – Survey/Question/Recite/Review tabs
- `src/components/QuestionCard.jsx`, `ReflectionCard.jsx` – note components
- `src/hooks/useChapters.js`, `useQuestions.js`, `useReflections.js` – data hooks

Testing Recommendations

- Unit: `vitest` + `@testing-library/react` for hooks and utilities.
- E2E: Playwright recommended for cross-browser flows. Test upload, selection, create note, summary export.

CI/CD

- GitHub Actions workflow: `lint` → `test` → `build`.
- Deploy frontend to Vercel (or Netlify). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project settings.

Estimates (MVP)

- Total: ~6–9 weeks for a single full-stack developer following this sequence. Individual steps have estimates above.

Developer checklist (copy into task tracker)

- [ ] Step 1 — Project sanity
- [ ] Step 2 — Auth
- [ ] Step 3 — Upload & Books list
- [ ] Step 4 — EPUB parsing & chapters
- [ ] Step 5 — Reading canvas
- [ ] Step 6 — Notes CRUD
- [ ] Step 7 — Progress tracking
- [ ] Step 8 — Summary & export
- [ ] Step 9 — Theme & accessibility
- [ ] Step 10 — Security RLS
- [ ] Step 11 — Testing
- [ ] Step 12 — CI/CD
- [ ] Step 13 — Docs & README

If you want, I will now:

- [ ] Add example implementations for `epubService.js` and `summaryService.js`.
- [ ] Create initial test fixtures and a minimal Playwright E2E test for the happy path.

— End of spec —
