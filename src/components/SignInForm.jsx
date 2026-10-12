import { useState } from 'react'
import { Button, Field, Input, Text, VStack } from '@chakra-ui/react'
import { MailCheck } from 'lucide-react'

import supabase from '../supabaseClient'
import { accentButtonProps, cleanTheme } from '../constants/theme'

/** Emails a magic link. Signing in and signing up are the same step. */
const SignInForm = ({ submitLabel = 'Send sign-in link' }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const [error, setError] = useState(null)

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

  if (sentTo) {
    return (
      <VStack align="flex-start" gap={3}>
        <MailCheck size={28} color={cleanTheme.done} />
        <Text>
          We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device to continue.
        </Text>
        <Button variant="plain" p={0} h="auto" onClick={() => setSentTo(null)}>
          <Text as="span" fontSize="sm" textDecoration="underline">
            Use a different email
          </Text>
        </Button>
      </VStack>
    )
  }

  return (
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
        {submitLabel}
      </Button>
    </VStack>
  )
}

export default SignInForm
