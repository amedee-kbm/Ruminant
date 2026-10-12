import { Link as RouterLink } from 'react-router'
import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react'

import login_bg from '../assets/login_bg.jpg'
import { cleanTheme } from '../constants/theme'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import SignInForm from './SignInForm'

function Login() {
  useDocumentTitle('Sign in')

  return (
    <Box
      minH="100vh"
      bgImage={`url(${login_bg})`}
      bgSize="cover"
      bgPosition="center"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg={cleanTheme.surface}
        borderRadius="xl"
        p={{ base: 6, md: 8 }}
        maxW="420px"
        w="full"
        boxShadow="xl"
      >
        <VStack gap={6} align="stretch">
          <Box>
            <Heading as="h1" fontFamily={cleanTheme.serif} fontSize="3xl" fontWeight={700} mb={2}>
              Ruminant
            </Heading>
            <Text color={cleanTheme.placeholderText}>
              Think about what you read, one chapter at a time.
            </Text>
          </Box>

          <SignInForm />

          <Link asChild fontSize="sm" color={cleanTheme.placeholderText} alignSelf="center">
            <RouterLink to="/">Look around the sample books first</RouterLink>
          </Link>
        </VStack>
      </Box>
    </Box>
  )
}

export default Login
