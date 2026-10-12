import { useState } from 'react'
import { Box, Button, Field, Heading, Input, Text, VStack } from '@chakra-ui/react'
import { MailCheck } from 'lucide-react'

import login_bg from '../assets/login_bg.jpg'
import supabase from '../supabaseClient'
import { accentButtonProps, cleanTheme } from '../constants/theme'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)

  useDocumentTitle('Sign in')

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setError(error.error_description || error.message)
    } else {
      setSentTo(email)
    }
    setLoading(false)
  }

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

          {sentTo ? (
            <VStack align="flex-start" gap={3}>
              <MailCheck size={28} color={cleanTheme.done} />
              <Text>
                We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device to
                continue.
              </Text>
              <Button variant="plain" p={0} h="auto" onClick={() => setSentTo(null)}>
                <Text as="span" fontSize="sm" textDecoration="underline">
                  Use a different email
                </Text>
              </Button>
            </VStack>
          ) : (
            <VStack as="form" onSubmit={handleLogin} align="stretch" gap={4}>
              <Field.Root required invalid={!!error}>
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  size="lg"
                  autoFocus
                />
                {error && <Field.ErrorText>{error}</Field.ErrorText>}
                <Field.HelperText>
                  No password. We’ll email you a link; new accounts are created automatically.
                </Field.HelperText>
              </Field.Root>
              <Button type="submit" size="lg" {...accentButtonProps} loading={loading}>
                Send sign-in link
              </Button>
            </VStack>
          )}
        </VStack>
      </Box>
    </Box>
  )
}

export default Login
