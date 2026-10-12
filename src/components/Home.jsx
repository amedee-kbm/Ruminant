import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Box, Button, Flex, Heading, HStack, Image, Text, VStack } from '@chakra-ui/react'
import { BookOpen, ChevronRight, Loader2, Plus } from 'lucide-react'

import { useBooks } from '../hooks/useBooks'
import { useFilePicker } from '../hooks/useFilePicker'
import useAuth from '../hooks/useAuth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createBook, importEpub } from '../lib/bookImport'
import { getSampleBooks } from '../lib/sampleBooks'
import { accentButtonProps, cleanTheme } from '../constants/theme'
import AppHeader from './AppHeader'
import AddBookForm from './library/AddBookForm'
import SignUpDialog from './SignUpDialog'

const spinStyle = `@keyframes spin { to { transform: rotate(360deg) } }
@keyframes skeleton-pulse { 50% { opacity: 0.5 } }`

const SkeletonBar = (props) => (
  <Box
    bg={cleanTheme.canvasBg}
    borderRadius="sm"
    animation="skeleton-pulse 1.5s ease-in-out infinite"
    {...props}
  />
)

/** Placeholder rows shaped like BookRow while the library loads */
const LibrarySkeleton = () => (
  <VStack align="stretch" gap={0} aria-busy="true" aria-label="Loading your books">
    {[60, 45, 70].map((width) => (
      <HStack key={width} gap={4} px={3} py={3}>
        <SkeletonBar w="40px" h="60px" flexShrink={0} />
        <Box flex="1">
          <SkeletonBar h="14px" w={`${width}%`} mb={2} />
          <SkeletonBar h="12px" w="30%" />
        </Box>
      </HStack>
    ))}
  </VStack>
)

const SectionLabel = ({ children }) => (
  <Heading as="h2" fontSize="sm" fontWeight={600} color={cleanTheme.placeholderText} px={3}>
    {children}
  </Heading>
)

const SampleBooks = () => (
  <VStack align="stretch" gap={1}>
    {getSampleBooks().map((book) => (
      <BookRow key={book.id} book={book} />
    ))}
  </VStack>
)

const BookRow = ({ book }) => {
  const total = book.chapters?.length ?? 0
  const done = book.chapters?.filter((c) => c.markdown_content?.trim()).length ?? 0

  return (
    <HStack
      asChild
      w="100%"
      gap={4}
      px={3}
      py={3}
      borderRadius="lg"
      textAlign="left"
      cursor="pointer"
      _hover={{ bg: cleanTheme.canvasBg }}
    >
      <RouterLink to={`/books/${book.id}`}>
        <Flex
          w="40px"
          h="60px"
          flexShrink={0}
          align="center"
          justify="center"
          bg={cleanTheme.canvasBg}
          borderRadius="sm"
          overflow="hidden"
        >
          {book.cover_url ? (
            <Image src={book.cover_url} alt="" w="100%" h="100%" objectFit="cover" />
          ) : (
            <BookOpen size={18} color={cleanTheme.placeholderText} />
          )}
        </Flex>
        <Box flex="1" minW={0}>
          <Text fontWeight={600} lineClamp={1}>
            {book.title}
          </Text>
          {book.author && (
            <Text fontSize="sm" color={cleanTheme.placeholderText} lineClamp={1}>
              {book.author}
            </Text>
          )}
        </Box>
        <Text fontSize="sm" color={cleanTheme.placeholderText} flexShrink={0}>
          {done}/{total}
        </Text>
        <ChevronRight size={16} color={cleanTheme.placeholderText} />
      </RouterLink>
    </HStack>
  )
}

