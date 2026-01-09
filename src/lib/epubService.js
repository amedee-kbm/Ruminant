import ePub from 'epubjs'

/**
 * Extracts metadata and content from an EPUB file
 * @param {File} file - The EPUB file picked from the browser
 * @returns {Promise<Object>} An object containing cover, title, author, chapters, and rawToc
 *
 * To display the cover in HTML, use the returned cover URL directly in an img tag:
 * ```jsx
 * const { cover, title, author } = await extractEpubData(file)
 * // Then in your JSX:
 * <img src={cover} alt={title} />
 * ```
 *
 * Note: If book.coverUrl() doesn't work, you may need to fix epub.js library:
 * - Clone epub.js repository
 * - In book.js, uncomment line 661: return this.archive.createUrl(this.cover);
 * - Comment out line 662: // return this.resources.get(this.cover);
 */
export const extractEpubData = async (file) => {
  try {
    // Convert File to ArrayBuffer for epubjs compatibility
    const arrayBuffer = await file.arrayBuffer()
    const book = ePub(arrayBuffer)

    // Wait for the book to be ready with a timeout
    const readyPromise = book.ready
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('EPUB loading timed out after 15 seconds')), 15000)
    )

    await Promise.race([readyPromise, timeoutPromise])

    // Extract metadata
    const metadata = book.package.metadata
    const title = metadata.title || 'Untitled'
    const author = metadata.creator || metadata['dc:creator'] || 'Unknown Author'

    // Extract cover image
    let cover = null
    try {
      // Try using book.coverUrl() method first (requires epub.js library fix)
      // See: https://stackoverflow.com/questions/59725723/how-do-i-display-in-html-the-cover-of-an-epub-book-using-epub-js
      // Note: If coverUrl() doesn't work, you may need to fix epub.js by uncommenting line 661
      // and commenting line 662 in book.js: return this.archive.createUrl(this.cover);
      if (book.coverUrl && typeof book.coverUrl === 'function') {
        try {
          cover = await book.coverUrl()
        } catch (coverUrlError) {
          console.warn('book.coverUrl() failed, falling back to manual extraction:', coverUrlError)
          // Fall through to manual extraction
        }
      }

      // Fallback: Manual cover extraction if coverUrl() didn't work or doesn't exist
      if (!cover) {
        const coverId =
          metadata.cover ||
          book.package.manifest.find((item) => item.properties === 'cover-image')?.id
        if (coverId) {
          const coverItem = book.package.manifest[coverId]
          if (coverItem) {
            const coverBlob = await book.archive.getBlob(coverItem.href)
            // Convert blob to base64 data URL for more reliable display
            cover = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result)
              reader.onerror = () => resolve(URL.createObjectURL(coverBlob)) // Fallback to blob URL
              reader.readAsDataURL(coverBlob)
            })
          }
        } else {
          // Try to find cover in manifest by properties or common names
          const coverManifestItem = Object.values(book.package.manifest).find(
            (item) =>
              item.properties === 'cover-image' ||
              item.href?.toLowerCase().includes('cover') ||
              item.id?.toLowerCase().includes('cover')
          )
          if (coverManifestItem) {
            const coverBlob = await book.archive.getBlob(coverManifestItem.href)
            // Convert blob to base64 data URL for more reliable display
            cover = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result)
              reader.onerror = () => resolve(URL.createObjectURL(coverBlob)) // Fallback to blob URL
              reader.readAsDataURL(coverBlob)
            })
          }
        }
      }
    } catch (coverError) {
      console.warn('Could not extract cover image:', coverError)
      // Continue without cover
    }

    // Extract chapters from table of contents
    const chapters = []
    let rawToc = null
    try {
      const toc = book.navigation.toc || []

      // Store the raw TOC exactly as epubjs gives it
      rawToc = toc
      console.log('rawToc', rawToc)

      // Function to clean titles by removing prepended numbering
      const cleanTitle = (title) => {
        if (!title) return title
        // Remove common numbering patterns at the start:
        // - "1. ", "1.1. ", "1.1.1. " etc. (handles nested numbering)
        // - "Chapter 1: ", "Chapter 1.1: " etc.
        // - "1 ", "1.1 " etc.
        let cleaned = title.trim()

        // Match one or more "number." patterns followed by optional space
        // This handles: "1. ", "1.1. ", "1.1.1. ", etc.
        cleaned = cleaned.replace(/^(\d+\.)+\s*/, '')

        // Handle "Chapter X: " or "Chapter X. " patterns
        cleaned = cleaned.replace(/^Chapter\s+\d+[\.\s:]+/i, '')

        // Catch any remaining leading digits followed by space (like "1 ")
        cleaned = cleaned.replace(/^\d+\s+/, '')

        return cleaned.trim()
      }

      // Function to clean and normalize hrefs (remove whitespace, newlines, etc.)
      const cleanHref = (href) => {
        if (!href) return null
        // Remove all whitespace, newlines, and normalize
        return href.trim().replace(/\s+/g, '').replace(/\n/g, '')
      }

      // Function to check if a TOC entry is front/back matter (not a real chapter)
      const isFrontOrBackMatter = (title, href) => {
        if (!title) return false
        const lowerTitle = title.toLowerCase()
        const frontMatterKeywords = [
          'title',
          'copyright',
          'dedication',
          'acknowledgment',
          'acknowledgement',
          'preface',
          'introduction',
          'foreword',
          'table of contents',
          'toc',
          'cover',
          'half-title',
          'title page',
        ]
        const backMatterKeywords = [
          'endnote',
          'endnotes',
          'appendix',
          'glossary',
          'index',
          'bibliography',
          'references',
          'about the author',
          'colophon',
        ]

        const allKeywords = [...frontMatterKeywords, ...backMatterKeywords]
        return allKeywords.some((keyword) => lowerTitle.includes(keyword))
      }

      // Recursive function to extract subchapters
      const extractSubchapters = (subitems) => {
        if (!subitems || subitems.length === 0) {
          return []
        }

        return subitems
          .filter((subitem) => {
            // Filter out front/back matter
            const title = cleanTitle(subitem.label)
            return !isFrontOrBackMatter(title, subitem.href)
          })
          .map((subitem) => ({
            id: subitem.id || null,
            title: cleanTitle(subitem.label) || 'Untitled Subchapter',
            href: cleanHref(subitem.href),
            subchapters: extractSubchapters(subitem.subitems),
          }))
      }

      // Check if TOC has only one item with subitems - treat subitems as top-level
      let itemsToProcess = toc
      if (toc.length === 1 && toc[0].subitems && toc[0].subitems.length > 0) {
        // Use subitems as top-level chapters
        itemsToProcess = toc[0].subitems
      }

      // Extract main chapters and their subchapters
      // Filter out front/back matter and clean hrefs
      itemsToProcess
        .filter((item) => {
          // Filter out front/back matter
          const title = cleanTitle(item.label)
          return !isFrontOrBackMatter(title, item.href)
        })
        .forEach((item) => {
          const chapter = {
            id: item.id || null,
            title: cleanTitle(item.label) || 'Untitled Chapter',
            href: cleanHref(item.href),
          }

          // Add subchapters if they exist
          if (item.subitems && item.subitems.length > 0) {
            chapter.subchapters = extractSubchapters(item.subitems)
          }

          chapters.push(chapter)
        })
    } catch (chapterError) {
      console.warn('Could not extract chapters:', chapterError)
      // Return empty chapters array
    }

    console.log('chapters', chapters)

    return {
      cover,
      title,
      author,
      chapters,
      rawToc, // Raw TOC exactly as epubjs provides it
    }
  } catch (error) {
    console.error('Error extracting EPUB data:', error)
    throw new Error(`Failed to extract EPUB data: ${error.message}`)
  }
}
