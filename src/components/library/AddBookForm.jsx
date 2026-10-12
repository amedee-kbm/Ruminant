import { useState } from 'react'
import { Box, Button, Field, HStack, Input, Text, Textarea, VStack } from '@chakra-ui/react'

import { accentButtonProps, cleanTheme } from '../../constants/theme'

const MAX_NUMBERED_CHAPTERS = 200

/** "12" becomes Chapter 1…12; anything else is one chapter title per line */
const parseChapters = (text) => {
  const trimmed = text.trim()
  if (/^\d+$/.test(trimmed)) {
    const count = Math.min(Number(trimmed), MAX_NUMBERED_CHAPTERS)
    return Array.from({ length: count }, (_, i) => ({ title: `Chapter ${i + 1}` }))
  }
  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({ title }))
}

/** Add a book by hand, for paper and Kindle books without an EPUB */
const AddBookForm = ({ onSubmit, onCancel, onImportEpub }) => {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [chaptersText, setChaptersText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const chapters = parseChapters(chaptersText)
  const canSubmit = title.trim() && chapters.length > 0 && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), author: author.trim(), chapters })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      bg={cleanTheme.canvasBg}
      borderRadius="lg"
      p={5}
      border="1px solid"
      borderColor={cleanTheme.border}
    >
      <VStack align="stretch" gap={4}>
        <Field.Root required>
          <Field.Label>Title</Field.Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            bg={cleanTheme.surface}
            autoFocus
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Author</Field.Label>
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            bg={cleanTheme.surface}
          />
        </Field.Root>
        <Field.Root required>
          <Field.Label>Chapters</Field.Label>
          <Textarea
            value={chaptersText}
            onChange={(e) => setChaptersText(e.target.value)}
            placeholder={'One title per line, or just a number like 12'}
            minH="100px"
            css={{ fieldSizing: 'content' }}
            bg={cleanTheme.surface}
          />
          <Field.HelperText>
            {chapters.length > 0
              ? `${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'}`
              : 'Copy them from the table of contents, or type how many there are.'}
          </Field.HelperText>
        </Field.Root>

        <HStack justify="space-between" wrap="wrap" gap={3}>
          <Text fontSize="sm" color={cleanTheme.placeholderText}>
            Have an EPUB?{' '}
            <Button variant="plain" size="sm" p={0} h="auto" onClick={onImportEpub}>
              <Text as="span" textDecoration="underline">
                Import it instead
              </Text>
            </Button>
          </Text>
          <HStack gap={2}>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" {...accentButtonProps} disabled={!canSubmit}>
              {submitting ? 'Adding…' : 'Add book'}
            </Button>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  )
}

export default AddBookForm
