# Architecture Analysis: Chapter & Reading Canvas Display Issues

## Problem Statement

The Workspace component is struggling to display chapters and reading canvas content that accurately match how they're represented in the EPUB book. There are synchronization and navigation issues between:
- Chapters stored in the database
- Chapters extracted by react-reader
- The actual EPUB structure

## Current Architecture Issues

### 1. **Multiple Sources of Truth for Chapters**

**Problem:**
- Chapters are extracted during upload via `epubService.js` (using `epubjs` directly)
- Chapters are also extracted by `react-reader` in `ReadingCanvas` via `tocChanged` callback
- These two extractions may produce different results:
  - Different filtering logic (front/back matter)
  - Different title cleaning
  - Different href normalization
  - Different chapter indexing

**Evidence:**
- `epubService.js` has complex filtering for front/back matter and title cleaning
- `ReadingCanvas.jsx` has simpler extraction logic in `handleTocChange`
- Database chapters may not match react-reader's TOC structure

### 2. **Locator/Href vs CFI Mismatch**

**Problem:**
- Database stores `locator` as an href (e.g., "chapter1.xhtml" or "chapter1.xhtml#section1")
- `react-reader` uses CFI (Canonical Fragment Identifier) for navigation (e.g., "epubcfi(/6/4[chap01ref]!/4/2/2)")
- Navigation logic tries to match hrefs to TOC items using fragile string normalization
- CFI is more reliable but requires the book to be loaded

**Evidence:**
```javascript
// ReadingCanvas.jsx lines 73-106
const findChapterInToc = (items, targetLocator) => {
  // Complex normalization and matching logic
  const normalize = (str) => str?.replace(/\s+/g, '').replace(/\n/g, '').split('#')[0].toLowerCase().trim()
  // This is fragile and may fail for edge cases
}
```

### 3. **Chapter Navigation Synchronization**

**Problem:**
- When a chapter is selected in the sidebar, the reading canvas tries to navigate using the stored `locator`
- The matching logic may fail, causing the wrong chapter or no navigation
- Location state updates may not trigger correctly
- User's reading position (CFI) is not persisted

**Evidence:**
- Navigation depends on TOC being loaded (`toc.length > 0`)
- Fallback to direct locator may not work with react-reader
- No persistence of reading position per chapter

### 4. **Chapter Display Inconsistencies**

**Problem:**
- Sidebar shows chapters from database (may have different titles/order)
- Reading canvas shows content from react-reader (may have different structure)
- Chapter titles may not match between sidebar and actual book content
- Chapter indexing may be off (0-based vs 1-based, gaps, etc.)

## Proposed Solutions

### Solution 1: **Single Source of Truth - Use react-reader TOC as Primary**

**Approach:**
- Remove chapter extraction from upload process
- Always extract chapters from react-reader's TOC when book loads
- Store chapters in database only after react-reader provides TOC
- Use react-reader's TOC structure directly for navigation

