import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatInterface from './ChatInterface'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Send: () => <div>Send</div>,
  MessageSquare: () => <div>MessageSquare</div>,
  User: () => <div>User</div>,
  Bot: () => <div>Bot</div>,
  Trash2: () => <div>Trash2</div>,
  Settings: () => <div>Settings</div>,
  ArrowDown: () => <div>ArrowDown</div>,
  X: () => <div>X</div>,
  FileText: () => <div>FileText</div>,
  Upload: () => <div>Upload</div>,
  Compass: () => <div>Compass</div>,
  Image: () => <div>Image</div>,
  Plus: () => <div>Plus</div>,
  Search: () => <div>Search</div>,
  BookOpen: () => <div>BookOpen</div>,
  Brain: () => <div>Brain</div>,
  Volume2: () => <div>Volume2</div>,
  Square: () => <div>Square</div>,
  Mic: () => <div>Mic</div>,
  MicOff: () => <div>MicOff</div>,
}))

// Mock MarkdownRenderer
vi.mock('./MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}))

// Mock SuggestedQuestions
vi.mock('./SuggestedQuestions', () => ({
  default: () => <div>SuggestedQuestions</div>,
}))

// Mock SettingsModal
vi.mock('./SettingsModal', () => ({
  default: () => <div>SettingsModal</div>,
}))

class MockAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  constructor(public src?: string) {}
}

describe('ChatInterface - TTS summarized notice and error surfacing', () => {
  const originalFetch = global.fetch
  const originalAudio = global.Audio
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  const defaultProps = {
    apiKey: 'test-key',
    setApiKey: vi.fn(),
    sessionId: 'test-session',
    selectedModel: 'gpt-5-mini',
    setSelectedModel: vi.fn(),
    selectedProvider: 'openai',
    setSelectedProvider: vi.fn(),
    modelDescriptions: {},
    sidebarOpen: false,
    settingsModalOpen: false,
    setSettingsModalOpen: vi.fn(),
    isWhitelisted: true,
    freeTurnsRemaining: 10,
    authType: 'guest' as const,
    onFreeTurnsUpdate: vi.fn(),
    hasFreeTurns: true,
    hasOwnApiKey: true,
    welcomeSuggestions: [],
    maxImageSizeMB: 3,
    setStudyLearnOverride: vi.fn(),
    ttsVoice: 'marin',
    setTtsVoice: vi.fn(),
  }

  // Sends a message and waits for the assistant response so the
  // "Read aloud" button becomes available for that message.
  const sendMessageAndGetReadAloudButton = async () => {
    render(<ChatInterface {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello there' } })
    const form = textarea.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument()
    })

    return screen.getByTitle('Read aloud')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.Audio = MockAudio as unknown as typeof Audio
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.Audio = originalAudio
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  const mockChatAndConversationsFetch = (ttsHandler: (url: string) => Promise<Response>) => {
    global.fetch = vi.fn((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }
      if (url === '/api/tts') {
        return ttsHandler(url as string)
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({
          'X-Conversation-ID': 'test-conv-123',
          'X-Free-Turns-Remaining': '9',
        }),
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Test response') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as any)
    })
  }

  it('shows a summarized notice when the TTS response includes the X-TTS-Summarized header', async () => {
    mockChatAndConversationsFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ 'X-TTS-Summarized': 'true' }),
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
      } as unknown as Response)
    )

    const readAloudButton = await sendMessageAndGetReadAloudButton()
    fireEvent.click(readAloudButton)

    await waitFor(() => {
      expect(screen.getByText(/Playing a summarized version/i)).toBeInTheDocument()
    })
  })

  it('shows no notice when the X-TTS-Summarized header is absent', async () => {
    mockChatAndConversationsFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers(),
        blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
      } as unknown as Response)
    )

    const readAloudButton = await sendMessageAndGetReadAloudButton()
    fireEvent.click(readAloudButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tts', expect.any(Object))
    })

    expect(screen.queryByText(/Playing a summarized version/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Couldn't play audio/i)).not.toBeInTheDocument()
  })

  it('shows an error notice when the TTS fetch fails, instead of failing silently', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockChatAndConversationsFetch(() => Promise.reject(new Error('network down')))

    const readAloudButton = await sendMessageAndGetReadAloudButton()
    fireEvent.click(readAloudButton)

    await waitFor(() => {
      expect(screen.getByText(/Couldn't play audio for this message/i)).toBeInTheDocument()
    })

    consoleErrorSpy.mockRestore()
  })
})
