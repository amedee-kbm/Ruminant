/**
 * Utility functions for file operations
 */

/**
 * Converts a data URL to a Blob
 * @param {string} dataUrl - The data URL to convert
 * @returns {Promise<Blob>} - The blob representation
 */
export const dataUrlToBlob = async (dataUrl) => {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Sanitizes a file name by removing special characters and normalizing
 * @param {string} name - The original file name
 * @param {string} fallbackExt - The fallback extension if none is found
 * @returns {string} - The sanitized file name
 */
export const sanitizeFileName = (name, fallbackExt = 'epub') => {
  if (!name) return `book-${Date.now()}.${fallbackExt}`
  const parts = name.split('.')
  const ext = parts.length > 1 ? parts.pop() : fallbackExt
  const base = parts.join('.') || `book-${Date.now()}`
  const safe = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${safe || `book-${Date.now()}`}.${ext}`
}


