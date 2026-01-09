import { Box, HStack, Text, VStack, Badge } from '@chakra-ui/react'

const statusColors = {
  surveyed: 'green',
  prepared: 'yellow',
  reading: 'blue',
  recite: 'purple',
  todo: 'gray',
}

const ChaptersSidebar = ({ chapters, currentChapterId, scheme, onChapterSelect }) => {
  // Count chapters with status that is not 'todo' (if status field exists)
  const completedCount = chapters?.filter((ch) => ch.status && ch.status !== 'todo').length || 0
  const totalCount = chapters?.length || 0

  return (
    <Box
      width="240px"
      borderRight={scheme.sidebarBorder}
      bg={scheme.sidebarBg}
      px={4}
      py={6}
      overflowY="auto"
    >
      <HStack justify="space-between" mb={4}>
        <Text fontWeight="bold" fontSize="sm" textTransform="uppercase" color={scheme.primaryText}>
          Chapters
        </Text>
        <Badge colorScheme="green" borderRadius="sm">
          {completedCount}/{totalCount}
        </Badge>
      </HStack>
      <VStack align="stretch" spacing={3}>
        {chapters && chapters.length > 0 ? (
          chapters.map((ch) => (
            <Box
              key={ch.id}
              p={3}
              borderRadius="md"
              bg={ch.id === currentChapterId ? scheme.chapterActiveBg : scheme.chapterInactiveBg}
              border={scheme.chapterBorder}
              cursor="pointer"
              onClick={() => onChapterSelect?.(ch.id)}
              _hover={{ bg: scheme.chapterActiveBg }}
            >
              <Text
                fontSize="xs"
                textTransform="uppercase"
                opacity={0.6}
                color={scheme.primaryText}
              >
                {ch.chapter_index !== null && ch.chapter_index !== undefined
                  ? `Chapter ${ch.chapter_index + 1}`
                  : `Chapter ${ch.id}`}
              </Text>
              <Text fontSize="sm" fontWeight="medium" color={scheme.primaryText}>
                {ch.title || 'Untitled Chapter'}
              </Text>
              {ch.status && (
                <Badge
                  mt={2}
                  size="sm"
                  colorScheme={statusColors[ch.status] || 'gray'}
                  textTransform="capitalize"
                >
                  {ch.status}
                </Badge>
              )}
            </Box>
          ))
        ) : (
          <Text fontSize="sm" color={scheme.placeholderText} opacity={0.7}>
            No chapters available
          </Text>
        )}
      </VStack>
    </Box>
  )
}

export default ChaptersSidebar
