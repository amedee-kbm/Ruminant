/**
 * Sample books shown to guests and to new users with an empty library. They can be opened
 * and written in, but edits only live in memory for the current tab and are never saved.
 */

const SAMPLE_PREFIX = 'sample-'

export const isSampleId = (bookId) => !!bookId?.startsWith(SAMPLE_PREFIX)

const sample = ({ slug, title, author, question, takeaway, chapters }) => {
  const id = `${SAMPLE_PREFIX}${slug}`
  return {
    id,
    title,
    author,
    cover_url: null,
    question,
    takeaway,
    chapters: chapters.map(([chapterTitle, notes], index) => ({
      id: `${id}-${index}`,
      title: chapterTitle,
      chapter_index: index,
      locator: `${id}-${index}`,
      markdown_content: notes ?? null,
    })),
  }
}

// Finished: every chapter has notes and the takeaway is written
const meditations = sample({
  slug: 'meditations',
  title: 'Meditations',
  author: 'Marcus Aurelius',
  question:
    'How did someone with that much power stay calm and decent? I want a few habits of mind I can actually use on a bad day.',
  takeaway:
    'Most of my distress comes from my judgement of events, not the events themselves. When something annoys me, ask: is this in my control? If not, let it go; if so, act on it and stop rehearsing it.',
  chapters: [
    [
      'Book One',
      'A list of thank-yous: what he learned from each person in his life. Good exercise: who taught me patience?',
    ],
    [
      'Book Two',
      '"Begin the morning by saying to yourself: I shall meet with the busybody, the ungrateful, arrogant..." Expect friction and it stops being a surprise.',
    ],
    [
      'Book Three',
      'We only ever live the present moment; the rest is past or uncertain. Stop borrowing worry.',
    ],
    [
      'Book Four',
      'Retreat into yourself: you don’t need a holiday to find quiet. Things can’t touch the mind; disturbance comes from opinion.',
    ],
    [
      'Book Five',
      'On getting out of bed: "I am rising to the work of a human being." Funny how relatable the emperor is here.',
    ],
    ['Book Six', 'The best revenge is not to be like the one who wronged you.'],
    ['Book Seven', 'On pain: what’s unbearable ends quickly, and what lasts can be borne.'],
    ['Book Eight', 'Don’t be overwhelmed by imagining your whole life at once. Just this, now.'],
    ['Book Nine', 'Doing nothing can be an injustice too. Quieter chapter; skimmed parts of it.'],
    ['Book Ten', 'Stop talking about what a good person is like, and be one.'],
    ['Book Eleven', 'When offended, ask: what did I expect? Reasonable people still err.'],
    [
      'Book Twelve',
      'We love ourselves more than others, yet care more about their opinion than our own. Worth sitting with.',
    ],
  ],
})

// In progress: notes on the first few chapters, the rest still to read
const walden = sample({
  slug: 'walden',
  title: 'Walden',
  author: 'Henry David Thoreau',
  question:
    'What do I actually need? I want to test my own sense of "enough" against someone who went to the extreme.',
  takeaway: null,
  chapters: [
    [
      'Economy',
      'Long, and he lists his costs to the half-cent. Main point: we spend our lives earning things that then own us. "The cost of a thing is the amount of life which is required to be exchanged for it."',
    ],
    [
      'Where I Lived, and What I Lived For',
      '"I went to the woods because I wished to live deliberately." He wants to simplify so he can notice things. Less of a hermit than I expected.',
    ],
    [
      'Reading',
      'Books should be read as deliberately as they were written. He’s hard on light reading, and a bit of a snob about it.',
    ],
    [
      'Sounds',
      'The train cuts through the pond’s quiet. Even in 1845 he’s writing about the world getting faster.',
    ],
    ['Solitude'],
    ['Visitors'],
    ['The Bean-Field'],
    ['The Village'],
    ['The Ponds'],
    ['Baker Farm'],
    ['Higher Laws'],
    ['Brute Neighbors'],
    ['House-Warming'],
    ['Former Inhabitants; and Winter Visitors'],
    ['Winter Animals'],
    ['The Pond in Winter'],
    ['Spring'],
    ['Conclusion'],
  ],
})

// Just started: the question is written, nothing else yet
const artOfWar = sample({
  slug: 'art-of-war',
  title: 'The Art of War',
  author: 'Sun Tzu',
  question:
    'People quote this for business and sport. Is there real advice in it for ordinary decisions, or is it just good-sounding lines?',
  takeaway: null,
  chapters: [
    [
      'Laying Plans',
      'Five factors to weigh before acting. "All warfare is based on deception." Plan, and know the ground, before you commit.',
    ],
    ['Waging War'],
    ['Attack by Stratagem'],
    ['Tactical Dispositions'],
    ['Energy'],
    ['Weak Points and Strong'],
    ['Maneuvering'],
    ['Variation in Tactics'],
    ['The Army on the March'],
    ['Terrain'],
    ['The Nine Situations'],
    ['The Attack by Fire'],
    ['The Use of Spies'],
  ],
})

// Edits during the session are kept here so they survive moving between pages
const store = new Map([meditations, walden, artOfWar].map((book) => [book.id, book]))

/** The sample books with their chapters, in display order */
export const getSampleBooks = () => [...store.values()]

/** A sample book's details, without its chapters, or null if there's no such sample */
export const getSampleBook = (bookId) => {
  const book = store.get(bookId)
  if (!book) return null
  const { chapters: _chapters, ...details } = book
  return details
}

export const getSampleChapters = (bookId) => store.get(bookId)?.chapters ?? []

export const updateSampleBook = (bookId, fields) => {
  const book = store.get(bookId)
  if (book) store.set(bookId, { ...book, ...fields })
}

export const updateSampleChapter = (chapterId, fields) => {
  for (const book of store.values()) {
    if (!book.chapters.some((c) => c.id === chapterId)) continue
    const chapters = book.chapters.map((c) => (c.id === chapterId ? { ...c, ...fields } : c))
    store.set(book.id, { ...book, chapters })
  }
}
