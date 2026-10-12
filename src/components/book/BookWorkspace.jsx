import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { Box, Button, Flex, Heading, HStack, Image, Text, VStack } from '@chakra-ui/react'
import { Download, ListOrdered, Loader2, Pencil, Sparkles } from 'lucide-react'

import useAuth from '../../hooks/useAuth'
import { useBook } from '../../hooks/useBook'
import { useChapters } from '../../hooks/useChapters'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { accentButtonProps, cleanTheme } from '../../constants/theme'
import { deleteBook } from '../../lib/booksApi'
import {
  buildExportMarkdown,
  downloadMarkdown,
  hasAnythingToExport,
  hasNotes,
} from '../../lib/bookNotes'
import { isSampleId } from '../../lib/sampleBooks'
import AppHeader from '../AppHeader'
import BookPrompt from './BookPrompt'
import ConfirmDialog from '../ConfirmDialog'
import ChapterCard from './ChapterCard'
import ChapterListEditor from './ChapterListEditor'
import EditBookDialog from './EditBookDialog'
import SignUpDialog from '../SignUpDialog'

const Spinner = () => (
  <>
    <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
  </>
)

/** Says a sample's edits aren't kept, and points to signing up or adding a real book */
const SampleBanner = ({ isGuest, onSignUp }) => (
  <HStack
    justify="space-between"
    gap={3}
    wrap="wrap"
    mb={8}
    px={4}
    py={3}
    borderRadius="lg"
    bg={cleanTheme.canvasBg}
  >
    <HStack gap={3} minW={0}>
      <Sparkles size={18} style={{ flexShrink: 0 }} />
      <Text fontSize="sm">This is a sample book. Try writing in it; nothing here is saved.</Text>
    </HStack>
    {isGuest ? (
      <Button size="sm" {...accentButtonProps} onClick={onSignUp}>
        Sign up to add your own
      </Button>
    ) : (
      <Button asChild size="sm" {...accentButtonProps}>
        <RouterLink to="/">Add your own book</RouterLink>
      </Button>
    )}
  </HStack>
)

