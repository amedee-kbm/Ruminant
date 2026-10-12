/**
 * Theme values. Colours are CSS variables defined in src/theme.css with light and dark
 * versions, so they work in Chakra style props, inline styles and icon props alike.
 */
export const cleanTheme = {
  appBg: 'var(--r-app-bg)',
  // Cards, inputs and dialogs that sit on the page
  surface: 'var(--r-surface)',
  // Subtle fills: hovered rows, the progress track, the add-book form
  canvasBg: 'var(--r-canvas)',
  primaryText: 'var(--r-text)',
  placeholderText: 'var(--r-muted)',
  faint: 'var(--r-faint)',
  border: 'var(--r-border)',
  borderStrong: 'var(--r-border-strong)',
  headerBorder: '1px solid var(--r-border)',
  headerBg: 'var(--r-header-bg)',
  headerHoverBg: 'var(--r-hover)',
  accent: 'var(--r-accent)',
  accentHover: 'var(--r-accent-hover)',
  onAccent: 'var(--r-on-accent)',
  done: 'var(--r-done)',
  error: 'var(--r-error)',
  cardShadow: 'var(--r-card-shadow)',
  // Book titles and the wordmark; body text stays sans-serif
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  // Width of the single reading column used on every page
  columnWidth: '680px',
}

/** Props for the primary (filled) button, which inverts in dark mode */
export const accentButtonProps = {
  bg: cleanTheme.accent,
  color: cleanTheme.onAccent,
  _hover: { bg: cleanTheme.accentHover },
}
