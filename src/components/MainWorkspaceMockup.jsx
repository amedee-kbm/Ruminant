import { useState } from 'react'
import useAuth from '../hooks/useAuth'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Stack,
  Tabs,
  Text,
  VStack,
  Separator,
} from '@chakra-ui/react'
import { BookOpen, Check, Download, Menu, MoreHorizontal, Palette } from 'lucide-react'

const chapters = [
  { id: 1, title: "Survey: The Author's Promise", status: 'surveyed' },
  { id: 2, title: 'Chapter 1 · Framing the Inquiry', status: 'prepared' },
  { id: 3, title: 'Chapter 2 · Tension & Contrast', status: 'reading' },
  { id: 4, title: 'Chapter 3 · Turning Point', status: 'recite' },
  { id: 5, title: 'Chapter 4 · Synthesis', status: 'todo' },
]

const colorSchemes = [
  {
    id: 'clean',
    label: 'Clean',
    appBg: '#ffffff',
    headerBg: '#f3f5f7',
    headerBorder: '1px solid rgba(41,41,41,0.06)',
    headerHoverBg: 'rgba(41,41,41,0.04)',
    sidebarBg: '#ffffff',
    sidebarBorder: '1px solid rgba(41,41,41,0.06)',
    chapterActiveBg: 'rgba(115,114,110,0.08)',
    chapterInactiveBg: '#ffffff',
    chapterBorder: '1px solid rgba(41,41,41,0.06)',
    contentBg: '#ffffff',
    canvasBg: '#f2f5f7',
    placeholderBorder: '1px dashed rgba(181,180,177,0.6)',
    placeholderText: '#73726e',
    rightPaneBg: '#ffffff',
    rightPaneBorder: '1px solid rgba(41,41,41,0.06)',
    reciteBg: '#f3f5f7',
    reciteBorder: '1px solid rgba(41,41,41,0.06)',
    reviewSeparator: 'rgba(41,41,41,0.08)',
    accent: '#292929',
    accentHover: '#191712',
    primaryText: '#262626',
  },
  {
    id: 'forest',
    label: 'Forest night',
    appBg: '#0b1110',
    headerBg: 'rgba(10,31,24,0.9)',
    headerBorder: '1px solid rgba(15,118,110,0.4)',
    headerHoverBg: 'rgba(34,197,94,0.1)',
    sidebarBg: 'rgba(6,24,18,0.95)',
    sidebarBorder: '1px solid rgba(15,118,110,0.4)',
    chapterActiveBg: 'rgba(16,185,129,0.16)',
    chapterInactiveBg: 'rgba(15,23,42,0.7)',
    chapterBorder: '1px solid rgba(15,118,110,0.6)',
    contentBg: '#020817',
    canvasBg: '#022c22',
    placeholderBorder: '1px dashed rgba(34,197,94,0.6)',
    placeholderText: 'rgba(148,163,184,0.9)',
    rightPaneBg: 'rgba(6,24,18,0.98)',
    rightPaneBorder: '1px solid rgba(15,118,110,0.5)',
    reciteBg: 'rgba(15,23,42,0.9)',
    reciteBorder: '1px solid rgba(34,197,94,0.6)',
    reviewSeparator: 'rgba(148,163,184,0.5)',
    accent: '#22c55e',
    accentHover: '#16a34a',
  },
  {
    id: 'inkBronze',
    label: 'Ink & bronze',
    // palette: #ffffff, #676f9d, #424769, #2d3250, #f9b17a
    appBg: '#0b1020',
    headerBg: 'rgba(24,31,55,0.95)',
    headerBorder: '1px solid rgba(103,118,157,0.7)',
    headerHoverBg: 'rgba(249,177,122,0.16)',
    sidebarBg: '#2d3250',
    sidebarBorder: '1px solid rgba(66,71,105,0.9)',
    chapterActiveBg: 'rgba(103,118,157,0.4)',
    chapterInactiveBg: 'rgba(24,31,55,0.9)',
    chapterBorder: '1px solid rgba(103,118,157,0.9)',
    contentBg: '#161927',
    canvasBg: '#424769',
    placeholderBorder: '1px dashed rgba(249,177,122,0.8)',
    placeholderText: 'rgba(226,232,240,0.9)',
    rightPaneBg: '#2d3250',
    rightPaneBorder: '1px solid rgba(66,71,105,0.9)',
    reciteBg: 'rgba(24,31,55,0.95)',
    reciteBorder: '1px solid rgba(249,177,122,0.8)',
    reviewSeparator: 'rgba(63,78,122,0.9)',
    accent: '#f9b17a',
    accentHover: '#f59e5b',
  },
  {
    id: 'desert',
    label: 'Desert dusk',
    appBg: '#1b130a',
    headerBg: 'rgba(48,29,18,0.96)',
    headerBorder: '1px solid rgba(248,250,252,0.12)',
    headerHoverBg: 'rgba(249,177,122,0.18)',
    sidebarBg: 'rgba(38,23,14,0.98)',
    sidebarBorder: '1px solid rgba(120,63,34,0.8)',
    chapterActiveBg: 'rgba(249,177,122,0.22)',
    chapterInactiveBg: 'rgba(30,18,12,0.9)',
    chapterBorder: '1px solid rgba(180,83,9,0.9)',
    contentBg: '#1f130b',
    canvasBg: '#3b2412',
    placeholderBorder: '1px dashed rgba(249,177,122,0.7)',
    placeholderText: 'rgba(248,250,252,0.8)',
    rightPaneBg: 'rgba(38,23,14,0.98)',
    rightPaneBorder: '1px solid rgba(180,83,9,0.9)',
    reciteBg: 'rgba(30,18,12,0.96)',
    reciteBorder: '1px solid rgba(249,177,122,0.8)',
    reviewSeparator: 'rgba(120,63,34,0.9)',
    accent: '#f97316',
    accentHover: '#ea580c',
  },
  {
    id: 'cyber',
    label: 'Cyber teal',
    appBg: '#020617',
    headerBg: 'rgba(8,47,73,0.96)',
    headerBorder: '1px solid rgba(34,211,238,0.7)',
    headerHoverBg: 'rgba(45,212,191,0.18)',
    sidebarBg: 'rgba(8,47,73,0.96)',
    sidebarBorder: '1px solid rgba(22,163,74,0.8)',
    chapterActiveBg: 'rgba(45,212,191,0.18)',
    chapterInactiveBg: 'rgba(15,23,42,0.96)',
    chapterBorder: '1px solid rgba(34,211,238,0.8)',
    contentBg: '#020617',
    canvasBg: '#0f172a',
    placeholderBorder: '1px dashed rgba(34,211,238,0.8)',
    placeholderText: 'rgba(148,163,184,0.95)',
    rightPaneBg: 'rgba(8,47,73,0.98)',
    rightPaneBorder: '1px solid rgba(34,211,238,0.8)',
    reciteBg: 'rgba(15,23,42,0.98)',
    reciteBorder: '1px solid rgba(45,212,191,0.9)',
    reviewSeparator: 'rgba(34,211,238,0.7)',
    accent: '#22c55e',
    accentHover: '#16a34a',
  },
  {
    id: 'paper',
    label: 'Paper & ink',
    appBg: '#020617',
    headerBg: 'rgba(15,23,42,0.97)',
    headerBorder: '1px solid rgba(148,163,184,0.7)',
    headerHoverBg: 'rgba(148,163,184,0.25)',
    sidebarBg: '#020617',
    sidebarBorder: '1px solid rgba(30,64,175,0.9)',
    chapterActiveBg: 'rgba(15,23,42,0.95)',
    chapterInactiveBg: 'rgba(15,23,42,0.8)',
    chapterBorder: '1px solid rgba(148,163,184,0.7)',
    contentBg: '#020617',
    canvasBg: '#111827',
    placeholderBorder: '1px dashed rgba(148,163,184,0.7)',
    placeholderText: 'rgba(209,213,219,0.95)',
    rightPaneBg: '#020617',
    rightPaneBorder: '1px solid rgba(148,163,184,0.7)',
    reciteBg: 'rgba(15,23,42,0.96)',
    reciteBorder: '1px solid rgba(148,163,184,0.7)',
    reviewSeparator: 'rgba(148,163,184,0.7)',
    accent: '#3b82f6',
    accentHover: '#2563eb',
  },
  {
    id: 'dark',
    label: 'Pure dark',
    appBg: '#020617',
    headerBg: 'rgba(15,23,42,0.98)',
    headerBorder: '1px solid rgba(31,41,55,0.9)',
    headerHoverBg: 'rgba(31,41,55,0.9)',
    sidebarBg: '#020617',
    sidebarBorder: '1px solid rgba(31,41,55,0.9)',
    chapterActiveBg: 'rgba(31,41,55,0.95)',
    chapterInactiveBg: 'rgba(15,23,42,0.95)',
    chapterBorder: '1px solid rgba(55,65,81,0.9)',
    contentBg: '#020617',
    canvasBg: '#030712',
    placeholderBorder: '1px dashed rgba(75,85,99,0.9)',
    placeholderText: 'rgba(156,163,175,0.95)',
    rightPaneBg: '#020617',
    rightPaneBorder: '1px solid rgba(31,41,55,0.9)',
    reciteBg: 'rgba(15,23,42,0.98)',
    reciteBorder: '1px solid rgba(55,65,81,0.9)',
    reviewSeparator: 'rgba(55,65,81,0.9)',
    accent: '#e5e7eb',
    accentHover: '#f9fafb',
  },
]

