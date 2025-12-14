import { useState, useEffect, useRef } from 'react'
import { Box, HStack, Text, Badge, Button, Spinner } from '@chakra-ui/react'
import { BookOpen, Check } from 'lucide-react'
import { ReactReader } from 'react-reader'
import supabase from '../../supabaseClient'

const ReadingCanvas = ({
  scheme,
  onAddReflection,
  onMarkDone,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  currentChapter,
  book,
  onAddQuestion,
  onChaptersExtracted, // New callback to pass chapters to parent
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [epubUrl, setEpubUrl] = useState(null)
  const [location, setLocation] = useState(null)
  const [toc, setToc] = useState([])
  const renditionRef = useRef(null)

  // Download EPUB and create blob URL
  useEffect(() => {
    const loadEpub = async () => {
      if (!book?.epub_path) {
        setEpubUrl(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Download EPUB file from storage
        const { data: epubBlob, error: downloadError } = await supabase.storage
          .from('books')
          .download(book.epub_path)

        if (downloadError || !epubBlob) {
          throw new Error(`Failed to download EPUB: ${downloadError?.message || 'Unknown error'}`)
        }

        // Create blob URL for react-reader
        const blobUrl = URL.createObjectURL(epubBlob)
        setEpubUrl(blobUrl)
        setLoading(false)

        // Cleanup function
        return () => {
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
          }
        }
      } catch (err) {
        console.error('Error loading EPUB:', err)
        setError(err.message || 'Failed to load EPUB')
        setLoading(false)
      }
    }

    loadEpub()
  }, [book?.epub_path])

  // Navigate to chapter when currentChapter changes
  useEffect(() => {
    if (currentChapter && toc.length > 0) {
      // Find the chapter in TOC by matching href/locator
      const findChapterInToc = (items, targetLocator) => {
        if (!targetLocator) return null
        
        // Normalize locator for comparison (remove whitespace, hash fragments)
        const normalize = (str) => str?.replace(/\s+/g, '').replace(/\n/g, '').split('#')[0].toLowerCase().trim()
        const normalizedTarget = normalize(targetLocator)
        
        for (const item of items) {
          if (item.href) {
            const normalizedHref = normalize(item.href)
            if (normalizedHref === normalizedTarget || 
                normalizedHref.includes(normalizedTarget) || 
                normalizedTarget.includes(normalizedHref)) {
              return item
            }
          }
          if (item.subitems) {
            const found = findChapterInToc(item.subitems, targetLocator)
            if (found) return found
          }
        }
        return null
      }

      const chapterInToc = findChapterInToc(toc, currentChapter.locator)
      if (chapterInToc && chapterInToc.href) {
        // Use the href from TOC to navigate - react-reader will convert to CFI
        console.log('Navigating to chapter from TOC:', chapterInToc.href)
        setLocation(chapterInToc.href)
      } else if (currentChapter.locator) {
        // Fallback: use the locator directly
        console.log('Navigating using locator directly:', currentChapter.locator)
        setLocation(currentChapter.locator)
      }
    }
  }, [currentChapter?.id, toc, currentChapter?.locator])

  // Handle TOC changes - extract chapters and pass to parent
  const handleTocChange = (tocData) => {
    console.log('TOC changed from react-reader:', tocData)
    setToc(tocData || [])

    // Extract chapters from TOC and pass to parent
    // react-reader's TOC structure matches epubjs: { label, href, subitems }
    if (tocData && onChaptersExtracted && tocData.length > 0) {
      const extractChapters = (items, index = { value: 0 }, parentTitle = '') => {
        const chapters = []
        for (const item of items) {
          // Only include items with hrefs (actual navigable content)
          if (item.href) {
            const title = item.label || `Chapter ${index.value + 1}`
            chapters.push({
              chapter_index: index.value++,
              title: title.trim(),
              locator: item.href.trim(), // Clean whitespace
            })
          }
          // Recursively process subitems
          if (item.subitems && item.subitems.length > 0) {
            chapters.push(...extractChapters(item.subitems, index, item.label))
          }
        }
        return chapters
      }

      const chapters = extractChapters(tocData)
      console.log(`Extracted ${chapters.length} chapters from react-reader TOC`)
      if (chapters.length > 0) {
        onChaptersExtracted(chapters)
      }
    }
  }

  // Handle location changes
  const handleLocationChange = (epubcfi) => {
    console.log('Location changed:', epubcfi)
    setLocation(epubcfi)
  }

  // Handle text selection for questions
  const handleSelection = (cfiRange, contents) => {
    if (!onAddQuestion) return

    try {
      const selection = contents.window.getSelection()
      const selectedText = selection.toString().trim()

      if (selectedText && selectedText.length > 0) {
        const questionText = prompt(
          `Create a question from this highlight:\n\n"${selectedText}"\n\nEnter your question:`
        )
        if (questionText && questionText.trim()) {
          onAddQuestion(questionText.trim(), selectedText)
        }
      }
    } catch (err) {
      console.warn('Error handling text selection:', err)
    }
  }

  if (loading) {
    return (
      <Box flex="1" borderRadius="lg" bg={scheme.canvasBg} p={6} display="flex" alignItems="center" justifyContent="center">
        <Spinner size="lg" color={scheme.accent} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box flex="1" borderRadius="lg" bg={scheme.canvasBg} p={6} display="flex" alignItems="center" justifyContent="center" flexDirection="column">
        <Text color="red.500" mb={4}>
          Error: {error}
        </Text>
      </Box>
    )
  }

  if (!epubUrl) {
    return (
      <Box flex="1" borderRadius="lg" bg={scheme.canvasBg} p={6} display="flex" alignItems="center" justifyContent="center">
        <Text color={scheme.placeholderText} opacity={0.7}>
          No EPUB file available
        </Text>
      </Box>
    )
  }

  return (
    <Box flex="1" borderRadius="lg" bg={scheme.canvasBg} p={6} position="relative" display="flex" flexDirection="column" overflow="hidden">
      <HStack mb={4} spacing={3}>
        <Box color={scheme.primaryText} display="inline-flex">
          <BookOpen size={18} />
        </Box>
        <Text fontWeight="semibold" color={scheme.primaryText}>
          {currentChapter?.title || 'Reading canvas'}
        </Text>
        <Badge colorScheme="blue">SQ3R · Read</Badge>
      </HStack>

      <Box
        flex="1"
        border={scheme.placeholderBorder}
        borderRadius="md"
        overflow="hidden"
        position="relative"
        minHeight="400px"
        bg={scheme.canvasBg}
        height="100%"
      >
        {epubUrl && (
          <ReactReader
            url={epubUrl}
            location={location}
            locationChanged={handleLocationChange}
            tocChanged={handleTocChange}
            showToc={false}
            readerStyles={{
              width: '100%',
              height: '100%',
            }}
            epubViewStyles={{
              width: '100%',
              height: '100%',
            }}
            getRendition={(rendition) => {
              renditionRef.current = rendition
              // Apply theme colors
              rendition.themes.default({
                body: {
                  color: scheme.primaryText,
                  background: scheme.canvasBg,
                },
              })
              // Handle text selection
              rendition.on('selected', handleSelection)
            }}
            epubOptions={{
              openAs: 'epub',
            }}
            epubInitOptions={{
              openAs: 'epub',
            }}
          />
        )}
      </Box>

      <HStack spacing={3} mt={4} justify="space-between">
        <HStack spacing={2}>
          <Badge colorScheme="yellow">Survey</Badge>
          <Badge colorScheme="green">Question</Badge>
          <Badge colorScheme="purple">Recite</Badge>
          <Badge colorScheme="teal">Review</Badge>
        </HStack>
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onPrevious}
            color={scheme.primaryText}
            isDisabled={!hasPrevious}
          >
            ← Previous
          </Button>
          <Button
            size="sm"
            bg={scheme.accent}
            _hover={{ bg: scheme.accentHover }}
            color={scheme.id === 'clean' ? 'white' : 'black'}
            onClick={onNext}
            isDisabled={!hasNext}
          >
            Next →
          </Button>
        </HStack>
      </HStack>
      <HStack spacing={4} mt={4}>
        <Button
          flex="1"
          variant="outline"
          onClick={onAddReflection}
          color={scheme.primaryText}
          borderColor={scheme.chapterBorder}
        >
          Add Reflection
        </Button>
        <Button
          flex="1"
          leftIcon={<Check size={16} />}
          bg={scheme.accent}
          _hover={{ bg: scheme.accentHover }}
          color={scheme.id === 'clean' ? 'white' : 'black'}
          onClick={onMarkDone}
        >
          Mark chapter done
        </Button>
      </HStack>
    </Box>
  )
}

export default ReadingCanvas
