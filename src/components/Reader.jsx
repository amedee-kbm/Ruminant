import React, { useState, useRef } from 'react'
import { ReactReader } from 'react-reader'

const Reader = () => {
  const [page, setPage] = useState('')
  const renditionRef = useRef(null)
  const tocRef = useRef(null) // here we store the toc data  co
  const [location, setLocation] = useState(0)

  const locationChanged = (epubcfi) => {
    // Update location state to track reading progress
    setLocation(epubcfi)

    // Update page display if rendition and TOC are available
    if (renditionRef.current && tocRef.current) {
      try {
        // Get the current href from the rendition
        const location = renditionRef.current.location
        if (location && location.start) {
          const { displayed, href } = location.start

          // Find which chapter matches this href in the toc
          const chapter = tocRef.current.find((item) => item.href === href)

          console.log('Current chapter:', chapter)
          console.log('Chapter label:', chapter ? chapter.label : 'n/a')

          setPage(
            `Page ${displayed.page} of ${displayed.total} in chapter ${chapter ? chapter.label : 'n/a'}`
          )
        }
      } catch (error) {
        console.error('Error accessing rendition location:', error)
      }
    }
  }
  return (
    <div style={{ height: '100vh', width: '60%' }}>
      <ReactReader
        url="https://oqxokzyjcnaotczwiilt.supabase.co/storage/v1/object/public/books/you%20can%20understand%20the%20bible_kreeft,%20peter.epub"
        location={location}
        locationChanged={locationChanged}
        getRendition={(rendition) => (renditionRef.current = rendition)}
        tocChanged={(toc) => (tocRef.current = toc)}
      />
      <div>{page}</div>
    </div>
  )
}

export default Reader
