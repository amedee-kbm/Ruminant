import { useCallback, useEffect, useRef, useState } from 'react'

const AUTOSAVE_DELAY_MS = 1000

/**
 * Debounced saving of the latest value passed to `schedule`. Pending changes are saved
 * on unmount, and the browser warns before closing the tab while any are unsaved.
 * @returns {{ status: 'idle'|'pending'|'saving'|'saved'|'error', schedule, retry }}
 */
export const useAutosave = (save) => {
  const [status, setStatus] = useState('idle')
  const saveRef = useRef(save)
  const pendingRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const flush = useCallback(async () => {
    clearTimeout(timeoutRef.current)
    const value = pendingRef.current
    if (value === null) return
    pendingRef.current = null

    setStatus('saving')
    try {
      await saveRef.current(value)
      // Newer edits may have arrived while the save was in flight
      setStatus(pendingRef.current === null ? 'saved' : 'pending')
    } catch (err) {
      console.error('Autosave failed:', err)
      pendingRef.current ??= value
      setStatus('error')
    }
  }, [])

  const schedule = useCallback(
    (value) => {
      pendingRef.current = value
      setStatus('pending')
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS)
    },
    [flush]
  )

  useEffect(() => () => void flush(), [flush])

  useEffect(() => {
    const warnIfUnsaved = (e) => {
      if (pendingRef.current !== null) e.preventDefault()
    }
    window.addEventListener('beforeunload', warnIfUnsaved)
    return () => window.removeEventListener('beforeunload', warnIfUnsaved)
  }, [])

  return { status, schedule, retry: flush }
}
