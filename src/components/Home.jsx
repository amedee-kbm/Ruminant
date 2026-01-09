import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useFetchData } from '../hooks/useFetchData'
import { useFilePicker } from '../hooks/useFilePicker'
import useAuth from '../hooks/useAuth'
import { uploadBook } from '../lib/bookUploadService'
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
  const { data: books, loading, error } = useFetchData('books')
  const { user } = useAuth()
  const [extracting, setExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)

  const { fileInputRef, selectedFile, handleUploadClick, handleFileChange, accept } = useFilePicker(
    {
      onFileSelected: async (file) => {
        setExtracting(true)
        setExtractionError(null)
        setUploadStatus(null)
        try {
          const result = await uploadBook(file, user?.id)
          setUploadStatus({
            state: 'success',
            message: result.message,
          })
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
