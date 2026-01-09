import { useState, useEffect, useRef } from 'react'
import { Box, HStack, Text, Badge, Button, Spinner } from '@chakra-ui/react'
import { BookOpen, Check } from 'lucide-react'
import { EpubViewer } from 'react-epub-viewer'
import supabase from '../../supabaseClient'
import ErrorBoundary from './ErrorBoundary'

// Global error logger
const logError = (context, error, additionalInfo = {}) => {
  console.error(`[ReadingCanvas Error - ${context}]`, {
    error,
    errorMessage: error?.message,
    errorStack: error?.stack,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
  })
}

const ReadingCanvas = ({
  scheme,
  onAddReflection,
  onMarkDone,
  // Removed onPrevious, onNext, hasPrevious, hasNext - using built-in navigation
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
  const [viewerReady, setViewerReady] = useState(false)
  const viewerRef = useRef(null)

  // Set up global error handlers
  useEffect(() => {
    // Catch unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      logError('Unhandled Promise Rejection', event.reason, {
        promise: event.promise,
      })
    }

    // Catch unhandled errors
    const handleError = (event) => {
      logError('Global Error', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Log all console errors related to EPUB
    const originalError = console.error
    const enhancedError = (...args) => {
      originalError.apply(console, args)
      const errorString = args[0]?.toString() || ''
      if (
        errorString.includes('react-epub-viewer') ||
        errorString.includes('EpubViewer') ||
        errorString.includes('epub') ||
        errorString.includes('epubjs')
      ) {
        console.error('[EPUB Viewer Error]', ...args)
      }
    }
    console.error = enhancedError

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      console.error = originalError
    }
  }, [])

  // Download EPUB and create blob URL
  useEffect(() => {
    const loadEpub = async () => {
      try {
        console.log('[ReadingCanvas] Starting EPUB load', {
          bookPath: book?.epub_path,
          bookId: book?.id,
        })

        if (!book?.epub_path) {
          console.warn('[ReadingCanvas] No epub_path found', { book })
          setEpubUrl(null)
          return
        }

        setLoading(true)
        setError(null)

        console.log('[ReadingCanvas] Getting public URL from storage...')
        // Get public URL from Supabase storage (books are now publicly accessible)
        const { data: urlData } = supabase.storage.from('books').getPublicUrl(book.epub_path)

        if (!urlData?.publicUrl) {
          logError('EPUB URL', new Error('No public URL returned'), { bookPath: book.epub_path })
          throw new Error('Failed to get public URL for EPUB')
        }

        const publicUrl = urlData.publicUrl
        console.log('[ReadingCanvas] Got public URL', {
          publicUrl,
          bookPath: book.epub_path,
        })

        setEpubUrl(publicUrl)
        setLoading(false)
      } catch (err) {
        logError('EPUB Load', err, { bookPath: book?.epub_path, bookId: book?.id })
        setError(err.message || 'Failed to load EPUB')
        setLoading(false)
      }
    }

    loadEpub()
  }, [book?.epub_path])

  // Removed custom chapter navigation - using react-epub-viewer's built-in navigation UI
  // The viewer will handle all navigation through its built-in controls

  // Handle TOC changes - extract chapters and pass to parent
  // tocChanged receives Toc[] where Toc = { label: string, href: string }
  const handleTocChange = (tocData) => {
    try {
      console.log('[ReadingCanvas] TOC changed from react-epub-viewer:', tocData)
      setToc(tocData || [])

      // Viewer is ready when TOC is loaded
      if (tocData && tocData.length > 0 && !viewerReady) {
        console.log('[ReadingCanvas] Viewer is now ready', { tocCount: tocData.length })
        setViewerReady(true)
      }

      // Extract chapters from TOC and pass to parent
      // react-epub-viewer's TOC structure: Toc[] = [{ label, href }, ...]
      if (tocData && onChaptersExtracted && tocData.length > 0) {
        const chapters = tocData.map((tocItem, index) => ({
          chapter_index: index,
          title: tocItem.label?.trim() || `Chapter ${index + 1}`,
          locator: tocItem.href?.trim() || '',
        }))

        console.log(
          `[ReadingCanvas] Extracted ${chapters.length} chapters from react-epub-viewer TOC`,
          chapters
        )
        if (chapters.length > 0) {
          try {
            onChaptersExtracted(chapters)
          } catch (err) {
            logError('onChaptersExtracted callback', err, { chapters })
          }
        }
      }
    } catch (err) {
      logError('handleTocChange', err, { tocData })
    }
  }

  // Handle page changes
  // pageChanged receives a Page object: { chapterName, currentPage, totalPage, startCfi, endCfi, base }
  const handlePageChange = (page) => {
    try {
      console.log('[ReadingCanvas] Page changed:', page)
      if (page?.startCfi) {
        setLocation(page.startCfi)
        console.log('[ReadingCanvas] Location updated to:', page.startCfi)
      }
    } catch (err) {
      logError('handlePageChange', err, { page })
    }
  }

  // Removed handleLocationChange - EpubViewer doesn't have locationChanged callback
  // Location tracking is handled via pageChanged callback

  // Log render state - MUST be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    console.log('[ReadingCanvas] Render state:', {
      loading,
      error,
      hasEpubUrl: !!epubUrl,
      viewerReady,
      tocCount: toc.length,
      currentChapter: currentChapter?.title,
      hasBook: !!book,
    })
  }, [loading, error, epubUrl, viewerReady, toc.length, currentChapter?.title, book])

  if (loading) {
    return (
      <Box
        flex="1"
        borderRadius="lg"
        bg={scheme.canvasBg}
        p={6}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color={scheme.accent} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box
        flex="1"
        borderRadius="lg"
        bg={scheme.canvasBg}
        p={6}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Text color="red.500" mb={4}>
          Error: {error}
        </Text>
      </Box>
    )
  }

  if (!epubUrl) {
    return (
      <Box
        flex="1"
        borderRadius="lg"
        bg={scheme.canvasBg}
        p={6}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text color={scheme.placeholderText} opacity={0.7}>
          No EPUB file available
        </Text>
      </Box>
    )
  }

  return (
    <ErrorBoundary>
      <Box
        flex="1"
        borderRadius="lg"
        bg={scheme.canvasBg}
        p={6}
        position="relative"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
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
          display="flex"
          flexDirection="column"
        >
          {epubUrl && (
            <Box width="100%" height="100%" flex="1" position="relative">
              {(() => {
                try {
                  console.log('[ReadingCanvas] Rendering EpubViewer', {
                    epubUrl,
                    hasRef: !!viewerRef.current,
                    viewerReady,
                    scheme: scheme.id,
                  })

                  return (
                    <EpubViewer
                      ref={(ref) => {
                        console.log('[ReadingCanvas] EpubViewer ref callback', { ref: !!ref })
                        viewerRef.current = ref
                        if (ref) {
                          console.log('[ReadingCanvas] Viewer ref methods available:', {
                            hasPrevPage: typeof ref.prevPage === 'function',
                            hasNextPage: typeof ref.nextPage === 'function',
                            hasSetLocation: typeof ref.setLocation === 'function',
                          })
                        }
                      }}
                      url={epubUrl}
                      epubFileOptions={{
                        openAs: 'epub',
                      }}
                      tocChanged={handleTocChange}
                      pageChanged={handlePageChange}
                      selectionChanged={(cfiRange, contents) => {
                        try {
                          console.log('[ReadingCanvas] Selection changed', {
                            cfiRange,
                            hasContents: !!contents,
                          })
                          // Handle text selection for questions
                          // selectionChanged receives: (cfiRange: string, contents: Contents)
                          if (!onAddQuestion) return
                          const selection =
                            contents?.window?.getSelection?.() || window.getSelection()
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
                          logError('selectionChanged', err, { cfiRange, hasContents: !!contents })
                        }
                      }}
                      bookChanged={(book) => {
                        console.log('[ReadingCanvas] Book changed', { book: !!book })
                      }}
                      rendtionChanged={(rendition) => {
                        console.log('[ReadingCanvas] Rendition changed', { rendition: !!rendition })
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: scheme.canvasBg,
                        color: scheme.primaryText,
                      }}
                      epubOptions={{
                        flow: 'paginated',
                        allowPopups: true,
                        allowScriptedContent: true,
                      }}
                    />
                  )
                } catch (err) {
                  logError('EpubViewer Render', err, { epubUrl })
                  return (
                    <Box p={4} color="red.500">
                      <Text>Error rendering viewer: {err.message}</Text>
                    </Box>
                  )
                }
              })()}
            </Box>
          )}
        </Box>

        <HStack spacing={3} mt={4} justify="flex-start">
          {/* Removed custom navigation buttons - using react-epub-viewer's built-in navigation */}
          <HStack spacing={2}>
            <Badge colorScheme="yellow">Survey</Badge>
            <Badge colorScheme="green">Question</Badge>
            <Badge colorScheme="purple">Recite</Badge>
            <Badge colorScheme="teal">Review</Badge>
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
    </ErrorBoundary>
  )
}

export default ReadingCanvas
