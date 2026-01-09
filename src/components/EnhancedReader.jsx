import React, { useState, useRef, useEffect } from 'react'
import { ReactReader } from 'react-reader'
import { Box, Button, Text, HStack, Badge } from '@chakra-ui/react'
import { BookOpen, Check } from 'lucide-react'
import supabase from '../supabaseClient'
import useAuth from '../hooks/useAuth'

/**
 * Enhanced Reader component built on react-reader
 * Supports all features from context.md:
 * - Chapter extraction from TOC
 * - Text selection for questions/reflections
 * - Location tracking
 * - Integration with database
 */
const EnhancedReader = ({
  bookId,
  currentChapterId,
  onChaptersExtracted,
  onAddQuestion,
  onAddReflection,
}) => {
  const { user } = useAuth()
  const [location, setLocation] = useState(0)
  const [toc, setToc] = useState([])
  const [book, setBook] = useState(null)
  const [epubUrl, setEpubUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const renditionRef = useRef(null)
  const bookRef = useRef(null)

  // Load book data and EPUB URL
  useEffect(() => {
    const loadBook = async () => {
      if (!bookId) return

      try {
        setLoading(true)

        // Fetch book from database
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single()

        if (bookError) throw bookError
        setBook(bookData)

        // Get public URL for EPUB
        if (bookData.epub_path) {
          const { data: urlData } = supabase.storage.from('books').getPublicUrl(bookData.epub_path)

          if (urlData?.publicUrl) {
            setEpubUrl(urlData.publicUrl)
          }
        }
      } catch (err) {
        console.error('Error loading book:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBook()
  }, [bookId])

  // Handle TOC changes - extract chapters
  const handleTocChange = async (tocData) => {
    console.log('[EnhancedReader] TOC changed:', tocData)
    setToc(tocData || [])

    if (tocData && tocData.length > 0 && onChaptersExtracted && bookId && user) {
      try {
        // Map TOC items to chapter format
        const chapters = tocData.map((tocItem, index) => ({
          book_id: bookId,
          chapter_index: index,
          title: tocItem.label?.trim() || `Chapter ${index + 1}`,
          locator: tocItem.href?.trim() || '',
          user_id: user.id,
        }))

        // Check if chapters already exist
        const { data: existingChapters } = await supabase
          .from('chapters')
          .select('id, chapter_index')
          .eq('book_id', bookId)

        const existingIndices = new Set(existingChapters?.map((ch) => ch.chapter_index) || [])

        // Only insert new chapters
        const newChapters = chapters.filter((ch) => !existingIndices.has(ch.chapter_index))

        if (newChapters.length > 0) {
          const { data: insertedChapters, error } = await supabase
            .from('chapters')
            .insert(newChapters)
            .select()

          if (error) {
            console.error('Error inserting chapters:', error)
          } else if (insertedChapters) {
            console.log(`[EnhancedReader] Inserted ${insertedChapters.length} new chapters`)
            // Merge with existing chapters
            const allChapters = [...(existingChapters || []), ...insertedChapters]
            onChaptersExtracted(allChapters)
          }
        } else {
          // All chapters exist, just pass them to parent
          onChaptersExtracted(existingChapters || [])
        }
      } catch (err) {
        console.error('Error processing chapters:', err)
      }
    }
  }

  // Get rendition object for text selection
  const handleGetRendition = (rendition) => {
    console.log('[EnhancedReader] Rendition available:', rendition)
    renditionRef.current = rendition

    if (!rendition) return

    // Enable text selection highlighting
    rendition.on('selected', (cfiRange, contents) => {
      handleTextSelection(cfiRange, contents)
    })

    // Alternative: Listen for mouseup events for selection
    rendition.on('mouseup', () => {
      const selection = contents?.window?.getSelection?.() || window.getSelection()
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim()
        const cfiRange = rendition.getRange(selection.getRangeAt(0))
        handleTextSelection(cfiRange?.toString(), contents, selectedText)
      }
    })
  }

  // Handle text selection for questions/reflections
  const handleTextSelection = (cfiRange, contents, selectedText = null) => {
    if (!cfiRange || !onAddQuestion) return

    try {
      // Get selected text if not provided
      let text = selectedText
      if (!text && contents) {
        const selection = contents.window?.getSelection?.() || window.getSelection()
        text = selection?.toString().trim() || ''
      }

      if (!text || text.length === 0) return

      // Prompt user to create a question from selection
      const questionText = prompt(
        `Create a question from this highlight:\n\n"${text}"\n\nEnter your question:`
      )

      if (questionText && questionText.trim() && currentChapterId && user) {
        // Create question in database
        const question = {
          chapter_id: currentChapterId,
          question_text: questionText.trim(),
          cfi: cfiRange,
          highlight_text: text,
          source: 'selection',
          user_id: user.id,
        }

        onAddQuestion(question)
      }
    } catch (err) {
      console.error('Error handling text selection:', err)
    }
  }

  // Handle location changes
  const handleLocationChange = (epubcfi) => {
    setLocation(epubcfi)
    // Optionally save progress to database
    if (bookId && currentChapterId && user) {
      // Could update chapter's last_read_location here
      console.log('[EnhancedReader] Location changed:', epubcfi)
    }
  }

  if (loading) {
    return (
      <Box height="100vh" display="flex" alignItems="center" justifyContent="center">
        <Text>Loading book...</Text>
      </Box>
    )
  }

  if (!epubUrl) {
    return (
      <Box height="100vh" display="flex" alignItems="center" justifyContent="center">
        <Text>No EPUB file available</Text>
      </Box>
    )
  }

  return (
    <Box height="100vh" display="flex" flexDirection="column" bg="gray.50">
      {/* Header */}
      <HStack p={4} borderBottom="1px" borderColor="gray.200" bg="white">
        <BookOpen size={18} />
        <Text fontWeight="semibold">{book?.title || 'Reading'}</Text>
        <Badge colorScheme="blue">SQ3R · Read</Badge>
      </HStack>

      {/* Reader */}
      <Box flex="1" position="relative" overflow="hidden">
        <ReactReader
          url={epubUrl}
          location={location}
          locationChanged={handleLocationChange}
          tocChanged={handleTocChange}
          getRendition={handleGetRendition}
          showToc={true}
          epubOptions={{
            flow: 'paginated',
            allowPopups: true,
            allowScriptedContent: true,
          }}
          readerStyles={{
            height: '100%',
          }}
        />
      </Box>

      {/* Action buttons */}
      <HStack p={4} borderTop="1px" borderColor="gray.200" bg="white" spacing={4}>
        <Button flex="1" variant="outline" onClick={() => onAddReflection && onAddReflection()}>
          Add Reflection
        </Button>
        <Button flex="1" leftIcon={<Check size={16} />} colorScheme="blue">
          Mark chapter done
        </Button>
      </HStack>
    </Box>
  )
}

export default EnhancedReader
