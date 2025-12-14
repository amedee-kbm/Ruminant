# Local-First Architecture: Instant Upload & Reading

## Your Desired Workflow

1. ✅ User picks file
2. ✅ Extract client-side (metadata, chapters, cover)
3. ✅ Save everything in browser (IndexedDB + localStorage)
4. ✅ **Everything available instantly** (no waiting for upload)
5. ✅ Upload in background (non-blocking)
6. ✅ Only download from server if nothing in browser

## This is: **Local-First / Offline-First Architecture**

This pattern prioritizes local storage and makes the server optional for immediate use.

---

## Implementation Strategy

### Phase 1: Local Storage on Upload

```javascript
// src/lib/localBookStorage.js
import { extractEpubData } from './epubService'

class LocalBookStorage {
  // IndexedDB for EPUB blobs (large files)
  async saveEpub(bookId, file) {
    const db = await this.getIndexedDB()
    const transaction = db.transaction(['epubs'], 'readwrite')
    const store = transaction.objectStore('epubs')
    await store.put({ bookId, blob: file, savedAt: Date.now() })
  }

  async getEpub(bookId) {
    const db = await this.getIndexedDB()
    const transaction = db.transaction(['epubs'], 'readonly')
    const store = transaction.objectStore('epubs')
    const result = await store.get(bookId)
    return result?.blob || null
  }

  // localStorage for metadata (small, fast)
  saveBookMetadata(bookId, metadata) {
    localStorage.setItem(`book_${bookId}`, JSON.stringify({
      ...metadata,
      savedAt: Date.now(),
      synced: false // Track if uploaded to server
    }))
  }

  getBookMetadata(bookId) {
    const cached = localStorage.getItem(`book_${bookId}`)
    return cached ? JSON.parse(cached) : null
  }

  // localStorage for chapters
  saveChapters(bookId, chapters) {
    localStorage.setItem(`chapters_${bookId}`, JSON.stringify(chapters))
  }

  getChapters(bookId) {
    const cached = localStorage.getItem(`chapters_${bookId}`)
    return cached ? JSON.parse(cached) : null
  }

  // IndexedDB setup
  async getIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ruminant-local-storage', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('epubs')) {
          db.createObjectStore('epubs', { keyPath: 'bookId' })
        }
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'bookId' })
        }
      }
    })
  }
}

export const localBookStorage = new LocalBookStorage()
```

### Phase 2: Modified Upload Flow

