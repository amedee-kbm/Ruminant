import MainWorkspaceMockup from './components/MainWorkspaceMockup'
import Workspace from './components/Workspace'
import Login from './components/Login'
import Home from './components/Home'
import Reader from './components/Reader'
import EnhancedReader from './components/EnhancedReader'
import BooksCollection from './components/BooksCollection'
import MVP from './components/MVP'
import MVPfull from './components/MVPfull'
import { Routes, Route, Navigate } from 'react-router'
import useAuth from './hooks/useAuth'

// Protected route component that handles auth state properly
const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />
  }

  return children
}

const App = () => {
  const { session, loading } = useAuth()

  // Show loading state while checking auth
  // But don't redirect if we're still loading - this prevents flash of logout
  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <>
      <Routes>
        <Route path="/" element={session ? <Home /> : <Navigate to="/sign-in" replace />} />
        <Route path="/reader" element={<Reader />} />
        <Route
          path="/mvp/:bookId?"
          element={
            <ProtectedRoute>
              <MVP />
            </ProtectedRoute>
          }
        />
        <Route path="/mvpfull" element={<MVPfull />} />
        <Route path="/enhanced-reader" element={<EnhancedReader />} />
        <Route
          path="/workspace/:bookId"
          element={
            <ProtectedRoute>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <MainWorkspaceMockup />
            </ProtectedRoute>
          }
        />
        <Route path="/books-collection" element={<BooksCollection />} />
        <Route path="/sign-in" element={session ? <Navigate to="/" replace /> : <Login />} />
      </Routes>
    </>
  )
}

export default App
