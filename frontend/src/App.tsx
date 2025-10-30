import { useState, useEffect } from 'react'
import ChatInterface from './components/ChatInterface'
import Header from './components/Header'
import './App.css'

function App() {
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [togetherApiKey, setTogetherApiKey] = useState<string>('')
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('')
  const [sessionId, setSessionId] = useState<string>('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5-nano')
  const [selectedProvider, setSelectedProvider] = useState<string>('openai')

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
    'Qwen/Qwen3-Next-80B-A3B-Thinking': 'Qwen 3 Next 80B A3B Thinking',
    // Anthropic models (Claude)
    'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 - Best for complex agents and coding',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 - Fastest with near-frontier intelligence',
    'claude-opus-4-1-20250805': 'Claude Opus 4.1 - Exceptional for specialized reasoning',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4 (Legacy)',
    'claude-3-7-sonnet-20250219': 'Claude Sonnet 3.7 (Legacy)',
    'claude-opus-4-20250514': 'Claude Opus 4 (Legacy)',
    'claude-3-5-haiku-20241022': 'Claude Haiku 3.5 (Legacy)',
    'claude-3-haiku-20240307': 'Claude Haiku 3 (Legacy)'
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

  // Create session when API key is provided
  const createSession = async (apiKey: string, provider: string) => {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey, provider: provider })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSessionId(data.session_id)
        return data.session_id
      } else {
        console.error('Failed to create session:', response.statusText)
        return null
      }
    } catch (error) {
      console.error('Error creating session:', error)
      return null
    }
  }

  // Handle API key changes
  const handleApiKeyChange = async (newApiKey: string) => {
    if (selectedProvider === 'together') {
      setTogetherApiKey(newApiKey)
    } else if (selectedProvider === 'anthropic') {
      setAnthropicApiKey(newApiKey)
    } else {
      setOpenaiApiKey(newApiKey)
    }
    const effectiveKey = newApiKey.trim()

    if (effectiveKey) {
      // Always create a new session when API key is provided (even if updating existing key)
      await createSession(effectiveKey, selectedProvider)
    } else {
      // Clear session if API key is empty
      setSessionId('')
    }
  }

  // Handle provider changes
  const handleProviderChange = async (newProvider: string) => {
    setSelectedProvider(newProvider)
    // Set default model based on provider
    if (newProvider === 'together') {
      setSelectedModel('deepseek-ai/DeepSeek-V3.1')
    } else if (newProvider === 'anthropic') {
      setSelectedModel('claude-sonnet-4-5-20250929')
    } else {
      setSelectedModel('gpt-5-nano')
    }
    // Do NOT recreate the session when switching providers to keep conversations intact.
    // We will keep using the existing sessionId. Backend stores conversations by the
    // original session's hashed key; API calls will pass the provider-specific key.
  }

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
          apiKey={selectedProvider === 'together' ? togetherApiKey : selectedProvider === 'anthropic' ? anthropicApiKey : openaiApiKey}
          setApiKey={handleApiKeyChange}
          sessionId={sessionId}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          selectedProvider={selectedProvider}
          setSelectedProvider={handleProviderChange}
          modelDescriptions={modelDescriptions}
        />
      </main>
    </div>
  )
}

export default App
