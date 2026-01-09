import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useFetchData } from '../hooks/useFetchData'
import { useFilePicker } from '../hooks/useFilePicker'
import useAuth from '../hooks/useAuth'
import { uploadBook, saveChaptersForBook } from '../lib/bookUploadService'
import { cleanTheme } from '../constants/theme'
import { sampleBooks } from '../constants/sampleData'
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowRight, BookOpen, CheckCircle2, UploadCloud, XCircle } from 'lucide-react'

const Home = () => {
  const navigate = useNavigate()
  const { data: books, loading, error, refetch: refetchBooks } = useFetchData('books', {
    orderBy: 'created_at',
    ascending: false, // newest first
  })
  const { user } = useAuth()
  const [extracting, setExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [chapterSelection, setChapterSelection] = useState(null)
  const [savingChapters, setSavingChapters] = useState(false)

  const { fileInputRef, selectedFile, handleUploadClick, handleFileChange, accept } = useFilePicker(
    {
      onFileSelected: async (file) => {
        setExtracting(true)
        setExtractionError(null)
        setUploadStatus(null)
        try {
          const result = await uploadBook(file, user?.id)

          // Initialize chapter selection step if we have chapters and bookId
          if (result.bookId && Array.isArray(result.chapters) && result.chapters.length > 0) {
            setChapterSelection({
              bookId: result.bookId,
              chapters: result.chapters.map((ch, index) => ({
                ...ch,
                _index: index,
                _selected: true,
              })),
            })
          } else if (!result.bookId) {
            // Book was uploaded but we couldn't get the ID (RLS issue)
            // User will need to refresh to see it, but we still show success
            console.warn('⚠️ Book uploaded but bookId is null. User may need to refresh to see it.')
          }

          setUploadStatus({
            state: 'success',
            message: result.message,
          })

          // Refresh the books list to show the newly uploaded book
          refetchBooks()
        } catch (error) {
          setExtractionError(error.message)
          setUploadStatus({
            state: 'error',
            message: 'Upload failed. Please try again.',
          })
        } finally {
          setExtracting(false)
        }
      },
    }
  )

  const booksToShow = books && books.length > 0 ? books : sampleBooks

  const handleToggleChapter = (idx) => {
    setChapterSelection((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        chapters: prev.chapters.map((ch, i) =>
          i === idx ? { ...ch, _selected: !ch._selected } : ch
        ),
      }
    })
  }

  const handleSelectAllChapters = (checked) => {
    setChapterSelection((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        chapters: prev.chapters.map((ch) => ({ ...ch, _selected: checked })),
      }
    })
  }

  const handleConfirmChapters = async () => {
    if (!chapterSelection || !user?.id) return
    const selected = chapterSelection.chapters.filter((c) => c._selected)
    setSavingChapters(true)
    try {
      await saveChaptersForBook(chapterSelection.bookId, selected, user.id)
      setUploadStatus((prev) => ({
        state: 'success',
        message:
          selected.length > 0
            ? `Imported ${selected.length} chapters.`
            : 'Book imported without chapters.',
      }))

      // Refresh the books list (though it shouldn't change, this ensures consistency)
      refetchBooks()
    } catch (err) {
      console.error('Error saving selected chapters:', err)
      setUploadStatus({
        state: 'error',
        message: 'There was a problem saving chapters.',
      })
    } finally {
      setSavingChapters(false)
      setChapterSelection(null)
    }
  }

  const handleCancelChapters = () => {
    setChapterSelection(null)
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={cleanTheme.appBg}>
        <Spinner size="lg" color={cleanTheme.accent} />
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={cleanTheme.appBg}>
        <Text color="red.500">Error: {error}</Text>
      </Flex>
    )
  }

  return (
    <Flex direction="column" bg={cleanTheme.appBg} color={cleanTheme.primaryText} minH="100vh">
      <Box
        as="header"
        borderBottom={cleanTheme.headerBorder}
        bg={cleanTheme.headerBg}
        px={8}
        py={5}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <HStack justify="space-between" align="center">
          <HStack spacing={3}>
            <Box
              width="40px"
              height="40px"
              borderRadius="md"
              bg={cleanTheme.canvasBg}
              border={cleanTheme.sidebarBorder}
              display="grid"
              placeItems="center"
              fontWeight="bold"
              fontSize="sm"
            >
              R
            </Box>
            <Box>
              <Text fontSize="xs" textTransform="uppercase" opacity={0.7}>
                Ruminant
              </Text>
              <Heading size="md">Library</Heading>
            </Box>
          </HStack>
          <HStack spacing={3}>
            <Button variant="ghost" leftIcon={<BookOpen size={16} />} as="a" href="/workspace">
              Workspace
            </Button>
            <Button
              bg={cleanTheme.accent}
              _hover={{ bg: cleanTheme.accentHover }}
              color="white"
              rightIcon={<ArrowRight size={16} />}
              onClick={handleUploadClick}
            >
              Upload EPUB
            </Button>
          </HStack>
        </HStack>
      </Box>

      <Box maxW="2400px" mx="auto" px={8} py={8} flex="1" width="100%">
        <VStack align="stretch" spacing={6}>
          <HStack justify="space-between" align="flex-end">
            <Box>
              <Heading size="lg">Your books</Heading>
              <Text color="gray.600">
                {books && books.length > 0
                  ? `${books.length} saved`
                  : 'Drop an EPUB to get started'}
              </Text>
            </Box>
            {uploadStatus && (
              <HStack
                spacing={2}
                color={uploadStatus.state === 'success' ? 'green.600' : 'red.600'}
                bg={uploadStatus.state === 'success' ? 'green.50' : 'red.50'}
                borderRadius="md"
                px={3}
                py={2}
                border={`1px solid ${uploadStatus.state === 'success' ? '#c6f6d5' : '#fed7d7'}`}
              >
                <Box as={uploadStatus.state === 'success' ? CheckCircle2 : XCircle} boxSize={4} />
                <Text fontSize="sm">{uploadStatus.message}</Text>
              </HStack>
            )}
          </HStack>

          {chapterSelection && (
            <Box
              borderRadius="md"
              border="1px solid #e2e8f0"
              bg="white"
              p={4}
            >
              <HStack justify="space-between" mb={3}>
                <Box>
                  <Heading size="sm" mb={1}>
                    Select chapters to import
                  </Heading>
                  <Text fontSize="sm" color="gray.600">
                    Choose which chapters from this EPUB you want to turn into notes.
                  </Text>
                </Box>
                <HStack spacing={2}>
                  <input
                    type="checkbox"
                    checked={chapterSelection.chapters.every((c) => c._selected)}
                    ref={undefined}
                    onChange={(e) => handleSelectAllChapters(e.target.checked)}
                  />
                  <Text fontSize="sm">Select all</Text>
                </HStack>
              </HStack>

              <VStack
                align="stretch"
                spacing={1}
                maxH="260px"
                overflowY="auto"
                borderRadius="md"
                border="1px solid #edf2f7"
                p={2}
              >
                {chapterSelection.chapters.map((ch, idx) => (
                  <HStack
                    key={ch.id || ch.href || idx}
                    spacing={2}
                    as="label"
                  >
                    <input
                      type="checkbox"
                      checked={!!ch._selected}
                      onChange={() => handleToggleChapter(idx)}
                    />
                    <Text fontSize="sm">
                      {ch.title || `Chapter ${idx + 1}`}
                    </Text>
                  </HStack>
                ))}
              </VStack>

              <HStack justify="flex-end" spacing={3} mt={3}>
                <Button variant="ghost" size="sm" onClick={handleCancelChapters}>
                  Skip
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={handleConfirmChapters}
                  isLoading={savingChapters}
                >
                  Save selected chapters
                </Button>
              </HStack>
            </Box>
          )}

          <SimpleGrid minChildWidth="180px" spacing={6}>
            {booksToShow.map((book) => (
              <Box
                key={book.id || book.title}
                role="group"
                borderRadius="lg"
                bg="white"
                boxShadow="sm"
                transition="box-shadow 0.2s ease, transform 0.2s ease"
                _hover={{ boxShadow: 'lg', transform: 'translateY(-2px)' }}
                cursor="pointer"
                onClick={() => navigate(`/mvp/${book.id || book.title}`)}
              >
                <AspectRatio ratio={2 / 3}>
                  <Box
                    bg="gray.50"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    p="10%" // 🔑 visual equalizer
                  >
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      objectFit="contain"
                      maxW="100%"
                      maxH="100%"
                      transition="box-shadow 0.2s ease"
                      _groupHover={{
                        boxShadow: 'xl', // 🔥 shadow around the image
                      }}
                    />
                  </Box>
                </AspectRatio>
              </Box>
            ))}
          </SimpleGrid>

          <HStack spacing={3} align="center">
            <Button
              variant="outline"
              leftIcon={<UploadCloud size={18} />}
              onClick={handleUploadClick}
            >
              Choose file
            </Button>
            {selectedFile && (
              <Badge colorScheme="blue" variant="subtle" borderRadius="md" px={2} py={1}>
                {selectedFile.name}
              </Badge>
            )}
            {extracting && (
              <HStack spacing={2}>
                <Spinner size="sm" />
                <Text>Extracting EPUB data...</Text>
              </HStack>
            )}
            {extractionError && (
              <Text color="red.500" fontSize="sm">
                {extractionError}
              </Text>
            )}
          </HStack>
        </VStack>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </Flex>
  )
}

export default Home
