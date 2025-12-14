# EPUB Loading Optimization Strategies

## Current Problem

Every time a book is opened:
1. **Download entire EPUB** from Supabase storage (~1-10MB per book)
2. **Create blob URL** from downloaded blob
3. **Load into react-reader** and extract TOC
4. **No caching** - downloads every time

**Result:** Slow initial load, especially on slower connections

---

## Optimization Strategies

### Strategy 1: **IndexedDB Caching** ⭐ (Recommended)

**Best for:** Large files, persistent storage, offline support

**How it works:**
- Store EPUB blob in IndexedDB (can handle 100MB+ files)
- Check cache first before downloading
- Download only if cache miss or expired
- Works offline after first load

**Implementation:**
```javascript
// Create a cache utility
class EpubCache {
  constructor() {
    this.dbName = 'ruminant-epub-cache'
    this.storeName = 'epubs'
    this.db = null
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'bookId' })
        }
      }
    })
  }

  async get(bookId) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(bookId)
      
      request.onsuccess = () => {
        const result = request.result
        if (result && result.blob) {
          // Check if cache is still valid (e.g., 30 days)
          const age = Date.now() - result.cachedAt
          if (age < 30 * 24 * 60 * 60 * 1000) {
            resolve(result.blob)
            return
          }
        }
        resolve(null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async set(bookId, blob) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put({
        bookId,
        blob,
        cachedAt: Date.now()
      })
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async delete(bookId) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(bookId)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// Use in ReadingCanvas.jsx
const epubCache = new EpubCache()

useEffect(() => {
  const loadEpub = async () => {
    if (!book?.epub_path || !book?.id) return

    setLoading(true)
    setError(null)

    try {
      // 1. Check cache first
      let epubBlob = await epubCache.get(book.id)
      
      if (!epubBlob) {
        // 2. Download from Supabase if not cached
        const { data, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.epub_path)

        if (downloadError || !data) {
          throw new Error(`Failed to download EPUB: ${downloadError?.message}`)
        }

        epubBlob = data
        
        // 3. Cache for next time
        await epubCache.set(book.id, epubBlob)
      }

      // 4. Create blob URL (works with cached or fresh blob)
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
}, [book?.epub_path, book?.id])
```

**Benefits:**
- ✅ Instant load after first download
- ✅ Works offline
- ✅ Handles large files (100MB+)
- ✅ Persistent across sessions
- ✅ Automatic cache management

**Storage:** ~5-10MB per book (depends on EPUB size)

---

### Strategy 2: **Service Worker Caching**

**Best for:** Network-level caching, automatic cache management

**How it works:**
- Service worker intercepts network requests
- Caches EPUB files automatically
- Serves from cache when available
- Updates cache in background

**Implementation:**
```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/storage/v1/object/public/books/')) {
    event.respondWith(
      caches.open('epub-cache-v1').then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response // Serve from cache
          }
          
          // Fetch and cache
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone())
            return response
          })
        })
      })
    )
  }
})
```

**Benefits:**
- ✅ Automatic caching
- ✅ Works for all storage requests
- ✅ Background updates
- ✅ No code changes needed in components

**Limitations:**
- Requires service worker setup
- Cache size limits (browser-dependent)
- More complex to manage

---

### Strategy 3: **Prefetching**

**Best for:** Books user is likely to open next

**How it works:**
- Pre-download books when user views library
- Cache in IndexedDB
- Ready when user opens book

**Implementation:**
```javascript
// In BooksCollection.jsx or Home.jsx
useEffect(() => {
  const prefetchBooks = async () => {
    const { data: books } = await supabase.from('books').select('id, epub_path')
    
    // Prefetch first 3 books (or recently opened)
    const booksToPrefetch = books.slice(0, 3)
    
    for (const book of booksToPrefetch) {
      // Check if already cached
      const cached = await epubCache.get(book.id)
      if (!cached) {
        // Prefetch in background
        supabase.storage
          .from('books')
          .download(book.epub_path)
          .then(({ data }) => {
            if (data) {
              epubCache.set(book.id, data)
            }
          })
          .catch(console.error)
      }
    }
  }
  
  prefetchBooks()
}, [])
```

**Benefits:**
- ✅ Books ready instantly
- ✅ Better UX
- ✅ Background loading

**Considerations:**
- Uses bandwidth
- Only prefetch likely candidates

---

### Strategy 4: **Lazy Loading / Progressive Loading**

**Best for:** Faster perceived load time

**How it works:**
- Load metadata first (fast)
- Show book structure immediately
- Load EPUB content in background
- Load chapters on-demand

**Implementation:**
```javascript
// Load in stages
const loadEpubProgressive = async () => {
  // Stage 1: Load metadata (already have from DB)
  setBookMetadata(book)
  
  // Stage 2: Load chapters from cache/DB (fast)
  const cachedChapters = localStorage.getItem(`chapters_${book.id}`)
  if (cachedChapters) {
    setChapters(JSON.parse(cachedChapters))
  }
  
  // Stage 3: Load EPUB in background
  const epubBlob = await epubCache.get(book.id) || await downloadEpub()
  
  // Stage 4: Extract TOC and update
  const toc = await extractToc(epubBlob)
  setToc(toc)
}
```

**Benefits:**
- ✅ Faster perceived load
- ✅ UI appears quickly
- ✅ Content loads progressively

