import { useState } from 'react'
import { Button, Dialog, Portal, Text } from '@chakra-ui/react'

import { cleanTheme } from '../constants/theme'

/** Asks before a destructive action; stays open with the error if the action fails */
const ConfirmDialog = ({ open, onClose, title, body, confirmLabel, onConfirm }) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    setError(null)
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      close()
    } catch (err) {
      console.error(`${confirmLabel} failed:`, err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && close()} role="alertdialog">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px={4}>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{body}</Text>
              {error && (
                <Text mt={3} color={cleanTheme.error} fontSize="sm">
                  {error}
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={confirm} loading={busy}>
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export default ConfirmDialog