/** One book: what you want from it, notes per chapter, and what you'll keep */
const BookWorkspace = () => {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id
  const isSample = isSampleId(bookId)

  const { book, loading, saveDetails, updateBookLocally, saveBookFields } = useBook(bookId, userId)
  const chapterState = useChapters(bookId, userId)
  const { chapters, updateChapterLocally, saveChapter, saveList } = chapterState

  // 'edit-details' | 'edit-chapters' | 'delete' | 'sign-up' | null
  const [mode, setMode] = useState(null)

  useDocumentTitle(book?.title)

  // The open chapter lives in the URL (?chapter=<id>) so refresh and shared links keep it.
  // No param: open the chapter after the last one with notes, i.e. where you left off.
  // Empty param: everything collapsed.
  const [searchParams, setSearchParams] = useSearchParams()
  const chosenId = searchParams.has('chapter') ? searchParams.get('chapter') || null : undefined
  const lastWithNotes = chapters.findLastIndex(hasNotes)
  const resumeId = lastWithNotes >= 0 ? chapters[lastWithNotes + 1]?.id : undefined
  const openId = chosenId === undefined ? resumeId : chosenId
  const openChapter = (id) => setSearchParams({ chapter: id ?? '' }, { replace: true })

  const doneCount = chapters.filter(hasNotes).length
  const progress = chapters.length ? (doneCount / chapters.length) * 100 : 0

  const handleChange = (chapterId, notes) => {
    // Pin the default chapter open, or the "where you left off" chapter would move mid-sentence
    if (chosenId === undefined) openChapter(chapterId)
    updateChapterLocally(chapterId, { markdown_content: notes })
  }

  const handleSave = (chapterId, notes) =>
    saveChapter(chapterId, { markdown_content: notes.trim() ? notes : null })

  const handleExport = () =>
    downloadMarkdown(buildExportMarkdown(book, chapters), `${book.title} - Ruminant`)

  const handleSaveChapters = async (edited) => {
    await saveList(edited)
    setMode(null)
  }

  const handleDelete = async () => {
    await deleteBook(book, userId)
    navigate('/', { replace: true })
  }

  if (loading || chapterState.loading) {
    return (
      <Box minH="100vh" bg={cleanTheme.appBg}>
        <AppHeader />
        <Flex justify="center" pt={20} color={cleanTheme.placeholderText}>
          <Spinner />
        </Flex>
      </Box>
    )
  }

  if (!book) {
    return (
      <Box minH="100vh" bg={cleanTheme.appBg}>
        <AppHeader />
        <VStack pt={20} gap={4}>
          <Text>This book doesn’t exist, or was deleted.</Text>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back to your books
          </Button>
        </VStack>
      </Box>
    )
  }

  const editingChapters = mode === 'edit-chapters'

  return (
    <Box bg={cleanTheme.appBg} color={cleanTheme.primaryText} minH="100vh">
      <AppHeader crumb={book.title} />

      <Box maxW={cleanTheme.columnWidth} mx="auto" px={4} py={{ base: 6, md: 10 }}>
        {isSample && <SampleBanner isGuest={!user} onSignUp={() => setMode('sign-up')} />}

        <HStack gap={4} align="flex-start" mb={8}>
          {book.cover_url && (
            <Image src={book.cover_url} alt="" w="56px" borderRadius="sm" boxShadow="sm" />
          )}
          <Box minW={0}>
            <Heading
              as="h1"
              fontFamily={cleanTheme.serif}
              fontSize={{ base: '2xl', md: '3xl' }}
              fontWeight={700}
              lineHeight={1.2}
            >
              {book.title}
            </Heading>
            {book.author && <Text color={cleanTheme.placeholderText}>{book.author}</Text>}
            <HStack gap={2} mt={3} wrap="wrap">
              {!isSample && (
                <Button size="xs" variant="outline" onClick={() => setMode('edit-details')}>
                  <Pencil size={14} />
                  Edit details
                </Button>
              )}
              <Button
                size="xs"
                variant="outline"
                onClick={handleExport}
                disabled={!hasAnythingToExport(book, chapters)}
              >
                <Download size={14} />
                Export
              </Button>
            </HStack>
          </Box>
        </HStack>

        <Box mb={10}>
          <BookPrompt
            field="question"
            value={book.question}
            prompt="Before you start, what do you want from this book?"
            placeholder="I want to explore..."
            onChange={updateBookLocally}
            onSave={saveBookFields}
            showSaveStatus={!isSample}
          />
        </Box>

        <Heading as="h2" fontSize="sm" fontWeight={600} color={cleanTheme.placeholderText} mb={1}>
          Chapters
        </Heading>

        {editingChapters ? (
          <ChapterListEditor
            chapters={chapters}
            onSave={handleSaveChapters}
            onCancel={() => setMode(null)}
          />
        ) : chapters.length === 0 ? (
          <VStack align="flex-start" gap={3} py={4}>
            <Text color={cleanTheme.placeholderText}>This book has no chapters yet.</Text>
            <Button variant="outline" onClick={() => setMode('edit-chapters')}>
              <ListOrdered size={16} />
              Add chapters
            </Button>
          </VStack>
        ) : (
          <>
            <Box mb={6}>
              <HStack justify="space-between" mb={2}>
                <Text fontSize="sm" color={cleanTheme.placeholderText}>
                  {doneCount} of {chapters.length} chapters have notes
                </Text>
                {!isSample && (
                  <Button size="xs" variant="ghost" onClick={() => setMode('edit-chapters')}>
                    <ListOrdered size={14} />
                    Edit chapters
                  </Button>
                )}
              </HStack>
              <Box h="4px" bg={cleanTheme.canvasBg} borderRadius="full" overflow="hidden">
                <Box
                  h="100%"
                  w={`${progress}%`}
                  bg={cleanTheme.done}
                  transition="width 0.3s ease"
                />
              </Box>
            </Box>

            <VStack align="stretch" gap={1}>
              {chapters.map((chapter, index) => {
                const next = chapters[index + 1]
                return (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    number={index + 1}
                    open={chapter.id === openId}
                    hasNext={!!next}
                    onToggle={() => openChapter(chapter.id === openId ? null : chapter.id)}
                    onNext={() => openChapter(next.id)}
                    onChange={handleChange}
                    onSave={handleSave}
                    showSaveStatus={!isSample}
                  />
                )
              })}
            </VStack>
          </>
        )}

        <Box mt={12} pt={8} borderTop={cleanTheme.headerBorder}>
          <BookPrompt
            field="takeaway"
            value={book.takeaway}
            prompt="Now that you’ve finished, what will you keep?"
            placeholder="One or two sentences"
            onChange={updateBookLocally}
            onSave={saveBookFields}
            showSaveStatus={!isSample}
          />
        </Box>
      </Box>

      <EditBookDialog
        open={mode === 'edit-details'}
        book={book}
        onSave={saveDetails}
        onDelete={() => setMode('delete')}
        onClose={() => setMode(null)}
      />
      <ConfirmDialog
        open={mode === 'delete'}
        onClose={() => setMode(null)}
        title="Delete this book?"
        body={`“${book.title}” and everything you wrote about it will be permanently deleted.`}
        confirmLabel="Delete book"
        onConfirm={handleDelete}
      />
      <SignUpDialog open={mode === 'sign-up'} onClose={() => setMode(null)} />
    </Box>
  )
}

export default BookWorkspace
