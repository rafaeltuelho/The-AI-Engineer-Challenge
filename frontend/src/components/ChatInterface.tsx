import React, { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare, User, Bot, Trash2, Settings, ArrowDown, X, FileText, Upload, Compass, Image, Plus, Search, BookOpen, Brain, Volume2, Square, Mic, MicOff } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import SuggestedQuestions from './SuggestedQuestions'
import SettingsModal from './SettingsModal'
import { extractSuggestedQuestions, type ExtractedContent } from '../utils/suggestedQuestionsExtractor'
import { formatBackendError } from '../utils/errorFormatter'
import './ChatInterface.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  extractedContent?: ExtractedContent
  suggestedQuestions?: string[]  // Store suggested questions per message for Topic Explorer
  thinking?: string  // Thinking content from <!--THINKING--> blocks
  image?: {
    dataUrl: string
    mimeType: string
    filename?: string
  }
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
  onToggleSidebar?: () => void
  settingsModalOpen: boolean
  setSettingsModalOpen: (open: boolean) => void
  isWhitelisted: boolean
  freeTurnsRemaining: number
  authType: 'guest' | 'google'
  onFreeTurnsUpdate: (turns: number) => void
  hasFreeTurns: boolean
  hasOwnApiKey: boolean
  welcomeSuggestions?: string[]
  maxImageSizeMB: number
  setStudyLearnOverride: (override: boolean) => void
  ttsVoice: string
  setTtsVoice: (voice: string) => void
}

// Parse thinking blocks from streamed content
const parseThinkingBlocks = (content: string): { thinking: string; response: string } => {
  const thinkingRegex = /<!--THINKING-->([\s\S]*?)<!--\/THINKING-->/g
  let thinking = ''
  let response = content

  // Handle complete thinking blocks (both open + close tags present)
  const matches = content.matchAll(thinkingRegex)
  for (const match of matches) {
    thinking += match[1].trim() + '\n\n'
    response = response.replace(match[0], '')
  }

  // Handle partial/incomplete thinking block during streaming
  // (open tag present but close tag hasn't arrived yet)
  const partialMatch = response.match(/<!--THINKING-->([\s\S]*)$/)
  if (partialMatch) {
    thinking += partialMatch[1]
    response = response.replace(partialMatch[0], '')
  }

  return {
    thinking: thinking.trim(),
    response: response.trim()
  }
}

// Collapsible thinking block component
const ThinkingBlock: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div
      className={`thinking-block ${expanded ? 'expanded' : 'collapsed'}`}
      onClick={() => setExpanded(e => !e)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="thinking-header">
        <Brain size={14} />
        <span>Thinking</span>
        <span className="thinking-toggle-hint">{expanded ? '▲ collapse' : '▼ expand'}</span>
      </div>
      <div className="thinking-content">
        <MarkdownRenderer content={content} chatMode="regular" />
        {!expanded && <div className="thinking-fade" />}
      </div>
    </div>
  )
}

