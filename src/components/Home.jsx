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
import { ArrowRight, BookOpen, CheckCircle2, UploadCloud, XCircle, Loader2, BookOpenCheck } from 'lucide-react'

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

  if (loading) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={cleanTheme.appBg} direction="column" gap={4}>
        <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: cleanTheme.accent }} />
        <Text color={cleanTheme.primaryText} fontSize="lg" fontWeight={500}>
          Loading your library...
        </Text>
      </Flex>
    )
  }

  if (error) {
    return (
      <Flex align="center" justify="center" height="100vh" bg={cleanTheme.appBg} direction="column" gap={4}>
        <XCircle size={48} color="#dc2626" />
        <Text color="red.500" fontSize="lg" fontWeight={500}>
          Error: {error}
        </Text>
        <Button
          onClick={() => window.location.reload()}
          bg={cleanTheme.accent}
          _hover={{ bg: cleanTheme.accentHover }}
          color="white"
          mt={4}
        >
          Reload
        </Button>
      </Flex>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideInDown {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .book-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .book-card:hover {
          transform: translateY(-4px);
        }
        .book-cover {
          transition: all 0.3s ease;
        }
        .book-card:hover .book-cover {
          transform: scale(1.02);
        }
        .status-toast {
          animation: slideInDown 0.3s ease;
        }
      `}</style>
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
          boxShadow="sm"
        >
          <HStack justify="space-between" align="center">
            <HStack spacing={3}>
              <Box
                width="44px"
                height="44px"
                borderRadius="lg"
                bg={cleanTheme.canvasBg}
                border={cleanTheme.sidebarBorder}
                display="grid"
                placeItems="center"
                fontWeight="bold"
                fontSize="lg"
                color={cleanTheme.accent}
                boxShadow="sm"
              >
                R
              </Box>
              <Box>
                <Text fontSize="xs" textTransform="uppercase" opacity={0.7} letterSpacing="0.5px" fontWeight={600}>
                  Ruminant
                </Text>
                <Heading size="md" fontWeight={700}>Library</Heading>
              </Box>
            </HStack>
            <HStack spacing={3}>
              <Button
                bg={cleanTheme.accent}
                _hover={{ bg: cleanTheme.accentHover, transform: 'translateX(2px)' }}
                color="white"
                rightIcon={<ArrowRight size={16} />}
                onClick={handleUploadClick}
                fontWeight={600}
                transition="all 0.2s ease"
                boxShadow="sm"
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
              <Heading size="lg" fontWeight={700} mb={1}>Your books</Heading>
              <Text color="gray.600" fontSize="sm">
                {books && books.length > 0
                  ? `${books.length} ${books.length === 1 ? 'book' : 'books'} saved`
                  : 'Drop an EPUB to get started'}
              </Text>
            </Box>
            {uploadStatus && (
              <HStack
                className="status-toast"
                spacing={2}
                color={uploadStatus.state === 'success' ? 'green.700' : 'red.700'}
                bg={uploadStatus.state === 'success' ? 'green.50' : 'red.50'}
                borderRadius="lg"
                px={4}
                py={2.5}
                border={`1px solid ${uploadStatus.state === 'success' ? '#c6f6d5' : '#fed7d7'}`}
                boxShadow="md"
              >
                <Box as={uploadStatus.state === 'success' ? CheckCircle2 : XCircle} boxSize={5} />
                <Text fontSize="sm" fontWeight={500}>{uploadStatus.message}</Text>
              </HStack>
            )}
          </HStack>

          {booksToShow.length === 0 ? (
            <Flex
              direction="column"
              align="center"
              justify="center"
              py={20}
              px={8}
              bg="gray.50"
              borderRadius="xl"
              border="2px dashed"
              borderColor="gray.200"
            >
              <BookOpenCheck size={64} color={cleanTheme.accent} style={{ opacity: 0.5, marginBottom: 4 }} />
              <Heading size="md" mb={2} color="gray.700">No books yet</Heading>
              <Text color="gray.600" textAlign="center" mb={6} maxW="400px">
                Upload your first EPUB to start building your library
              </Text>
              <Button
                bg={cleanTheme.accent}
                _hover={{ bg: cleanTheme.accentHover }}
                color="white"
                leftIcon={<UploadCloud size={18} />}
                onClick={handleUploadClick}
                size="lg"
                fontWeight={600}
              >
                Upload Your First Book
              </Button>
            </Flex>
          ) : (
            <Box
              display="grid"
              gridTemplateColumns="repeat(auto-fill, minmax(180px, 220px))"
              gap={6}
              justifyContent="center"
            >
              {booksToShow.map((book) => (
                <Box
                  key={book.id || book.title}
                  className="book-card"
                  role="group"
                  borderRadius="xl"
                  bg="white"
                  boxShadow="md"
                  overflow="hidden"
                  cursor="pointer"
                  onClick={() => navigate(`/mvp/${book.id || book.title}`)}
                  _hover={{ boxShadow: 'xl' }}
                  maxW="220px"
                  w="100%"
                >
                  <AspectRatio ratio={2 / 3}>
                    <Box
                      bg="gray.50"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      p="12%"
                      position="relative"
                      overflow="hidden"
                    >
                      <Image
                        className="book-cover"
                        src={book.cover_url}
                        alt={book.title}
                        objectFit="contain"
                        maxW="100%"
                        maxH="100%"
                        filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))"
                        _groupHover={{
                          filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2))',
                        }}
                      />
                    </Box>
                  </AspectRatio>
                  <Box
                    px={3}
                    py={2}
                    bg="white"
                    borderTop="1px solid"
                    borderColor="gray.100"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight={600}
                      color="gray.800"
                      noOfLines={2}
                      textAlign="center"
                      minH="2.5em"
                    >
                      {book.title}
                    </Text>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {booksToShow.length > 0 && (
            <HStack spacing={3} align="center" pt={4} borderTop="1px solid" borderColor="gray.200">
              <Button
                variant="outline"
                leftIcon={<UploadCloud size={18} />}
                onClick={handleUploadClick}
                fontWeight={500}
                _hover={{ bg: 'gray.50', transform: 'translateY(-1px)' }}
                transition="all 0.2s ease"
              >
                Choose file
              </Button>
              {selectedFile && (
                <Badge
                  colorScheme="blue"
                  variant="subtle"
                  borderRadius="md"
                  px={3}
                  py={1.5}
                  fontSize="sm"
                  fontWeight={500}
                >
                  {selectedFile.name}
                </Badge>
              )}
              {extracting && (
                <HStack spacing={2} px={4} py={2} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                  <Text color="blue.700" fontSize="sm" fontWeight={500}>Extracting EPUB data...</Text>
                </HStack>
              )}
              {extractionError && (
                <HStack spacing={2} px={4} py={2} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                  <XCircle size={16} color="#dc2626" />
                  <Text color="red.700" fontSize="sm" fontWeight={500}>
                    {extractionError}
                  </Text>
                </HStack>
              )}
            </HStack>
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
    </Flex>
    </>
  )
}

export default Home