const statusColors = {
  surveyed: 'green',
  prepared: 'yellow',
  reading: 'blue',
  recite: 'purple',
  todo: 'gray',
}

const MainWorkspaceMockup = () => {
  const [schemeIndex, setSchemeIndex] = useState(0)
  const { signOut } = useAuth()
  const scheme = colorSchemes[schemeIndex]

  const cycleScheme = () => {
    setSchemeIndex((prev) => (prev + 1) % colorSchemes.length)
  }
  const handleLogout = async () => {
    await signOut()
  }

  return (
    <Flex direction="column" height="100vh" bg={scheme.appBg} color={scheme.primaryText}>
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
            color="white"
            _hover={{ bg: scheme.headerHoverBg }}
          >
            <Menu size={18} />
          </IconButton>
          <Box>
            <Text fontSize="sm" opacity={0.7}>
              Ruminant / Steal Like an Artist
            </Text>
            <Heading size="md">Chapter 2 · Tension & Contrast</Heading>
          </Box>
        </HStack>
        <HStack spacing={3}>
          <Button size="sm" leftIcon={<Palette size={16} />} variant="ghost" onClick={cycleScheme}>
            {scheme.label}
          </Button>
          <Button size="sm" leftIcon={<Download size={16} />} variant="outline">
            Export
          </Button>
          <Button onClick={handleLogout}>Log out</Button>
          <IconButton aria-label="more" variant="outline" colorScheme="whiteAlpha">
            <MoreHorizontal size={16} />
          </IconButton>
        </HStack>
      </Flex>

      <Flex flex="1" overflow="hidden">
        <Box
          width="240px"
          borderRight={scheme.sidebarBorder}
          bg={scheme.sidebarBg}
          px={4}
          py={6}
          overflowY="auto"
        >
          <HStack justify="space-between" mb={4}>
            <Text fontWeight="bold" fontSize="sm" textTransform="uppercase">
              Chapters
            </Text>
            <Badge colorScheme="green" borderRadius="sm">
              3/12
            </Badge>
          </HStack>
          <VStack align="stretch" spacing={3}>
            {chapters.map((ch) => (
              <Box
                key={ch.id}
                p={3}
                borderRadius="md"
                bg={ch.status === 'reading' ? scheme.chapterActiveBg : scheme.chapterInactiveBg}
                border={scheme.chapterBorder}
              >
                <Text fontSize="xs" textTransform="uppercase" opacity={0.6}>
                  Chapter {ch.id}
                </Text>
                <Text fontSize="sm" fontWeight="medium">
                  {ch.title}
                </Text>
                <Badge
                  mt={2}
                  size="sm"
                  colorScheme={statusColors[ch.status]}
                  textTransform="capitalize"
                >
                  {ch.status}
                </Badge>
              </Box>
            ))}
          </VStack>
        </Box>

        <Flex flex="1" direction="column" bg={scheme.contentBg} px={6} py={6} gap={4}>
          <Box flex="1" borderRadius="lg" bg={scheme.canvasBg} p={6} position="relative">
            <HStack mb={4} spacing={3}>
              <BookOpen size={18} />
              <Text fontWeight="semibold">Reading canvas</Text>
              <Badge colorScheme="blue">SQ3R · Read</Badge>
            </HStack>
            <Box
              flex="1"
              border={scheme.placeholderBorder}
              borderRadius="md"
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color={scheme.placeholderText}
              fontSize="sm"
            >
              epub.js view placeholder — select text to create prompts
            </Box>
            <HStack spacing={3} mt={4} justify="space-between">
              <HStack spacing={2}>
                <Badge colorScheme="yellow">Survey</Badge>
                <Badge colorScheme="green">Question</Badge>
                <Badge colorScheme="purple">Recite</Badge>
                <Badge colorScheme="teal">Review</Badge>
              </HStack>
              <HStack spacing={2}>
                <Button size="sm" variant="ghost">
                  ← Previous
                </Button>
                <Button
                  size="sm"
                  bg={scheme.accent}
                  _hover={{ bg: scheme.accentHover }}
                  color="black"
                >
                  Next →
                </Button>
              </HStack>
            </HStack>
          </Box>
          <HStack spacing={4}>
            <Button flex="1" variant="outline">
              Add Reflection
            </Button>
            <Button
              flex="1"
              leftIcon={<Check size={16} />}
              bg={scheme.accent}
              _hover={{ bg: scheme.accentHover }}
              color="black"
            >
              Mark chapter done
            </Button>
          </HStack>
        </Flex>

        <Box
          width="360px"
          borderLeft={scheme.rightPaneBorder}
          bg={scheme.rightPaneBg}
          backdropFilter="blur(6px)"
          px={5}
          py={6}
          overflowY="auto"
        >
          <Tabs.Root defaultValue="survey" variant="enclosed" colorScheme="green">
            <Tabs.List mb={4}>
              <Tabs.Trigger value="survey">Survey</Tabs.Trigger>
              <Tabs.Trigger value="question">Question</Tabs.Trigger>
              <Tabs.Trigger value="recite">Recite</Tabs.Trigger>
              <Tabs.Trigger value="review">Review</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="survey">
              <Heading size="xs" textTransform="uppercase" opacity={0.6}>
                Survey prompts
              </Heading>
              <Text mt={3} fontSize="sm" lineHeight="tall">
                • I expect the author to contrast imitation vs originality. <br />• Key evidence
                likely comes from Chapter 4 references.
              </Text>
              <Button mt={4} size="sm" variant="outline" width="100%">
                Edit survey notes
              </Button>
            </Tabs.Content>
            <Tabs.Content value="question">
              <Heading size="xs" textTransform="uppercase" opacity={0.6}>
                Active questions
              </Heading>
              <Stack spacing={3} mt={3}>
                <Box border="1px solid rgba(255,255,255,0.15)" borderRadius="md" p={3}>
                  <Text fontWeight="semibold" fontSize="sm">
                    How does contrast build tension?
                  </Text>
                  <Text fontSize="xs" opacity={0.7}>
                    Added from highlight · Jump to §2.3
                  </Text>
                </Box>
                <Box border="1px solid rgba(255,255,255,0.15)" borderRadius="md" p={3}>
                  <Text fontWeight="semibold" fontSize="sm">
                    Which quote best summarizes the author&apos;s advice?
                  </Text>
                  <Text fontSize="xs" opacity={0.7}>
                    Prepared before reading
                  </Text>
                </Box>
              </Stack>
              <Button mt={4} size="sm" colorScheme="green" width="100%">
                Add question
              </Button>
            </Tabs.Content>
            <Tabs.Content value="recite">
              <Heading size="xs" textTransform="uppercase" opacity={0.6}>
                Recite
              </Heading>
              <Text fontSize="sm" mt={3} opacity={0.8}>
                Without peeking back, summarize what you just read.
              </Text>
              <Box
                mt={3}
                p={3}
                borderRadius="md"
                border={scheme.reciteBorder}
                bg={scheme.reciteBg}
                minHeight="120px"
              >
                <Text fontSize="sm" color="rgba(248,250,252,0.9)">
                  “Contrast forces constraint, which keeps the creative problem solvable...”
                </Text>
              </Box>
              <Button mt={4} size="sm" variant="outline" width="100%">
                Continue reciting
              </Button>
            </Tabs.Content>
            <Tabs.Content value="review">
              <Heading size="xs" textTransform="uppercase" opacity={0.6}>
                Review
              </Heading>
              <Text fontSize="sm" mt={3}>
                • Answered 4/6 prompts <br />• 2 highlights waiting for notes
              </Text>
              <Separator my={4} borderColor={scheme.reviewSeparator} borderWidth="1px" />
              <Button width="100%" colorScheme="green" size="sm">
                Generate summary
              </Button>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </Flex>
    </Flex>
  )
}

export default MainWorkspaceMockup
