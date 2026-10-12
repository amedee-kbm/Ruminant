import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router'
import useAuth from './hooks/useAuth'
import { isSampleId } from './lib/sampleBooks'

// Route-level code splitting keeps the editor out of the login and library bundles
const loadBookWorkspace = () => import('./components/book/BookWorkspace')
const Login = lazy(() => import('./components/Login'))
const Home = lazy(() => import('./components/Home'))
const BookWorkspace = lazy(loadBookWorkspace)

// Same markup and styles as the splash in index.html, so loading looks like one screen
const Splash = () => (
  <div className="splash" role="status" aria-label="Loading">
    <span>Ruminant</span>
  </div>
)

// Guests can open the sample books; every other book needs an account
const BookRoute = () => {
  const { session } = useAuth()
  const { bookId } = useParams()
  return session || isSampleId(bookId) ? <BookWorkspace /> : <Navigate to="/sign-in" replace />
}

const App = () => {
  const { session, loading } = useAuth()

  // Fetch the book page in the background so opening a book doesn't flash the splash
  useEffect(() => {
    if (!loading) loadBookWorkspace()
  }, [loading])

  // Wait for the initial session check so signed-in users aren't shown the guest view
  if (loading) {
    return <Splash />
  }

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/books/:bookId" element={<BookRoute />} />
        <Route path="/sign-in" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
