import React, { useState, useRef, useEffect } from 'react'
import { Send, Key, MessageSquare, User, Bot, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, ArrowDown, X, FileText, Upload, Database, MessageCircle, BookOpen } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import SuggestedQuestions from './SuggestedQuestions'
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
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  apiKey, 
  setApiKey, 
  sessionId,
  selectedModel, 
  setSelectedModel, 
  selectedProvider,
  setSelectedProvider,
  modelDescriptions 
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant.')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [showConversationInfoBanner, setShowConversationInfoBanner] = useState(() => {
    // Check if user has previously dismissed the banner
    return localStorage.getItem('conversationInfoBannerDismissed') !== 'true'
  })
  const [expandedSections, setExpandedSections] = useState({
    apiKey: true,
    provider: false,
    model: false,
    systemMessage: false,
    conversations: false
  })
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null)
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState<string | null>(null)
  const [isPdfUploading, setIsPdfUploading] = useState(false)
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(true)
  const [chatMode, setChatMode] = useState<'regular' | 'rag' | 'topic-explorer'>('regular')
  const [lastSuggestedQuestions, setLastSuggestedQuestions] = useState<string[]>([])
  const [hasConversationStarted, setHasConversationStarted] = useState(false)
  const [documentSuggestedQuestions, setDocumentSuggestedQuestions] = useState<string[]>([])
  const [documentSummary, setDocumentSummary] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartXRef = useRef<number | null>(null)
  const dragStartWidthRef = useRef<number | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = localStorage.getItem('chat_sidebar_width')
    const parsed = stored ? parseInt(stored, 10) : 280
    return isNaN(parsed) ? 280 : parsed
  })
  const [isResizing, setIsResizing] = useState<boolean>(false)

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
  const getAvailableModels = () => {
    const openaiModels = [
      'gpt-4', 'gpt-4-mini', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
      'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'
    ]
    
    const togetherModels = [
      'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3.1', 'deepseek-ai/DeepSeek-V3',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'moonshotai/Kimi-K2-Instruct-0905',
      'Qwen/Qwen3-Next-80B-A3B-Thinking'
    ]
    
    // Filter by provider first
    let availableModels = selectedProvider === 'together' ? togetherModels : openaiModels
    
    if (chatMode === 'topic-explorer') {
      // Only allow specific models for Topic Explorer mode
      if (selectedProvider === 'together') {
        return ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1','meta-llama/Llama-3.3-70B-Instruct-Turbo']
      } else {
        return ['gpt-4.1', 'gpt-4o', 'gpt-5']
      }
    }
    
    return availableModels
  }
  
  const availableModels = getAvailableModels()
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

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem('chat_sidebar_width', String(sidebarWidth))
  }, [sidebarWidth])

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
    if (!messageToSubmit.trim() || !apiKey.trim()) return

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
    setShowConversationInfoBanner(false)
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
    // Store dismissal in localStorage so it doesn't show again
    localStorage.setItem('conversationInfoBannerDismissed', 'true')
  }


  const dismissApiKeyInfo = () => {
    setShowApiKeyInfo(false)
  }

  const handleSuggestedQuestionClick = (question: string) => {
    // Don't clear Topic Explorer suggested questions - keep them visible in chat panel
    
    // In Topic Explorer mode, automatically submit the question
    if (chatMode === 'topic-explorer') {
      // Set the input message and immediately submit with the question directly
      setInputMessage(question)
      handleSubmit({ preventDefault: () => {} } as React.FormEvent, question)
    } else {
      // In other modes, set the message and focus the textarea for manual submission
      setInputMessage(question)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }

  const handleDocumentSuggestedQuestionClick = (question: string) => {
    // Don't clear document suggested questions - keep them visible in chat panel
    
    // Auto-submit the question (same behavior as Topic Explorer)
    setInputMessage(question)
    handleSubmit({ preventDefault: () => {} } as React.FormEvent, question)
  }

  // Resizer Handlers
  const MIN_WIDTH = 180
  const MAX_WIDTH = 600

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return
    if (dragStartXRef.current === null || dragStartWidthRef.current === null) return

    const delta = e.clientX - dragStartXRef.current
    let newWidth = dragStartWidthRef.current + delta
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH
    if (isPanelCollapsed) {
      setIsPanelCollapsed(false)
    }
    setSidebarWidth(newWidth)
  }

  const handleMouseUp = () => {
    if (!isResizing) return
    setIsResizing(false)
    dragStartXRef.current = null
    dragStartWidthRef.current = null
    window.removeEventListener('mousemove', handleMouseMove as any)
    window.removeEventListener('mouseup', handleMouseUp as any)
  }

  const handleResizerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = isPanelCollapsed ? 280 : sidebarWidth
    setIsResizing(true)
    window.addEventListener('mousemove', handleMouseMove as any)
    window.addEventListener('mouseup', handleMouseUp as any)
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
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
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
    return <div className="message-text">{message.content}</div>
  }

  return (
    <div className="chat-interface" ref={containerRef}>
      <div className={`left-panel ${isPanelCollapsed ? 'collapsed' : ''}`} style={!isPanelCollapsed ? { width: `${sidebarWidth}px` } : undefined}>
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
                onClick={() => toggleSection('provider')}
              >
                <div className="section-title">
                  <Settings size={14} />
                  <span>Provider</span>
                </div>
                {expandedSections.provider ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.provider && (
                <div className="section-content">
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="provider-select"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="together">Together.ai</option>
                  </select>
                  <div className="provider-info">
                    {selectedProvider === 'openai' ? (
                      <span>Using OpenAI's GPT models</span>
                    ) : (
                      <span>Using Together.ai's open-source models</span>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                    placeholder={`${selectedProvider === 'together' ? 'Together.ai key: tgp_' : 'OpenAI key: sk-'} ...`}
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
                        <div key={conv.conversation_id} className={`conversation-item ${conv.mode === 'rag' ? 'rag-mode' : conv.mode === 'topic-explorer' ? 'topic-explorer-mode' : 'regular-mode'}`}>
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

      <div
        className={`panel-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizerMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        title="Drag to resize"
      />

      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-header-left">
            <h2>Chat with AI</h2>
            <div className="mode-badges">
              <button
                className={`mode-badge ${chatMode === 'regular' ? 'active regular-mode' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                onClick={() => {
                  if (!hasConversationStarted) {
                    setChatMode('regular')
                    setDeveloperMessage(getDefaultDeveloperMessage('regular'))
                    setLastSuggestedQuestions([])
                  }
                }}
                title={hasConversationStarted ? "Cannot switch mode after conversation starts. Start a new chat to change mode." : "AI Chat Mode - General conversation"}
                data-mode="regular"
                disabled={hasConversationStarted}
              >
                <MessageCircle size={14} />
                <span>AI Chat</span>
              </button>
              <button
                className={`mode-badge ${chatMode === 'rag' ? 'active rag-mode' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                onClick={() => {
                  if (!hasConversationStarted) {
                    setChatMode('rag')
                    setDeveloperMessage(getDefaultDeveloperMessage('rag'))
                    setLastSuggestedQuestions([])
                  }
                }}
                title={hasConversationStarted ? "Cannot switch mode after conversation starts. Start a new chat to change mode." : "RAG Mode - Query uploaded documents"}
                data-mode="rag"
                disabled={hasConversationStarted}
              >
                <Database size={14} />
                <span>RAG</span>
              </button>
              <button
                className={`mode-badge ${chatMode === 'topic-explorer' ? 'active topic-explorer-mode' : ''} ${hasConversationStarted ? 'disabled' : ''}`}
                onClick={() => {
                  if (!hasConversationStarted) {
                    setChatMode('topic-explorer')
                    setDeveloperMessage(getDefaultDeveloperMessage('topic-explorer'))
                    setLastSuggestedQuestions([])
                    // Set appropriate default model for Topic Explorer mode based on provider
                    if (selectedProvider === 'together') {
                      setSelectedModel('deepseek-ai/DeepSeek-V3')
                    } else {
                      setSelectedModel('gpt-4.1')
                    }
                  }
                }}
                title={hasConversationStarted ? "Cannot switch mode after conversation starts. Start a new chat to change mode." : "Topic Explorer - Guided learning with structured responses"}
                data-mode="topic-explorer"
                disabled={hasConversationStarted}
              >
                <BookOpen size={14} />
                <span>Topic Explorer</span>
              </button>
            </div>
          </div>
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
            Please enter your {selectedProvider === 'together' ? 'Together.ai' : 'OpenAI'} API key in settings to start chatting
          </div>
        )}



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
            <div className="empty-state">
              {/*uploadedDocuments.length > 0 && showPdfBanner && (
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
              ) */}
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
              title="Upload Document (PDF, Word, PowerPoint)"
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
              accept=".pdf,.docx,.doc,.pptx,.ppt"
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