const Home = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGuest = !user
  const { books, loading, error, refetch } = useBooks(user?.id)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(null)
  const [message, setMessage] = useState(null)
  const [signUpOpen, setSignUpOpen] = useState(false)

  useDocumentTitle(null)

  // Open the new book straight away; stay here if its chapters couldn't be saved
  const finishAdding = (book) => {
    if (book.chaptersSaved) {
      navigate(`/books/${book.id}`)
    } else {
      setMessage(`Added "${book.title}", but its chapters could not be saved.`)
      setAdding(false)
      refetch()
    }
  }

  const { fileInputRef, handleUploadClick, handleFileChange, accept } = useFilePicker({
    onFileSelected: async (file) => {
      setImporting(file.name)
      setMessage(null)
      try {
        finishAdding(await importEpub(file, user?.id))
      } catch (err) {
        console.error('EPUB import failed:', err)
        setMessage(`Couldn't import ${file.name}: ${err.message}`)
      } finally {
        setImporting(null)
      }
    },
  })

  const handleAddBook = async (book) => {
    setMessage(null)
    try {
      finishAdding(await createBook(book, user?.id))
    } catch (err) {
      console.error('Adding book failed:', err)
      setMessage(`Couldn't add the book: ${err.message}`)
    }
  }

  // Guests can look around, but adding a book needs an account
  const startAdding = () => (isGuest ? setSignUpOpen(true) : setAdding(true))
  const startImport = () => (isGuest ? setSignUpOpen(true) : handleUploadClick())

  const addButtons = (
    <HStack gap={3}>
      <Button {...accentButtonProps} onClick={startAdding}>
        <Plus size={16} />
        Add a book
      </Button>
      <Button variant="outline" onClick={startImport}>
        Import EPUB
      </Button>
    </HStack>
  )

  return (
    <Box bg={cleanTheme.appBg} color={cleanTheme.primaryText} minH="100vh">
      <style>{spinStyle}</style>
      <AppHeader />

      <Box maxW={cleanTheme.columnWidth} mx="auto" px={4} py={{ base: 6, md: 10 }}>
        {isGuest ? (
          <VStack align="stretch" gap={10}>
            <VStack align="flex-start" gap={4}>
              <Heading as="h1" fontFamily={cleanTheme.serif} fontSize="3xl" fontWeight={700}>
                Think about what you read
              </Heading>
              <Text color={cleanTheme.placeholderText} maxW="520px">
                Read anywhere you like. Here you write what you want from a book before you start, a
                few notes on each chapter, and what you’ll keep once you finish. Open a sample to
                see how it works.
              </Text>
              {addButtons}
            </VStack>
            <VStack align="stretch" gap={2}>
              <SectionLabel>Sample books</SectionLabel>
              <SampleBooks />
            </VStack>
          </VStack>
        ) : (
          <>
            <HStack justify="space-between" mb={6}>
              <Heading as="h1" fontFamily={cleanTheme.serif} fontSize="3xl" fontWeight={700}>
                Your books
              </Heading>
              {!adding && books.length > 0 && (
                <Button size="sm" {...accentButtonProps} onClick={startAdding}>
                  <Plus size={16} />
                  Add a book
                </Button>
              )}
            </HStack>

            <VStack align="stretch" gap={4}>
              {importing && (
                <HStack fontSize="sm" color={cleanTheme.placeholderText}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <Text>Importing {importing}…</Text>
                </HStack>
              )}
              {(message || error) && (
                <Text fontSize="sm" color={cleanTheme.error}>
                  {message || `Couldn't load your books: ${error}`}
                </Text>
              )}

              {adding && (
                <AddBookForm
                  onSubmit={handleAddBook}
                  onCancel={() => setAdding(false)}
                  onImportEpub={handleUploadClick}
                />
              )}

              {loading ? (
                <LibrarySkeleton />
              ) : books.length > 0 ? (
                <VStack align="stretch" gap={0}>
                  {books.map((book) => (
                    <BookRow key={book.id} book={book} />
                  ))}
                </VStack>
              ) : (
                !adding && (
                  <VStack align="stretch" gap={10}>
                    <VStack align="flex-start" gap={4} py={6}>
                      <Text color={cleanTheme.placeholderText} maxW="480px">
                        Read anywhere you like. Here you write one question before each chapter and
                        one takeaway after it.
                      </Text>
                      {addButtons}
                    </VStack>
                    <VStack align="stretch" gap={2}>
                      <SectionLabel>Or look around a sample</SectionLabel>
                      <SampleBooks />
                    </VStack>
                  </VStack>
                )
              )}
            </VStack>
          </>
        )}
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <SignUpDialog open={signUpOpen} onClose={() => setSignUpOpen(false)} />
    </Box>
  )
}

export default Home