---

### Strategy 5: **Compression**

**Best for:** Reducing download size

**How it works:**
- Compress EPUBs before upload (if not already compressed)
- Use gzip/brotli compression
- Decompress on client

**Note:** EPUBs are already ZIP files, so additional compression may not help much.

---

### Strategy 6: **Signed URLs with Browser Cache**

**Best for:** Leveraging browser's native cache

**How it works:**
- Use Supabase signed URLs (long expiry)
- Browser caches automatically
- Reuse same URL

**Implementation:**
```javascript
// Get signed URL (cache for 30 days)
const getEpubUrl = async (book) => {
  const cacheKey = `epub_url_${book.id}`
  const cached = localStorage.getItem(cacheKey)
  
  if (cached) {
    const { url, expiresAt } = JSON.parse(cached)
    if (Date.now() < expiresAt) {
      return url // Use cached URL
    }
  }
  
  // Generate new signed URL
  const { data, error } = await supabase.storage
    .from('books')
    .createSignedUrl(book.epub_path, 30 * 24 * 60 * 60) // 30 days
  
  if (data?.signedUrl) {
    localStorage.setItem(cacheKey, JSON.stringify({
      url: data.signedUrl,
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
    }))
    return data.signedUrl
  }
}

// Use signed URL directly (browser caches automatically)
const epubUrl = await getEpubUrl(book)
setEpubUrl(epubUrl) // No blob needed!
```

**Benefits:**
- ✅ Browser handles caching
- ✅ No blob management
- ✅ Simpler code

**Limitations:**
- Requires public or signed URLs
- Less control over cache

---

### Strategy 7: **Streaming / Chunked Loading**

**Best for:** Very large EPUBs

**How it works:**
- Load EPUB in chunks
- Start reading before full download
- Load remaining in background

**Note:** EPUB format doesn't support streaming well, but you could:
- Load first chapter immediately
- Load rest in background

---

## Recommended Combined Approach

### **Primary: IndexedDB + Prefetching**

```javascript
// 1. Create EpubCache utility (IndexedDB)
// 2. Check cache first in ReadingCanvas
// 3. Prefetch books in library view
// 4. Add cache management (cleanup old books)
```

### **Secondary: Progressive Loading**

```javascript
// 1. Show cached chapters immediately
// 2. Load EPUB in background
// 3. Update UI when ready
```

### **Tertiary: Service Worker** (Optional)

```javascript
// For automatic network-level caching
// Less control but works everywhere
```

---

## Implementation Priority

### Phase 1: IndexedDB Caching (Biggest Win)
- ✅ Create `EpubCache` utility
- ✅ Integrate into `ReadingCanvas`
- ✅ Instant load after first download

**Impact:** 90% faster on subsequent loads

### Phase 2: Prefetching
- ✅ Prefetch books in library
- ✅ Background downloads
- ✅ Better UX

**Impact:** Instant load for prefetched books

### Phase 3: Progressive Loading
- ✅ Show metadata/chapters first
- ✅ Load EPUB in background
- ✅ Faster perceived load

**Impact:** Better perceived performance

### Phase 4: Cache Management
- ✅ Cleanup old books
- ✅ Size limits
- ✅ User controls

**Impact:** Better resource management

---

## Performance Comparison

| Strategy | First Load | Subsequent Loads | Offline | Complexity |
|----------|-----------|-------------------|---------|------------|
| **Current** | 2-10s | 2-10s | ❌ | Low |
| **IndexedDB** | 2-10s | <100ms | ✅ | Medium |
| **IndexedDB + Prefetch** | 2-10s | <100ms | ✅ | Medium |
| **Service Worker** | 2-10s | <500ms | ✅ | High |
| **Signed URLs** | 2-10s | <500ms | ⚠️ | Low |

---

## Code Example: Complete Solution

```javascript
// src/lib/epubCache.js
export class EpubCache {
  // ... (implementation from Strategy 1)
}

// src/components/workspace/ReadingCanvas.jsx
import { EpubCache } from '../../lib/epubCache'

const epubCache = new EpubCache()

useEffect(() => {
  const loadEpub = async () => {
    if (!book?.epub_path || !book?.id) return

    setLoading(true)
    
    try {
      // 1. Check IndexedDB cache
      let epubBlob = await epubCache.get(book.id)
      
      if (!epubBlob) {
        // 2. Download if not cached
        const { data, error } = await supabase.storage
          .from('books')
          .download(book.epub_path)
        
        if (error || !data) throw error
        
        epubBlob = data
        await epubCache.set(book.id, epubBlob) // Cache it
      }
      
      // 3. Create blob URL
      const blobUrl = URL.createObjectURL(epubBlob)
      setEpubUrl(blobUrl)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }
  
  loadEpub()
}, [book?.id, book?.epub_path])
```

---

## Summary

**Best Solution:** IndexedDB caching + Prefetching

**Why:**
- ✅ 90% faster subsequent loads
- ✅ Works offline
- ✅ Handles large files
- ✅ Reasonable complexity
- ✅ Great UX

**Next Steps:**
1. Implement `EpubCache` utility
2. Integrate into `ReadingCanvas`
3. Add prefetching in library view
4. Add cache management

This will make book loading **nearly instant** after the first download! 🚀
