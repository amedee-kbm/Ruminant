const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])
// Well-formed numerals only, so words like "did" or "mid" aren't mistaken for one
const ROMAN_NUMERAL = /^(?=[mdclxvi])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/i

const stripPunctuation = (word) => word.replace(/[.:,]$/, '')
const isNumber = (word) =>
  /^\d+$/.test(stripPunctuation(word)) || ROMAN_NUMERAL.test(stripPunctuation(word))

const titleCaseWord = (word, isFirst) => {
  if (ROMAN_NUMERAL.test(stripPunctuation(word))) return word.toUpperCase()
  const lower = word.toLowerCase()
  if (!isFirst && SMALL_WORDS.has(lower)) return lower
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/**
 * Tidies titles as EPUB tables of contents often write them:
 * "PART ONE   YES, YOU CAN" becomes "Part One · Yes, You Can".
 * Wide gaps (tabs, runs of spaces) mark a label and a title, so they become " · ".
 * Titles with no lowercase letters are converted to title case; others are left alone.
 */
export const formatTitle = (title) => {
  if (!title) return ''
  const parts = title
    .trim()
    .split(/\t+|\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  const shouting = !/\p{Ll}/u.test(title)
  return parts
    .map((part) =>
      shouting
        ? part
            .split(/\s+/)
            // A word after a number ("Chapter IV The…") starts the title proper
            .map((word, i, words) => titleCaseWord(word, i === 0 || isNumber(words[i - 1])))
            .join(' ')
        : part.replace(/\s+/g, ' ')
    )
    .join(' · ')
}
