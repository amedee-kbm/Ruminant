import {useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router'
import { ReactReader } from 'react-reader'
import '@blocknote/core/fonts/inter.css'
import { useCreateBlockNote, getDefaultReactSlashMenuItems } from '@blocknote/react'
import '../styles/styles.css'
import supabase from '../supabaseClient'
import useAuth from '../hooks/useAuth'

// Test bookId for development/testing
const TEST_BOOK_ID = '5f5ee420-acc0-4627-ac17-95092498f673'

export const MyMVP = () => {
  // Get bookId from route params (from /mvp/:bookId)
  // Fallback to test bookId if not in route
  const { bookId: routeBookId} = useParams()
  const [location, setLocation] = useState(0)
  const [currentChapter, setCurrentChapter] = useState(null)
  const [dbChapter, setDbChapter] = useState(null)
  const [book, setBook] = useState(null)
  const [epubUrl, setEpubUrl] = useState(null)
  const [loadingchapter, setLoadingChapter] = useState(false)
  const [loadingBook, setLoadingBook] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadedChapterId, setLoadedChapterId] = useState(null)
  const saveTimeoutRef = useRef(null)
  const hasUnsavedChangesRef = useRef(false)
  const renditionRef = useRef(null)
  const tocRef = useRef(null)
  const { user } = useAuth()

  // Determine the bookId to use (route param or test fallback)
  const bookId = routeBookId || TEST_BOOK_ID
   
  // Create BlockNote editor instance with coustom slash menu
  const editor = useCreateBlockNote({
    slashMenuItems: (schema) => {
      const defaultItems = getDefaultReactSlashMenuItems(schema)

      // Custom slash menu items for questions, reflections, and notes
      const customItems = [
        {
          title: 'Question',
          onItemClick: async () => {
            try {
              const currentBlock = editor.getTextCursorPosition().block
            }
            
          }
        }
      ]
    }
  })
}
