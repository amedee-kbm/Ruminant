import { useEffect, useState } from 'react'
import ePub from 'epubjs'
import { Box, Flex, IconButton, Container, Image, VStack, Card } from '@chakra-ui/react'

import { Menu, House, Search } from 'lucide-react'

import Header from './Header'
import consolation from '../assets/consolation.jpg'
import acedia from '../assets/acedia.jpg'
import imitation from '../assets/imitation.jpg'

import supabase from '../supabaseClient'

const BooksCollection = () => {
  const books = [
    { id: 1, name: 'The Consolation of Philosophy', image: consolation },
    { id: 2, name: 'The Imitation of Christ', image: imitation },
    { id: 3, name: 'The Noonday Devil', image: acedia },
  ]
  const [, setChapters] = useState([])

  useEffect(() => {
    const fetchBooks = async () => {
      const { data, error } = await supabase.from('books').select('*')

      if (error) {
        console.error(error)
      } else {
        console.log(data)
      }
    }

    const getEpubBlob = async () => {
      const { data, error } = await supabase.storage
        .from('books')
        .download('Steal Like an Artist.epub')

      if (error) {
        console.log('error')
        console.error(error)
        return null
      }
      chaptersList(data)
      return data
    }

    const chaptersList = async (blob) => {
      console.log('hello, sir')

      try {
        // Convert blob to ArrayBuffer for better ePub compatibility
        const arrayBuffer = await blob.arrayBuffer()
        const book = ePub(arrayBuffer)

        // Add timeout to prevent hanging indefinitely
        const readyPromise = book.ready
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('book.ready timed out after 10 seconds')), 10000)
        )

        await Promise.race([readyPromise, timeoutPromise])
        console.log('hello, again')
        const toc = book.navigation.toc
        console.log('chapters', toc)
        setChapters(toc)
      } catch (error) {
        console.error('Error loading ePub chapters:', error)
      }
    }

    fetchBooks()
    getEpubBlob()
  }, [])

  return (
    <Flex h="100vh" bg="#3f453c">
      <VStack w="45px" gap={0} mt="5px">
        <IconButton
          variant="ghost"
          colorPalette="#091702ff"
          _hover={{ bg: '#4a5047' }}
          aria-label="Home"
        >
          <Menu color="white" />
        </IconButton>
        <IconButton
          variant="ghost"
          colorPalette="#091702ff"
          _hover={{ bg: '#4a5047' }}
          aria-label="Home"
        >
          <House color="white" />
        </IconButton>
        <IconButton
          variant="ghost"
          colorPalette="#091702ff"
          _hover={{ bg: '#4a5047' }}
          aria-label="Home"
        >
          <Search color="white" />
        </IconButton>
      </VStack>
      <Box flex="1" display="flex" flexDirection="column">
        <Header />
        <Container
          maxW="container.xl"
          py={6}
          px={4}
          display="grid"
          flex="1"
          minH="0"
          overflowY="auto"
          gap={6}
          gridTemplateColumns={{
            base: 'repeat(2, auto)',
            sm: 'repeat(3, auto)',
            md: 'repeat(4, auto)',
            lg: 'repeat(6, auto)',
          }}
          justifyContent="center"
          backgroundColor="#d3e6c9"
        >
          {books.map((b) => (
            <Card.Root
              key={b.id}
              p={0}
              width="155px"
              height="225px"
              border="3px solid white"
              borderRadius="md"
              overflow="hidden"
              boxShadow="none"
              transition="box-shadow 200ms ease, transform 200ms ease"
              _hover={{ boxShadow: 'lg', transform: 'translateY(-4px)' }}
            >
              <Image src={b.image} alt={b.name} width="100%" height="100%" objectFit="cover" />
            </Card.Root>
          ))}
        </Container>
      </Box>
    </Flex>
  )
}

export default BooksCollection
