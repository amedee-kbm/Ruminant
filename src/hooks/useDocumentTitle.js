import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Meditations · Ruminant" */
export const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · Ruminant` : 'Ruminant'
  }, [title])
}
