// MVPfull.jsx - Full-featured EPUB reader using react-epub-viewer
import { useState, useRef } from 'react'
import { EpubViewer } from 'react-epub-viewer'

const MVPfull = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(null)
  const [totalPages, setTotalPages] = useState(null)
  const [toc, setToc] = useState([])
  const viewerRef = useRef(null)

  const bookUrl =
    'https://oqxokzyjcnaotczwiilt.supabase.co/storage/v1/object/public/books/you%20can%20understand%20the%20bible_kreeft,%20peter.epub'

  const handleTocChange = (tocData) => {
    console.log('Table of Contents loaded:', tocData)
    if (tocData && Array.isArray(tocData)) {
      setToc(tocData)
    }
  }

  const handlePageChange = (pageInfo) => {
    console.log('Page changed:', pageInfo)
    if (pageInfo) {
      setCurrentPage(pageInfo.current)
      setTotalPages(pageInfo.total)
      setLoading(false)
    }
  }

  const handleBookChanged = (book) => {
    console.log('Book loaded:', book)
    setLoading(false)
  }

  const handleError = (err) => {
    console.error('Error loading book:', err)
    setError('Failed to load the book. Please check the URL or try again.')
    setLoading(false)
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxWidth: '28rem',
          }}
        >
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#f3f4f6',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: 'white',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          padding: '1rem',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '72rem',
            margin: '0 auto',
          }}
        >
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1f2937',
              margin: 0,
            }}
          >
            You Can Understand the Bible
          </h1>
          {currentPage && totalPages && (
            <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
              Page {currentPage} of {totalPages}
            </div>
          )}
        </div>
      </div>

      {/* Book Viewer with Built-in Navigation and TOC */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '2rem',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <p style={{ fontSize: '1.125rem', color: '#374151' }}>Loading book...</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              This may take a moment
            </p>
          </div>
        )}

        {/* react-epub-viewer provides built-in UI including:
            - Table of Contents sidebar
            - Navigation controls (prev/next buttons)
            - Font size controls
            - Theme controls
            - Full-screen mode
        */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          <EpubViewer
            ref={viewerRef}
            url={bookUrl}
            epubFileOptions={{
              openAs: 'epub',
            }}
            tocChanged={handleTocChange}
            pageChanged={handlePageChange}
            bookChanged={handleBookChanged}
            onError={handleError}
            styles={{
              viewer: {
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
              },
              view: {
                padding: '2rem',
              },
            }}
          />
        </div>
      </div>

      {/* Optional: Additional Info Footer */}
      {toc.length > 0 && (
        <div
          style={{
            backgroundColor: 'white',
            boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '0.75rem 1rem',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              maxWidth: '72rem',
              margin: '0 auto',
              fontSize: '0.75rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            {toc.length} chapters available • Use the built-in navigation controls to explore
          </div>
        </div>
      )}
    </div>
  )
}

export default MVPfull

