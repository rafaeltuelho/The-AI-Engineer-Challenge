import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import Header from './components/Header'
import { useAuth } from './contexts/AuthContext'
import './App.css'

function App() {
  const { user, authConfig } = useAuth()
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [togetherApiKey, setTogetherApiKey] = useState<string>('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5-nano')
  const [selectedProvider, setSelectedProvider] = useState<string>('openai')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [freeTurnsRemaining, setFreeTurnsRemaining] = useState<number>(user?.freeTurnsRemaining ?? 0)
  const [welcomeSuggestions, setWelcomeSuggestions] = useState<string[]>([])

  const modelDescriptions = {
    // OpenAI models
    'gpt-4': 'Standard GPT-4 model',
    'gpt-4-mini': 'Compact GPT-4 variant',
    'gpt-4-turbo': 'Enhanced GPT-4 with improved performance',
    'gpt-4o': 'Latest GPT-4 optimized model',
    'gpt-4o-mini': 'Lightweight version of GPT-4o',
    'gpt-4.1': 'Standard GPT-4.1 model',
    'gpt-4.1-mini': 'Compact GPT-4.1 variant',
    'gpt-4.1-nano': 'Ultra-lightweight GPT-4.1',
    'gpt-5': 'Latest GPT-5 model',
    'gpt-5-mini': 'Compact GPT-5 variant',
    'gpt-5-nano': 'Ultra-lightweight GPT-5 (default)',
    // Together.ai models
    'deepseek-ai/DeepSeek-R1': 'DeepSeek R1 reasoning model',
    'deepseek-ai/DeepSeek-V3': 'DeepSeek V3 reasoning model',
    'deepseek-ai/DeepSeek-V3.1': 'DeepSeek V3.1 (default Together.ai)',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'Llama 3.3 70B Turbo',
    'openai/gpt-oss-20b': 'OpenAI GPT OSS 20B',
    'openai/gpt-oss-120b': 'OpenAI GPT OSS 120B',
    'moonshotai/Kimi-K2-Instruct-0905': 'Moonshot.ai Kimi K2 Instruct 0905',
    'Qwen/Qwen3-Next-80B-A3B-Thinking': 'Qwen 3 Next 80B A3B Thinking'
  }

  // Fetch app config (suggestions) on mount
  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const data = await response.json()
          if (data.suggestions && Array.isArray(data.suggestions)) {
            setWelcomeSuggestions(data.suggestions)
          }
        }
      } catch (error) {
        console.error('Failed to fetch app config:', error)
      }
    }
    fetchAppConfig()
  }, [])

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

  // Sync freeTurnsRemaining from user context
  useEffect(() => {
    if (user) {
      setFreeTurnsRemaining(user.freeTurnsRemaining)
    }
  }, [user])

  // Handle API key changes
  const handleApiKeyChange = (newApiKey: string) => {
    if (selectedProvider === 'together') {
      setTogetherApiKey(newApiKey)
    } else {
      setOpenaiApiKey(newApiKey)
    }
  }

  // Handle provider changes
  const handleProviderChange = async (newProvider: string) => {
    setSelectedProvider(newProvider)
    // Set default model based on provider
    if (newProvider === 'together') {
      setSelectedModel('deepseek-ai/DeepSeek-V3.1')
    } else {
      setSelectedModel('gpt-5-nano')
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
  }

  // Determine effective API key based on user type
  const getEffectiveApiKey = (): string => {
    if (!user) return ''

    // Whitelisted users: backend will use server-side key
    if (user.isWhitelisted) {
      return ''
    }

    // Free tier users (not whitelisted, has free turns, no own key)
    const hasFreeTurns = freeTurnsRemaining > 0
    const hasOwnKey = selectedProvider === 'together' ? togetherApiKey.trim() : openaiApiKey.trim()

    if (!user.isWhitelisted && hasFreeTurns && !hasOwnKey) {
      return ''
    }

    // Users with own API keys
    return selectedProvider === 'together' ? togetherApiKey : openaiApiKey
  }

  // Lock provider/model for free tier users
  useEffect(() => {
    if (!user || !authConfig) return

    const hasOwnKey = selectedProvider === 'together' ? togetherApiKey.trim() : openaiApiKey.trim()
    const isFreeTierMode = !user.isWhitelisted && freeTurnsRemaining > 0 && !hasOwnKey

    if (isFreeTierMode) {
      // Lock to free provider and model
      if (selectedProvider !== authConfig.freeProvider) {
        setSelectedProvider(authConfig.freeProvider)
      }
      if (selectedModel !== authConfig.freeModel) {
        setSelectedModel(authConfig.freeModel)
      }
    }
  }, [user, authConfig, freeTurnsRemaining, togetherApiKey, openaiApiKey, selectedProvider, selectedModel])

  const handleFreeTurnsUpdate = (turns: number) => {
    setFreeTurnsRemaining(turns)
  }

  if (!user) return null

  const effectiveApiKey = getEffectiveApiKey()
  const hasOwnKey = selectedProvider === 'together' ? togetherApiKey.trim() : openaiApiKey.trim()
  const hasFreeTurns = freeTurnsRemaining > 0

  return (
    <div className="app">
      <Header
        theme={theme}
        onThemeChange={handleThemeChange}
        selectedModel={selectedModel}
        selectedProvider={selectedProvider}
        onSettingsClick={() => setSettingsModalOpen(true)}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        isWhitelisted={user.isWhitelisted}
        freeTurnsRemaining={freeTurnsRemaining}
        authType={user.authType}
        userName={user.name}
        userPicture={user.picture}
      />
      <main className="main-content">
        <ChatInterface
          apiKey={effectiveApiKey}
          setApiKey={handleApiKeyChange}
          sessionId={user.sessionId}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedProvider={selectedProvider}
          setSelectedProvider={handleProviderChange}
          modelDescriptions={modelDescriptions}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          settingsModalOpen={settingsModalOpen}
          setSettingsModalOpen={setSettingsModalOpen}
          isWhitelisted={user.isWhitelisted}
          freeTurnsRemaining={freeTurnsRemaining}
          authType={user.authType}
          onFreeTurnsUpdate={handleFreeTurnsUpdate}
          hasFreeTurns={hasFreeTurns}
          hasOwnApiKey={!!hasOwnKey}
          welcomeSuggestions={welcomeSuggestions}
        />
      </main>
    </div>
  )
}

export default App
