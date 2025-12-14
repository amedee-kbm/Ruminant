import { HStack, Flex, Box, Text, Heading, Button, IconButton } from '@chakra-ui/react'
import { BookOpen, Download, Menu, MoreHorizontal, Palette } from 'lucide-react'
import useAuth from '../../hooks/useAuth'

const WorkspaceHeader = ({ book, scheme, onCycleScheme, onExport }) => {
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={6}
      py={4}
      borderBottom={scheme.headerBorder}
      bg={scheme.headerBg}
      backdropFilter="blur(6px)"
    >
      <HStack spacing={4}>
        <IconButton
          aria-label="menu"
          variant="ghost"
          color={scheme.primaryText}
          _hover={{ bg: scheme.headerHoverBg }}
        >
          <Menu size={18} />
        </IconButton>
        <Box>
          <Text fontSize="sm" opacity={0.7} color={scheme.primaryText}>
            Ruminant / {book?.title || 'Loading...'}
          </Text>
          <Heading size="md" color={scheme.primaryText}>
            {book?.currentChapter || 'Select a chapter'}
          </Heading>
        </Box>
      </HStack>
      <HStack spacing={3}>
        <Button
          size="sm"
          leftIcon={<Palette size={16} />}
          variant="ghost"
          onClick={onCycleScheme}
          color={scheme.primaryText}
        >
          {scheme.label}
        </Button>
        <Button
          size="sm"
          leftIcon={<Download size={16} />}
          variant="outline"
          onClick={onExport}
          color={scheme.primaryText}
        >
          Export
        </Button>
        <Button onClick={handleLogout} color={scheme.primaryText}>
          Log out
        </Button>
        <IconButton
          aria-label="more"
          variant="outline"
          colorScheme="whiteAlpha"
          color={scheme.primaryText}
        >
          <MoreHorizontal size={16} />
        </IconButton>
      </HStack>
    </Flex>
  )
}

export default WorkspaceHeader

