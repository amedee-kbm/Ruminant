import { CloseButton, Dialog, Portal, Text } from '@chakra-ui/react'

import { cleanTheme } from '../constants/theme'
import SignInForm from './SignInForm'

/** Asks a guest to sign up when they try something that needs an account */
const SignUpDialog = ({ open, onClose }) => (
  <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner px={4}>
        <Dialog.Content>
          <Dialog.Header flexDirection="column" alignItems="flex-start" gap={2}>
            <Dialog.Title fontFamily={cleanTheme.serif} fontSize="2xl">
              Add your own books
            </Dialog.Title>
            <Text color={cleanTheme.placeholderText}>
              Sign up to keep your questions, notes and takeaways for every book you read. It’s
              free.
            </Text>
          </Dialog.Header>
          <Dialog.Body pb={6}>
            <SignInForm submitLabel="Sign up with email" />
          </Dialog.Body>
          <Dialog.CloseTrigger asChild>
            <CloseButton size="sm" />
          </Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
)

export default SignUpDialog
