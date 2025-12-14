import { useState } from 'react'
import { Box, VStack, Heading, Text, Input, Button, Field, Link } from '@chakra-ui/react'
import login_bg from '../assets/login_bg.jpg'
import supabase from '../supabaseClient'

function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      alert(error.error_description || error.message)
    } else {
      alert('Check your email for the login link!')
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
      <Box bg="white" borderRadius="xl" p={8} maxW="500px" w="full" boxShadow="xl">
        <VStack spacing={6} align="stretch">
          {/* Logo */}
          <Box textAlign="center" mb={2}>
            <Box
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w="60px"
              h="60px"
              borderRadius="full"
              border="3px solid"
              borderColor="teal.500"
              mb={4}
            >
              <Text fontSize="2xl" fontWeight="bold" color="teal.600" transform="rotate(-15deg)">
                r
              </Text>
            </Box>
            <Heading as="h1" size="lg" fontWeight="normal" color="gray.700" letterSpacing="tight">
              ruminant.
            </Heading>
          </Box>

          {/* Welcome Text */}
          <Heading as="h2" size="lg" textAlign="center" fontWeight="normal" color="gray.800">
            Welcome
          </Heading>

          <Text textAlign="center" color="gray.600" fontSize="sm">
            Log in to Ruminant to continue to Account.
          </Text>

          {/* Email Input */}
          <form onSubmit={handleLogin}>
            <Field.Root>
              <Field.Label color="teal.600" fontSize="sm" fontWeight="normal">
                Email address*
              </Field.Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                borderColor="teal.500"
                borderWidth="2px"
                _hover={{ borderColor: 'teal.600' }}
                _focus={{
                  borderColor: 'teal.600',
                  boxShadow: '0 0 0 1px var(--chakra-colors-teal-600)',
                }}
                size="lg"
                bg="white"
                mb={2}
              />
            </Field.Root>

            {/* Continue Button */}
            <Button
              bg="teal.600"
              color="white"
              size="lg"
              _hover={{ bg: 'teal.700' }}
              _active={{ bg: 'teal.800' }}
              fontWeight="semibold"
              py={6}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </Button>
          </form>

          {/* Sign Up Link */}
          <Text textAlign="center" fontSize="sm" color="gray.700">
            Don't have a Ruminant account?{' '}
            <Link color="teal.600" fontWeight="semibold">
              Sign up!
            </Link>
          </Text>
        </VStack>
      </Box>
    </Box>
  )
}

export default Login
