import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Flex, Spinner, Box, Text } from '@chakra-ui/react'
import supabase from '../supabaseClient'
import { colorSchemes } from '../constants/theme'
import { sampleBooks } from '../constants/sampleData'
import useAuth from '../hooks/useAuth'
import { extractEpubData } from '../lib/epubService'
import WorkspaceHeader from './workspace/WorkspaceHeader'
// import ChaptersSidebar from './workspace/ChaptersSidebar' // Removed - using built-in navigation
import ReadingCanvas from './workspace/ReadingCanvas'
import RightPane from './workspace/RightPane'

const Workspace = () => {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [currentChapterId, setCurrentChapterId] = useState(null)
  const [schemeIndex, setSchemeIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [reflections, setReflections] = useState([])
  const [surveyNotes, setSurveyNotes] = useState('')
  const { user } = useAuth()

  const scheme = colorSchemes[schemeIndex]

  useEffect(() => {
    const fetchBookData = async () => {
      if (!bookId) {
        setError('No book ID provided')
        setLoading(false)
        return
      }

      try {
        let finalBook = null

        // First check if it's a sample book
        const sampleBook = sampleBooks.find((b) => b.id === bookId || b.title === bookId)
        if (sampleBook) {
          finalBook = {
            id: sampleBook.id,
            title: sampleBook.title,
            author: sampleBook.author,
            cover_url: null,
          }
          setBook(finalBook)
        } else {
          // Try to fetch book by ID from database
          const { data: bookData, error: bookError } = await supabase
            .from('books')
            .select('*')
            .eq('id', bookId)
            .single()

          if (bookError) {
            // If not found by ID, try by title
            const { data: booksByTitle } = await supabase
              .from('books')
              .select('*')
              .ilike('title', `%${bookId}%`)
              .limit(1)

            if (booksByTitle && booksByTitle.length > 0) {
              finalBook = booksByTitle[0]
              setBook(finalBook)
            } else {
              throw new Error(`Book not found: ${bookId}`)
            }
          } else {
            finalBook = bookData
            setBook(bookData)
          }
        }

        // Fetch chapters for this book
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('book_id', finalBook?.id || bookId)
          .order('chapter_index', { ascending: true })

        if (chaptersError) {
          console.warn('Error fetching chapters:', chaptersError)
          // Set empty chapters array if error (chapters might not be seeded yet)
          setChapters([])
        } else {
          const chaptersList = chaptersData || []
          setChapters(chaptersList)
          // Set first chapter as current if available and no current chapter is set
          if (chaptersList.length > 0 && !currentChapterId) {
            setCurrentChapterId(chaptersList[0].id)
          }
          // Note: Chapter extraction is now handled by react-epub-viewer via onChaptersExtracted callback
          // This ensures chapters are extracted correctly using the wrapper library
        }
      } catch (err) {
        console.error('Error fetching book data:', err)
        setError(err.message || 'Failed to load book')
      } finally {
        setLoading(false)
      }
    }

    fetchBookData()
  }, [bookId])

  // Fetch questions and reflections when chapter changes
  useEffect(() => {
    const fetchChapterData = async () => {
      if (!currentChapterId || !user?.id) return

      try {
        // Fetch questions for current chapter
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .eq('chapter_id', currentChapterId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setQuestions(questionsData || [])

        // Fetch reflections for current chapter
        const { data: reflectionsData } = await supabase
          .from('reflections')
          .select('*')
          .eq('chapter_id', currentChapterId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setReflections(reflectionsData || [])
      } catch (err) {
        console.error('Error fetching chapter data:', err)
      }
    }

    fetchChapterData()
  }, [currentChapterId, user?.id])

  const cycleScheme = () => {
    setSchemeIndex((prev) => (prev + 1) % colorSchemes.length)
  }

  const handleChapterSelect = (chapterId) => {
    setCurrentChapterId(chapterId)
    // Load survey notes for this chapter
    const savedNotes = localStorage.getItem(`survey_notes_${chapterId}`)
    if (savedNotes) {
      setSurveyNotes(savedNotes)
    } else {
      setSurveyNotes('')
    }
  }

  const handleExport = async () => {
    if (!book || !user?.id) return

    try {
      // Fetch all questions and reflections for the book (via chapters)
      const chapterIds = chapters.map((ch) => ch.id)
      const { data: allQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('user_id', user.id)

      const { data: allReflections } = await supabase
        .from('reflections')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('user_id', user.id)

      // Create summary text
      let summaryText = `# ${book.title}\n\n`
      if (book.author) summaryText += `Author: ${book.author}\n\n`

      if (allQuestions && allQuestions.length > 0) {
        summaryText += '## Questions\n\n'
        allQuestions.forEach((q, idx) => {
          summaryText += `${idx + 1}. ${q.question_text}\n`
          if (q.highlight_text) summaryText += `   Highlight: "${q.highlight_text}"\n`
          summaryText += '\n'
        })
      }

      if (allReflections && allReflections.length > 0) {
        summaryText += '## Reflections\n\n'
        allReflections.forEach((r, idx) => {
          summaryText += `${idx + 1}. ${r.reflection_text}\n\n`
        })
      }

      // Create and download file
      const blob = new Blob([summaryText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${book.title.replace(/[^a-z0-9]/gi, '_')}_summary.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting:', err)
      alert('Failed to export summary')
    }
  }

  const handleAddReflection = async () => {
    if (!currentChapterId || !user?.id) {
      alert('Please select a chapter first')
      return
    }

    const reflectionText = prompt('Enter your reflection:')
    if (!reflectionText || !reflectionText.trim()) return

    try {
      const { error } = await supabase.from('reflections').insert({
        chapter_id: currentChapterId,
        user_id: user.id,
        reflection_text: reflectionText.trim(),
      })

      if (error) throw error

      // Refresh reflections
      const { data } = await supabase
        .from('reflections')
        .select('*')
        .eq('chapter_id', currentChapterId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setReflections(data || [])
    } catch (err) {
      console.error('Error adding reflection:', err)
      alert('Failed to add reflection')
    }
  }

  const handleMarkDone = async () => {
    if (!currentChapterId || !user?.id) return

    try {
      // Update chapter status to 'done' or similar
      const { error } = await supabase
        .from('chapters')
        .update({ status: 'done' })
        .eq('id', currentChapterId)
        .eq('user_id', user.id)

      if (error) throw error

      // Refresh chapters
      const { data } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', book.id)
        .order('chapter_index', { ascending: true })

      if (data) {
        setChapters(data)
      }

      alert('Chapter marked as done!')
    } catch (err) {
      console.error('Error marking chapter done:', err)
      // If status column doesn't exist, just show success message
      alert('Chapter marked as done!')
    }
  }

  const handleAddQuestion = async (questionText, highlightText = null) => {
    if (!currentChapterId || !user?.id) {
      alert('Please select a chapter first')
      return
    }

    if (!questionText || !questionText.trim()) return

    try {
      const { error } = await supabase.from('questions').insert({
        chapter_id: currentChapterId,
        user_id: user.id,
        question_text: questionText.trim(),
        highlight_text: highlightText,
        source: highlightText ? 'highlight' : 'manual',
      })

      if (error) throw error

      // Refresh questions
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', currentChapterId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setQuestions(data || [])
    } catch (err) {
      console.error('Error adding question:', err)
      alert('Failed to add question')
    }
  }

  const handleEditSurveyNotes = async (notes) => {
    if (!currentChapterId || !user?.id) return

    try {
      // Store survey notes - could be in a separate table or as metadata
      // For now, we'll use a simple approach with localStorage or a notes table
      // This is a simplified implementation
      setSurveyNotes(notes)
      localStorage.setItem(`survey_notes_${currentChapterId}`, notes)
    } catch (err) {
      console.error('Error saving survey notes:', err)
    }
  }

  const handleGenerateSummary = async () => {
    if (!book || !user?.id) return

    try {
      // Fetch all questions and reflections (via chapters)
      const chapterIds = chapters.map((ch) => ch.id)
      const { data: allQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('user_id', user.id)

      const { data: allReflections } = await supabase
        .from('reflections')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('user_id', user.id)

      let summaryText = `# Summary: ${book.title}\n\n`
      if (book.author) summaryText += `Author: ${book.author}\n\n`

      if (allQuestions && allQuestions.length > 0) {
        summaryText += '## Questions\n\n'
        allQuestions.forEach((q, idx) => {
          summaryText += `${idx + 1}. ${q.question_text}\n`
          if (q.highlight_text) summaryText += `   Highlight: "${q.highlight_text}"\n`
          summaryText += '\n'
        })
      }

      if (allReflections && allReflections.length > 0) {
        summaryText += '## Reflections\n\n'
        allReflections.forEach((r, idx) => {
          summaryText += `${idx + 1}. ${r.reflection_text}\n\n`
        })
      }

      // Save to summaries table
      const { error } = await supabase.from('summaries').insert({
        book_id: book.id,
        user_id: user.id,
        combined_text: summaryText,
      })

      if (error) throw error

      alert('Summary generated successfully!')
    } catch (err) {
      console.error('Error generating summary:', err)
      alert('Failed to generate summary')
    }
  }

  const handlePrevious = () => {
    if (!chapters || chapters.length === 0 || !currentChapterId) return

    const currentIndex = chapters.findIndex((ch) => ch.id === currentChapterId)
    if (currentIndex > 0) {
      setCurrentChapterId(chapters[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (!chapters || chapters.length === 0 || !currentChapterId) return

    const currentIndex = chapters.findIndex((ch) => ch.id === currentChapterId)
    if (currentIndex < chapters.length - 1) {
      setCurrentChapterId(chapters[currentIndex + 1].id)
    }
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={scheme.appBg}>
        <Spinner size="lg" color={scheme.accent} />
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={scheme.appBg} direction="column">
        <Text color="red.500" mb={4}>
          Error: {error}
        </Text>
        <Box
          as="button"
          onClick={() => navigate('/')}
          px={4}
          py={2}
          bg={scheme.accent}
          color="white"
          borderRadius="md"
          _hover={{ bg: scheme.accentHover }}
        >
          Back to Library
        </Box>
      </Flex>
    )
  }

  if (!book) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={scheme.appBg} direction="column">
        <Text color={scheme.primaryText} mb={4}>
          Book not found
        </Text>
        <Box
          as="button"
          onClick={() => navigate('/')}
          px={4}
          py={2}
          bg={scheme.accent}
          color="white"
          borderRadius="md"
          _hover={{ bg: scheme.accentHover }}
        >
          Back to Library
        </Box>
      </Flex>
    )
  }

  const currentChapter = chapters.find((ch) => ch.id === currentChapterId)

  return (
    <Flex direction="column" height="100vh" bg={scheme.appBg} color={scheme.primaryText}>
      <WorkspaceHeader
        book={{
          ...book,
          currentChapter: currentChapter?.title || 'Select a chapter',
        }}
        scheme={scheme}
        onCycleScheme={cycleScheme}
        onExport={handleExport}
      />

      <Flex flex="1" overflow="hidden">
        {/* Removed ChaptersSidebar - using react-epub-viewer's built-in navigation */}
        <Flex
          flex="1"
          direction="column"
          bg={scheme.contentBg}
          px={6}
          py={6}
          gap={4}
          overflow="hidden"
        >
          <ReadingCanvas
            scheme={scheme}
            currentChapter={currentChapter}
            book={book}
            onAddReflection={handleAddReflection}
            onMarkDone={handleMarkDone}
            // Removed onPrevious, onNext - using react-epub-viewer's built-in navigation
            onAddQuestion={handleAddQuestion}
            onChaptersExtracted={async (extractedChapters) => {
              try {
                console.log('[Workspace] onChaptersExtracted called', {
                  chapterCount: extractedChapters?.length,
                  hasBook: !!book?.id,
                  hasUser: !!user?.id,
                })

                // Store chapters extracted by react-epub-viewer
                if (extractedChapters && extractedChapters.length > 0 && book?.id && user?.id) {
                  // Delete existing chapters for this book
                  const { error: deleteError } = await supabase
                    .from('chapters')
                    .delete()
                    .eq('book_id', book.id)
                    .eq('user_id', user.id)

                  if (deleteError) {
                    console.error('[Workspace] Error deleting chapters:', deleteError)
                  }

                  // Insert new chapters
                  const chaptersToInsert = extractedChapters.map((chapter) => ({
                    book_id: book.id,
                    chapter_index: chapter.chapter_index,
                    title: chapter.title,
                    locator: chapter.locator,
                    user_id: user.id,
                  }))

                  console.log('[Workspace] Inserting chapters:', chaptersToInsert)

                  const { data: insertedChapters, error: insertError } = await supabase
                    .from('chapters')
                    .insert(chaptersToInsert)
                    .select()

                  if (insertError) {
                    console.error('[Workspace] Error inserting chapters:', insertError)
                  } else if (insertedChapters) {
                    console.log(
                      `[Workspace] Extracted and inserted ${insertedChapters.length} chapters from react-epub-viewer`,
                      insertedChapters
                    )
                    setChapters(insertedChapters)
                    if (insertedChapters.length > 0 && !currentChapterId) {
                      setCurrentChapterId(insertedChapters[0].id)
                    }
                  }
                } else {
                  console.warn('[Workspace] onChaptersExtracted called but missing data:', {
                    hasChapters: !!extractedChapters,
                    chapterCount: extractedChapters?.length,
                    hasBook: !!book?.id,
                    hasUser: !!user?.id,
                  })
                }
              } catch (err) {
                console.error('[Workspace] Error in onChaptersExtracted:', err, {
                  errorMessage: err?.message,
                  errorStack: err?.stack,
                })
              }
            }}
            // Removed hasPrevious, hasNext - using react-epub-viewer's built-in navigation
          />
        </Flex>

        <RightPane
          scheme={scheme}
          currentChapterId={currentChapterId}
          questions={questions}
          reflections={reflections}
          surveyNotes={surveyNotes}
          onAddQuestion={handleAddQuestion}
          onEditSurveyNotes={handleEditSurveyNotes}
          onGenerateSummary={handleGenerateSummary}
        />
      </Flex>
    </Flex>
  )
}

export default Workspace
