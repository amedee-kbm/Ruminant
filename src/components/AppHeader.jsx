import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { Box, Button, HStack, IconButton, Menu, Portal, Text } from '@chakra-ui/react'
import { ChevronRight, CircleUser, LogOut, Moon, Sun } from 'lucide-react'

import useAuth from '../hooks/useAuth'
import { cleanTheme } from '../constants/theme'
import { isDark, onSystemModeChange, storeMode } from '../lib/colorMode'

/** Switches between light and dark. Until first used, the app follows the OS setting. */
const ColorModeButton = () => {
  const [dark, setDark] = useState(isDark)

  // While following the OS, keep the icon in step when the OS setting changes
  useEffect(() => onSystemModeChange(() => setDark(isDark())), [])

  const toggle = () => {
    storeMode(dark ? 'light' : 'dark')
    setDark(!dark)
  }

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <IconButton variant="ghost" size="sm" aria-label={label} title={label} onClick={toggle}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  )
}

/** The signed-in user's email and sign out */
const AccountMenu = ({ email, onSignOut }) => (
  <Menu.Root positioning={{ placement: 'bottom-end' }}>
    <Menu.Trigger asChild>
      <IconButton variant="ghost" size="sm" aria-label="Account">
        <CircleUser size={18} />
      </IconButton>
    </Menu.Trigger>
    <Portal>
      <Menu.Positioner>
        <Menu.Content minW="220px">
          <Menu.ItemGroup>
            <Menu.ItemGroupLabel fontWeight={400} color={cleanTheme.placeholderText}>
              {email}
            </Menu.ItemGroupLabel>
          </Menu.ItemGroup>
          <Menu.Separator />
          <Menu.Item value="sign-out" onClick={onSignOut}>
            <LogOut size={16} />
            Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
)

/**
 * Sticky header shared by every page but sign-in: wordmark (home), an optional breadcrumb,
 * page actions passed as children, and the account menu (or a sign-in link for guests).
 */
const AppHeader = ({ crumb, children }) => {
  const { user, signOut } = useAuth()

  return (
    <HStack
      as="header"
      justify="space-between"
      gap={3}
      px={{ base: 3, md: 6 }}
      h="56px"
      borderBottom={cleanTheme.headerBorder}
      position="sticky"
      top={0}
      bg={cleanTheme.headerBg}
      backdropFilter="blur(8px)"
      zIndex={10}
    >
      <HStack as="nav" aria-label="Breadcrumb" gap={1} minW={0}>
        <Box
          asChild
          fontFamily={cleanTheme.serif}
          fontWeight={700}
          fontSize="lg"
          px={2}
          py={1}
          borderRadius="md"
          _hover={{ bg: cleanTheme.headerHoverBg }}
          flexShrink={0}
        >
          <RouterLink to="/">Ruminant</RouterLink>
        </Box>
        {crumb && (
          <>
            <ChevronRight size={16} color={cleanTheme.placeholderText} style={{ flexShrink: 0 }} />
            <Text px={2} lineClamp={1} color={cleanTheme.placeholderText} aria-current="page">
              {crumb}
            </Text>
          </>
        )}
      </HStack>

      <HStack gap={1} flexShrink={0}>
        {children}
        <ColorModeButton />
        {user ? (
          <AccountMenu email={user.email} onSignOut={signOut} />
        ) : (
          <Button asChild size="sm" variant="outline" ml={1}>
            <RouterLink to="/sign-in">Sign in</RouterLink>
          </Button>
        )}
      </HStack>
    </HStack>
  )
}

export default AppHeader
