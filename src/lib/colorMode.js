/**
 * Colour mode: 'system' (follow the OS), 'light' or 'dark', remembered per browser.
 * index.html applies the stored mode before first paint with the same logic; keep the
 * storage key in sync with it.
 */

const STORAGE_KEY = 'ruminant:color-mode'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export const getStoredMode = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system'
  } catch {
    return 'system'
  }
}

export const applyMode = (mode) => {
  const dark = mode === 'dark' || (mode === 'system' && darkQuery().matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export const storeMode = (mode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (err) {
    console.warn('Could not remember colour mode:', err)
  }
  applyMode(mode)
}

export const isDark = () => document.documentElement.classList.contains('dark')

/** Calls `onChange` whenever the OS colour scheme changes; returns an unsubscribe function */
export const onSystemModeChange = (onChange) => {
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Applies the stored mode and follows OS changes while it's 'system'. Call once at startup. */
export const initColorMode = () => {
  applyMode(getStoredMode())
  darkQuery().addEventListener('change', () => {
    if (getStoredMode() === 'system') applyMode('system')
  })
}
