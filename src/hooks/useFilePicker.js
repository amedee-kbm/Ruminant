import { useState, useRef } from 'react'

export const useFilePicker = (options = {}) => {
  const { accept = '.epub,application/epub+zip', onFileSelected } = options
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again (e.g. after a failed upload) still fires onChange
    event.target.value = ''
    if (!file) return

    if (file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub')) {
      setSelectedFile(file)
      onFileSelected?.(file)
    } else {
      alert('Please select a valid EPUB file')
    }
  }

  return {
    fileInputRef,
    selectedFile,
    handleUploadClick,
    handleFileChange,
    accept,
  }
}
