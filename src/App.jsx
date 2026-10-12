import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import useAuth from './hooks/useAuth'

// Route-level code splitting keeps the reader/editor out of the login and library bundles
const Login = lazy(() => import('./components/Login'))
const Home = lazy(() => import('./components/Home'))
const BookWorkspace = lazy(() => import('./components/book/BookWorkspace'))

const Loading = () => <div>Loading...</div>

const ProtectedRoute = ({ children }) => {
  const { session } = useAuth()
  return session ? children : <Navigate to="/sign-in" replace />
}

const App = () => {
  const { session, loading } = useAuth()

  // Wait for the initial session check so signed-in users aren't bounced to /sign-in
  if (loading) {
    return <Loading />
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/books/:bookId"
          element={
            <ProtectedRoute>
              <BookWorkspace />
            </ProtectedRoute>
          }
        />
        <Route path="/sign-in" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
