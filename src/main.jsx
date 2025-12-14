import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import App from './App'
import { AuthProvider } from './contexts/AuthProvider'

const root = document.getElementById('root')

ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <ChakraProvider value={defaultSystem}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ChakraProvider>
  </BrowserRouter>
)
