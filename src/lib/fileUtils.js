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
