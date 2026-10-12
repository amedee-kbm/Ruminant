import { useCallback } from 'react'
import { Box } from '@chakra-ui/react'

import { useAutosave } from '../../hooks/useAutosave'
import { SaveStatus, WritingArea } from './WritingArea'

/** One of the book's own fields (question or takeaway), saved as you type */
const BookPrompt = ({
  field,
  value,
  prompt,
  placeholder,
  onChange,
  onSave,
  showSaveStatus = true,
}) => {
  const save = useCallback(
    (text) => onSave({ [field]: text.trim() ? text : null }),
    [onSave, field]
  )
  const autosave = useAutosave(save)

  const update = (text) => {
    onChange({ [field]: text })
    autosave.schedule(text)
  }

  return (
    <Box>
      <WritingArea
        prompt={prompt}
        value={value || ''}
        onChange={update}
        placeholder={placeholder}
      />
      {showSaveStatus && (
        <Box pl={3} pt={1}>
          <SaveStatus autosave={autosave} />
        </Box>
      )}
    </Box>
  )
}

export default BookPrompt
