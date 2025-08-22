import React, { useState, useRef, useEffect } from 'react'
import { Send, Key, Settings, MessageSquare, User, Bot, RefreshCw, Trash2 } from 'lucide-react'
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
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [showConversations, setShowConversations] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load conversations on component mount
  useEffect(() => {
    if (apiKey) {
      loadConversations()
    }
  }, [apiKey])

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        setConversations(data)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    }
  }

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages.map((msg: any) => ({
          id: msg.timestamp,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        })))
        setConversationId(convId)
        setDeveloperMessage(data.system_message)
        setShowConversations(false)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const deleteConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await loadConversations()
        if (conversationId === convId) {
          clearChat()
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

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
          conversation_id: conversationId,
          developer_message: developerMessage,
          user_message: inputMessage,
          model: 'gpt-4.1-mini',
          api_key: apiKey
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Get conversation ID from response headers or create new one
      const newConversationId = response.headers.get('X-Conversation-ID') || conversationId || `conv_${Date.now()}`
      if (!conversationId) {
        setConversationId(newConversationId)
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

      // Reload conversations to show the updated list
      await loadConversations()

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
    setConversationId(null)
  }

  const startNewConversation = () => {
    clearChat()
    setShowConversations(false)
  }

  return (
    <div className="chat-interface">
      <div className="chat-container">
        <div className="chat-header">
          <h2>Chat with AI</h2>
          <div className="chat-actions">
            <button 
              className="conversations-btn"
              onClick={() => setShowConversations(!showConversations)}
              title="Conversations"
            >
              <RefreshCw size={20} />
            </button>
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

        {showConversations && (
          <div className="conversations-panel">
            <div className="conversations-header">
              <h3>Conversations</h3>
              <button 
                className="new-conversation-btn"
                onClick={startNewConversation}
              >
                New Chat
              </button>
            </div>
            <div className="conversations-list">
              {conversations.length === 0 ? (
                <p className="no-conversations">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <div key={conv.conversation_id} className="conversation-item">
                    <div 
                      className="conversation-content"
                      onClick={() => loadConversation(conv.conversation_id)}
                    >
                      <div className="conversation-preview">
                        {conv.system_message.substring(0, 50)}...
                      </div>
                      <div className="conversation-meta">
                        <span>{conv.message_count} messages</span>
                        <span>{new Date(conv.last_updated).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      className="delete-conversation-btn"
                      onClick={() => deleteConversation(conv.conversation_id)}
                      title="Delete conversation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

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
            {conversationId && (
              <div className="setting-group">
                <label>Current Conversation ID</label>
                <div className="conversation-id-display">
                  {conversationId}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={48} />
              <h3>Start a conversation</h3>
              <p>Enter your message below to begin chatting with the AI assistant.</p>
              {conversations.length > 0 && (
                <p className="conversation-hint">
                  💡 You have {conversations.length} previous conversation{conversations.length !== 1 ? 's' : ''}. 
                  Click the refresh button above to view them.
                </p>
              )}
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
          {conversationId && (
            <div className="conversation-info">
              <span>💬 Continuing conversation: {conversationId.substring(0, 8)}...</span>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default ChatInterface
