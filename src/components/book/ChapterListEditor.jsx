import { useState } from 'react'
import { Box, Button, HStack, IconButton, Input, Text, VStack } from '@chakra-ui/react'
import { ArrowDown, ArrowUp, Plus, Trash2, Undo2 } from 'lucide-react'

import { accentButtonProps, cleanTheme } from '../../constants/theme'
import { hasNotes } from '../../lib/bookNotes'
import { formatTitle } from '../../lib/formatTitle'

let nextKey = 0
const newKey = () => `new-${nextKey++}`

/**
 * Edit a book's chapter list in one go: rename, reorder, add and remove. Nothing is saved
 * until "Save chapters"; removals can be undone until then.
 */
const ChapterListEditor = ({ chapters, onSave, onCancel }) => {
  const [items, setItems] = useState(() =>
    chapters.map((c) => ({
      key: c.id,
      id: c.id,
      title: formatTitle(c.title),
      hasWriting: hasNotes(c),
      removed: false,
    }))
  )
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (key, fields) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...fields } : item)))

  const move = (index, delta) =>
    setItems((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  const remove = (item) =>
    item.id
      ? update(item.key, { removed: true })
      : setItems((prev) => prev.filter((i) => i.key !== item.key))

  const addChapter = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setItems((prev) => [...prev, { key: newKey(), title: newTitle.trim(), removed: false }])
    setNewTitle('')
  }

  const kept = items.filter((item) => !item.removed)
  const losingWriting = items.filter((item) => item.removed && item.hasWriting).length
  const canSave = kept.every((item) => item.title.trim()) && !saving

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(kept.map(({ id, title }) => ({ id, title: title.trim() })))
    } catch (err) {
      console.error('Saving chapters failed:', err)
      setError(err.message || 'Could not save chapters.')
      setSaving(false)
    }
  }

  return (
    <VStack align="stretch" gap={4}>
      <Text fontSize="sm" color={cleanTheme.placeholderText}>
        Rename, reorder, add or remove chapters. Notes stay with their chapter.
      </Text>

      <VStack align="stretch" gap={1}>
        {items.map((item, index) =>
          item.removed ? (
            <HStack key={item.key} px={2} py={1} gap={2} color={cleanTheme.placeholderText}>
              <Text flex="1" textDecoration="line-through" lineClamp={1}>
                {item.title}
              </Text>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => update(item.key, { removed: false })}
              >
                <Undo2 size={14} />
                Undo
              </Button>
            </HStack>
          ) : (
            <HStack key={item.key} gap={1}>
              <Input
                value={item.title}
                onChange={(e) => update(item.key, { title: e.target.value })}
                aria-label={`Chapter ${index + 1} title`}
                placeholder="Chapter title"
                size="sm"
                bg={cleanTheme.surface}
              />
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Move down"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </IconButton>
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Remove chapter"
                onClick={() => remove(item)}
              >
                <Trash2 size={16} />
              </IconButton>
            </HStack>
          )
        )}
      </VStack>

      <HStack as="form" onSubmit={addChapter} gap={1}>
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New chapter title"
          size="sm"
          bg={cleanTheme.surface}
        />
        <Button type="submit" size="sm" variant="outline" disabled={!newTitle.trim()}>
          <Plus size={16} />
          Add
        </Button>
      </HStack>

      {losingWriting > 0 && (
        <Text fontSize="sm" color={cleanTheme.error}>
          Saving will delete the notes of {losingWriting} removed{' '}
          {losingWriting === 1 ? 'chapter' : 'chapters'}.
        </Text>
      )}
      {error && (
        <Text fontSize="sm" color={cleanTheme.error}>
          {error}
        </Text>
      )}

      <Box borderTop={cleanTheme.headerBorder} pt={4}>
        <HStack justify="flex-end" gap={2}>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button {...accentButtonProps} onClick={save} disabled={!canSave} loading={saving}>
            Save chapters
          </Button>
        </HStack>
      </Box>
    </VStack>
  )
}

export default ChapterListEditor
