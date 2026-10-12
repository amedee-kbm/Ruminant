import { Box, Button, HStack, Text, Textarea } from '@chakra-ui/react'

import { cleanTheme } from '../../constants/theme'

const SAVE_LABELS = { pending: 'Editing…', saving: 'Saving…', saved: 'Saved' }

/** A borderless writing area marked by a rule in the margin, with an optional serif prompt */
export const WritingArea = ({ prompt, value, onChange, placeholder, minH = '5em' }) => (
  <Box as="label" display="block">
    {prompt && (
      <Text fontFamily={cleanTheme.serif} fontSize="lg" mb={2}>
        {prompt}
      </Text>
    )}
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      minH={minH}
      css={{ fieldSizing: 'content' }}
      resize="none"
      border="none"
      borderLeft="2px solid"
      borderColor={cleanTheme.border}
      borderRadius={0}
      px={3}
      py={1}
      fontSize="md"
      lineHeight={1.7}
      _placeholder={{ color: cleanTheme.faint }}
      _focusVisible={{ outline: 'none', boxShadow: 'none', borderColor: cleanTheme.accent }}
    />
  </Box>
)

/** "Saving…" / "Saved", or a retry button when the last save failed */
export const SaveStatus = ({ autosave }) => (
  <HStack fontSize="xs" color={cleanTheme.faint} minH="24px">
    {autosave.status === 'error' ? (
      <>
        <Text color={cleanTheme.error}>Couldn’t save.</Text>
        <Button size="xs" variant="outline" onClick={autosave.retry}>
          Retry
        </Button>
      </>
    ) : (
      <Text>{SAVE_LABELS[autosave.status]}</Text>
    )}
  </HStack>
)
