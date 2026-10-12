import { useState } from 'react'
import { Box, Button, Dialog, Field, Input, Portal, Text, VStack } from '@chakra-ui/react'
import { Trash2 } from 'lucide-react'

import { accentButtonProps, cleanTheme } from '../../constants/theme'

const EditBookForm = ({ book, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ title: title.trim(), author: author.trim() || null })
      onClose()
    } catch (err) {
      console.error('Saving book details failed:', err)
      setError(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Dialog.Header>
        <Dialog.Title>Edit book</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <VStack gap={4}>
          <Field.Root required>
            <Field.Label>Title</Field.Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field.Root>
          <Field.Root>
            <Field.Label>Author</Field.Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field.Root>
        </VStack>
        {error && (
          <Text mt={3} color={cleanTheme.error} fontSize="sm">
            {error}
          </Text>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" colorPalette="red" onClick={onDelete}>
          <Trash2 size={16} />
          Delete book
        </Button>
        <Box flex="1" />
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" {...accentButtonProps} loading={saving} disabled={!title.trim()}>
          Save
        </Button>
      </Dialog.Footer>
    </form>
  )
}

/** Dialog for a book's title and author; also where the book is deleted from */
const EditBookDialog = ({ open, book, onSave, onDelete, onClose }) => (
  <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner px={4}>
        <Dialog.Content>
          {/* Mounted only while open, so it starts from the current details each time */}
          {open && (
            <EditBookForm book={book} onSave={onSave} onDelete={onDelete} onClose={onClose} />
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
)

export default EditBookDialog
