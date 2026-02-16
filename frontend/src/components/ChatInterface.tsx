import React, { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, User, Bot, Trash2, Settings, ArrowDown, X, FileText, Upload, Compass } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import SuggestedQuestions from './SuggestedQuestions'
import SettingsModal from './SettingsModal'
import type { ExtractedContent } from '../utils/suggestedQuestionsExtractor'
import './ChatInterface.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  extractedContent?: ExtractedContent
  suggestedQuestions?: string[]  // Store suggested questions per message for Topic Explorer
}

interface ChatInterfaceProps {
  apiKey: string
  setApiKey: (key: string) => void
  sessionId: string
  selectedModel: string
  setSelectedModel: (model: string) => void
  selectedProvider: string
  setSelectedProvider: (provider: string) => void
  modelDescriptions: Record<string, string>
  sidebarOpen: boolean
  settingsModalOpen: boolean
  setSettingsModalOpen: (open: boolean) => void
  isWhitelisted: boolean
  freeTurnsRemaining: number
  authType: 'guest' | 'google'
  onFreeTurnsUpdate: (turns: number) => void
  hasFreeTurns: boolean
  hasOwnApiKey: boolean
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  apiKey,
  setApiKey,
  sessionId,
  selectedModel,
  setSelectedModel,
  selectedProvider,
  setSelectedProvider,
  modelDescriptions,
  sidebarOpen,
  settingsModalOpen,
  setSettingsModalOpen,
  isWhitelisted,
  freeTurnsRemaining,
  authType: _authType,  // Received but not used in this component
  onFreeTurnsUpdate,
  hasFreeTurns,
  hasOwnApiKey
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])

  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null)
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState<string | null>(null)
  const [isPdfUploading, setIsPdfUploading] = useState(false)
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)
  const [chatMode, setChatMode] = useState<'regular' | 'rag' | 'topic-explorer'>('regular')
  const [_lastSuggestedQuestions, setLastSuggestedQuestions] = useState<string[]>([])
  const [hasConversationStarted, setHasConversationStarted] = useState(false)
  const [documentSuggestedQuestions, setDocumentSuggestedQuestions] = useState<string[]>([])
  const [documentSummary, setDocumentSummary] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Default developer messages for each chat mode
  const getDefaultDeveloperMessage = (mode: 'regular' | 'rag' | 'topic-explorer'): string => {
    switch (mode) {
      case 'regular':
        return `You are a helpful AI assistant.
If the topic involves math, always write equations or expressions in LaTeX notation, enclosed in double dollar signs ($$...$$) for block equations or single dollar signs ($...$) for inline expressions.
Do not explain LaTeX syntax to the user, only show the math properly formatted. If your response contains any sentence with money representation using the dollar currency sign followed by a number (money value), make sure you escape it with '\\$' to not confuse with an inline LaTeX math notation.
Aways enrich the markdown response with emoji markups and engaging words to make the content more apealing for young students.
If you need to show a picture, use the ![description](url) format.
        `
      case 'rag':
        return `You are a helpful assistant that answers questions based on provided context. If the context doesn\'t contain enough information to answer the question, please say so.
If the topic involves math, always write equations or expressions in LaTeX notation, enclosed in double dollar signs ($$...$$) for block equations or single dollar signs ($...$) for inline expressions.
Do not explain LaTeX syntax to the user, only show the math properly formatted. If your response contains any sentence with money representation using the dollar currency sign followed by a number (money value), make sure you escape it with '\\$' to not confuse with an inline LaTeX math notation.
Aways enrich the markdown response with emoji markups and engaging words to make the content more apealing for young students.
If you need to show a picture, use the ![description](url) format.`
      case 'topic-explorer':
        return `You are an educational study companion for middle school students learning Math, Science, or US History. 
Your role is to help students understand topics from their class materials in a clear, friendly, and encouraging way. 
Always explain ideas at the level of an elementary or middle school student, avoiding overly complex words. 
If the topic involves math, always write equations or expressions in LaTeX notation, enclosed in double dollar signs ($$...$$) for block equations or single dollar signs ($...$) for inline expressions.
Do not explain LaTeX syntax to the student, only show the math properly formatted. If your response contains any sentence with money representation using the dollar currency sign followed by a number (money value), make sure you escape it with '\\$' to not confuse with an inline LaTeX math notation.

When answering a question, always follow this structure:
1. ### Explanation: 
  simple, clear explanation based on the provided context, using age-appropriate language.
2. ### Real-Life Example: 
  show how the idea connects to something in the student's everyday life.
3. ### Practice Activity: 
  create a short, fun challenge (problem to solve, small writing task, or drawing prompt) that helps the student practice.

Do not give long essays at first. Be concise, supportive, and engaging, like a tutor who makes learning fun. As the student start to interact by asking more questions, you can start to give more detailed and engaging answers.
Additionally, at the end of your response, propose 2-4 short follow-up questions the student could ask next to keep learning. Always offer to solve the proposed 'Practice Activity' in step-by-step approach as one of these suggestions. Label this section 'Suggested Questions'.

Aways enrich the markdown response with emoji markups and engaging words to make the content more apealing for young students.

Always format your output in a strict JSON object with only two keys:
- "answer": containing the Explanation, Real-Life Example and Practice Activity as the answer contetn body.
- "suggested_questions": a list of 2-3 short follow-up questions.

Sample JSON output:
{
  "answer": "...",
  "suggested_questions": ["...", "...", "..."]
}`
      default:
        return 'You are a helpful AI assistant.'
    }
  }

  // Filter available models based on chat mode and provider
  // const getAvailableModels = () => {
  //   const openaiModels = [
  //     'gpt-4', 'gpt-4-mini', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
  //     'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'
  //   ]
  //
  //   const togetherModels = [
  //     'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3.1', 'deepseek-ai/DeepSeek-V3',
  //     'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  //     'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'moonshotai/Kimi-K2-Instruct-0905',
  //     'Qwen/Qwen3-Next-80B-A3B-Thinking'
  //   ]
  //
  //   // Filter by provider first
  //   let availableModels = selectedProvider === 'together' ? togetherModels : openaiModels
  //
  //   if (chatMode === 'topic-explorer') {
  //     // Only allow specific models for Topic Explorer mode
  //     if (selectedProvider === 'together') {
  //       return ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1','meta-llama/Llama-3.3-70B-Instruct-Turbo']
  //     } else {
  //       return ['gpt-4.1', 'gpt-4o', 'gpt-5']
  //     }
  //   }
  //
  //   return availableModels
  // }
  
  // const availableModels = getAvailableModels()
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

  // Helper function to process Topic Explorer JSON responses
  const processTopicExplorerMessage = (content: string) => {
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') {
        const answer = parsed?.answer
        const suggested = parsed?.suggested_questions

        // Handle both formats: single string or object with sections
        let formattedMarkdown = ''
        if (typeof answer === 'string') {
          // Single string format - remove "Suggested Questions" section to avoid duplication
          formattedMarkdown = answer.replace(/\n\nSuggested Questions?:?\s*\n.*$/s, '')
        } else if (typeof answer === 'object' && answer !== null) {
          // Object format with separate sections
          const explanation = answer.Explanation || answer.explanation || ''
          const example = answer['Real-Life Example'] || answer.real_life_example || answer.realLifeExample || ''
          const practice = answer['Practice Activity'] || answer.practice_activity || answer.practiceActivity || ''

          formattedMarkdown = [
            explanation ? `### Explanation\n\n${explanation}` : '',
            example ? `### Real-Life Example\n\n${example}` : '',
            practice ? `### Practice Activity\n\n${practice}` : ''
          ].filter(Boolean).join('\n\n')
        }

        return {
          content: formattedMarkdown || content,
          suggestedQuestions: Array.isArray(suggested) ? suggested.filter((s: unknown) => typeof s === 'string') as string[] : []
        }
      }
    } catch (e) {
      // If parsing fails, return original content
    }
    return { content, suggestedQuestions: [] }
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
        
        // Set the conversation mode based on the response
        const conversationMode = data.mode || "regular"
        setChatMode(conversationMode as 'regular' | 'rag' | 'topic-explorer')
        
        // Process messages based on conversation mode
        const processedMessages = data.messages.map((msg: any) => {
          const baseMessage = {
            id: msg.timestamp,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp)
          }

          // Process Topic Explorer assistant messages - include suggested questions per message
          if (conversationMode === 'topic-explorer' && msg.role === 'assistant') {
            const processed = processTopicExplorerMessage(msg.content)
            return {
              ...baseMessage,
              content: processed.content,
              suggestedQuestions: processed.suggestedQuestions
            }
          }

          return baseMessage
        })

        setMessages(processedMessages)
        setConversationId(convId)
        setDeveloperMessage(data.system_message)

        // Set lastSuggestedQuestions for backwards compatibility (from the last assistant message)
        if (conversationMode === 'topic-explorer') {
          const lastAssistantMessage = processedMessages
            .filter((msg: any) => msg.role === 'assistant')
            .pop()
          if (lastAssistantMessage?.suggestedQuestions) {
            setLastSuggestedQuestions(lastAssistantMessage.suggestedQuestions)
          } else {
            setLastSuggestedQuestions([])
          }
        } else {
          setLastSuggestedQuestions([])
        }
        
        setHasConversationStarted(true) // Mark conversation as started when loading existing conversation
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

  const handleSubmit = async (e: React.FormEvent, messageContent?: string) => {
    e.preventDefault()
    const messageToSubmit = messageContent || inputMessage

    // Guard: check if user can send messages
    const canSendMessage = isWhitelisted || hasOwnApiKey || hasFreeTurns
    if (!messageToSubmit.trim() || !canSendMessage) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSubmit,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentMessage = messageToSubmit
    setInputMessage('')
    setIsLoading(true)
    
    // Mark that conversation has started after first user message
    if (!hasConversationStarted) {
      setHasConversationStarted(true)
    }

    try {
      // Determine which endpoint to use based on chat mode
      const isRagMode = chatMode === 'rag' || chatMode === 'topic-explorer'
      const endpoint = isRagMode ? '/api/rag-query' : '/api/chat'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          'X-API-Key': apiKey,
          ...(isRagMode && conversationId ? { 'X-Conversation-ID': conversationId } : {})
        },
        body: JSON.stringify(isRagMode ? {
          question: currentMessage,
          developer_message: developerMessage,
          k: 3,
          model: selectedModel,
          mode: chatMode,
          provider: selectedProvider
        } : {
          conversation_id: conversationId,
          developer_message: developerMessage,
          user_message: currentMessage,
          model: selectedModel,
          api_key: apiKey,
          provider: selectedProvider
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

      if (isRagMode) {
        // Handle RAG response (JSON)
        const ragResult = await response.json()
        assistantMessage = ragResult.answer

        // Get conversation ID from response headers or use existing one for RAG queries
        const newConversationId = response.headers.get('X-Conversation-ID') || conversationId
        if (!conversationId && newConversationId) {
          setConversationId(newConversationId)
        }

        // Update free turns remaining from response header
        const freeTurnsHeader = response.headers.get('X-Free-Turns-Remaining')
        if (freeTurnsHeader !== null) {
          const turns = parseInt(freeTurnsHeader, 10)
          if (!isNaN(turns)) {
            onFreeTurnsUpdate(turns)
          }
        }
        
        // Topic Explorer: parse JSON structure and render sections
        let extractedContent: ExtractedContent | undefined
        let messageSuggestedQuestions: string[] = []

        if (chatMode === 'topic-explorer') {
          try {
            // Ensure we have a string to parse
            let parsed: any
            if (typeof assistantMessage === 'string') {
              // Try to parse as JSON
              try {
                parsed = JSON.parse(assistantMessage)
              } catch (parseError) {
                // If it's not valid JSON, replace with user-friendly message
                console.warn('Response is not valid JSON, replacing with error message:', parseError)
                assistantMessage = 'I apologize, but I encountered an issue formatting my response. Please try asking your question again.'
                parsed = null
              }
            } else {
              // Already an object
              parsed = assistantMessage
            }

            if (parsed && typeof parsed === 'object') {
              const answer = parsed?.answer
              const suggested = parsed?.suggested_questions

              // Handle both formats: single string or object with sections
              let formattedMarkdown = ''
              if (typeof answer === 'string') {
                // Single string format - remove "Suggested Questions" section to avoid duplication
                formattedMarkdown = answer.replace(/\n\nSuggested Questions?:?\s*\n.*$/s, '')
              } else if (typeof answer === 'object' && answer !== null) {
                // Object format with separate sections
                const explanation = answer.Explanation || answer.explanation || ''
                const example = answer['Real-Life Example'] || answer.real_life_example || answer.realLifeExample || ''
                const practice = answer['Practice Activity'] || answer.practice_activity || answer.practiceActivity || ''

                formattedMarkdown = [
                  explanation ? `### Explanation\n\n${explanation}` : '',
                  example ? `### Real-Life Example\n\n${example}` : '',
                  practice ? `### Practice Activity\n\n${practice}` : ''
                ].filter(Boolean).join('\n\n')
              }

              assistantMessage = formattedMarkdown || assistantMessage
              if (Array.isArray(suggested)) {
                messageSuggestedQuestions = suggested.filter((s: unknown) => typeof s === 'string') as string[]
              }
            } else {
              // If parsed is null or not an object, ensure we don't have raw JSON
              const trimmedContent = assistantMessage.trim()
              if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
                console.warn('Detected raw JSON content in Topic Explorer, replacing with error message')
                assistantMessage = 'I apologize, but I encountered an issue formatting my response. Please try asking your question again.'
              }
            }
          } catch (e) {
            // Fallback: if all parsing fails, show a user-friendly message instead of raw JSON
            console.warn('Failed to parse Topic Explorer response:', e)
            assistantMessage = 'I apologize, but I encountered an issue formatting my response. Please try asking your question again.'
          }
        }

        // Update lastSuggestedQuestions state (for backwards compatibility)
        setLastSuggestedQuestions(messageSuggestedQuestions)

        // Store suggested questions in the message object for per-message display
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: assistantMessage, extractedContent, suggestedQuestions: messageSuggestedQuestions }
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
        }

        // Update free turns remaining from response header
        const freeTurnsHeader = response.headers.get('X-Free-Turns-Remaining')
        if (freeTurnsHeader !== null) {
          const turns = parseInt(freeTurnsHeader, 10)
          if (!isNaN(turns)) {
            onFreeTurnsUpdate(turns)
          }
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

        // Clear suggested questions for regular chat mode
        setLastSuggestedQuestions([])

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
        content: 'Sorry, there was an error processing your request.\n\nError: ' + error,
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
    setDeveloperMessage(getDefaultDeveloperMessage('regular'))
    setChatMode('regular')
    setLastSuggestedQuestions([])
    setHasConversationStarted(false)
    setDocumentSuggestedQuestions([])
    setDocumentSummary(null)
  }

  const startNewConversation = () => {
    clearChat()
    // Reload conversations to ensure the list is up to date
    setTimeout(() => {
      loadConversations()
    }, 100)
  }

  const handleSuggestedQuestionClick = (question: string) => {
    setInputMessage(question)
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, question)
  }

  const handleDocumentSuggestedQuestionClick = (question: string) => {
    // Don't clear document suggested questions - keep them visible in chat panel
    
    // Auto-submit the question (same behavior as Topic Explorer)
    setInputMessage(question)
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, question)
  }

  const handlePdfUpload = async (file: File) => {
    if (!sessionId || !apiKey) {
      setPdfUploadError('Session ID and API key are required')
      return
    }

    // Check file type - support PDF, Word, and PowerPoint
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/msword', // .doc
      'application/vnd.ms-powerpoint' // .ppt
    ]
    
    if (!supportedTypes.includes(file.type)) {
      setPdfUploadError('Please select a PDF, Word, or PowerPoint file')
      return
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      setPdfUploadError('File size must be less than 20MB')
      return
    }

    setIsPdfUploading(true)
    setPdfUploadError(null)
    setPdfUploadSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'X-API-Key': apiKey,
          'X-Provider': selectedProvider
        },
        body: formData
      })

      if (!response.ok) {
        // Try to parse error as JSON, fall back to text if not valid JSON
        let errorMessage = 'Upload failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || 'Upload failed'
        } catch {
          // Response is not JSON (e.g., plain "Internal Server Error")
          const errorText = await response.text().catch(() => '')
          errorMessage = errorText || `HTTP error ${response.status}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      setPdfUploadSuccess(`${data.file_type.toUpperCase()} document "${data.file_name}" uploaded and processed successfully! ${data.chunk_count} chunks created.`)
      
      // Store document suggested questions and summary
      if (data.suggested_questions && data.suggested_questions.length > 0) {
        setDocumentSuggestedQuestions(data.suggested_questions)
      }
      if (data.summary) {
        setDocumentSummary(data.summary)
      }
      
      // Only switch to RAG mode if currently in regular mode
      // Preserve RAG or Topic Explorer mode if already selected
      if (chatMode === 'regular') {
        setChatMode('rag')
        setDeveloperMessage(getDefaultDeveloperMessage('rag'))
      }
      
      // Clear success message after 10 seconds
      setTimeout(() => setPdfUploadSuccess(null), 10000)

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
      return <MarkdownRenderer content={message.content} chatMode={chatMode} />
    }
    return <>{message.content}</>
  }

  return (
    <div className="chat-interface" ref={containerRef}>
      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        developerMessage={developerMessage}
        setDeveloperMessage={setDeveloperMessage}
        modelDescriptions={modelDescriptions}
        isWhitelisted={isWhitelisted}
        freeTurnsRemaining={freeTurnsRemaining}
        hasFreeTurns={hasFreeTurns}
      />

      {/* Sidebar - Chat History Only */}
      <div className={`left-panel ${!sidebarOpen ? 'collapsed' : ''}`}>
        {sidebarOpen && (
          <>
            {/* New Chat Button */}
            <button
              className="new-chat-btn sidebar-new-chat"
              onClick={startNewConversation}
              disabled={!apiKey.trim()}
              title={apiKey.trim() ? "Start a new conversation" : "Enter API key to start chatting"}
            >
              <MessageSquare size={16} />
              New Chat
            </button>

            {/* Conversation History List */}
            <div className="conversations-list">
              {conversations.length === 0 ? (
                <p className="no-conversations">No conversations yet</p>
              ) : (
                conversations.map((conv) => {
                  const isActive = conversationId === conv.conversation_id
                  const modeLabel = conv.mode === 'rag' ? '📄' : conv.mode === 'topic-explorer' ? '📚' : '💬'

                  return (
                    <div
                      key={conv.conversation_id}
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() => loadConversation(conv.conversation_id)}
                    >
                      <span className="conversation-mode-icon">{modeLabel}</span>
                      <div className="conversation-title">
                        {conv.title || conv.system_message.substring(0, 30)}
                      </div>
                      <button
                        className="delete-conversation-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(conv.conversation_id)
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Settings Button at Bottom */}
            <div className="sidebar-footer">
              <button
                className="sidebar-settings-btn"
                onClick={() => setSettingsModalOpen(true)}
                title="Open settings"
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-left">
            <h2>Chat with AI</h2>
          </div>
          <div className="chat-header-buttons">
            <button
              className="settings-btn"
              onClick={() => setSettingsModalOpen(true)}
              title="Open settings"
            >
              <Settings size={16} />
            </button>
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
        </div>

        <div
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {/* Show document summary and suggested questions when available - always visible */}
          {documentSummary && documentSuggestedQuestions.length > 0 && (
            <div className="document-summary-section">
              <h3>📄 Document Summary</h3>
              <p className="document-summary-text">{documentSummary}</p>
              <div className="document-suggested-questions">
                <SuggestedQuestions
                  questions={documentSuggestedQuestions}
                  onQuestionClick={handleDocumentSuggestedQuestionClick}
                  isVisible={true}
                />
              </div>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <h1 className="welcome-heading">What can I help with?</h1>

              <div className="mode-cards">
                <button
                  className={`mode-card ${chatMode === 'regular' ? 'active' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                  onClick={() => { if (!hasConversationStarted) { setChatMode('regular'); setDeveloperMessage(getDefaultDeveloperMessage('regular')); }}}
                  disabled={hasConversationStarted}
                >
                  <MessageSquare size={24} />
                  <div className="mode-card-title">AI Chat</div>
                  <div className="mode-card-desc">General conversation</div>
                </button>
                <button
                  className={`mode-card ${chatMode === 'rag' ? 'active' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                  onClick={() => { if (!hasConversationStarted) { setChatMode('rag'); setDeveloperMessage(getDefaultDeveloperMessage('rag')); }}}
                  disabled={hasConversationStarted}
                >
                  <FileText size={24} />
                  <div className="mode-card-title">RAG Mode</div>
                  <div className="mode-card-desc">Chat with documents</div>
                </button>
                <button
                  className={`mode-card ${chatMode === 'topic-explorer' ? 'active' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                  onClick={() => { if (!hasConversationStarted) { setChatMode('topic-explorer'); setDeveloperMessage(getDefaultDeveloperMessage('topic-explorer')); }}}
                  disabled={hasConversationStarted}
                >
                  <Compass size={24} />
                  <div className="mode-card-title">Topic Explorer</div>
                  <div className="mode-card-desc">Deep dive into topics</div>
                </button>
              </div>

              <div className="suggestion-chips">
                <button className="suggestion-chip" onClick={() => handleSuggestedQuestionClick("Explain quantum computing in simple terms")}>
                  Explain quantum computing
                </button>
                <button className="suggestion-chip" onClick={() => handleSuggestedQuestionClick("Write a creative short story about time travel")}>
                  Write a short story
                </button>
                <button className="suggestion-chip" onClick={() => handleSuggestedQuestionClick("What are the best practices for REST API design?")}>
                  REST API best practices
                </button>
                <button className="suggestion-chip" onClick={() => handleSuggestedQuestionClick("Help me debug a React useEffect issue")}>
                  Debug React useEffect
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`message-row ${message.role}`}>
                <div className="message-row-inner">
                  <div className="message-avatar">
                    {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className="message-body">
                    <div className="message-role-label">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="message-content">
                      {renderMessageContent(message)}
                    </div>
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString()}
                    </div>

                    {/* Show Topic Explorer suggested questions after assistant messages */}
                    {message.role === 'assistant' &&
                     chatMode === 'topic-explorer' &&
                     message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                      <div className="topic-explorer-suggested-questions">
                        <SuggestedQuestions
                          questions={message.suggestedQuestions}
                          onQuestionClick={handleSuggestedQuestionClick}
                          isVisible={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message-row assistant">
              <div className="message-row-inner">
                <div className="message-avatar">
                  <Bot size={20} />
                </div>
                <div className="message-body">
                  <div className="message-role-label">Assistant</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
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

        {/* Free tier banner */}
        {!isWhitelisted && hasFreeTurns && !hasOwnApiKey && (
          <div className="free-tier-banner">
            Free mode: {freeTurnsRemaining} message{freeTurnsRemaining === 1 ? '' : 's'} remaining · Using {selectedModel}
          </div>
        )}

        {/* Exhausted banner */}
        {!isWhitelisted && !hasFreeTurns && !hasOwnApiKey && (
          <div className="exhausted-banner">
            You've used all your free messages! Configure your API Key in Settings to continue.
          </div>
        )}

        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-container">
            <button
              type="button"
              className="pdf-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns) || isPdfUploading}
              title="Upload Document (PDF, Word, PowerPoint)"
            >
              <Upload size={20} />
            </button>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isWhitelisted && !hasOwnApiKey && !hasFreeTurns
                  ? "Free messages exhausted. Add your API key in Settings to continue."
                  : "Type your message here... (Cmd|Ctrl+Enter to send)"
              }
              className="message-input"
              disabled={isLoading || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
              rows={1}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || !inputMessage.trim() || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
            >
              <Send size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isPdfUploading}
            />
          </div>
          <div className="input-disclaimer">
            AI can make mistakes. Consider checking important info.
          </div>

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