**Pros:**
- Single source of truth (react-reader's TOC)
- Guaranteed match between sidebar and reading canvas
- Simpler logic (no dual extraction)

**Cons:**
- Chapters not available until book loads
- Requires book to be loaded to see chapters
- May need loading state for chapters

**Implementation:**
1. Remove chapter extraction from `bookUploadService.js`
2. Always extract from react-reader in `ReadingCanvas`
3. Store chapters in DB after extraction (current approach, but make it the only approach)
4. Use TOC items directly for navigation instead of database locators

**Files to modify:**
- `src/lib/bookUploadService.js` - Remove chapter insertion
- `src/components/workspace/ReadingCanvas.jsx` - Ensure TOC extraction is reliable
- `src/components/Workspace.jsx` - Handle chapter loading state

---

### Solution 2: **Store CFI Instead of Href for Navigation**

**Approach:**
- Add `cfi` column to `chapters` table (or use existing `cfi` in `questions` as reference)
- When chapters are extracted, convert hrefs to CFIs using epubjs
- Store CFI in database for reliable navigation
- Use CFI directly for navigation (react-reader supports CFI natively)

**Pros:**
- CFI is more reliable than href matching
- Direct navigation without TOC lookup
- Supports precise positioning within chapters

**Cons:**
- Requires epubjs to be loaded to convert href → CFI
- CFI format is complex and less human-readable
- May need to handle CFI generation during extraction

**Implementation:**
1. Modify schema to add `cfi` column to `chapters` (or use existing pattern)
2. When extracting chapters, use epubjs to get CFI for each href:
   ```javascript
   const book = ePub(epubBlob)
   await book.ready
   const spineItem = book.spine.get(href)
   const cfi = spineItem.cfiBase
   ```
3. Store CFI in database
4. Use CFI directly for navigation: `setLocation(chapter.cfi)`

**Files to modify:**
- Database schema (add `cfi` column)
- `src/components/workspace/ReadingCanvas.jsx` - Extract and use CFI
- `src/components/Workspace.jsx` - Store CFI when chapters extracted

---

### Solution 3: **Hybrid: Store Both Href and CFI, Use CFI for Navigation**

**Approach:**
- Keep `locator` (href) for display and reference
- Add `cfi` column for navigation
- Extract both during chapter extraction
- Use CFI for navigation, href for display/matching

**Pros:**
- Best of both worlds
- Href for human-readable references
- CFI for reliable navigation
- Backward compatible

**Cons:**
- More complex data model
- Need to extract both during initialization

**Implementation:**
1. Add `cfi` column to `chapters` table
2. Extract both href and CFI when chapters are extracted
3. Store both in database
4. Use CFI for navigation, href for display

---

### Solution 4: **Use epubjs Directly Instead of react-reader**

**Approach:**
- Replace react-reader with direct epubjs usage
- Full control over chapter extraction and navigation
- Use epubjs's native navigation methods

**Pros:**
- Full control over extraction and navigation
- Can use same extraction logic as upload
- Direct access to epubjs features

**Cons:**
- More complex implementation
- Need to build reader UI from scratch
- Lose react-reader's built-in features

**Implementation:**
1. Replace `ReactReader` with custom epubjs implementation
2. Use epubjs directly for rendering and navigation
3. Use same extraction logic as `epubService.js`

---

### Solution 5: **Improve Current Matching Logic + Add Fallbacks**

**Approach:**
- Keep current architecture but improve matching logic
- Add better normalization and fallback strategies
- Add CFI conversion as fallback
- Better error handling and logging

**Pros:**
- Minimal changes to current architecture
- Incremental improvement
- Backward compatible

**Cons:**
- Still has fundamental mismatch issues
- May not solve all edge cases
- Technical debt remains

**Implementation:**
1. Improve `findChapterInToc` matching logic
2. Add multiple fallback strategies
3. Add CFI conversion when href matching fails
4. Better error handling and user feedback

---

## Recommended Solution: **Solution 3 (Hybrid Approach)**

I recommend **Solution 3** because it:
1. Provides reliable navigation (CFI)
2. Maintains human-readable references (href)
3. Is backward compatible
4. Solves the core navigation issues
5. Allows for future enhancements (precise positioning, bookmarks, etc.)

### Implementation Plan for Solution 3:

#### Phase 1: Database Schema Update
```sql
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS cfi text;
```

#### Phase 2: Update Chapter Extraction
- Modify `ReadingCanvas.jsx` to extract CFI when chapters are extracted
- Use epubjs to convert href to CFI:
  ```javascript
  const book = ePub(epubBlob)
  await book.ready
  const spineItem = book.spine.get(href)
  const cfi = spineItem.cfiBase || book.locations.cfiFromHref(href)
  ```

#### Phase 3: Update Navigation
- Use CFI directly for navigation instead of href matching
- Simplify navigation logic in `ReadingCanvas.jsx`

#### Phase 4: Update Chapter Storage
- Store both `locator` (href) and `cfi` in database
- Update `Workspace.jsx` to handle both fields

#### Phase 5: Add Reading Position Persistence
- Store current CFI position per chapter
- Restore position when chapter is selected

---

## Alternative Quick Fix: **Solution 1 (Simplified)**

If you want a quicker fix with minimal changes, **Solution 1** is simpler:
- Remove dual extraction
- Always use react-reader's TOC
- Simplify navigation to use TOC items directly

This solves the synchronization issue but doesn't address CFI reliability.

---

## Important Note: Text Selection Feature Compatibility

**Question:** Will Solution 1 support selecting text to create reflections?

**Answer: YES!** Text selection is **independent** of chapter navigation:

- ✅ react-reader provides CFI for text selections via `handleSelection(cfiRange, contents)`
- ✅ CFI works regardless of how chapters are extracted or navigated
- ✅ Current code already handles selections (currently creates questions)
- ✅ To support reflections from selections, just modify `handleSelection` to also call `onAddReflection`

**What's needed:**
1. Modify `handleSelection` in `ReadingCanvas.jsx` to support creating reflections
2. Optionally add `cfi` and `highlight_text` columns to `reflections` table to link back to source passage
3. Update `handleAddReflection` to accept `cfi` and `highlight_text` parameters

**Example implementation:**
```javascript
const handleSelection = (cfiRange, contents) => {
  const selectedText = contents.window.getSelection().toString().trim()
  if (selectedText) {
    // Show dialog: "Create question" or "Create reflection"
    const choice = confirm(`Selected: "${selectedText}"\n\nCreate reflection? (OK) or Question? (Cancel)`)
    if (choice) {
      onAddReflection(selectedText, cfiRange) // New: support reflection from selection
    } else {
      onAddQuestion(selectedText, cfiRange)
    }
  }
}
```

## Questions to Consider

1. **Do you need chapters available before the book loads?**
   - If yes, keep upload-time extraction
   - If no, Solution 1 is simpler

2. **How important is precise positioning within chapters?**
   - If important, use CFI (Solution 2 or 3)
   - If not, href matching may be sufficient
   - **Note:** Text selections already use CFI, so this mainly affects chapter navigation

3. **Do you need to support bookmarks or reading progress?**
   - If yes, CFI is essential
   - If no, href may be sufficient

4. **Are you experiencing specific navigation failures?**
   - Understanding the exact failures will help prioritize solutions

---

## Next Steps

1. **Decide on solution approach** based on your priorities
2. **Test current failures** to understand specific issues
3. **Implement chosen solution** incrementally
4. **Add logging** to track navigation success/failure
5. **Add user feedback** for navigation issues

Would you like me to implement one of these solutions? I recommend starting with Solution 3 (Hybrid) for the best long-term architecture.