```javascript
// src/lib/bookUploadService.js
import { extractEpubData } from './epubService'
import { localBookStorage } from './localBookStorage'
import supabase from '../supabaseClient'

export const uploadBook = async (file, userId) => {
  if (!userId) {
    throw new Error('You must be signed in to upload a book.')
  }

  // ============================================
  // STEP 1: Extract client-side (FAST)
  // ============================================
  const data = await extractEpubData(file)
  
  // Generate temporary book ID (use before server assigns real ID)
  const tempBookId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // ============================================
  // STEP 2: Save everything locally (INSTANT)
  // ============================================
  
  // Save EPUB blob to IndexedDB
  await localBookStorage.saveEpub(tempBookId, file)
  
  // Save metadata to localStorage
  localBookStorage.saveBookMetadata(tempBookId, {
    id: tempBookId,
    title: data.title || file.name,
    author: data.author || 'Unknown author',
    cover: data.cover, // Base64 data URL
    epub_path: null, // Will be set after upload
    user_id: userId,
    synced: false, // Not uploaded yet
    createdAt: Date.now()
  })
  
  // Save chapters to localStorage
  if (data.chapters && data.chapters.length > 0) {
    localBookStorage.saveChapters(tempBookId, data.chapters.map((ch, index) => ({
      id: `temp_ch_${index}`,
      book_id: tempBookId,
      chapter_index: index,
      title: ch.title || `Chapter ${index + 1}`,
      locator: ch.href || `chapter-${index}`,
      user_id: userId
    })))
  }

  // ============================================
  // STEP 3: Return immediately (USER CAN READ NOW!)
  // ============================================
  // Book is now available locally - user can open it instantly
  
  // ============================================
  // STEP 4: Upload in background (NON-BLOCKING)
  // ============================================
  uploadToServerInBackground(tempBookId, file, data, userId)
    .then((serverBookId) => {
      // After upload succeeds, update local storage with real ID
      updateLocalStorageWithServerId(tempBookId, serverBookId)
    })
    .catch((error) => {
      console.error('Background upload failed:', error)
      // Mark as failed but keep local copy
      const metadata = localBookStorage.getBookMetadata(tempBookId)
      if (metadata) {
        metadata.uploadError = error.message
        localBookStorage.saveBookMetadata(tempBookId, metadata)
      }
    })

  // Return immediately with temp ID
  return {
    id: tempBookId,
    title: data?.title || file.name,
    message: `Imported "${data?.title || file.name}" - ready to read!`,
    synced: false
  }
}

// Background upload function
async function uploadToServerInBackground(tempBookId, file, data, userId) {
  const safeName = sanitizeFileName(file.name, 'epub')
  const timestamp = Date.now()
  const epubPath = `${userId}/${timestamp}-${safeName}`

  // Upload EPUB to storage
  const { error: epubError } = await supabase.storage
    .from('books')
    .upload(epubPath, file, {
      upsert: true,
      contentType: file.type || 'application/epub+zip',
    })

  if (epubError) throw epubError

  // Upload cover
  let coverUrl = null
  if (data.cover) {
    const coverBlob = await dataUrlToBlob(data.cover)
    coverUrl = await uploadCover(coverBlob, userId, timestamp)
  }

  // Save book record
  const { data: insertedBook, error: insertError } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title: data.title || file.name,
      author: data.author || 'Unknown author',
      epub_path: epubPath,
      cover_url: coverUrl,
    })
    .select()
    .single()

  if (insertError) throw insertError

  const serverBookId = insertedBook.id

  // Insert chapters
  if (data.chapters && data.chapters.length > 0) {
    const chaptersToInsert = data.chapters.map((chapter, index) => ({
      book_id: serverBookId,
      chapter_index: index,
      title: chapter.title || `Chapter ${index + 1}`,
      locator: chapter.href || `chapter-${index}`,
      user_id: userId,
    }))

    await supabase.from('chapters').insert(chaptersToInsert)
  }

  return serverBookId
}

// Update local storage with server ID
async function updateLocalStorageWithServerId(tempBookId, serverBookId) {
  // Get local data
  const epubBlob = await localBookStorage.getEpub(tempBookId)
  const metadata = localBookStorage.getBookMetadata(tempBookId)
  const chapters = localBookStorage.getChapters(tempBookId)

  // Save with real server ID
  if (epubBlob) {
    await localBookStorage.saveEpub(serverBookId, epubBlob)
    await localBookStorage.deleteEpub(tempBookId) // Clean up temp
  }

  if (metadata) {
    metadata.id = serverBookId
    metadata.synced = true
    metadata.syncedAt = Date.now()
    localBookStorage.saveBookMetadata(serverBookId, metadata)
    localStorage.removeItem(`book_${tempBookId}`) // Clean up temp
  }

  if (chapters) {
    const updatedChapters = chapters.map(ch => ({
      ...ch,
      book_id: serverBookId,
      id: undefined // Let server assign real IDs
    }))
    localBookStorage.saveChapters(serverBookId, updatedChapters)
    localStorage.removeItem(`chapters_${tempBookId}`) // Clean up temp
  }
}
```

### Phase 3: Modified Reading Flow

```javascript
// src/components/workspace/ReadingCanvas.jsx
import { localBookStorage } from '../../lib/localBookStorage'

useEffect(() => {
  const loadEpub = async () => {
    if (!book?.id) return

    setLoading(true)
    setError(null)

    try {
      // ============================================
      // STEP 1: Check local storage FIRST
      // ============================================
      let epubBlob = await localBookStorage.getEpub(book.id)
      
      if (!epubBlob) {
        // ============================================
        // STEP 2: Only download if not in browser
        // ============================================
        if (!book?.epub_path) {
          throw new Error('No EPUB file available')
        }

        const { data, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.epub_path)

        if (downloadError || !data) {
          throw new Error(`Failed to download EPUB: ${downloadError?.message}`)
        }

        epubBlob = data
        
        // Cache it for next time
        await localBookStorage.saveEpub(book.id, epubBlob)
      }

      // Create blob URL (works with local or downloaded blob)
      const blobUrl = URL.createObjectURL(epubBlob)
      setEpubUrl(blobUrl)
      setLoading(false)
    } catch (err) {
      console.error('Error loading EPUB:', err)
      setError(err.message || 'Failed to load EPUB')
      setLoading(false)
    }
  }

  loadEpub()
}, [book?.id, book?.epub_path])
```

### Phase 4: Modified Workspace (Load from Local First)

