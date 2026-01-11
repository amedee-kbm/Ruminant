import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ReactReader } from 'react-reader'

import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

import { BlockNoteView } from '@blocknote/mantine'

import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from '@blocknote/react'

import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'

import supabase from '../supabaseClient'
import useAuth from '../hooks/useAuth'
import ErrorBoundary from './workspace/ErrorBoundary'

const TEST_BOOK_ID = '5f5ee420-acc0-4627-ac17-95092498f673'

export const MVP = () => {
  const { bookId: routeBookId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const bookId = routeBookId || TEST_BOOK_ID
  const userId = user?.id

  const [location, setLocation] = useState(0)
  const [currentChapter, setCurrentChapter] = useState(null)
  const [dbChapter, setDbChapter] = useState(null)
  const [book, setBook] = useState(null)
  const [epubUrl, setEpubUrl] = useState(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [loadingChapter, setLoadingChapter] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditorLoaded, setIsEditorLoaded] = useState(false)
  const [loadedChapterId, setLoadedChapterId] = useState(null)

  // Notes library
  const [chaptersList, setChaptersList] = useState([])

  // Draft handling
  const [draftAvailable, setDraftAvailable] = useState(false)
  const [draftContent, setDraftContent] = useState(null)

  const getDraftKey = (chapterId) => `draft:${bookId}:${chapterId}`

  const chapterHasDraft = (chapterId) => {
    try {
      const d = localStorage.getItem(getDraftKey(chapterId))
      return !!(d && d.trim())
    } catch (err) {
      return false
    }
  }

  // View mode: 'read' | 'notes'
  const [viewMode, setViewMode] = useState('read')

  // Summary state
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [concatenatedNotes, setConcatenatedNotes] = useState('')
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('md')

  // Questions and Reflections state
  const [questionsList, setQuestionsList] = useState([])
  const [reflectionsList, setReflectionsList] = useState([])
  const [showChapters, setShowChapters] = useState(true) // Default to true (expanded)
  const [showQuestions, setShowQuestions] = useState(false)
  const [showReflections, setShowReflections] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null) // For inline editing in list
  const [openQuestion, setOpenQuestion] = useState(null) // For question open in main editor
  const [editingReflection, setEditingReflection] = useState(null)
  const [loadingReflection, setLoadingReflection] = useState(false)
  const [reflectionMarkdownToLoad, setReflectionMarkdownToLoad] = useState(null) // Store markdown to load via existing mechanism
  const [editorKey, setEditorKey] = useState(0) // Key to force editor remount
  const [reflectionInitialMarkdown, setReflectionInitialMarkdown] = useState(null) // Markdown to initialize editor with
  const [newQuestionInput, setNewQuestionInput] = useState('')
  const [newReflectionTitle, setNewReflectionTitle] = useState('')
  const [selectedText, setSelectedText] = useState(null)
  const [selectedCfiRange, setSelectedCfiRange] = useState(null)
  const selectionHandlerRef = useRef(null)
  const [reflectionNotification, setReflectionNotification] = useState(null)

  // Book notes state
  const [showBookNotes, setShowBookNotes] = useState(false)
  const [bookNotes, setBookNotes] = useState('')
  const [isEditingBookNotes, setIsEditingBookNotes] = useState(false)
  const bookNotesSaveTimeoutRef = useRef(null)

  const renditionRef = useRef(null) 
  const tocRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const hasUnsavedChangesRef = useRef(false)
  const pendingReflectionRef = useRef(null) // Store pending reflection text to insert

  // -------------------------
  // BlockNote editor
  // -------------------------
  // Parse markdown to blocks if we have reflection markdown to initialize with
  const [reflectionInitialBlocks, setReflectionInitialBlocks] = useState(null)
  
  // Create a temporary editor instance just for parsing markdown to blocks
  // This is needed because tryParseMarkdownToBlocks requires an editor instance
  const tempEditorForParsing = useCreateBlockNote()
  
  // Parse markdown to blocks when reflectionInitialMarkdown is set
  // This runs when we have markdown to initialize the editor with
  useEffect(() => {
    if (reflectionInitialMarkdown && tempEditorForParsing) {
      const parseMarkdown = async () => {
        try {
          console.log('🔍 [Editor Init] Parsing reflection markdown to blocks...')
          const blocks = await tempEditorForParsing.tryParseMarkdownToBlocks(reflectionInitialMarkdown)
          // Validate blocks - BlockNote will handle ID generation automatically for PartialBlock objects
          // We just need to ensure blocks have the required structure (type)
          const validBlocks = blocks.filter(block => 
            block && 
            typeof block === 'object' && 
            block.type &&
            typeof block.type === 'string'
          )
          console.log(`✅ [Editor Init] Parsed ${validBlocks.length} valid blocks from markdown`)
          setReflectionInitialBlocks(validBlocks)
        } catch (error) {
          console.error('❌ Error parsing reflection markdown:', error)
          setReflectionInitialBlocks([])
        }
      }
      parseMarkdown()
    } else if (!reflectionInitialMarkdown) {
      // Clear blocks when markdown is cleared
      setReflectionInitialBlocks(null)
    }
  }, [reflectionInitialMarkdown, tempEditorForParsing])
  
  // Create the actual editor - will be initialized with blocks if reflectionInitialBlocks is set
  // BlockNote accepts PartialBlock objects in initialContent - it will generate IDs automatically
  const editor = useCreateBlockNote(
    reflectionInitialBlocks ? { initialContent: reflectionInitialBlocks } : {}
  )

  // -------------------------
  // Custom slash menu items
  // -------------------------
  const getCustomSlashMenuItems = (editor) => [
    {
      title: 'Question',
      aliases: ['question', 'q', 'ask'],
      group: 'Content Types',
      icon: '❓',
      onItemClick: async () => {
        const cursor = editor.getTextCursorPosition()
        if (!cursor) return

        const markdown = '### ❓ Question\n\nEnter your question here...'
        const blocks = await editor.tryParseMarkdownToBlocks(markdown)

        editor.insertBlocks(blocks, cursor.block, 'after')

        const last = blocks[blocks.length - 1]
        if (last) editor.setTextCursorPosition(last.id, 'start')
      },
    },
    {
      title: 'Reflection',
      aliases: ['reflection', 'reflect', 'think'],
      group: 'Content Types',
      icon: '💭',
      onItemClick: async () => {
        const cursor = editor.getTextCursorPosition()
        if (!cursor) return

        const markdown = '### 💭 Reflection\n\nEnter your reflection here...'
        const blocks = await editor.tryParseMarkdownToBlocks(markdown)

        editor.insertBlocks(blocks, cursor.block, 'after')

        const last = blocks[blocks.length - 1]
        if (last) editor.setTextCursorPosition(last.id, 'start')
      },
    },
    {
      title: 'Note',
      aliases: ['note', 'memo'],
      group: 'Content Types',
      icon: '📝',
      onItemClick: async () => {
        const cursor = editor.getTextCursorPosition()
        if (!cursor) return

        const markdown = '### 📝 Note\n\nEnter your note here...'
        const blocks = await editor.tryParseMarkdownToBlocks(markdown)

        editor.insertBlocks(blocks, cursor.block, 'after')

        const last = blocks[blocks.length - 1]
        if (last) editor.setTextCursorPosition(last.id, 'start')
      },
    },
  ]

  // -------------------------
  // Book loading (unchanged)
  // -------------------------
  useEffect(() => {
    if (!bookId || !userId) return

    const loadBook = async () => {
      setLoadingBook(true)

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error || !data) {
        setLoadingBook(false)
        return
      }

      setBook(data)
      
      // Load book notes if available
      if (data.book_notes) {
        setBookNotes(data.book_notes)
      } else {
        setBookNotes('')
      }

      if (data.epub_path) {
        const { data: urlData } = supabase.storage.from('books').getPublicUrl(data.epub_path)

        setEpubUrl(urlData.publicUrl)
      }

      setLoadingBook(false)
    }

    loadBook()
  }, [bookId, userId])

  // -------------------------
  // EPUB location → chapter
  // -------------------------
  const locationChanged = (epubcifi) => {
    setLocation(epubcifi)

    if (!renditionRef.current || !tocRef.current) return

    const loc = renditionRef.current.location?.start
    if (!loc?.href) return

    const chapter = tocRef.current.find(
      (item) => item.href?.split('#')[0] === loc.href.split('#')[0]
    )

    if (chapter && chapter.href !== currentChapter?.href) {
      setCurrentChapter(chapter)
    }
  }

  // -------------------------
  // Chapter DB loading + editor content management
  // -------------------------
  const loadChapterFromDatabase = async (tocChapter, bookIdParam) => {
    if (!userId || !tocChapter || !bookIdParam) return
    setLoadingChapter(true)
    setIsEditorLoaded(false)

    try {
      // Try to find chapter in DB by title or locator (fuzzy)
      const { data: chapters, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookIdParam)
        .eq('user_id', userId)
        .or(`title.ilike.%${tocChapter.label}%,locator.ilike.%${tocChapter.href}%`)
        .limit(1)

      if (error) {
        console.error('❌ Error querying chapters:', { error, chapterTitle: tocChapter.label, chapterHref: tocChapter.href })
        setDbChapter(null)
        return
      }

      if (chapters && chapters.length > 0) {
        const foundChapter = chapters[0]
        setDbChapter(foundChapter)
        console.log('✅ Found chapter in database:', { id: foundChapter.id, title: foundChapter.title, hasContent: !!foundChapter.markdown_content, contentLength: foundChapter.markdown_content?.length || 0 })
      } else {
        console.log('ℹ️ Chapter not found in database - will create it when user edits', { chapterTitle: tocChapter.label, chapterHref: tocChapter.href })
        setDbChapter(null)
      }
    } catch (error) {
      console.error('❌ Error loading chapter from database:', error)
      setDbChapter(null)
    } finally {
      setLoadingChapter(false)
    }
  }

  // NOTE: We no longer load chapters from reader navigation.
  // Notes should be accessed via the Notes Library UI (chapter list) instead.
  // The `loadChapterFromDatabase` helper remains available if needed for future flows.

  // Helper function to wait for blocks to have IDs (workaround for collaboration plugin)
  const waitForBlockIds = async (editor, maxAttempts = 20) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const topLevelBlocks = editor.topLevelBlocks || []
        if (topLevelBlocks.length === 0 || topLevelBlocks[0]?.id !== null) {
          return true
        }
      } catch (e) {
        // Editor might not be ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }

  // Load markdown content into BlockNote editor when dbChapter changes, book notes are opened, or reflection markdown is set
  useEffect(() => {
    const loadMarkdownIntoEditor = async () => {
      if (!editor || isEditorLoaded) return

      // Wait for blocks to have IDs (workaround for collaboration plugin issue)
      const hasIds = await waitForBlockIds(editor)
      if (!hasIds) {
        console.warn('⚠️ Blocks still have null IDs after waiting, proceeding anyway...')
      }

      // Handle reflection markdown loading (avoids block manipulation)
      if (reflectionMarkdownToLoad) {
        try {
          console.log('📝 Loading reflection markdown into editor...', { contentLength: reflectionMarkdownToLoad.length })
          const blocks = await editor.tryParseMarkdownToBlocks(reflectionMarkdownToLoad)
          editor.replaceBlocks(editor.document, blocks)
          setIsEditorLoaded(true)
          setReflectionMarkdownToLoad(null) // Clear after loading
          console.log('✅ Successfully loaded reflection markdown into editor')
          return
        } catch (error) {
          console.error('❌ Error loading reflection markdown into editor:', error)
          setIsEditorLoaded(true)
          setReflectionMarkdownToLoad(null) // Clear even on error
          return
        }
      }

      // Handle book notes
      if (isEditingBookNotes && showBookNotes) {
        try {
          if (bookNotes && bookNotes.trim()) {
            const blocks = await editor.tryParseMarkdownToBlocks(bookNotes)
            editor.replaceBlocks(editor.document, blocks)
          } else {
            editor.replaceBlocks(editor.document, [])
          }
          setIsEditorLoaded(true)
          return
        } catch (error) {
          console.error('❌ Error loading book notes into editor:', error)
          setIsEditorLoaded(true)
          return
        }
      }

      // Handle chapter notes
      if (!dbChapter || isEditingBookNotes) return

      try {
        const markdownContent = dbChapter.markdown_content

        if (markdownContent && markdownContent.trim()) {
          console.log('📝 Loading markdown content into editor...', { chapterId: dbChapter.id, contentLength: markdownContent.length })

          // Parse markdown to blocks
          const blocks = await editor.tryParseMarkdownToBlocks(markdownContent)

          // Replace editor content
          editor.replaceBlocks(editor.document, blocks)

          setIsEditorLoaded(true)
          console.log('✅ Successfully loaded markdown into editor')
        } else {
          // Empty chapter - start with empty editor
          console.log('ℹ️ Chapter has no content, starting with empty editor')
          editor.replaceBlocks(editor.document, [])
          setIsEditorLoaded(true)
        }
      } catch (error) {
        console.error('❌ Error loading markdown into editor:', error)
        setIsEditorLoaded(true) // Prevent repeated retries
      }
    }

    loadMarkdownIntoEditor()
  }, [editor, dbChapter, isEditorLoaded, isEditingBookNotes, showBookNotes, bookNotes, reflectionMarkdownToLoad])

  // Save reflection to database (defined here so it can be used in useEffect)
  const saveReflection = async (reflectionText, reflectionId = null, bookIdParam = null) => {
    const targetBookId = bookIdParam || bookId
    if (!reflectionText || !targetBookId || !userId) return

    try {
      let reflection
      
      if (reflectionId) {
        // Update existing reflection
        const { data: updatedData, error } = await supabase
          .from('reflections')
          .update({ reflection_text: reflectionText.trim() || '' })
          .eq('id', reflectionId)
          .eq('user_id', userId)
          .select()

        if (error) throw error

        // Handle the response - it might be an array or null
        if (updatedData && Array.isArray(updatedData) && updatedData.length > 0) {
          reflection = updatedData[0]
        } else if (updatedData && updatedData.id) {
          reflection = updatedData
        }

        // If we didn't get the reflection back, fetch it
        if (!reflection) {
          console.log('⚠️ Reflection updated but data not returned, fetching it...')
          const { data: fetchedReflection, error: fetchError } = await supabase
            .from('reflections')
            .select('*')
            .eq('id', reflectionId)
            .eq('user_id', userId)
            .single()

          if (fetchError || !fetchedReflection) {
            console.error('❌ Error fetching updated reflection:', fetchError)
            throw new Error('Reflection updated but could not be retrieved')
          }
          reflection = fetchedReflection
        }
        
        // Update in list only if we have a valid reflection
        if (reflection && reflection.id) {
          setReflectionsList((prev) => prev.map((r) => (r && r.id === reflectionId ? reflection : r)))
          console.log('✅ Reflection updated:', reflectionId)
        } else {
          throw new Error('Reflection updated but no data returned')
        }
      } else {
        // Create new reflection (top-level, tied to book)
        const { data: insertedData, error } = await supabase
          .from('reflections')
          .insert({
            book_id: targetBookId,
            reflection_text: reflectionText.trim() || '',
            user_id: userId
          })
          .select()

        if (error) throw error

        // Handle the response - it might be an array or null
        if (insertedData && Array.isArray(insertedData) && insertedData.length > 0) {
          reflection = insertedData[0]
        } else if (insertedData && insertedData.id) {
          reflection = insertedData
        }

        // If we didn't get the reflection back, fetch it
        if (!reflection) {
          console.log('⚠️ Reflection inserted but data not returned, fetching it...')
          const { data: fetchedReflection, error: fetchError } = await supabase
            .from('reflections')
            .select('*')
            .eq('book_id', targetBookId)
            .eq('user_id', userId)
            .eq('reflection_text', reflectionText.trim())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (fetchError || !fetchedReflection) {
            console.error('❌ Error fetching created reflection:', fetchError)
            throw new Error('Reflection created but could not be retrieved')
          }
          reflection = fetchedReflection
        }
        
        if (reflection && reflection.id) {
          setReflectionsList((prev) => [reflection, ...prev])
          setNewReflectionTitle('')
          console.log('✅ Reflection saved:', reflection.id)
        } else {
          throw new Error('Reflection created but no data returned')
        }
      }
      
      return reflection
    } catch (err) {
      console.error('❌ Error saving reflection:', err)
      alert('Failed to save reflection. Please try again.')
      throw err
    }
  }

  // Save reflection in background (UX workaround - no editor manipulation)
  const saveReflectionInBackground = async (reflectionText, bookIdParam = null) => {
    try {
      // Format the reflection markdown
      const markdown = `## Reflection\n\n> **"${reflectionText}"**\n\n`
      
      // Save to reflections table (top-level, tied to book)
      const targetBookId = bookIdParam || bookId
      const reflection = await saveReflection(markdown, null, targetBookId)
      console.log('✅ [Reflection] Saved to database:', reflectionText.slice(0, 50))
      
      // Refresh reflections list for this book
      if (targetBookId === bookId) {
        await fetchReflectionsByBook(targetBookId)
      }
      
      // Show notification
      setReflectionNotification('Reflection created successfully!')
      setTimeout(() => setReflectionNotification(null), 3000)
      
    } catch (err) {
      console.error('❌ [Reflection] Error saving reflection:', {
        error: err,
        errorMessage: err?.message,
        reflectionText: reflectionText?.slice(0, 100),
        bookId: bookIdParam || bookId
      })
      setReflectionNotification(`Failed to save reflection: ${err?.message || 'Unknown error'}`)
      setTimeout(() => setReflectionNotification(null), 5000)
    }
  }

  // Fetch chapters list for Notes Library
  useEffect(() => {
    if (!bookId || !userId) return

    const fetchChapters = async () => {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('id,title,chapter_index,markdown_content')
          .eq('book_id', bookId)
          .eq('user_id', userId)
          .order('chapter_index', { ascending: true })

        if (error) {
          console.error('❌ Error fetching chapters list:', error)
          return
        }

        setChaptersList(data || [])
      } catch (err) {
        console.error('❌ Unexpected error fetching chapters:', err)
      }
    }

    fetchChapters()
  }, [bookId, userId])

  // Fetch reflections for the book when bookId changes (top-level, not tied to chapters)
  useEffect(() => {
    if (!bookId || !userId) {
      setReflectionsList([])
      return
    }

    fetchReflectionsByBook(bookId)
  }, [bookId, userId])

  // Fetch questions for a chapter
  const fetchQuestionsAndReflections = async (chapterId) => {
    if (!chapterId || !userId) {
      setQuestionsList([])
      return
    }

    try {
      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (questionsError) {
        console.error('❌ Error fetching questions:', questionsError)
        setQuestionsList([])
      } else {
        // Filter out any invalid questions (those without an id)
        const validQuestions = (questionsData || []).filter(q => q && q.id)
        setQuestionsList(validQuestions)
      }
    } catch (err) {
      console.error('❌ Error fetching questions:', err)
    }
  }

  // Fetch reflections for a book (top-level, not tied to chapters)
  const fetchReflectionsByBook = async (bookIdParam = null) => {
    const targetBookId = bookIdParam || bookId
    if (!targetBookId || !userId) {
      setReflectionsList([])
      return
    }

    try {
      const { data: reflectionsData, error: reflectionsError } = await supabase
        .from('reflections')
        .select('*')
        .eq('book_id', targetBookId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (reflectionsError) {
        console.error('❌ Error fetching reflections:', reflectionsError)
        setReflectionsList([])
      } else {
        setReflectionsList(reflectionsData || [])
      }
    } catch (err) {
      console.error('❌ Error fetching reflections:', err)
    }
  }

  // Open book notes in editor
  const openBookNotes = async () => {
    if (!editor) return

    try {
      // Flush any pending chapter saves
      if (saveTimeoutRef.current && dbChapter?.id) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
        try {
          const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document)
          await saveChapterContent(dbChapter.id, currentMarkdown)
        } catch (err) {
          console.error('❌ Error flushing save for chapter:', err)
        }
      }

      setIsEditingBookNotes(true)
      setDbChapter(null) // Clear chapter selection
      setIsEditorLoaded(false)
      setShowBookNotes(true)
      
      // Clear questions list (reflections are book-level, so keep them)
      setQuestionsList([])
      setShowQuestions(false)
      setShowReflections(false)
      
      // Fetch reflections for this book
      if (bookId) {
        await fetchReflectionsByBook(bookId)
      }
      
      // Clear editing reflection and question when switching to book notes
      setOpenQuestion(null)
      setEditingReflection(null)

      // The useEffect will handle loading the content
    } catch (err) {
      console.error('❌ Error opening book notes:', err)
    }
  }

  // Chapter selection from Notes Library
  const selectChapter = async (chapter) => {
    // Flush pending save for previous chapter or book notes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
      if (editor && dbChapter?.id) {
        try {
          const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document)
          await saveChapterContent(dbChapter.id, currentMarkdown)
          try { localStorage.removeItem(getDraftKey(dbChapter.id)) } catch (_) {}
        } catch (err) {
          console.error('❌ Error flushing save for previous chapter:', err)
        }
      }
    }

    // Flush book notes save if editing
    if (bookNotesSaveTimeoutRef.current && isEditingBookNotes) {
      clearTimeout(bookNotesSaveTimeoutRef.current)
      bookNotesSaveTimeoutRef.current = null
      if (editor && bookId && userId) {
        try {
          const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document)
          await supabase
            .from('books')
            .update({ book_notes: currentMarkdown || null })
            .eq('id', bookId)
            .eq('user_id', userId)
        } catch (err) {
          console.error('❌ Error flushing save for book notes:', err)
        }
      }
    }

    setIsEditingBookNotes(false)
    setDbChapter(chapter)
    setIsEditorLoaded(false)

    // Reset questions state (reflections are book-level, so keep them)
    // Clear editingReflection and openQuestion so we're back to editing chapter notes
    setEditingQuestion(null)
    setOpenQuestion(null)
    setEditingReflection(null)
    setNewQuestionInput('')
    setNewReflectionTitle('')

    // Fetch questions for this chapter
    await fetchQuestionsAndReflections(chapter.id)
    
    // Fetch reflections for this book (top-level)
    if (bookId) {
      await fetchReflectionsByBook(bookId)
    }

    // Check for local draft for this chapter
    try {
      const key = getDraftKey(chapter.id)
      const draft = localStorage.getItem(key)
      if (draft && draft.trim() && draft !== (chapter.markdown_content || '')) {
        setDraftAvailable(true)
        setDraftContent(draft)
      } else {
        setDraftAvailable(false)
        setDraftContent(null)
      }
    } catch (err) {
      console.warn('❌ Could not access localStorage for drafts:', err)
    }
  }

  // Clear editor when chapter changes but dbChapter is null (no chapter found)
  useEffect(() => {
    if (!dbChapter && currentChapter && isEditorLoaded) {
      console.log('ℹ️ No database chapter found, clearing editor')
      if (editor) {
        editor.replaceBlocks(editor.document, [])
      }
      setIsEditorLoaded(false)
    }
  }, [dbChapter, currentChapter, editor, isEditorLoaded])

  // Auto-save function to save editor content to database
  const saveChapterContent = useCallback(async (chapterId, markdownContent) => {
    if (!userId || !chapterId || saving) return

    try {
      setSaving(true)
      console.log('💾 Saving chapter content...', { chapterId, contentLength: markdownContent?.length || 0 })

      const { error } = await supabase
        .from('chapters')
        .update({ markdown_content: markdownContent || null })
        .eq('id', chapterId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error saving chapter content:', { error, chapterId, errorCode: error.code, errorMessage: error.message })
        throw error
      }

      console.log('✅ Successfully saved chapter content', { chapterId })
    } catch (error) {
      console.error('❌ Failed to save chapter content:', error)
    } finally {
      setSaving(false)
    }
  }, [userId, saving])

  // Create or update chapter record
  const createOrUpdateChapter = useCallback(async (tocChapter, markdownContent) => {
    if (!userId || !bookId || !currentChapter) return

    try {
      setSaving(true)
      console.log('📝 Creating/updating chapter record...', { chapterTitle: tocChapter.label, chapterHref: tocChapter.href, contentLength: markdownContent?.length || 0 })

      // Check if chapter already exists
      const { data: existingChapters } = await supabase
        .from('chapters')
        .select('id')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .or(`title.ilike.%${tocChapter.label}%,locator.ilike.%${tocChapter.href}%`)
        .limit(1)

      if (existingChapters && existingChapters.length > 0) {
        // Update existing chapter
        const chapterId = existingChapters[0].id
        const { error } = await supabase
          .from('chapters')
          .update({ 
            markdown_content: markdownContent || null,
            title: tocChapter.label,
            locator: tocChapter.href
          })
          .eq('id', chapterId)
          .eq('user_id', userId)

        if (error) throw error

        // Update dbChapter state
        const { data: updatedChapter } = await supabase
          .from('chapters')
          .select('*')
          .eq('id', chapterId)
          .single()

        if (updatedChapter) {
          setDbChapter(updatedChapter)
        }

        console.log('✅ Updated existing chapter', { chapterId })
      } else {
        // Create new chapter
        // Find the chapter_index by counting existing chapters
        const { data: existingChaptersCount } = await supabase
          .from('chapters')
          .select('chapter_index', { count: 'exact', head: true })
          .eq('book_id', bookId)
          .eq('user_id', userId)

        const chapterIndex = existingChaptersCount?.length || 0

        const { data: newChapter, error } = await supabase
          .from('chapters')
          .insert({
            book_id: bookId,
            user_id: userId,
            title: tocChapter.label,
            locator: tocChapter.href,
            chapter_index: chapterIndex,
            markdown_content: markdownContent || null
          })
          .select()
          .single()

        if (error) throw error

        setDbChapter(newChapter)
        console.log('✅ Created new chapter', { id: newChapter.id, title: newChapter.title, chapterIndex: newChapter.chapter_index })
      }
    } catch (error) {
      console.error('❌ Error creating/updating chapter:', { error, chapterTitle: tocChapter.label, errorCode: error.code, errorMessage: error.message })
    } finally {
      setSaving(false)
    }
  }, [userId, bookId, currentChapter])

  // Auto-save handler: Called when editor content changes
  const handleEditorChange = useCallback(async () => {
    if (!editor || !isEditorLoaded) return

    // Convert blocks to markdown immediately
    let markdown
    try {
      markdown = await editor.blocksToMarkdownLossy(editor.document)
    } catch (err) {
      console.error('❌ Error converting editor to markdown:', err)
      return
    }

    // Handle book notes editing
    if (isEditingBookNotes) {
      setBookNotes(markdown)
      
      // Clear previous timeout
      if (bookNotesSaveTimeoutRef.current) {
        clearTimeout(bookNotesSaveTimeoutRef.current)
      }

      // Debounce save by 2 seconds
      bookNotesSaveTimeoutRef.current = setTimeout(async () => {
        try {
          if (!bookId || !userId) return
          
          const { error } = await supabase
            .from('books')
            .update({ book_notes: markdown || null })
            .eq('id', bookId)
            .eq('user_id', userId)

          if (error) {
            console.error('❌ Error saving book notes:', error)
          } else {
            console.log('✅ Book notes saved')
          }
        } catch (error) {
          console.error('❌ Error in book notes auto-save:', error)
        }
      }, 2000)
      return
    }

    // Handle reflection editing (reflections are separate from chapter notes)
    if (editingReflection) {
      // Save to reflection, not chapter notes
      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save by 2 seconds
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('📝 Reflection content changed, auto-saving...', {
            reflectionId: editingReflection.id,
            hasContent: markdown.length > 0,
            contentLength: markdown.length
          })

          await saveReflection(markdown, editingReflection.id)
        } catch (error) {
          console.error('❌ Error in reflection auto-save:', error)
        }
      }, 2000)
      return
    }

    // Handle chapter notes editing
    if (!dbChapter) return

    // Write to local UI state immediately
    setChaptersList((prev) => prev.map((c) => (c.id === dbChapter.id ? { ...c, markdown_content: markdown } : c)))

    // Persist draft locally immediately
    try {
      localStorage.setItem(getDraftKey(dbChapter.id), markdown)
      setDraftAvailable(true)
      setDraftContent(markdown)
    } catch (err) {
      console.warn('❌ Could not write draft to localStorage:', err)
    }

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('📝 Editor content changed, auto-saving...', {
          hasContent: markdown.length > 0,
          contentLength: markdown.length
        })

        if (dbChapter?.id) {
          // Chapter exists in DB - update it
          await saveChapterContent(dbChapter.id, markdown)

          // Clear any draft for this chapter
          try { localStorage.removeItem(getDraftKey(dbChapter.id)); setDraftAvailable(false); setDraftContent(null) } catch (_) {}
        } else {
          console.warn('No selected chapter to save')
        }
      } catch (error) {
        console.error('❌ Error in auto-save:', error)
      }
    }, 2000) // 2 second debounce
  }, [editor, dbChapter, isEditorLoaded, isEditingBookNotes, bookId, userId, saveChapterContent, editingReflection, saveReflection])

  // Restore / Discard draft handlers
  const restoreDraft = async () => {
    if (!dbChapter || !draftAvailable) return
    try {
      const key = getDraftKey(dbChapter.id)
      const draft = localStorage.getItem(key)
      if (!draft) return
      const blocks = await editor.tryParseMarkdownToBlocks(draft)
      editor.replaceBlocks(editor.document, blocks)
      setDraftAvailable(false)
      setDraftContent(null)
      setChaptersList((prev) => prev.map((c) => (c.id === dbChapter.id ? { ...c, markdown_content: draft } : c)))
    } catch (err) {
      console.error('❌ Error restoring draft:', err)
    }
  }

  const discardDraft = () => {
    if (!dbChapter) return
    try {
      localStorage.removeItem(getDraftKey(dbChapter.id))
      setDraftAvailable(false)
      setDraftContent(null)
    } catch (err) {
      console.warn('❌ Could not remove draft:', err)
    }
  }

  // Questions CRUD operations
  const createQuestion = async () => {
    if (!newQuestionInput.trim() || !dbChapter?.id || !userId) {
      if (!dbChapter?.id) {
        alert('Please select a chapter first to add questions.')
      }
      return
    }

    const questionText = newQuestionInput.trim()

    try {
      // Try to insert and get the data back
      const { data: insertedData, error: insertError } = await supabase
        .from('questions')
        .insert({
          chapter_id: dbChapter.id,
          question_text: questionText,
          user_id: userId,
          source: 'manual'
        })
        .select()

      if (insertError) throw insertError

      // Handle the response - it might be an array or null
      let newQuestion = null
      if (insertedData && Array.isArray(insertedData) && insertedData.length > 0) {
        newQuestion = insertedData[0]
      } else if (insertedData && insertedData.id) {
        newQuestion = insertedData
      }

      // If we got the question back, add it to the list
      if (newQuestion && newQuestion.id) {
        setQuestionsList((prev) => [newQuestion, ...prev])
        setNewQuestionInput('')
        console.log('✅ Question created:', newQuestion.id)
      } else {
        // Fallback: refresh the entire list to get the newly created question
        console.log('⚠️ Question inserted but data not returned, refreshing list...')
        setNewQuestionInput('')
        await fetchQuestionsAndReflections(dbChapter.id)
        
        // Fetch reflections for this book (top-level)
        if (bookId) {
          await fetchReflectionsByBook(bookId)
        }
      }
    } catch (err) {
      console.error('❌ Error creating question:', err)
      alert('Failed to create question. Please try again.')
    }
  }

  const updateQuestion = async (questionId, newText) => {
    if (!newText.trim() || !questionId || !userId) return

    try {
      const { data, error } = await supabase
        .from('questions')
        .update({ question_text: newText.trim() })
        .eq('id', questionId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      setQuestionsList((prev) => prev.map((q) => (q.id === questionId ? data : q)))
      setEditingQuestion(null)
      console.log('✅ Question updated:', questionId)
    } catch (err) {
      console.error('❌ Error updating question:', err)
      alert('Failed to update question. Please try again.')
    }
  }

  const deleteQuestion = async (questionId) => {
    if (!questionId || !userId) return

    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)
        .eq('user_id', userId)

      if (error) throw error

      setQuestionsList((prev) => prev.filter((q) => q.id !== questionId))
      console.log('✅ Question deleted:', questionId)
    } catch (err) {
      console.error('❌ Error deleting question:', err)
      alert('Failed to delete question. Please try again.')
    }
  }

  const openQuestionInEditor = async (question) => {
    if (!editor || !question) return

    try {
      // Set as open question so header shows question info and auto-save saves to question
      setOpenQuestion(question)
      // Clear reflection when opening a question
      setEditingReflection(null)
      
      const markdown = `## ${question.question_text}\n\n`
      const blocks = await editor.tryParseMarkdownToBlocks(markdown)
      editor.replaceBlocks(editor.document, blocks)
      
      // Focus on the first block after the heading
      if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1]
        editor.setTextCursorPosition(lastBlock.id, 'start')
      }
    } catch (err) {
      console.error('❌ Error opening question in editor:', err)
    }
  }

  // Reflections CRUD operations
  // Note: saveReflection is defined earlier (before the useEffect that uses it)

  const deleteReflection = async (reflectionId) => {
    if (!reflectionId || !userId) return

    if (!confirm('Are you sure you want to delete this reflection?')) return

    try {
      const { error } = await supabase
        .from('reflections')
        .delete()
        .eq('id', reflectionId)
        .eq('user_id', userId)

      if (error) throw error

      setReflectionsList((prev) => prev.filter((r) => r.id !== reflectionId))
      console.log('✅ Reflection deleted:', reflectionId)
    } catch (err) {
      console.error('❌ Error deleting reflection:', err)
      alert('Failed to delete reflection. Please try again.')
    }
  }

  const openReflectionInEditor = async (reflection) => {
    if (!reflection) {
      console.error('❌ No reflection provided to openReflectionInEditor')
      return
    }

    try {
      console.log('🔍 [Open Reflection] Opening reflection:', reflection.id)
      
      // Switch to notes mode if we're in read mode
      if (viewMode === 'read') {
        setViewMode('notes')
        // Wait a bit for the view to switch
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // If we're editing book notes, we can still open reflections
      // If no chapter is selected, we need to ensure editor is ready
      if (!dbChapter && !isEditingBookNotes) {
        console.log('🔍 [Open Reflection] No chapter selected, opening book notes...')
        // Open book notes to have an editor available
        await openBookNotes()
        // Wait a bit for editor to be ready
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Editor should be available from useCreateBlockNote hook
      // But we need to make sure the editor is actually rendered in the DOM
      if (!editor) {
        console.error('❌ Editor not available')
        throw new Error('Editor not available. Please ensure you are in notes view.')
      }
      
      // Wait for editor to be loaded if it's not ready
      if (!isEditorLoaded) {
        console.log('🔍 [Open Reflection] Waiting for editor to be loaded...')
        let attempts = 0
        while (!isEditorLoaded && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        if (!isEditorLoaded) {
          console.warn('⚠️ [Open Reflection] Editor not loaded after waiting, proceeding anyway...')
        }
      }
      
      // Set as editing reflection so auto-save saves to reflection, not chapter notes
      setEditingReflection(reflection)
      // Clear question when opening a reflection
      setOpenQuestion(null)
      
      // Parse reflection_text - it may contain the quote and reflection
      // Format expected: "## Reflection\n\n> **\"quote\"**\n\nreflection text\n\n"
      const reflectionText = reflection.reflection_text || ''
      
      // If it doesn't start with ##, format it properly
      let markdown = reflectionText
      if (!reflectionText.startsWith('##')) {
        // Try to extract quote if it's in a specific format, otherwise just show the text
        markdown = `## Reflection\n\n${reflectionText}\n\n`
      }
      
      // First, let's inspect editor.document to see all blocks
      console.log('🔍 [Open Reflection] ===== EDITOR.DOCUMENT INSPECTION =====')
      console.log('📄 editor.document (full):', JSON.stringify(editor.document, null, 2))
      console.log('📄 editor.document (summary):', {
        length: editor.document?.length || 0,
        isArray: Array.isArray(editor.document),
        blocks: editor.document?.map((block, index) => ({
          index,
          id: block?.id,
          type: block?.type,
          content: block?.content ? (typeof block.content === 'string' ? block.content.slice(0, 50) : JSON.stringify(block.content).slice(0, 50)) : 'no content',
          hasId: !!block?.id,
          keys: block ? Object.keys(block) : []
        })) || []
      })
      console.log('🔍 [Open Reflection] ===== END INSPECTION =====')
      
      // Parse markdown to blocks
      const blocks = await editor.tryParseMarkdownToBlocks(markdown)
      console.log('🔍 [Open Reflection] Parsed blocks:', {
        blocksCount: blocks?.length || 0,
        blocks: blocks?.map((block, index) => ({
          index,
          id: block?.id,
          type: block?.type,
          content: block?.content ? (typeof block.content === 'string' ? block.content.slice(0, 50) : JSON.stringify(block.content).slice(0, 50)) : 'no content',
          hasId: !!block?.id,
          keys: block ? Object.keys(block) : []
        })) || []
      })
      
      // Validate parsed blocks before using them - more thorough validation
      if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        throw new Error(`Failed to parse markdown to blocks: blocks=${blocks}, isArray=${Array.isArray(blocks)}, length=${blocks?.length}`)
      }
      
      // Check for invalid blocks (undefined or missing id) - more thorough validation
      const invalidBlocks = []
      const validBlocks = []
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        if (!block) {
          console.error(`❌ [Open Reflection] Block at index ${i} is undefined or null`)
          invalidBlocks.push({ index: i, reason: 'undefined or null' })
          continue
        }
        if (typeof block !== 'object') {
          console.error(`❌ [Open Reflection] Block at index ${i} is not an object:`, typeof block, block)
          invalidBlocks.push({ index: i, reason: 'not an object' })
          continue
        }
        if (!block.id || typeof block.id !== 'string') {
          console.error(`❌ [Open Reflection] Block at index ${i} has invalid id:`, block.id, block)
          invalidBlocks.push({ index: i, reason: 'invalid id', block })
          continue
        }
        if (!block.type || typeof block.type !== 'string') {
          console.error(`❌ [Open Reflection] Block at index ${i} has invalid type:`, block.type, block)
          invalidBlocks.push({ index: i, reason: 'invalid type', block })
          continue
        }
        validBlocks.push(block)
      }
      
      if (invalidBlocks.length > 0) {
        console.error('❌ [Open Reflection] Invalid blocks found:', invalidBlocks)
        throw new Error(`Parsed blocks contain ${invalidBlocks.length} invalid blocks: ${invalidBlocks.map(b => `${b.index} (${b.reason})`).join(', ')}`)
      }
      
      // Use only valid blocks - this is what we'll actually insert
      const finalBlocks = validBlocks
      console.log(`✅ [Open Reflection] All ${finalBlocks.length} parsed blocks are valid`)
      
      // Now we can manipulate blocks - replace all current blocks with new ones
      // Use finalBlocks instead of blocks to ensure we only use validated blocks
      // The issue is that both editor.document and topLevelBlocks may contain stale block references
      // We'll try to get valid blocks first, then replace, or use removeBlocks if available
      try {
        console.log('🔍 [Open Reflection] Attempting to replace blocks...')
        
        // Strategy: Try to get valid blocks from editor, validate them, then replace
        // If that fails, try removeBlocks, or direct replace with empty array
        let blocksToReplace = null
        
        // Try 1: Get blocks from editor and validate them
        try {
          const currentDoc = editor.document || []
          console.log('🔍 [Open Reflection] Current document has', currentDoc.length, 'blocks')
          
          // Validate each block exists in editor's internal state
          const validBlocks = []
          for (const block of currentDoc) {
            if (block?.id) {
              try {
                const verified = editor.getBlock(block.id)
                if (verified) {
                  validBlocks.push(block)
                } else {
                  console.warn(`⚠️ [Open Reflection] Block ${block.id} not found in editor`)
                }
              } catch (e) {
                console.warn(`⚠️ [Open Reflection] Could not verify block ${block.id}:`, e.message)
              }
            }
          }
          
          if (validBlocks.length > 0) {
            blocksToReplace = validBlocks
            console.log(`✅ [Open Reflection] Found ${validBlocks.length} valid blocks to replace`)
          } else {
            console.log('ℹ️ [Open Reflection] No valid blocks found, editor may be empty or all blocks are stale')
          }
        } catch (e) {
          console.warn('⚠️ [Open Reflection] Could not get/validate blocks:', e.message)
        }
        
        // Try 2: If no valid blocks, reset editor state and try again
        if (!blocksToReplace || blocksToReplace.length === 0) {
          console.log('🔍 [Open Reflection] No valid blocks found, resetting editor state...')
          
          // Reset editor loaded state to force a fresh start
          setIsEditorLoaded(false)
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Check if editor is now in a better state
          const freshDoc = editor.document || []
          console.log('🔍 [Open Reflection] After reset - document state:', {
            length: freshDoc.length,
            blockIds: freshDoc.map(b => b?.id).filter(Boolean)
          })
          
          // Try to insert blocks now
          if (freshDoc.length === 0) {
            // Editor is empty, use insertBlocks
            console.log('🔍 [Open Reflection] Editor empty after reset, inserting blocks...')
            try {
              editor.insertBlocks(finalBlocks)
              console.log('✅ [Open Reflection] Successfully inserted blocks after reset')
            } catch (insertErr) {
              console.warn('⚠️ [Open Reflection] insertBlocks failed after reset:', insertErr.message)
              // Last resort: try replaceBlocks with empty array
              editor.replaceBlocks([], finalBlocks)
              console.log('✅ [Open Reflection] Successfully replaced using empty array (after reset)')
            }
          } else {
            // Editor still has blocks - try to validate and replace
            const freshValidBlocks = []
            for (const block of freshDoc) {
              if (block?.id) {
                try {
                  const verified = editor.getBlock(block.id)
                  if (verified) freshValidBlocks.push(block)
                } catch (e) {}
              }
            }
            
            if (freshValidBlocks.length > 0) {
              console.log(`🔍 [Open Reflection] Found ${freshValidBlocks.length} valid blocks after reset, replacing...`)
              editor.replaceBlocks(freshValidBlocks, finalBlocks)
              console.log('✅ [Open Reflection] Successfully replaced using fresh valid blocks')
            } else {
              // Still no valid blocks - try insertBlocks anyway (might work)
              console.log('🔍 [Open Reflection] No valid blocks after reset, trying insertBlocks...')
              try {
                editor.insertBlocks(finalBlocks)
                console.log('✅ [Open Reflection] Successfully inserted blocks (no valid blocks to replace)')
              } catch (insertErr) {
                console.error('❌ [Open Reflection] All approaches failed after reset:', insertErr)
                throw insertErr
              }
            }
          }
        } else {
          // Use validated blocks for replacement
          console.log('🔍 [Open Reflection] Replacing validated blocks...')
          editor.replaceBlocks(blocksToReplace, finalBlocks)
          console.log('✅ [Open Reflection] Successfully replaced blocks using validated blocks')
        }
        
        // Wait a moment for BlockNote to process
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Set cursor position
        const currentDoc = editor.document
        if (currentDoc && currentDoc.length > 0) {
          const lastBlock = currentDoc[currentDoc.length - 1]
          if (lastBlock?.id) {
            editor.setTextCursorPosition(lastBlock.id, 'start')
            console.log('✅ [Open Reflection] Cursor position set successfully')
          }
        }
      } catch (err) {
        console.error('❌ [Open Reflection] Error replacing blocks:', err)
        throw err
      }
    } catch (err) {
      console.error('❌ Error opening reflection in editor:', err)
      alert(`Failed to open reflection: ${err?.message || 'Unknown error'}. Please try again.`)
    }
  }

  // Get the stored selection from epub.js 'selected' event
  const getReaderSelection = () => {
    return selectedText
  }

  // Try to read selection from the reader (handles multiple possible locations)
  const getReaderSelectionFallback = () => {
    try {
      // First try top-level selection
      const s = window.getSelection?.()?.toString?.()?.trim()
      if (s) return s

      // Try epub.js contents
      const contents = renditionRef.current?.getContents?.()
      if (contents && contents.length) {
        for (const c of contents) {
          try {
            const cs = c.window?.getSelection?.()?.toString?.()?.trim()
            if (cs) return cs
          } catch (e) {
            // ignore
          }
        }
      }

      // Try iframe if present
      const iframe = renditionRef.current?.iframe
      const isel = iframe?.contentWindow?.getSelection?.()?.toString?.()?.trim()
      if (isel) return isel
    } catch (err) {
      console.warn('❌ Error getting reader selection:', err)
    }

    return null
  }

  // Create a reflection from selected text (top-level, tied to book)
  const createReflectionFromSelection = async () => {
    const selection = getReaderSelection() || getReaderSelectionFallback()
    if (!selection || !selection.trim()) {
      alert('No text selected in the reader. Highlight a passage then click "Make reflection".')
      return
    }

    if (!userId || !bookId) {
      alert('Please ensure you are logged in and have a book selected.')
      return
    }

    const selectedTextTrimmed = selection.trim()
    const snippet = selectedTextTrimmed.length > 300 ? `${selectedTextTrimmed.slice(0, 297)}...` : selectedTextTrimmed

    // Save reflection in background (top-level, tied to book - no chapter needed)
    await saveReflectionInBackground(snippet, bookId)

    // Clear selection
    setSelectedText(null)
    setSelectedCfiRange(null)
  }

  // Generate a concise summary by concatenating chapter notes and extracting a short per-chapter excerpt
  const generateConciseSummary = async () => {
    if (!bookId || !userId) return
    setGeneratingSummary(true)

    try {
      const { data: chapters, error } = await supabase
        .from('chapters')
        .select('title,markdown_content')
        .eq('book_id', bookId)
        .eq('user_id', userId)
        .order('chapter_index', { ascending: true })

      if (error) throw error

      const concat = (chapters || [])
        .map((c) => `# ${c.title}\n\n${c.markdown_content || ''}`)
        .join('\n\n')

      setConcatenatedNotes(concat)

      const extractIntro = (text) => {
        if (!text) return ''
        const para = text.split(/\n\n+/).find((p) => p && p.trim()) || ''
        const sentMatch = para.match(/(.+?[.!?])(\s|$)/)
        if (sentMatch && sentMatch[1]) return sentMatch[1]
        return para.slice(0, 200)
      }

      const bullets = (chapters || []).map((c) => {
        const excerpt = extractIntro(c.markdown_content || '') || '(no notes)'
        return `${c.title}: ${excerpt}`
      })

      const joined = bullets.join('\n')

      // Keep concise - limit to ~800 chars
      const concise = joined.length > 800 ? `${joined.slice(0, 797)}...` : joined

      setSummaryText(concise)
      setShowAllNotes(false)
      setSummaryVisible(true)
    } catch (err) {
      console.error('❌ Error generating summary:', err)
      alert('Error generating summary. Check console for details.')
    } finally {
      setGeneratingSummary(false)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard')
    } catch (err) {
      console.warn('❌ Copy failed:', err)
    }
  }

  const downloadConcatenatedNotes = (format = downloadFormat) => {
    try {
      const content = concatenatedNotes || ''
      const isTxt = format === 'txt'
      const type = isTxt ? 'text/plain' : 'text/markdown'
      const ext = isTxt ? 'txt' : 'md'
      const blob = new Blob([content], { type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bookId || 'notes'}-all-notes.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('❌ Error downloading notes:', err)
    }
  }

  // Cleanup timeout and selection handler on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (bookNotesSaveTimeoutRef.current) {
        clearTimeout(bookNotesSaveTimeoutRef.current)
      }
      const rendition = renditionRef.current
      const handler = selectionHandlerRef.current
      if (rendition && handler) {
        rendition.off('selected', handler)
        selectionHandlerRef.current = null
      }
    }
  }, [])

  // -------------------------
  // Render
  // -------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {/* Top bar: mode toggle + actions */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #2a2a2a',
          backgroundColor: '#111',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '6px 10px',
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Home
          </button>
          <button
            onClick={() => setViewMode('read')}
            style={{
              padding: '6px 10px',
              backgroundColor: viewMode === 'read' ? '#2563eb' : '#222',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Read
          </button>
          <button
            onClick={() => setViewMode('notes')}
            style={{
              padding: '6px 10px',
              backgroundColor: viewMode === 'notes' ? '#2563eb' : '#222',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Notes
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={createReflectionFromSelection}
            style={{
              padding: '6px 10px',
              backgroundColor: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: 4,
            }}
          >
            Make reflection
          </button>
          <button
            onClick={generateConciseSummary}
            style={{
              padding: '6px 10px',
              backgroundColor: generatingSummary ? '#9ca3ff' : '#6ee7b7',
              color: '#000',
              border: 'none',
              borderRadius: 4,
            }}
          >
            {generatingSummary ? 'Generating...' : 'Generate summary'}
          </button>
        </div>
      </div>

      {/* Reflection notification */}
      {reflectionNotification && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            right: 12,
            zIndex: 1000,
            padding: '12px 16px',
            backgroundColor: reflectionNotification.includes('Failed') ? '#dc2626' : '#10b981',
            color: '#fff',
            borderRadius: 6,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            maxWidth: 400,
            fontSize: 14,
          }}
        >
          {reflectionNotification}
        </div>
      )}

      {/* Summary overlay */}
      {summaryVisible && (
        <div style={{ position: 'absolute', right: 12, top: 56, zIndex: 30, width: 420, maxHeight: '70vh', overflow: 'auto', background: '#121212', border: '1px solid #2b2b2b', padding: 12, borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: '#fff' }}>Concise summary</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setDownloadFormat('md')} style={{ padding: '6px 8px', background: downloadFormat === 'md' ? '#111' : '#222', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 4 }}>MD</button>
                <button onClick={() => setDownloadFormat('txt')} style={{ padding: '6px 8px', background: downloadFormat === 'txt' ? '#111' : '#222', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 4 }}>TXT</button>
              </div>
              <button onClick={() => copyToClipboard(summaryText)} style={{ padding: '6px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>Copy</button>
              <button onClick={() => downloadConcatenatedNotes()} style={{ padding: '6px 8px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 4 }}>Download ({downloadFormat.toUpperCase()})</button>
              <button onClick={() => setSummaryVisible(false)} style={{ padding: '6px 8px', background: '#444', color: '#fff', border: 'none', borderRadius: 4 }}>Close</button>
            </div>
          </div>

          <div style={{ color: '#d1d5db', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.3 }}>{summaryText || 'No notes yet.'}</div>

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#9e9e9e', fontSize: 12 }}>{concatenatedNotes ? 'Includes all chapters' : ''}</div>
            <button onClick={() => setShowAllNotes((s) => !s)} style={{ padding: '6px 8px', background: '#222', color: '#fff', border: 'none', borderRadius: 4 }}>{showAllNotes ? 'Hide all' : 'Show all notes'}</button>
          </div>

          {showAllNotes && (
            <pre style={{ marginTop: 8, background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 6, maxHeight: '50vh', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{concatenatedNotes || '(no notes)'}</pre>
          )}
        </div>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {viewMode === 'read' ? (
          // Full-screen reader
          <div style={{ flex: 1, backgroundColor: '#000' }}>
            {epubUrl && (
              <ReactReader
                url={epubUrl}
                location={location}
                locationChanged={locationChanged}
                getRendition={async (r) => {
                  renditionRef.current = r
                  
                  // Set up the 'selected' event listener after rendition is ready
                  if (r && !selectionHandlerRef.current) {
                    try {
                      // Wait for rendition to be ready
                      if (r.ready && typeof r.ready.then === 'function') {
                        await r.ready
                      }
                      
                      // Give it a small delay to ensure everything is initialized
                      await new Promise(resolve => setTimeout(resolve, 100))

                      const handleSelection = (cfiRange, contents) => {
                        try {
                          const text = r.getRange(cfiRange).toString()
                          if (text && text.trim()) {
                            setSelectedText(text.trim())
                            setSelectedCfiRange(cfiRange)
                            console.log('✅ Text selected via epub.js event:', text.slice(0, 50))
                            // Don't clear the selection - let the user see it
                            // It will be cleared when they create a reflection or manually deselect
                          }
                        } catch (err) {
                          console.warn('Error handling selection:', err)
                        }
                      }

                      selectionHandlerRef.current = handleSelection
                      r.on('selected', handleSelection)
                      console.log('✅ Set up epub.js selected event listener')
                    } catch (err) {
                      console.warn('Error setting up selection handler:', err)
                    }
                  }
                }}
                tocChanged={(toc) => (tocRef.current = toc)}
              />
            )}
          </div>
        ) : (
          // Notes / working mode: chapters list + editor
          <div
            style={{
              flex: 1,
              display: 'flex',
              height: '100%',
              backgroundColor: '#1f1f1f',
            }}
          >
            {/* Chapters list */}
            <div
              style={{
                width: '34%',
                borderRight: '1px solid #2a2a2a',
                padding: '8px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              {/* Scrollable content area */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <button
                  onClick={() => setShowChapters(!showChapters)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: showChapters ? '#2b2b2b' : '#1a1a1a',
                    color: '#fff',
                    border: '1px solid #2a2a2a',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Chapters ({chaptersList.length})</span>
                  <span>{showChapters ? '▼' : '▶'}</span>
                </button>

                {showChapters && (
                  <>
                    {chaptersList.length === 0 && (
                      <div style={{ color: '#ccc', fontSize: 13 }}>No chapters found for this book.</div>
                    )}
                    {chaptersList.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => selectChapter(ch)}
                        style={{
                          padding: '8px',
                          marginBottom: '6px',
                          cursor: 'pointer',
                          // Only highlight chapter if we're not editing a reflection
                          backgroundColor: !editingReflection && dbChapter?.id === ch.id ? '#2b2b2b' : 'transparent',
                          borderRadius: 4,
                        }}
                      >
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{ch.title}</div>
                        <div style={{ color: '#9e9e9e', fontSize: 12, marginTop: 4 }}>
                          {ch.markdown_content ? 'Has notes' : 'No notes'}
                          {chapterHasDraft(ch.id) && (
                            <span style={{ marginLeft: 8, color: '#f59e0b' }}>• draft</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Questions Toggle (chapter-specific) */}
                {dbChapter && (
                  <>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2a2a2a' }}>
                    {/* Questions Toggle */}
                    <div style={{ marginBottom: 12 }}>
                      <button
                        onClick={() => setShowQuestions(!showQuestions)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: showQuestions ? '#2b2b2b' : '#1a1a1a',
                          color: '#fff',
                          border: '1px solid #2a2a2a',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Questions ({questionsList.filter(q => q && q.id).length})</span>
                        <span>{showQuestions ? '▼' : '▶'}</span>
                      </button>

                      {showQuestions && (
                        <div style={{ marginTop: 8, padding: '8px', backgroundColor: '#1a1a1a', borderRadius: 4 }}>
                          {/* Add new question */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            <input
                              value={newQuestionInput}
                              onChange={(e) => setNewQuestionInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  createQuestion()
                                }
                              }}
                              placeholder="Add a question..."
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                borderRadius: 4,
                                border: '1px solid #333',
                                background: '#0f0f0f',
                                color: '#fff',
                                fontSize: 13,
                              }}
                            />
                            <button
                              onClick={createQuestion}
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Add
                            </button>
                          </div>

                          {/* Questions list */}
                          {questionsList.length === 0 ? (
                            <div style={{ color: '#9e9e9e', fontSize: 12, padding: '8px 0' }}>No questions yet.</div>
                          ) : (
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {questionsList.filter(q => q && q.id).map((q) => (
                                <div
                                  key={q.id}
                                  style={{
                                    padding: '8px',
                                    marginBottom: 6,
                                    backgroundColor: '#0f0f0f',
                                    borderRadius: 4,
                                    border: '1px solid #222',
                                  }}
                                >
                                  {editingQuestion?.id === q.id ? (
                                    <div>
                                      <input
                                        value={editingQuestion.text}
                                        onChange={(e) =>
                                          setEditingQuestion({ ...editingQuestion, text: e.target.value })
                                        }
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            updateQuestion(q.id, editingQuestion.text)
                                          }
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '6px 8px',
                                          borderRadius: 4,
                                          border: '1px solid #333',
                                          background: '#000',
                                          color: '#fff',
                                          fontSize: 13,
                                          marginBottom: 6,
                                        }}
                                      />
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                          onClick={() => updateQuestion(q.id, editingQuestion.text)}
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#10b981',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: 12,
                                          }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingQuestion(null)}
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: 12,
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div
                                        onClick={() => openQuestionInEditor(q)}
                                        style={{
                                          color: '#fff',
                                          fontSize: 13,
                                          marginBottom: 6,
                                          cursor: 'pointer',
                                          padding: '4px 0',
                                        }}
                                      >
                                        {q.question_text}
                                      </div>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                          onClick={() => setEditingQuestion({ id: q.id, text: q.question_text })}
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: 12,
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => deleteQuestion(q.id)}
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#b91c1c',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            fontSize: 12,
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              </div>

              {/* Fixed bottom section: Book Notes and Reflections */}
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #2a2a2a', flexShrink: 0 }}>
                {/* Book Notes Toggle */}
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => {
                      if (!showBookNotes) {
                        openBookNotes()
                      } else {
                        setShowBookNotes(false)
                        setIsEditingBookNotes(false)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: showBookNotes ? '#2b2b2b' : '#1a1a1a',
                      color: '#fff',
                      border: '1px solid #2a2a2a',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Book Notes</span>
                    <span>{showBookNotes ? '▼' : '▶'}</span>
                  </button>
                </div>

                {/* Reflections Toggle (top-level, tied to book) */}
                <div>
                  <button
                    onClick={() => setShowReflections(!showReflections)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: showReflections ? '#2b2b2b' : '#1a1a1a',
                      color: '#fff',
                      border: '1px solid #2a2a2a',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Reflections ({reflectionsList.length})</span>
                    <span>{showReflections ? '▼' : '▶'}</span>
                  </button>

                  {showReflections && (
                    <div style={{ marginTop: 8, padding: '8px', backgroundColor: '#1a1a1a', borderRadius: 4, maxHeight: '200px', overflowY: 'auto' }}>
                      {/* Reflections list */}
                      {reflectionsList.length === 0 ? (
                        <div style={{ color: '#9e9e9e', fontSize: 12, padding: '8px 0' }}>No reflections yet.</div>
                      ) : (
                        <div>
                          {reflectionsList.filter(r => r && r.id).map((r) => {
                            // Extract a display title from reflection_text
                            // Try to find text after "> **" or use first 50 chars
                            let displayText = 'Reflection'
                            if (r.reflection_text) {
                              const quoteMatch = r.reflection_text.match(/> \*\*"([^"]+)"\*\*/)
                              if (quoteMatch && quoteMatch[1]) {
                                displayText = quoteMatch[1].slice(0, 50)
                              } else {
                                // Remove markdown and get first line or 50 chars
                                const plainText = r.reflection_text.replace(/[#*>]/g, '').trim()
                                displayText = plainText.slice(0, 50) || 'Reflection'
                              }
                            }
                            return (
                              <div
                                key={r.id}
                                style={{
                                  padding: '8px',
                                  marginBottom: 6,
                                  backgroundColor: editingReflection?.id === r.id ? '#2b2b2b' : '#0f0f0f',
                                  borderRadius: 4,
                                  border: editingReflection?.id === r.id ? '1px solid #444' : '1px solid #222',
                                }}
                              >
                                <div
                                  onClick={() => openReflectionInEditor(r)}
                                  style={{
                                    color: '#fff',
                                    fontSize: 13,
                                    marginBottom: 6,
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                  }}
                                >
                                  {displayText}
                                  {(r.reflection_text?.length > 50 || r.highlight_text?.length > 50) && '...'}
                                </div>
                                <button
                                  onClick={() => deleteReflection(r.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#b91c1c',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editor area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {isEditingBookNotes ? (
                <>
                  <div style={{ padding: '10px', borderBottom: '1px solid #222', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 4 }}>Book Notes</div>
                      <strong>Book Notes</strong>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{saving ? 'Saving...' : ''}</div>
                    </div>
                    <div style={{ color: '#9e9e9e', fontSize: 12 }}>Book Notes</div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ErrorBoundary>
                      <BlockNoteView key={editorKey} editor={editor} slashMenu={false} theme="dark" onChange={handleEditorChange}>
                        <SuggestionMenuController
                          triggerCharacter="/"
                          getItems={async (query) =>
                            filterSuggestionItems(
                              [...getDefaultReactSlashMenuItems(editor), ...getCustomSlashMenuItems(editor)],
                              query
                            )
                          }
                        />
                      </BlockNoteView>
                    </ErrorBoundary>
                  </div>
                </>
              ) : dbChapter ? (
                <>
              <div style={{ padding: '10px', borderBottom: '1px solid #222', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  {loadingReflection ? (
                    <>
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 4 }}>Reflection</div>
                      <strong>Loading reflection...</strong>
                    </>
                  ) : openQuestion ? (
                    <>
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 4 }}>Question</div>
                      <strong>{openQuestion.question_text}</strong>
                    </>
                  ) : editingReflection ? (
                    <>
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 4 }}>Reflection</div>
                      <strong>
                        {(() => {
                          // Extract quote from reflection text
                          if (editingReflection.reflection_text) {
                            const quoteMatch = editingReflection.reflection_text.match(/> \*\*"([^"]+)"\*\*/)
                            if (quoteMatch && quoteMatch[1]) {
                              return `"${quoteMatch[1].slice(0, 60)}${quoteMatch[1].length > 60 ? '...' : ''}"`
                            }
                            // Fallback: show first line or first 60 chars
                            const plainText = editingReflection.reflection_text.replace(/[#*>]/g, '').trim()
                            return plainText.slice(0, 60) + (plainText.length > 60 ? '...' : '')
                          }
                          return 'Reflection'
                        })()}
                      </strong>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 4 }}>Chapter</div>
                      <strong>{dbChapter.title}</strong>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{saving ? 'Saving...' : ''}</div>
                      {draftAvailable && (
                        <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                          <button onClick={restoreDraft} style={{ padding: '6px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>Restore draft</button>
                          <button onClick={discardDraft} style={{ padding: '6px 8px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: 4 }}>Discard draft</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ color: '#9e9e9e', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {loadingReflection ? (
                    <div>Loading...</div>
                  ) : openQuestion ? (
                    <div>Question</div>
                  ) : editingReflection ? (
                    <div>Reflection</div>
                  ) : (
                    <div>Chapter index: {dbChapter.chapter_index}</div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                {loadingReflection && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    color: '#fff'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: 8 }}>Loading reflection...</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Setting up editor</div>
                    </div>
                  </div>
                )}
                <ErrorBoundary>
                  <BlockNoteView editor={editor} slashMenu={false} theme="dark" onChange={handleEditorChange}>
                    <SuggestionMenuController
                      triggerCharacter="/"
                      getItems={async (query) =>
                        filterSuggestionItems(
                          [...getDefaultReactSlashMenuItems(editor), ...getCustomSlashMenuItems(editor)],
                          query
                        )
                      }
                    />
                  </BlockNoteView>
                </ErrorBoundary>
                </div>
                </>
              ) : (
                <div style={{ padding: 16, color: '#ccc' }}>Select a chapter from the left to view or edit notes, or open Book Notes.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MVP
