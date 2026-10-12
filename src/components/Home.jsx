import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Box, Button, Flex, Heading, HStack, Image, Text, VStack } from '@chakra-ui/react'
import { BookOpen, ChevronRight, Loader2, Plus } from 'lucide-react'

import { useBooks } from '../hooks/useBooks'
import { useFilePicker } from '../hooks/useFilePicker'
import useAuth from '../hooks/useAuth'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createBook, importEpub } from '../lib/bookImport'
import { accentButtonProps, cleanTheme } from '../constants/theme'
import AppHeader from './AppHeader'
import AddBookForm from './library/AddBookForm'

const spinStyle = `@keyframes spin { to { transform: rotate(360deg) } }`

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
  const { books, loading, error, refetch } = useBooks(user?.id)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(null)
  const [message, setMessage] = useState(null)

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

  return (
    <Box bg={cleanTheme.appBg} color={cleanTheme.primaryText} minH="100vh">
      <style>{spinStyle}</style>
      <AppHeader />

      <Box maxW={cleanTheme.columnWidth} mx="auto" px={4} py={{ base: 6, md: 10 }}>
        <HStack justify="space-between" mb={6}>
          <Heading as="h1" fontFamily={cleanTheme.serif} fontSize="3xl" fontWeight={700}>
            Your books
          </Heading>
          {!adding && books.length > 0 && (
            <Button size="sm" {...accentButtonProps} onClick={() => setAdding(true)}>
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
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          ) : books.length > 0 ? (
            <VStack align="stretch" gap={0}>
              {books.map((book) => (
                <BookRow key={book.id} book={book} />
              ))}
            </VStack>
          ) : (
            !adding && (
              <VStack align="flex-start" gap={4} py={6}>
                <Text color={cleanTheme.placeholderText} maxW="480px">
                  Read anywhere you like. Here you write one question before each chapter and one
                  takeaway after it.
                </Text>
                <HStack gap={3}>
                  <Button {...accentButtonProps} onClick={() => setAdding(true)}>
                    <Plus size={16} />
                    Add a book
                  </Button>
                  <Button variant="outline" onClick={handleUploadClick}>
                    Import EPUB
                  </Button>
                </HStack>
              </VStack>
            )
          )}
        </VStack>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </Box>
  )
}

export default Home