// Default developer messages for each chat mode (pure function, extracted outside component)
const getDefaultDeveloperMessage = (mode: 'regular' | 'rag' | 'topic-explorer'): string => {
  switch (mode) {
    case 'regular':
      return `You are a brilliant study companion who makes learning irresistible. Your secret: you adapt to the student's curiosity.

**How you respond:**
- Start SHORT and punchy. Don't overwhelm. Give the core idea in 2-3 sentences max.
- Connect EVERYTHING to real-world examples — show how concepts live in everyday life, technology, nature, sports, games, or current events.
- Drop curiosity hooks — end with a fascinating "did you know?" or a mind-bending connection that makes them WANT to ask more.
- As the student asks follow-ups, progressively go deeper. Match their energy and curiosity level.
- If they're really engaged (asking great questions, going deeper), unlock more advanced insights and connections.

**Your style:**
- Warm but not over-the-top. Like a cool older sibling who happens to know everything.
- Use analogies that click — compare abstract concepts to things students actually experience.
- Celebrate genuine curiosity, not just correct answers.
- If a concept connects to another subject (math → music, history → science), mention it briefly to spark cross-disciplinary thinking.

**Formatting rules:**
- Keep initial responses concise (under 150 words unless the topic demands more)
- Use emoji sparingly but effectively to highlight key points
- For math: use LaTeX notation with $$...$$ for block equations and $...$ for inline
- Do not explain LaTeX syntax — just show the math formatted
- If showing money with $ sign, escape it as \\$ to avoid LaTeX confusion
- Use ![description](url) format for images

At the end of every response, include "### Suggested Questions" with exactly 3 follow-up questions. Make them progressively more intriguing — the third one should be the most mind-blowing connection or deeper dive.
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
  onToggleSidebar,
  settingsModalOpen,
  setSettingsModalOpen,
  isWhitelisted,
  freeTurnsRemaining,
  authType: _authType,  // Received but not used in this component
  onFreeTurnsUpdate,
  hasFreeTurns,
  hasOwnApiKey,
  welcomeSuggestions = [],
  maxImageSizeMB,
  setStudyLearnOverride,
  ttsVoice,
  setTtsVoice
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [developerMessage, setDeveloperMessage] = useState(getDefaultDeveloperMessage('regular'))
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null)

  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null)
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState<string | null>(null)
  const [isPdfUploading, setIsPdfUploading] = useState(false)
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)
  const [chatMode, setChatMode] = useState<'regular' | 'rag' | 'topic-explorer'>('regular')
  const [_lastSuggestedQuestions, setLastSuggestedQuestions] = useState<string[]>([])
  const [hasConversationStarted, setHasConversationStarted] = useState(false)
  const [documentSuggestedQuestions, setDocumentSuggestedQuestions] = useState<string[]>([])
  const [documentSummary, setDocumentSummary] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Image attachment state
  const [attachedImage, setAttachedImage] = useState<{ file: File; dataUrl: string } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(true)
  const [studyLearnEnabled, setStudyLearnEnabled] = useState(true)
  const [topicExplorerEnabled, setTopicExplorerEnabled] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(false)
  const [thinkingEffort, setThinkingEffort] = useState<'medium' | 'high'>('medium')

  // TTS state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [loadingTtsId, setLoadingTtsId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioBlobUrlRef = useRef<string | null>(null)
  const ttsAbortControllerRef = useRef<AbortController | null>(null)

  // Dictate state
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingStreamRef = useRef<MediaStream | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const autoThinkingTriggered = useRef(false)
  const autoMiniTriggered = useRef(false)       // new
  const autoFullTriggered = useRef(false)       // new
  const slLastSetModel = useRef<string>('')     // tracks what SL system last set


  // Filter available models based on chat mode and provider
  // const getAvailableModels = () => {
  //   const openaiModels = [
  //     'gpt-5', 'gpt-5-mini', 'gpt-5-nano'
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
  //       return ['gpt-5']
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
      messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
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

  // Auto-focus textarea on load.
  //
  // iOS Safari blocks programmatic focus() calls that don't originate from
  // a synchronous user-gesture handler (touchstart/touchend/click). Both the
  // `autoFocus` HTML attribute and any setTimeout-based focus() call are
  // silently ignored — this is intentional Apple policy to prevent pages from
  // forcibly showing the virtual keyboard.
  //
  // Strategy:
  //   1. On non-iOS browsers (desktop, Android Chrome): focus immediately.
  //   2. On iOS Safari: attach a one-shot `touchstart` listener on the document.
  //      The first time the user touches *anything* on the page, focus() is
  //      called synchronously inside that gesture handler, which iOS Safari
  //      permits. This mirrors the behaviour of Gmail, Slack, and ChatGPT on iOS.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Detect iOS Safari. The canonical check is the presence of a touch-capable
    // Safari that is NOT Android (Android Chrome also sets MaxTouchPoints > 0).
    const isIOS =
      /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))

    if (!isIOS) {
      // Non-iOS: plain programmatic focus works fine.
      const timer = setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true })
      }, 100)
      return () => clearTimeout(timer)
    }

    // iOS Safari: defer focus to the first user touch anywhere on the page.
    const focusOnFirstTouch = () => {
      textareaRef.current?.focus()
      document.removeEventListener('touchstart', focusOnFirstTouch)
    }
    document.addEventListener('touchstart', focusOnFirstTouch, { passive: true })
    return () => document.removeEventListener('touchstart', focusOnFirstTouch)
  }, [])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false)
      }
    }

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContextMenu])

  // Derive chatMode from toggles (for backward compatibility)
  useEffect(() => {
    if (topicExplorerEnabled) {
      setChatMode('topic-explorer')
      setDeveloperMessage(getDefaultDeveloperMessage('topic-explorer'))
    } else if (documentSummary) {
      // If document is uploaded, use RAG mode
      setChatMode('rag')
      setDeveloperMessage(getDefaultDeveloperMessage('rag'))
    } else {
      setChatMode('regular')
      // Use student prompt when Study & Learn is enabled, generic prompt otherwise
      if (studyLearnEnabled) {
        setDeveloperMessage(getDefaultDeveloperMessage('regular'))
      } else {
        setDeveloperMessage(
          'You are a helpful, knowledgeable AI assistant. You provide clear, accurate, and well-structured answers. You can help with research, analysis, writing, coding, math, science, and general questions. When appropriate, use markdown formatting for better readability. If you\'re unsure about something, say so honestly.'
        )
      }
    }
  }, [topicExplorerEnabled, documentSummary, studyLearnEnabled])

  // Auto-switch to gpt-5-nano when Study & Learn is enabled, then upgrade progressively
  useEffect(() => {
    if (studyLearnEnabled) {
      slLastSetModel.current = 'gpt-5-nano'
      setSelectedModel('gpt-5-nano')
      setSelectedProvider('openai')
      setStudyLearnOverride(true)
      // Reset progression refs when re-enabling
      autoThinkingTriggered.current = false
      autoMiniTriggered.current = false
      autoFullTriggered.current = false
      // Also reset thinking — Study & Learn starts with thinking off (it auto-enables at turn 3)
      setThinkingEnabled(false)
      setThinkingEffort('medium')
    } else {
      setStudyLearnOverride(false)
    }
  }, [studyLearnEnabled, setSelectedModel, setSelectedProvider]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Model rank for one-directional upgrades (never downgrade)
  const MODEL_RANK: Record<string, number> = { 'gpt-5-nano': 0, 'gpt-5-mini': 1, 'gpt-5': 2 }

  // Progressive model upgrades for Study & Learn
  useEffect(() => {
    if (!studyLearnEnabled) return

    const userMessageCount = messages.filter(m => m.role === 'user').length
    const currentRank = MODEL_RANK[selectedModel] ?? 0

    // Turn 3+: upgrade to gpt-5-mini (only if current model is lower ranked)
    if (userMessageCount >= 3 && !autoMiniTriggered.current) {
      if (currentRank < MODEL_RANK['gpt-5-mini']) {
        setSelectedModel('gpt-5-mini')
      }
      if (!autoThinkingTriggered.current) {
        setThinkingEnabled(true)
        setThinkingEffort('high')
        autoThinkingTriggered.current = true
      }
      autoMiniTriggered.current = true
    }

    // Turn 5+: upgrade to gpt-5 (only if current model is lower ranked)
    if (userMessageCount >= 5 && !autoFullTriggered.current) {
      if (currentRank < MODEL_RANK['gpt-5']) {
        setSelectedModel('gpt-5')
      }
      autoFullTriggered.current = true
    }
  }, [messages, studyLearnEnabled, selectedModel, setSelectedModel])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current)
        audioBlobUrlRef.current = null
      }
    }
  }, [])

  // Cleanup dictate on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      recordingStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

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
    // Prevent loading if already active or currently loading
    if (conversationId === convId || loadingConversationId === convId) {
      return
    }

    // Set loading state
    setLoadingConversationId(convId)

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
            timestamp: new Date(msg.timestamp),
            // Preserve image data if present in backend message
            // Backend returns image_attachment, map it to local image shape
            ...(msg.image_attachment ? {
              image: {
                dataUrl: msg.image_attachment.data_url,
                mimeType: msg.image_attachment.mime_type,
                filename: msg.image_attachment.filename
              }
            } : {})
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

          // Process regular chat assistant messages - extract suggested questions from text
          if (conversationMode === 'regular' && msg.role === 'assistant') {
            const extracted = extractSuggestedQuestions(msg.content)
            if (extracted.hasSuggestedQuestions) {
              return {
                ...baseMessage,
                content: extracted.mainContent,
                suggestedQuestions: extracted.suggestedQuestions
              }
            }
          }

          return baseMessage
        })

        setMessages(processedMessages)
        setConversationId(convId)
        setDeveloperMessage(data.system_message)

        // Set lastSuggestedQuestions for backwards compatibility (from the last assistant message)
        if (conversationMode === 'topic-explorer' || conversationMode === 'regular') {
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

        // Close sidebar on mobile when conversation is selected
        if (isMobile && onToggleSidebar && sidebarOpen) {
          onToggleSidebar()
        }
      } else {
        console.error('Failed to load conversation:', response.statusText)
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      // Clear loading state
      setLoadingConversationId(null)
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputMessage(value)

    // Detect slash command at the start of input
    if (value === '/' && !showContextMenu) {
      setShowContextMenu(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleReadAloud = async (message: Message) => {
    // Toggle off if already playing this message
    if (playingMessageId === message.id) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlayingMessageId(null)
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current)
        audioBlobUrlRef.current = null
      }
      return
    }

    // Abort any in-flight TTS request to prevent race conditions
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort()
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current)
      audioBlobUrlRef.current = null
    }

    // Strip markdown from content for TTS
    let plainText = message.content
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
      .replace(/\*([^*]+)\*/g, '$1')      // Remove italic *text*
      .replace(/_([^_]+)_/g, '$1')        // Remove italic _text_
      .replace(/#{1,6}\s+/g, '')          // Remove headings #
      .replace(/`([^`]+)`/g, '$1')        // Remove inline code `code`
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links [text](url) -> text
      .trim()

    setLoadingTtsId(message.id)

    // Create new AbortController for this request
    const abortController = new AbortController()
    ttsAbortControllerRef.current = abortController

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify({
          text: plainText,
          voice: ttsVoice
        }),
        signal: abortController.signal
      })

      // Check if this request was aborted or superseded
      if (loadingTtsId !== message.id) {
        return
      }

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`)
      }

      const blob = await response.blob()

      // Check again after async operation
      if (loadingTtsId !== message.id) {
        return
      }

      const url = URL.createObjectURL(blob)
      audioBlobUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setPlayingMessageId(null)
        if (audioBlobUrlRef.current) {
          URL.revokeObjectURL(audioBlobUrlRef.current)
          audioBlobUrlRef.current = null
        }
      }

      audio.onerror = () => {
        setPlayingMessageId(null)
        if (audioBlobUrlRef.current) {
          URL.revokeObjectURL(audioBlobUrlRef.current)
          audioBlobUrlRef.current = null
        }
        console.error('Audio playback error')
      }

      // Set loading state cleared, wait for play to succeed before showing "playing"
      setLoadingTtsId(null)

      try {
        await audio.play()
        setPlayingMessageId(message.id)  // Only set AFTER play succeeds
      } catch (playError) {
        // Clean up if play failed — reset state and revoke URL
        setPlayingMessageId(null)
        if (audioBlobUrlRef.current) {
          URL.revokeObjectURL(audioBlobUrlRef.current)
          audioBlobUrlRef.current = null
        }
        console.error('Audio playback failed:', playError)
      }

    } catch (error) {
      // Ignore aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('TTS error:', error)
      setLoadingTtsId(null)
      // Could show error message to user here if needed
    }
  }

  const handleDictate = async () => {
    // If currently recording, stop
    if (isRecording) {
      // Set isTranscribing immediately to prevent race condition
      setIsTranscribing(true)
      setIsRecording(false)

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      recordingStreamRef.current?.getTracks().forEach(t => t.stop())
      return
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream

      // Determine MIME type
      let mimeType = ''
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recordingChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        // isTranscribing is already set to true when stop() was called
        try {
          const audioBlob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const ext = recorder.mimeType?.includes('mp4') ? 'mp4' : 'webm'
          const formData = new FormData()
          formData.append('audio', audioBlob, `recording.${ext}`)

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: {
              'X-Session-ID': sessionId,
              ...(apiKey ? { 'X-API-Key': apiKey } : {})
            },
            body: formData,
          })

          if (!response.ok) throw new Error('Transcription failed')

          const data = await response.json()
          if (data.text) {
            setInputMessage(prev => prev ? `${prev} ${data.text}` : data.text)
          }
        } catch (err) {
          console.error('Transcription error:', err)
          setImageError('Transcription failed. Please try again.')
          setTimeout(() => setImageError(null), 3000)
        } finally {
          setIsTranscribing(false)
          recordingChunksRef.current = []
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Microphone access error:', error)
      setImageError('Microphone access denied. Please allow microphone access.')
      setTimeout(() => setImageError(null), 3000)
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
      timestamp: new Date(),
      ...(attachedImage ? {
        image: {
          dataUrl: attachedImage.dataUrl,
          mimeType: attachedImage.file.type,
          filename: attachedImage.file.name
        }
      } : {})
    }

    setMessages(prev => [...prev, userMessage])
    const currentMessage = messageToSubmit
    const currentImage = attachedImage
    setInputMessage('')
    setAttachedImage(null) // Clear attached image after capturing it
    setImageError(null)
    setIsLoading(true)

    // Mark that conversation has started after first user message
    if (!hasConversationStarted) {
      setHasConversationStarted(true)
    }

    try {
      // Determine which endpoint to use based on chat mode
      const isRagMode = chatMode === 'rag' || chatMode === 'topic-explorer'
      const endpoint = isRagMode ? '/api/rag-query' : '/api/chat'

      // Build request body
      const requestBody = isRagMode ? {
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
        api_key: apiKey || undefined,
        provider: selectedProvider,
        // Include image_attachment only for OpenAI GPT models in regular chat mode
        ...(currentImage && selectedProvider === 'openai' && chatMode === 'regular' ? {
          image_attachment: {
            mime_type: currentImage.file.type,
            data_url: currentImage.dataUrl,
            filename: currentImage.file.name
          }
        } : {}),
        // New optional fields for ChatGPT-style features (backend will ignore for now)
        web_search: webSearchEnabled,
        ...(thinkingEnabled ? {
          reasoning: { effort: thinkingEffort, summary: "auto" }
        } : {}),
        ...(webSearchEnabled ? {
          include: ['web_search_call.action.sources']
        } : {})
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          ...(isRagMode && conversationId ? { 'X-Conversation-ID': conversationId } : {})
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        // Try to parse a user-friendly error message from the backend
        let errorDetail = `HTTP error! status: ${response.status}`
        try {
          const errorData = await response.json()
          console.error('Backend error response:', errorData) // Log full error for debugging
          if (errorData.detail) {
            // Use formatter to convert structured errors to human-friendly messages
            errorDetail = formatBackendError(errorData.detail)
          }
        } catch {
          // If JSON parsing fails, use the default HTTP status message
        }
        throw new Error(errorDetail)
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

          // Parse thinking blocks if thinking is enabled
          const { thinking, response: cleanedContent } = thinkingEnabled
            ? parseThinkingBlocks(assistantMessage)
            : { thinking: '', response: assistantMessage }

          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: cleanedContent, thinking: thinking || undefined }
                : msg
            )
          )
        }

        // Parse thinking blocks one final time
        const { thinking: finalThinking, response: finalContent } = thinkingEnabled
          ? parseThinkingBlocks(assistantMessage)
          : { thinking: '', response: assistantMessage }

        // Extract suggested questions from the streamed response
        const extracted = extractSuggestedQuestions(finalContent)
        let regularSuggestedQuestions: string[] = []
        if (extracted.hasSuggestedQuestions) {
          assistantMessage = extracted.mainContent
          regularSuggestedQuestions = extracted.suggestedQuestions
        } else {
          assistantMessage = finalContent
        }

        // Update message with cleaned content, thinking, and suggested questions
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: assistantMessage,
                  thinking: finalThinking || undefined,
                  suggestedQuestions: regularSuggestedQuestions
                }
              : msg
          )
        )

        // Update lastSuggestedQuestions state
        setLastSuggestedQuestions(regularSuggestedQuestions)

        // Reload conversations to show the updated list
        setTimeout(() => {
          loadConversations()
        }, 100)
      }

    } catch (error) {
      console.error('Error:', error)
      const friendlyMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, there was an error processing your request.\n\n${friendlyMessage}`,
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
    autoThinkingTriggered.current = false
    autoMiniTriggered.current = false
    autoFullTriggered.current = false
    slLastSetModel.current = ''
    setThinkingEffort('medium')

    // Reset model and thinking when Study & Learn is enabled
    if (studyLearnEnabled) {
      setSelectedModel('gpt-5-nano')
      setThinkingEnabled(false)
    }
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
    if (!sessionId) {
      setPdfUploadError('Session is required')
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
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
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

  // Image attachment handlers
  const handleImageSelect = async (file: File) => {
    setImageError(null)

    // Validate file type
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!supportedTypes.includes(file.type)) {
      setImageError('Please select a PNG, JPEG, WEBP, or GIF image')
      return
    }

    // Validate file size
    const maxSizeBytes = maxImageSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setImageError(`Image size must be less than ${maxImageSizeMB} MB`)
      return
    }

    // Convert to data URL
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setAttachedImage({ file, dataUrl })
    }
    reader.onerror = () => {
      setImageError('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleImageSelect(files[0])
    }
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingImage(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))

    if (imageFile) {
      handleImageSelect(imageFile)
    } else {
      setImageError('Please drop an image file')
    }
  }

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingImage(true)
  }

  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingImage(false)
  }

  const removeAttachedImage = () => {
    setAttachedImage(null)
    setImageError(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Handle clipboard paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    // Only handle paste for OpenAI in regular chat mode
    if (selectedProvider !== 'openai' || chatMode !== 'regular') return

    const items = e.clipboardData?.items
    if (!items) return

    // Look for image items in clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault() // Prevent default paste behavior for images
        const file = item.getAsFile()
        if (file) {
          handleImageSelect(file)
        }
        break
      }
    }
  }

  const renderMessageContent = (message: Message) => {
    if (message.role === 'assistant') {
      return <MarkdownRenderer content={message.content} chatMode={chatMode} />
    }

    // For user messages, render text and optional image
    return (
      <>
        {message.image && (
          <div className="message-image">
            <img
              src={message.image.dataUrl}
              alt={message.image.filename || 'Uploaded image'}
              loading="lazy"
            />
            {message.image.filename && (
              <span className="message-image-filename">{message.image.filename}</span>
            )}
          </div>
        )}
        {message.content && <div className="message-text">{message.content}</div>}
      </>
    )
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
        ttsVoice={ttsVoice}
        setTtsVoice={setTtsVoice}
        sessionId={sessionId}
      />

      {/* Backdrop for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => onToggleSidebar && onToggleSidebar()}
        />
      )}

      {/* Sidebar - Chat History Only */}
      <div className={`left-panel ${!sidebarOpen ? 'collapsed' : ''}`}>
        {sidebarOpen && (
          <>
            {/* New Chat Button */}
            <button
              className="new-chat-btn sidebar-new-chat"
              onClick={startNewConversation}
              disabled={!isWhitelisted && !hasOwnApiKey && !hasFreeTurns}
              title={isWhitelisted || hasOwnApiKey || hasFreeTurns ? "Start a new conversation" : "Enter API key to start chatting"}
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
                  const isLoading = loadingConversationId === conv.conversation_id
                  const modeLabel = conv.mode === 'rag' ? '📄' : conv.mode === 'topic-explorer' ? '📚' : '💬'

                  return (
                    <div
                      key={conv.conversation_id}
                      className={`conversation-item ${isActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
                      onClick={() => loadConversation(conv.conversation_id)}
                      style={{ cursor: isLoading ? 'wait' : 'pointer' }}
                    >
                      <span className="conversation-mode-icon">{modeLabel}</span>
                      <div className="conversation-title">
                        {conv.title || conv.system_message.substring(0, 30)}
                      </div>
                      {isLoading && (
                        <div className="conversation-loading-indicator">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      )}
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
              disabled={!isWhitelisted && !hasOwnApiKey && !hasFreeTurns}
              title={isWhitelisted || hasOwnApiKey || hasFreeTurns ? "New Chat" : "Enter API key to start chatting"}
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
          {/* Show loading indicator when loading a conversation */}
          {loadingConversationId && messages.length === 0 && (
            <div className="conversation-loading-screen">
              <div className="loading-message">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>Loading conversation...</p>
              </div>
            </div>
          )}

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

          {!loadingConversationId && messages.length === 0 ? (
            <div className="welcome-screen">
              <h1 className="welcome-heading">What can I help with?</h1>

              {welcomeSuggestions && welcomeSuggestions.length > 0 ? (
                <div className="suggestion-chips">
                  {welcomeSuggestions.slice(0, 3).map((suggestion, index) => (
                    <button key={index} className="suggestion-chip" onClick={() => handleSuggestedQuestionClick(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="suggestion-chips loading">
                  {[1,2,3].map(i => (
                    <div key={i} className="suggestion-chip skeleton" />
                  ))}
                </div>
              )}
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

                    {/* Thinking block - collapsible with preview */}
                    {message.role === 'assistant' && message.thinking && (
                      <ThinkingBlock content={message.thinking} />
                    )}

                    <div className="message-content">
                      {message.role === 'assistant' && !message.content && isLoading ? (
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      ) : renderMessageContent(message)}
                    </div>

                    {/* Read Aloud button for assistant messages */}
                    {message.role === 'assistant' &&
                     message.content &&
                     !isLoading &&
                     (hasOwnApiKey || isWhitelisted) && (
                      <div className="message-actions">
                        <button
                          className={`read-aloud-btn ${playingMessageId === message.id ? 'playing' : ''}`}
                          onClick={() => handleReadAloud(message)}
                          disabled={loadingTtsId === message.id}
                          title={playingMessageId === message.id ? 'Stop' : 'Read aloud'}
                          aria-label={playingMessageId === message.id ? 'Stop reading' : 'Read aloud'}
                        >
                          {loadingTtsId === message.id ? (
                            <div className="tts-spinner" />
                          ) : playingMessageId === message.id ? (
                            <Square size={14} />
                          ) : (
                            <Volume2 size={14} />
                          )}
                        </button>
                      </div>
                    )}

                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString()}
                    </div>

                    {/* Show suggested questions after assistant messages (Topic Explorer and regular Chat) */}
                    {message.role === 'assistant' &&
                     (chatMode === 'topic-explorer' || chatMode === 'regular') &&
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
          {isLoading && !messages.some(m => m.role === 'assistant' && !m.content) && (
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
          {/* Image preview stays ABOVE the box */}
          {attachedImage && (
            <div className="image-preview-container">
              <div className="image-preview">
                <img src={attachedImage.dataUrl} alt="Attached" />
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={removeAttachedImage}
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
              <span className="image-filename">{attachedImage.file.name}</span>
            </div>
          )}

          <div
            className={`input-container ${isDraggingImage ? 'dragging-image' : ''}`}
            onDrop={handleImageDrop}
            onDragOver={handleImageDragOver}
            onDragLeave={handleImageDragLeave}
          >
            {/* TOP ROW: just the textarea */}
            <textarea
              ref={textareaRef}
              autoFocus
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                !isWhitelisted && !hasOwnApiKey && !hasFreeTurns
                  ? "Free messages exhausted. Add your API key in Settings to continue."
                  : isDraggingImage
                  ? "Drop image here..."
                  : "Message AI..."
              }
              className="message-input"
              disabled={isLoading || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
              rows={1}
            />

            {/* BOTTOM ROW: controls bar */}
            <div className="input-controls-row">
              {/* Left: context menu [+] */}
              <div className="context-menu-wrapper" ref={contextMenuRef}>
                <button
                  type="button"
                  className="context-menu-button"
                  onClick={() => setShowContextMenu(!showContextMenu)}
                  disabled={isLoading || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
                  title="Add context (or type /)"
                >
                  <Plus size={20} />
                </button>

                {/* Context menu popover */}
                {showContextMenu && (
                  <div className="context-menu-popover">
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        imageInputRef.current?.click()
                        setShowContextMenu(false)
                      }}
                      disabled={selectedProvider !== 'openai' || chatMode !== 'regular' || !!attachedImage}
                    >
                      <Image size={16} />
                      <span>Attach Image</span>
                    </button>
                    <button
                      type="button"
                      className={`context-menu-item${documentSummary ? ' toggle active' : ''}`}
                      onClick={() => {
                        fileInputRef.current?.click()
                        setShowContextMenu(false)
                      }}
                      disabled={isPdfUploading}
                      title={documentSummary ? "Document loaded — RAG mode active. Upload another to replace." : "Attach a document to enable RAG mode"}
                    >
                      <Upload size={16} />
                      <span>Attach Document</span>
                      {documentSummary && <span className="checkmark">✓</span>}
                    </button>
                    <div className="context-menu-divider" />
                    <button
                      type="button"
                      className={`context-menu-item toggle ${webSearchEnabled ? 'active' : ''}`}
                      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    >
                      <Search size={16} />
                      <span>Web Search</span>
                      {webSearchEnabled && <span className="checkmark">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`context-menu-item toggle ${studyLearnEnabled ? 'active' : ''}`}
                      onClick={() => setStudyLearnEnabled(!studyLearnEnabled)}
                    >
                      <BookOpen size={16} />
                      <span>Study & Learn</span>
                      {studyLearnEnabled && <span className="checkmark">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`context-menu-item toggle ${topicExplorerEnabled ? 'active' : ''}`}
                      onClick={() => setTopicExplorerEnabled(!topicExplorerEnabled)}
                      disabled={hasConversationStarted}
                      title={hasConversationStarted ? "Topic Explorer can only be enabled at the start of a new conversation" : "Enable Topic Explorer for interactive document learning"}
                    >
                      <Compass size={16} />
                      <span>Topic Explorer</span>
                      {topicExplorerEnabled && <span className="checkmark">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`context-menu-item toggle ${thinkingEnabled ? 'active' : ''}`}
                      onClick={() => {
                        setThinkingEnabled(!thinkingEnabled)
                        if (thinkingEnabled) {
                          setThinkingEffort('medium')
                        }
                      }}
                    >
                      <Brain size={16} />
                      <span>Thinking</span>
                      {thinkingEnabled && <span className="checkmark">✓</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* Active feature chips - now inline in the controls row */}
              {webSearchEnabled && (
                <button
                  type="button"
                  className="input-chip active"
                  onClick={() => setWebSearchEnabled(false)}
                >
                  <Search size={13} />
                  <span>Web Search</span>
                  <X size={11} />
                </button>
              )}
              {studyLearnEnabled && (
                <button
                  type="button"
                  className="input-chip active"
                  onClick={() => setStudyLearnEnabled(false)}
                >
                  <BookOpen size={13} />
                  <span>Study & Learn</span>
                  <X size={11} />
                </button>
              )}
              {topicExplorerEnabled && (
                <button
                  type="button"
                  className="input-chip active"
                  onClick={() => setTopicExplorerEnabled(false)}
                >
                  <Compass size={13} />
                  <span>Topic Explorer</span>
                  <X size={11} />
                </button>
              )}
              {thinkingEnabled && (
                <button
                  type="button"
                  className="input-chip active"
                  onClick={() => {
                    setThinkingEnabled(false)
                    setThinkingEffort('medium')
                  }}
                >
                  <Brain size={13} />
                  <span>Thinking{thinkingEffort === 'high' ? ' (high)' : ''}</span>
                  <X size={11} />
                </button>
              )}
              {chatMode === 'rag' && (
                <div className="input-chip active rag-chip">
                  <Upload size={13} />
                  <span>RAG Mode</span>
                </div>
              )}

              {/* Spacer pushes right-side buttons to the end */}
              <div style={{ flex: 1 }} />

              {/* Right: mic + send */}
              {(hasOwnApiKey || isWhitelisted) && (
                <button
                  type="button"
                  className={`dictate-btn ${isRecording ? 'recording' : ''}`}
                  onClick={handleDictate}
                  disabled={isLoading || isTranscribing || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
                  title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Dictate'}
                  aria-label={isRecording ? 'Stop dictation' : 'Start dictation'}
                >
                  {isTranscribing ? (
                    <div className="dictate-spinner" />
                  ) : isRecording ? (
                    <MicOff size={16} />
                  ) : (
                    <Mic size={16} />
                  )}
                </button>
              )}
              <button
                type="submit"
                className="send-button"
                disabled={isLoading || !inputMessage.trim() || (!isWhitelisted && !hasOwnApiKey && !hasFreeTurns)}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Hidden file inputs - keep as-is */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isPdfUploading}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              onChange={handleImageInputChange}
              style={{ display: 'none' }}
            />
          </div>
          <div className="input-disclaimer">
            AI can make mistakes. Consider checking important info.
          </div>

          {imageError && (
            <div className="upload-message error">
              <X size={16} />
              <span>{imageError}</span>
              <button onClick={() => setImageError(null)}>
                <X size={14} />
              </button>
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
