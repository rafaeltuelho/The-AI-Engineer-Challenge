import React, { useState, useRef, useEffect } from 'react'
import { Send, Key, Settings, MessageSquare, User, Bot } from 'lucide-react'
import './ChatInterface.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  apiKey: string
  setApiKey: (key: string) => void
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiKey, setApiKey }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !apiKey.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developer_message: developerMessage,
          user_message: inputMessage,
          model: 'gpt-4.1-mini',
          api_key: apiKey
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let assistantMessage = ''
      const assistantMessageId = (Date.now() + 1).toString()
      
      const assistantMessageObj: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessageObj])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        assistantMessage += chunk

        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: assistantMessage }
              : msg
          )
        )
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please check your API key and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="chat-interface">
      <div className="chat-container">
        <div className="chat-header">
          <h2>Chat with AI</h2>
          <div className="chat-actions">
            <button 
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button 
              className="clear-btn"
              onClick={clearChat}
              title="Clear Chat"
            >
              Clear
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <div className="setting-group">
              <label htmlFor="api-key">
                <Key size={16} />
                OpenAI API Key
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                className="api-key-input"
              />
            </div>
            <div className="setting-group">
              <label htmlFor="developer-message">
                <MessageSquare size={16} />
                System Message
              </label>
              <textarea
                id="developer-message"
                value={developerMessage}
                onChange={(e) => setDeveloperMessage(e.target.value)}
                placeholder="Define the AI's behavior and role"
                className="developer-message-input"
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={48} />
              <h3>Start a conversation</h3>
              <p>Enter your message below to begin chatting with the AI assistant.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="message-content">
                  <div className="message-text">{message.content}</div>
                  <div className="message-timestamp">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">
                <Bot size={20} />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message here..."
              className="message-input"
              disabled={isLoading || !apiKey.trim()}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || !inputMessage.trim() || !apiKey.trim()}
            >
              <Send size={20} />
            </button>
          </div>
          {!apiKey.trim() && (
            <div className="api-key-warning">
              <Key size={16} />
              Please enter your OpenAI API key in settings to start chatting
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default ChatInterface
