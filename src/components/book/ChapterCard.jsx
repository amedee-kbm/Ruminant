import { useCallback, useEffect, useRef } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { ArrowRight, Check } from 'lucide-react'

import { useAutosave } from '../../hooks/useAutosave'
import { cleanTheme } from '../../constants/theme'
import { getNotes, hasNotes } from '../../lib/bookNotes'
import { formatTitle } from '../../lib/formatTitle'
import { SaveStatus, WritingArea } from './WritingArea'

/** The chapter number, or a check once it has notes */
const StatusMark = ({ done, number }) => (
  <Box
    w="24px"
    h="24px"
    flexShrink={0}
    borderRadius="full"
    display="grid"
    placeItems="center"
    fontSize="xs"
    fontWeight={600}
    border="1.5px solid"
    borderColor={done ? 'transparent' : cleanTheme.borderStrong}
    bg={done ? cleanTheme.done : 'transparent'}
    color={done ? cleanTheme.surface : cleanTheme.placeholderText}
  >
    {done ? <Check size={14} strokeWidth={3} /> : number}
  </Box>
)

/** One chapter: a row that expands into its notes */
const ChapterCard = ({
  chapter,
  number,
  open,
  hasNext,
  onToggle,
  onNext,
  onChange,
  onSave,
  showSaveStatus = true,
}) => {
  const notes = getNotes(chapter)
  const done = hasNotes(chapter)

  const save = useCallback((value) => onSave(chapter.id, value), [onSave, chapter.id])
  const autosave = useAutosave(save)

  // Bring a newly opened chapter into view, e.g. after "Next chapter" or a shared link
  const cardRef = useRef(null)
  useEffect(() => {
    if (open) cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  const update = (value) => {
    onChange(chapter.id, value)
    autosave.schedule(value)
  }

  return (
    <Box
      ref={cardRef}
      scrollMarginTop="72px"
      borderRadius="xl"
      bg={open ? cleanTheme.surface : 'transparent'}
      boxShadow={open ? cleanTheme.cardShadow : 'none'}
      border="1px solid"
      borderColor={open ? cleanTheme.border : 'transparent'}
      my={open ? 3 : 0}
      transition="box-shadow 0.2s ease, margin 0.2s ease"
    >
      <HStack
        as="button"
        onClick={onToggle}
        aria-expanded={open}
        w="100%"
        px={4}
        py={3}
        gap={4}
        textAlign="left"
        cursor="pointer"
        borderRadius="xl"
        _hover={open ? undefined : { bg: cleanTheme.canvasBg }}
      >
        <StatusMark done={done} number={number} />
        <Box flex="1" minW={0}>
          <Text fontWeight={open ? 600 : 500}>{formatTitle(chapter.title)}</Text>
          {!open && done && (
            <Text fontSize="sm" color={cleanTheme.placeholderText} lineClamp={1}>
              {notes}
            </Text>
          )}
        </Box>
      </HStack>

      {open && (
        <VStack align="stretch" gap={4} px={4} pb={4} pl={{ base: 4, md: '56px' }} pt={1}>
          <WritingArea
            value={notes}
            onChange={update}
            placeholder="What stood out in this chapter?"
            minH="7em"
          />
          <HStack justify="space-between">
            {showSaveStatus ? <SaveStatus autosave={autosave} /> : <Box />}
            {hasNext && (
              <Button size="sm" variant="ghost" onClick={onNext}>
                Next chapter
                <ArrowRight size={16} />
              </Button>
            )}
          </HStack>
        </VStack>
      )}
    </Box>
  )
}

export default ChapterCard
