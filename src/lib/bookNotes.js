import { formatTitle } from './formatTitle'

/**
 * A book has a question (what you want from it, written before reading) and a takeaway
 * (what you'll keep, written after). Each chapter has free-form notes, stored in
 * chapters.markdown_content.
 */

export const getNotes = (chapter) => chapter.markdown_content || ''

export const hasNotes = (chapter) => !!getNotes(chapter).trim()

/** Every chapter's notes, framed by the book's question and takeaway, as Markdown */
export const buildExportMarkdown = (book, chapters) => {
  const sections = [`# ${book.title}`]
  if (book.author) sections.push(`*${book.author}*`)
  if (book.question?.trim())
    sections.push(`## What I wanted to find out\n\n${book.question.trim()}`)

  const chapterNotes = chapters
    .filter(hasNotes)
    .map((c) => `### ${formatTitle(c.title)}\n\n${getNotes(c).trim()}`)
  if (chapterNotes.length) sections.push(`## Chapter notes\n\n${chapterNotes.join('\n\n')}`)

  if (book.takeaway?.trim()) sections.push(`## What I'll keep\n\n${book.takeaway.trim()}`)
  return `${sections.join('\n\n')}\n`
}

export const hasAnythingToExport = (book, chapters) =>
  !!(book.question?.trim() || book.takeaway?.trim() || chapters.some(hasNotes))

export const downloadMarkdown = (content, fileName) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
