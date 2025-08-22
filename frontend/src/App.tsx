import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import Header from './components/Header'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Load theme preference from localStorage on component mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      // Default to light theme
      setTheme('light')
    }
  }, [])

  // Update document data-theme attribute and save to localStorage when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  return (
    <div className="app">
      <Header theme={theme} onThemeChange={handleThemeChange} />
      <main className="main-content">
        <ChatInterface 
          apiKey={apiKey} 
          setApiKey={setApiKey} 
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      </main>
    </div>
  )
}

export default App