```javascript
// src/components/Workspace.jsx
import { localBookStorage } from '../lib/localBookStorage'

useEffect(() => {
  const fetchBookData = async () => {
    if (!bookId) return

    setLoading(true)

    try {
      // ============================================
      // STEP 1: Check local storage FIRST
      // ============================================
      let bookData = localBookStorage.getBookMetadata(bookId)
      let chaptersData = localBookStorage.getChapters(bookId)

      // If found locally, use it immediately
      if (bookData) {
        setBook(bookData)
        if (chaptersData) {
          setChapters(chaptersData)
          if (chaptersData.length > 0 && !currentChapterId) {
            setCurrentChapterId(chaptersData[0].id)
          }
        }
        setLoading(false) // Show UI immediately!
      }

      // ============================================
      // STEP 2: Sync from server in background
      // ============================================
      // Fetch from database to get latest data
      const { data: dbBook } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single()

      if (dbBook) {
        // Update local storage with server data
        localBookStorage.saveBookMetadata(bookId, {
          ...dbBook,
          synced: true,
          syncedAt: Date.now()
        })
        
        // Update state if different
        if (!bookData || JSON.stringify(bookData) !== JSON.stringify(dbBook)) {
          setBook(dbBook)
        }
      }

      // Fetch chapters from server
      const { data: dbChapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookId)
        .order('chapter_index', { ascending: true })

      if (dbChapters && dbChapters.length > 0) {
        localBookStorage.saveChapters(bookId, dbChapters)
        
        // Update state if different
        if (!chaptersData || JSON.stringify(chaptersData) !== JSON.stringify(dbChapters)) {
          setChapters(dbChapters)
          if (dbChapters.length > 0 && !currentChapterId) {
            setCurrentChapterId(dbChapters[0].id)
          }
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error fetching book data:', err)
      setError(err.message || 'Failed to load book')
      setLoading(false)
    }
  }

  fetchBookData()
}, [bookId])
```

---

## Complete Flow Diagram

```
User picks file
    ↓
Extract client-side (epubService.js)
    ↓
Save to IndexedDB (EPUB blob)
Save to localStorage (metadata, chapters)
    ↓
RETURN IMMEDIATELY ✅ (User can read now!)
    ↓
[Background] Upload to Supabase
    ↓
[Background] Update local storage with server ID
    ↓
[When reading] Check IndexedDB first
    ↓
[If not found] Download from Supabase
    ↓
[After download] Cache in IndexedDB
```

---

## Benefits

### ✅ Instant Availability
- Book available immediately after file pick
- No waiting for upload
- Can read while uploading

### ✅ Offline Support
- Works completely offline after first upload
- No server dependency for reading

### ✅ Fast Reading
- EPUB loaded from IndexedDB (instant)
- No network delay

### ✅ Background Sync
- Upload doesn't block UI
- Sync happens in background
- User can continue working

### ✅ Resilience
- Works even if upload fails
- Local copy always available
- Can retry upload later

---

## Storage Strategy

| Data Type | Storage | Size Limit | Use Case |
|-----------|---------|------------|----------|
| **EPUB Blob** | IndexedDB | 100MB+ | Large files, persistent |
| **Book Metadata** | localStorage | 5-10MB | Small, fast access |
| **Chapters** | localStorage | 5-10MB | Small, fast access |
| **Reading Position** | localStorage | <1MB | Per-chapter CFI |
| **Questions/Reflections** | localStorage + DB | <1MB | Cache + sync |

---

## Implementation Checklist

- [ ] Create `localBookStorage.js` utility
- [ ] Modify `uploadBook()` to save locally first
- [ ] Add background upload function
- [ ] Update `ReadingCanvas` to check local first
- [ ] Update `Workspace` to load from local first
- [ ] Add sync status indicator
- [ ] Handle temp ID → server ID migration
- [ ] Add cleanup for old temp books
- [ ] Add error handling for failed uploads
- [ ] Add retry mechanism for failed uploads

---

## User Experience

### Upload Flow:
1. User picks file → **Instant feedback** ("Book ready!")
2. Book appears in library → **Can open immediately**
3. Upload happens in background → **No blocking**
4. Sync indicator shows status → **Transparent**

### Reading Flow:
1. Click book → **Instant load** (from IndexedDB)
2. Chapters appear → **Instant** (from localStorage)
3. Start reading → **No delay**
4. Background sync → **Updates if needed**

---

## This Matches Your Requirements!

✅ User picks file  
✅ Extract client-side  
✅ Save everything in browser  
✅ Everything available instantly  
✅ Upload in background  
✅ Only download if nothing in browser  

This is the **local-first architecture** pattern! 🎯
