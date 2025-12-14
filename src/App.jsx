import MainWorkspaceMockup from './components/MainWorkspaceMockup'
import Workspace from './components/Workspace'
import Login from './components/Login'
import Home from './components/Home'
import BooksCollection from './components/BooksCollection'
import { Routes, Route } from 'react-router'
import useAuth from './hooks/useAuth'

const App = () => {
  const { session, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }
  return (
    <>
      <Routes>
        <Route path="/" element={session ? <Home /> : <Login />} />
        <Route path="/workspace/:bookId" element={<Workspace />} />
        <Route path="/workspace" element={<MainWorkspaceMockup />} />
        <Route path="/books-collection" element={<BooksCollection />} />
        <Route path="/sign-in" element={<Login />} />
      </Routes>
    </>
  )
}

export default App
