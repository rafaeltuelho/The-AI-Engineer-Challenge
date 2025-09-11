import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import Header from './components/Header'
import './App.css'

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5-nano')

  const modelDescriptions = {
    'gpt-4': 'Standard GPT-4 model',
    'gpt-4-turbo': 'Enhanced GPT-4 with improved performance',
    'gpt-4o': 'Latest GPT-4 optimized model',
    'gpt-4o-mini': 'Lightweight version of GPT-4o',
    'gpt-4.1-mini': 'Compact GPT-4.1 variant',
    'gpt-4.1-nano': 'Ultra-lightweight GPT-4.1',
    'gpt-5': 'Latest GPT-5 model',
    'gpt-4-mini': 'Compact GPT-4 variant',
    'gpt-5-nano': 'Ultra-lightweight GPT-5 (default)'
  }

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
      <Header 
        theme={theme} 
        onThemeChange={handleThemeChange}
        selectedModel={selectedModel}
        modelDescription={modelDescriptions[selectedModel as keyof typeof modelDescriptions]}
      />
      <main className="main-content">
        <ChatInterface 
          apiKey={apiKey} 
          setApiKey={setApiKey} 
          theme={theme}
          onThemeChange={handleThemeChange}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          modelDescriptions={modelDescriptions}
        />
      </main>
    </div>
  )
}

export default App
