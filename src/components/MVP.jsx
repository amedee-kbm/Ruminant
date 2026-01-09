import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router'
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

const TEST_BOOK_ID = '5f5ee420-acc0-4627-ac17-95092498f673'

export const MVP = () => {
  const { bookId: routeBookId } = useParams()
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

  // Pre-questions editing state
  const [editingQuestions, setEditingQuestions] = useState(false)
  const [questionsDraft, setQuestionsDraft] = useState([])
  const [newQuestionText, setNewQuestionText] = useState('')

  // Summary state
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryVisible, setSummaryVisible] = useState(false)
  const [summaryText, setSummaryText] = useState('')
  const [concatenatedNotes, setConcatenatedNotes] = useState('')
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('md')

  const renditionRef = useRef(null) 
  const tocRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const hasUnsavedChangesRef = useRef(false)

  // -------------------------
  // BlockNote editor
  // -------------------------
  const editor = useCreateBlockNote()

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

  // Load markdown content into BlockNote editor when dbChapter changes
  useEffect(() => {
    const loadMarkdownIntoEditor = async () => {
      if (!editor || !dbChapter || isEditorLoaded) return

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
  }, [editor, dbChapter, isEditorLoaded])

  // Fetch chapters list for Notes Library
  useEffect(() => {
    if (!bookId || !userId) return

    const fetchChapters = async () => {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('id,title,chapter_index,markdown_content,pre_questions')
          .eq('book_id', bookId)
          .eq('user_id', userId)
          .order('chapter_index', { ascending: true })

        if (error) {
          console.error('❌ Error fetching chapters list:', error)
          return
        }

        console.log('📚 Fetched chapters for book:', {
          bookId,
          userId,
          count: data?.length || 0,
          sample: (data || []).slice(0, 5),
        })

        setChaptersList(data || [])
      } catch (err) {
        console.error('❌ Unexpected error fetching chapters:', err)
      }
    }

    fetchChapters()
  }, [bookId, userId])

  // Chapter selection from Notes Library
  const selectChapter = async (chapter) => {
    // Flush pending save for previous chapter
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

    setDbChapter(chapter)
    setIsEditorLoaded(false)

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

    // Initialize pre-questions editing state
    try {
      setQuestionsDraft(chapter.pre_questions || [])
      setEditingQuestions(false)
      setNewQuestionText('')
    } catch (err) {
      setQuestionsDraft([])
      setEditingQuestions(false)
      setNewQuestionText('')
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
    if (!editor || !dbChapter || !isEditorLoaded) return

    // Convert blocks to markdown immediately for local UI/draft
    let markdown
    try {
      markdown = await editor.blocksToMarkdownLossy(editor.document)
    } catch (err) {
      console.error('❌ Error converting editor to markdown:', err)
      return
    }

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
  }, [editor, dbChapter, isEditorLoaded, saveChapterContent])

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

  // Pre-questions editing helpers
  const startEditQuestions = () => {
    setQuestionsDraft(dbChapter?.pre_questions || [])
    setNewQuestionText('')
    setEditingQuestions(true)
  }

  const addQuestion = () => {
    const q = (newQuestionText || '').trim()
    if (!q) return
    setQuestionsDraft((prev) => [...prev, q])
    setNewQuestionText('')
  }

  const removeQuestion = (index) => {
    setQuestionsDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const savePreQuestions = async () => {
    if (!dbChapter?.id || !userId) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('chapters')
        .update({ pre_questions: questionsDraft })
        .eq('id', dbChapter.id)
        .eq('user_id', userId)

      if (error) throw error

      // Update local state optimistically
      setDbChapter((prev) => ({ ...(prev || {}), pre_questions: questionsDraft }))
      setChaptersList((prev) => prev.map((c) => (c.id === dbChapter.id ? { ...c, pre_questions: questionsDraft } : c)))
      setEditingQuestions(false)
    } catch (err) {
      console.error('❌ Error saving pre_questions:', err)
    } finally {
      setSaving(false)
    }
  }

  const cancelEditQuestions = () => {
    setQuestionsDraft(dbChapter?.pre_questions || [])
    setNewQuestionText('')
    setEditingQuestions(false)
  }

  // Try to read selection from the reader (handles multiple possible locations)
  const getReaderSelection = () => {
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

  // Create a reflection prompt from the current reader selection
  const createReflectionFromSelection = async () => {
    const selection = getReaderSelection()
    if (!selection) {
      alert('No text selected in the reader. Highlight a passage then click "Make reflection".')
      return
    }

    const snippet = selection.length > 300 ? `${selection.slice(0, 297)}...` : selection
    const prompt = `Reflect on the passage: "${snippet}"`

    // If a dbChapter is already selected, add it to the questions draft
    if (dbChapter?.id) {
      setQuestionsDraft((prev) => [...prev, prompt])
      setEditingQuestions(true)
      setViewMode('notes')
      return
    }

    // Try to ensure a chapter exists for current reader location
    if (currentChapter) {
      try {
        // createOrUpdateChapter will set dbChapter if it creates/updates
        await createOrUpdateChapter(currentChapter, '')

        // Reload chapter from DB to ensure state is set
        await loadChapterFromDatabase(currentChapter, bookId)

        // Add the prompt
        setQuestionsDraft((prev) => [...prev, prompt])
        setEditingQuestions(true)
        setViewMode('notes')
        return
      } catch (err) {
        console.error('❌ Error creating chapter for selection:', err)
      }
    }

    // Fallback: just open questions editor with the prompt (no chapter linked yet)
    setQuestionsDraft((prev) => [...prev, prompt])
    setEditingQuestions(true)
    setViewMode('notes')
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
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

      {/* Summary overlay */}
      {summaryVisible && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 56,
            zIndex: 30,
            width: 420,
            maxHeight: '70vh',
            overflow: 'auto',
            background: '#121212',
            border: '1px solid #2b2b2b',
            padding: 12,
            borderRadius: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: '#fff' }}>Concise summary</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setDownloadFormat('md')}
                  style={{
                    padding: '6px 8px',
                    background: downloadFormat === 'md' ? '#111' : '#222',
                    color: '#fff',
                    border: '1px solid #2a2a2a',
                    borderRadius: 4,
                  }}
                >
                  MD
                </button>
                <button
                  onClick={() => setDownloadFormat('txt')}
                  style={{
                    padding: '6px 8px',
                    background: downloadFormat === 'txt' ? '#111' : '#222',
                    color: '#fff',
                    border: '1px solid #2a2a2a',
                    borderRadius: 4,
                  }}
                >
                  TXT
                </button>
              </div>
              <button
                onClick={() => copyToClipboard(summaryText)}
                style={{
                  padding: '6px 8px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                }}
              >
                Copy
              </button>
              <button
                onClick={() => downloadConcatenatedNotes()}
                style={{
                  padding: '6px 8px',
                  background: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                }}
              >
                Download ({downloadFormat.toUpperCase()})
              </button>
              <button
                onClick={() => setSummaryVisible(false)}
                style={{
                  padding: '6px 8px',
                  background: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div
            style={{
              color: '#d1d5db',
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.3,
            }}
          >
            {summaryText || 'No notes yet.'}
          </div>

          <div
            style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ color: '#9e9e9e', fontSize: 12 }}>
              {concatenatedNotes ? 'Includes all chapters' : ''}
            </div>
            <button
              onClick={() => setShowAllNotes((s) => !s)}
              style={{
                padding: '6px 8px',
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
              }}
            >
              {showAllNotes ? 'Hide all' : 'Show all notes'}
            </button>
          </div>

          {showAllNotes && (
            <pre
              style={{
                marginTop: 8,
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 8,
                borderRadius: 6,
                maxHeight: '50vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {concatenatedNotes || '(no notes)'}
            </pre>
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
                getRendition={(r) => (renditionRef.current = r)}
                tocChanged={(toc) => {
                  console.log('📚 ReactReader TOC:', toc)
                  tocRef.current = toc
                }}
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
                overflowY: 'auto',
                padding: '8px',
                boxSizing: 'border-box',
              }}
            >
          <div style={{ color: '#fff', marginBottom: '8px', fontWeight: 600 }}>Chapters</div>
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
                    backgroundColor: dbChapter?.id === ch.id ? '#2b2b2b' : 'transparent',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{ch.title}</div>
                  <div style={{ color: '#9e9e9e', fontSize: 12, marginTop: 4 }}>
                    {ch.markdown_content ? 'Has notes' : 'No notes'}
                    {ch.pre_questions && ch.pre_questions.length > 0 && (
                      <span style={{ marginLeft: 8 }}>• {ch.pre_questions.length} questions</span>
                    )}
                    {chapterHasDraft(ch.id) && (
                      <span style={{ marginLeft: 8, color: '#f59e0b' }}>• draft</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Editor area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {dbChapter ? (
            <>
              <div style={{ padding: '10px', borderBottom: '1px solid #222', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong>{dbChapter.title}</strong>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{saving ? 'Saving...' : ''}</div>
                  {draftAvailable && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                      <button onClick={restoreDraft} style={{ padding: '6px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>Restore draft</button>
                      <button onClick={discardDraft} style={{ padding: '6px 8px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: 4 }}>Discard draft</button>
                    </div>
                  )}
                </div>
                <div style={{ color: '#9e9e9e', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={startEditQuestions} style={{ padding: '6px 8px', backgroundColor: '#111', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 4 }}>Edit questions</button>
                  <div>Chapter index: {dbChapter.chapter_index}</div>
                </div>
              </div>

              {editingQuestions ? (
                <div style={{ padding: 12, borderBottom: '1px solid #222', color: '#fff' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Pre-read questions</div>
                  <div>
                    {questionsDraft.length === 0 && <div style={{ color: '#9e9e9e', marginBottom: 8 }}>No questions yet.</div>}
                    {questionsDraft.map((q, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>{q}</div>
                        <button onClick={() => removeQuestion(idx)} style={{ padding: '4px 6px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}>Delete</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} placeholder='Add a question...' style={{ flex: 1, padding: '6px', borderRadius: 4, border: '1px solid #333', background: '#0f0f0f', color: '#fff' }} />
                    <button onClick={addQuestion} style={{ padding: '6px 8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>Add</button>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button onClick={savePreQuestions} style={{ padding: '6px 8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 4 }}>Save questions</button>
                    <button onClick={cancelEditQuestions} style={{ padding: '6px 8px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: 4 }}>Cancel</button>
                  </div>
                </div>
              ) : null}

              <div style={{ flex: 1, minHeight: 0 }}>
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
              </div>
            </>
          ) : (
            <div style={{ padding: 16, color: '#ccc' }}>
              Select a chapter from the left to view or edit notes.
            </div>
          )}
        </div>
      </div>
        )}
      </div>
    </div>
  )
}

export default MVP
