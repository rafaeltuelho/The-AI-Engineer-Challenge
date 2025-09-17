import React, { useState, useRef, useEffect } from 'react'
import { Send, Key, MessageSquare, User, Bot, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, ArrowDown, X, FileText, Upload } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
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
  sessionId: string
  selectedModel: string
  setSelectedModel: (model: string) => void
  modelDescriptions: Record<string, string>
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  apiKey, 
  setApiKey, 
  sessionId,
  selectedModel, 
  setSelectedModel, 
  modelDescriptions 
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [showConversationInfoBanner, setShowConversationInfoBanner] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    apiKey: true,
    model: false,
    systemMessage: false,
    conversations: false
  })
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([])
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null)
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState<string | null>(null)
  const [isPdfUploading, setIsPdfUploading] = useState(false)
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(true)
  const [isRagMode, setIsRagMode] = useState(false)
  const [showPdfBanner, setShowPdfBanner] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableModels = Object.keys(modelDescriptions)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const checkIfNearBottom = () => {
    if (!messagesContainerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    return scrollHeight - scrollTop - clientHeight < 50 // Reduced threshold for better UX
  }

  const handleScroll = () => {
    if (!messagesContainerRef.current) return
    
    const nearBottom = checkIfNearBottom()
    setIsUserScrolling(!nearBottom)
    setShouldAutoScroll(nearBottom)
  }

  useEffect(() => {
    if (shouldAutoScroll && messages.length > 0) {
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
  }, [messages, shouldAutoScroll])

  // Auto-scroll when new messages are added during streaming
  useEffect(() => {
    if (isLoading && shouldAutoScroll) {
      const interval = setInterval(() => {
        if (shouldAutoScroll) {
          scrollToBottom()
        }
      }, 100)
      
      return () => clearInterval(interval)
    }
  }, [isLoading, shouldAutoScroll])

  // Reset auto-scroll when starting a new conversation
  useEffect(() => {
    if (!conversationId) {
      setShouldAutoScroll(true)
      setIsUserScrolling(false)
    }
  }, [conversationId])

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [inputMessage])

  // Load conversations on component mount
  useEffect(() => {
    if (sessionId) {
      loadConversations()
    }
  }, [sessionId])

  // Reload conversations when conversationId changes (new conversation created)
  useEffect(() => {
    if (conversationId) {
      // Small delay to ensure backend has processed the conversation
      setTimeout(() => {
        loadConversations()
      }, 200)
    }
  }, [conversationId])

  // Show API key success banner when API key is entered
  useEffect(() => {
    if (apiKey.trim() && !showApiKeySuccess) {
      setShowApiKeySuccess(true)
    }
  }, [apiKey, showApiKeySuccess])

  const loadConversations = async () => {
    try {
      console.log('Loading conversations for session:', sessionId)
      const response = await fetch('/api/conversations', {
        headers: {
          'X-Session-ID': sessionId
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Conversations loaded:', data)
        setConversations(data || [])
      } else {
        console.error('Failed to load conversations:', response.status, response.statusText)
        setConversations([])
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
      setConversations([])
    }
  }

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        headers: {
          'X-Session-ID': sessionId
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Clear current messages and load the conversation history
        setMessages(data.messages.map((msg: any) => ({
          id: msg.timestamp,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        })))
        setConversationId(convId)
        setDeveloperMessage(data.system_message)
        
        // Check if this conversation has uploaded documents (RAG mode)
        // We'll need to check if there are any documents in the session
        // For now, we'll assume regular chat mode when loading conversations
        setIsRagMode(false)
      } else {
        console.error('Failed to load conversation:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  const deleteConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}`, {
        method: 'DELETE',
        headers: {
          'X-Session-ID': sessionId
        }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
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
    const currentMessage = inputMessage
    setInputMessage('')
    setIsLoading(true)

    try {
      // Use RAG mode if it's been set for this conversation
      const shouldUseRAG = isRagMode
      
      const response = await fetch(shouldUseRAG ? '/api/rag-query' : '/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          'X-API-Key': apiKey
        },
        body: JSON.stringify(shouldUseRAG ? {
          question: currentMessage,
          k: 5
        } : {
          conversation_id: conversationId,
          developer_message: developerMessage,
          user_message: currentMessage,
          model: selectedModel,
          api_key: apiKey
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      let assistantMessage = ''
      const assistantMessageId = (Date.now() + 1).toString()
      
      const assistantMessageObj: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessageObj])

      if (shouldUseRAG) {
        // Handle RAG response (JSON)
        const ragResult = await response.json()
        assistantMessage = ragResult.answer
        
        // Get conversation ID from response headers or create new one for RAG queries
        const newConversationId = response.headers.get('X-Conversation-ID') || conversationId || `conv_${Date.now()}`
        if (!conversationId) {
          setConversationId(newConversationId)
          // Show info banner when first conversation is created
          setShowConversationInfoBanner(true)
        }
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: assistantMessage }
              : msg
          )
        )
        
        // Reload conversations to show the updated list
        setTimeout(() => {
          loadConversations()
        }, 100)
      } else {
        // Handle regular chat response (streaming)
        // Get conversation ID from response headers or create new one
        const newConversationId = response.headers.get('X-Conversation-ID') || conversationId || `conv_${Date.now()}`
        if (!conversationId) {
          setConversationId(newConversationId)
          // Show info banner when first conversation is created
          setShowConversationInfoBanner(true)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

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
        setTimeout(() => {
          loadConversations()
        }, 100)
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
    setConversationId(null)
    setDeveloperMessage('You are a helpful AI assistant.')
    setShowConversationInfoBanner(false)
    setIsRagMode(false)
    setShowPdfBanner(false)
  }

  const startNewConversation = () => {
    clearChat()
    // Reload conversations to ensure the list is up to date
    setTimeout(() => {
      loadConversations()
    }, 100)
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const togglePanel = () => {
    setIsPanelCollapsed(!isPanelCollapsed)
  }

  const dismissInfoBanner = () => {
    setShowConversationInfoBanner(false)
  }


  const dismissApiKeyInfo = () => {
    setShowApiKeyInfo(false)
  }

  const dismissPdfBanner = () => {
    setShowPdfBanner(false)
  }


  const handlePdfUpload = async (file: File) => {
    if (!sessionId || !apiKey) {
      setPdfUploadError('Session ID and API key are required')
      return
    }

    if (file.type !== 'application/pdf') {
      setPdfUploadError('Please select a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setPdfUploadError('File size must be less than 10MB')
      return
    }

    setIsPdfUploading(true)
    setPdfUploadError(null)
    setPdfUploadSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'X-API-Key': apiKey
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const data = await response.json()
      
      const newDocument = {
        document_id: data.document_id,
        file_name: data.file_name,
        chunk_count: data.chunk_count,
        upload_time: new Date()
      }

      setUploadedDocuments(prev => [newDocument, ...prev])
      setPdfUploadSuccess(`PDF "${data.file_name}" uploaded and processed successfully! ${data.chunk_count} chunks created.`)
      
      // Set RAG mode for the current conversation
      setIsRagMode(true)
      
      // Show PDF banner
      setShowPdfBanner(true)
      
      // Clear success message after 5 seconds
      setTimeout(() => setPdfUploadSuccess(null), 5000)

    } catch (error) {
      console.error('Upload error:', error)
      setPdfUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsPdfUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handlePdfUpload(files[0])
    }
  }

  const renderMessageContent = (message: Message) => {
    if (message.role === 'assistant') {
      return <MarkdownRenderer content={message.content} />
    }
    return <div className="message-text">{message.content}</div>
  }

  return (
    <div className="chat-interface">
      <div className={`left-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-header">
          <h2>Chat settings</h2>
          <button 
            className="panel-toggle-btn"
            onClick={togglePanel}
            title={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isPanelCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        
        {!isPanelCollapsed && (
          <div className="panel-content">
            <div className="setting-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('apiKey')}
              >
                <div className="section-title">
                  <Key size={14} />
                  <span>API Key</span>
                </div>
                {expandedSections.apiKey ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.apiKey && (
                <div className="section-content">
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your OpenAI API key"
                    className="api-key-input"
                  />
                  {apiKey.trim() && showApiKeyInfo && (
                    <div className="api-key-info">
                      <div className="info-icon">ℹ️</div>
                      <div className="info-text">
                        Your API key is only used for this session and is not stored or persisted anywhere!
                      </div>
                      <button 
                        className="dismiss-info-btn"
                        onClick={dismissApiKeyInfo}
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="setting-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('model')}
              >
                <div className="section-title">
                  <Settings size={14} />
                  <span>Model</span>
                </div>
                {expandedSections.model ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.model && (
                <div className="section-content">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="model-select"
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model} - {modelDescriptions[model as keyof typeof modelDescriptions]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="setting-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('systemMessage')}
              >
                <div className="section-title">
                  <MessageSquare size={14} />
                  <span>System Message</span>
                </div>
                {expandedSections.systemMessage ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.systemMessage && (
                <div className="section-content">
                  <textarea
                    id="developer-message"
                    value={developerMessage}
                    onChange={(e) => setDeveloperMessage(e.target.value)}
                    placeholder="Define the AI's behavior and role"
                    className="developer-message-input"
                    rows={3}
                  />
                </div>
              )}
            </div>


            <div className="setting-section">
              <div 
                className="section-header"
                onClick={() => toggleSection('conversations')}
              >
                <div className="section-title">
                  <MessageSquare size={14} />
                  <span>Conversations</span>
                </div>
                {expandedSections.conversations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.conversations && (
                <div className="section-content">
                  {showConversationInfoBanner && (
                    <div className="conversation-info-banner">
                      <div className="info-icon">ℹ️</div>
                      <div className="info-content">
                        <div className="info-title">Session-based Conversations</div>
                        <div className="info-text">
                          Conversations are isolated by user-session, stored in-memory in the backend server-side and remain active for the duration of the current user-session interaction or up to 10min of inactivity.
                        </div>
                      </div>
                      <button 
                        className="dismiss-banner-btn"
                        onClick={dismissInfoBanner}
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
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
                              {conv.title || conv.system_message.substring(0, 30)}
                            </div>
                            <div className="conversation-meta">
                              <span>{conv.message_count} msgs</span>
                              <span>{new Date(conv.last_updated).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button 
                            className="delete-conversation-btn"
                            onClick={() => deleteConversation(conv.conversation_id)}
                            title="Delete conversation"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {conversationId && (
                    <div className="conversation-id-section">
                      <div className="conversation-id-label">Current ID</div>
                      <div className="conversation-id-display">
                        {conversationId.substring(0, 12)}...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="chat-container">
        <div className="chat-header">
          <h2>Chat with AI</h2>
          <button 
            className="new-chat-btn"
            onClick={startNewConversation}
            disabled={!apiKey.trim()}
            title={apiKey.trim() ? "New Chat" : "Enter API key to start chatting"}
          >
            <MessageSquare size={16} />
            New Chat
          </button>
        </div>

        {!apiKey.trim() && (
          <div className="api-key-warning">
            <Key size={16} />
            Please enter your OpenAI API key in settings to start chatting
          </div>
        )}



        <div 
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="empty-state">
              <Bot size={48} />
              <h3>Start a conversation</h3>
              <p>Enter your message below to begin chatting with the AI assistant.</p>
              {uploadedDocuments.length > 0 && showPdfBanner && (
                <div className="pdf-info-banner">
                  <FileText size={16} />
                  <div className="pdf-info-content">
                    <div className="pdf-info-title">PDF Documents Ready</div>
                    <div className="pdf-info-text">
                      You have {uploadedDocuments.length} PDF document{uploadedDocuments.length !== 1 ? 's' : ''} uploaded. 
                      You can now ask questions about your documents directly in the chat - the AI will use information from your uploaded PDFs to answer your questions.
                    </div>
                  </div>
                  <button 
                    className="dismiss-pdf-banner-btn"
                    onClick={dismissPdfBanner}
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {conversations.length > 0 && (
                <p className="conversation-hint">
                  💡 You have {conversations.length} previous conversation{conversations.length !== 1 ? 's' : ''}. 
                  Open the Conversations section in the left panel to view them.
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
                  {renderMessageContent(message)}
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

        {isUserScrolling && messages.length > 0 && (
          <button 
            className="scroll-to-bottom-btn"
            onClick={() => {
              setShouldAutoScroll(true)
              scrollToBottom()
            }}
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
            New messages
          </button>
        )}

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <button
              type="button"
              className="pdf-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !apiKey.trim() || isPdfUploading}
              title="Upload PDF"
            >
              <Upload size={20} />
            </button>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... (Cmd|Ctrl+Enter to send)"
              className="message-input"
              disabled={isLoading || !apiKey.trim()}
              rows={2}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || !inputMessage.trim() || !apiKey.trim()}
            >
              <Send size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isPdfUploading}
            />
          </div>
          {conversationId && (
            <div className="conversation-info">
              <span>💬 Continuing conversation: {conversationId.substring(0, 8)}...</span>
            </div>
          )}
          
          {pdfUploadError && (
            <div className="upload-message error">
              <X size={16} />
              <span>{pdfUploadError}</span>
              <button onClick={() => setPdfUploadError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {pdfUploadSuccess && (
            <div className="upload-message success">
              <FileText size={16} />
              <span>{pdfUploadSuccess}</span>
              <button onClick={() => setPdfUploadSuccess(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {isPdfUploading && (
            <div className="upload-message uploading">
              <div className="loading-spinner" />
              <span>Processing PDF...</span>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default ChatInterface
