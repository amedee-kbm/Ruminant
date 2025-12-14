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
    if (file) {
      if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
        setSelectedFile(file)
        console.log('Selected EPUB file:', file.name)
        onFileSelected?.(file)
      } else {
        alert('Please select a valid EPUB file')
      }
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
