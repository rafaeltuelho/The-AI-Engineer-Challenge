import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('ChatInterface - Image Attachment', () => {
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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch to return empty conversations
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    )
  })

  it('shows image attachment button for OpenAI in regular chat mode', () => {
    render(<ChatInterface {...defaultProps} />)
    
    const imageButton = screen.getByTitle('Attach Image (PNG, JPEG, WEBP, GIF)')
    expect(imageButton).toBeInTheDocument()
  })

  it('hides image attachment button for Together.ai provider', () => {
    render(<ChatInterface {...defaultProps} selectedProvider="together" />)
    
    const imageButton = screen.queryByTitle('Attach Image (PNG, JPEG, WEBP, GIF)')
    expect(imageButton).not.toBeInTheDocument()
  })

  it('validates image file type', async () => {
    render(<ChatInterface {...defaultProps} />)
    
    const imageButton = screen.getByTitle('Attach Image (PNG, JPEG, WEBP, GIF)')
    const fileInput = imageButton.parentElement?.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement
    
    // Create a fake PDF file
    const pdfFile = new File(['fake pdf content'], 'test.pdf', { type: 'application/pdf' })
    
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/Please select a PNG, JPEG, WEBP, or GIF image/i)).toBeInTheDocument()
    })
  })

  it('validates image file size', async () => {
    render(<ChatInterface {...defaultProps} maxImageSizeMB={3} />)
    
    const imageButton = screen.getByTitle('Attach Image (PNG, JPEG, WEBP, GIF)')
    const fileInput = imageButton.parentElement?.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement
    
    // Create a fake large image file (4 MB)
    const largeFile = new File([new ArrayBuffer(4 * 1024 * 1024)], 'large.png', { type: 'image/png' })
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/Image size must be less than 3 MB/i)).toBeInTheDocument()
    })
  })

  it('accepts valid image file', async () => {
    render(<ChatInterface {...defaultProps} />)

    const imageButton = screen.getByTitle('Attach Image (PNG, JPEG, WEBP, GIF)')
    const fileInput = imageButton.parentElement?.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

    // Create a small valid PNG file
    const validFile = new File(['fake png content'], 'test.png', { type: 'image/png' })

    // Mock FileReader properly
    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        // Simulate async file reading
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,fakebase64data' } })
          }
        }, 0)
      }),
      onload: null as any,
      onerror: null as any,
    }

    global.FileReader = vi.fn(function(this: any) {
      return mockFileReader
    }) as any

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('handles clipboard paste for images', async () => {
    render(<ChatInterface {...defaultProps} />)

    const textarea = screen.getByRole('textbox')

    // Create a mock clipboard event with an image
    const mockFile = new File(['fake png content'], 'pasted.png', { type: 'image/png' })
    const mockDataTransferItem = {
      type: 'image/png',
      getAsFile: () => mockFile,
    }

    const mockClipboardData = {
      items: [mockDataTransferItem],
    }

    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,pasteddata' } })
          }
        }, 0)
      }),
      onload: null as any,
      onerror: null as any,
    }

    global.FileReader = vi.fn(function(this: any) {
      return mockFileReader
    }) as any

    // Simulate paste event
    fireEvent.paste(textarea, { clipboardData: mockClipboardData })

    await waitFor(() => {
      expect(screen.getByText('pasted.png')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('ignores paste for non-OpenAI providers', () => {
    render(<ChatInterface {...defaultProps} selectedProvider="together" />)

    const textarea = screen.getByRole('textbox')

    const mockFile = new File(['fake png content'], 'pasted.png', { type: 'image/png' })
    const mockDataTransferItem = {
      type: 'image/png',
      getAsFile: () => mockFile,
    }

    const mockClipboardData = {
      items: [mockDataTransferItem],
    }

    // Simulate paste event
    fireEvent.paste(textarea, { clipboardData: mockClipboardData })

    // Should not show image preview for Together.ai
    expect(screen.queryByText('pasted.png')).not.toBeInTheDocument()
  })
})

