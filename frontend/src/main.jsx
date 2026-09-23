import React from 'react'
import ReactDOM from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
