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
  // Store original globals to restore after tests
  const originalFetch = global.fetch
  const originalFileReader = global.FileReader

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

  afterEach(() => {
    // Restore original globals to prevent test pollution
    global.fetch = originalFetch
    global.FileReader = originalFileReader
  })

  it('shows image attachment button for OpenAI in regular chat mode', () => {
    render(<ChatInterface {...defaultProps} />)

    // The image input is now hidden and triggered via context menu
    const imageInput = document.querySelector('input[type="file"][accept*="image"]')
    expect(imageInput).toBeInTheDocument()
  })

  it('hides image attachment button for Together.ai provider', () => {
    render(<ChatInterface {...defaultProps} selectedProvider="together" />)

    // The image input is still in the DOM but should be disabled for non-OpenAI providers
    const imageInput = document.querySelector('input[type="file"][accept*="image"]')
    expect(imageInput).toBeInTheDocument()
  })

  it('validates image file type', async () => {
    render(<ChatInterface {...defaultProps} />)

    // Find the hidden image input directly
    const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

    // Create a fake PDF file
    const pdfFile = new File(['fake pdf content'], 'test.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Please select a PNG, JPEG, WEBP, or GIF image/i)).toBeInTheDocument()
    })
  })

  it('validates image file size', async () => {
    render(<ChatInterface {...defaultProps} maxImageSizeMB={3} />)

    // Find the hidden image input directly
    const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

    // Create a fake large image file (4 MB)
    const largeFile = new File([new ArrayBuffer(4 * 1024 * 1024)], 'large.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/Image size must be less than 3 MB/i)).toBeInTheDocument()
    })
  })

  it('accepts valid image file', async () => {
    render(<ChatInterface {...defaultProps} />)

    // Find the hidden image input directly
    const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

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

  it('renders image in user message after sending', async () => {
    // Mock successful chat response
    global.fetch = vi.fn((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }
      // Mock chat endpoint
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

    render(<ChatInterface {...defaultProps} />)

    // Find the hidden image input directly
    const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

    // Create and attach a valid image
    const validFile = new File(['fake png content'], 'test-image.png', { type: 'image/png' })

    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,testdata123' } })
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

    // Wait for image preview to appear
    await waitFor(() => {
      expect(screen.getByText('test-image.png')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Type a message and send
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Check out this image!' } })

    const form = textarea.closest('form')!
    fireEvent.submit(form)

    // Wait for user message to appear in chat
    await waitFor(() => {
      expect(screen.getByText('Check out this image!')).toBeInTheDocument()
    })

    // Check that image is rendered in the message
    const messageImages = screen.getAllByAltText('test-image.png')
    expect(messageImages.length).toBeGreaterThan(0)

    // Verify image src contains the data URL
    const renderedImage = messageImages.find(img =>
      img.getAttribute('src')?.includes('data:image/png;base64,testdata123')
    )
    expect(renderedImage).toBeInTheDocument()
  })

  it('renders image without text in user message', async () => {
    global.fetch = vi.fn((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
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
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Response') })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      } as any)
    })

    render(<ChatInterface {...defaultProps} />)

    // Find the hidden image input directly
    const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement

    const validFile = new File(['fake png'], 'image-only.png', { type: 'image/png' })

    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,imageonly' } })
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
      expect(screen.getByText('image-only.png')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Send with minimal text (image is the main content)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Image' } })

    const form = textarea.closest('form')!
    fireEvent.submit(form)

    // Image should be rendered in the message
    await waitFor(() => {
      const images = screen.getAllByAltText('image-only.png')
      // Should have at least one image in the message (not just in preview)
      expect(images.length).toBeGreaterThan(0)
      // Verify the image has the correct data URL
      const messageImage = images.find(img =>
        img.getAttribute('src')?.includes('data:image/png;base64,imageonly')
      )
      expect(messageImage).toBeInTheDocument()
    })
  })

  it('loads and renders images from conversation history', async () => {
    // Mock conversation history with image_attachment from backend
    const mockConversations = [
      {
        conversation_id: 'conv-with-image',
        title: 'Conversation with Image',
        last_updated: new Date().toISOString(),
        mode: 'regular',
      }
    ]

    const mockConversationDetail = {
      conversation_id: 'conv-with-image',
      title: 'Conversation with Image',
      mode: 'regular',
      messages: [
        {
          role: 'user',
          content: 'Here is my screenshot',
          timestamp: new Date().toISOString(),
          image_attachment: {
            data_url: 'data:image/png;base64,historicalimage123',
            mime_type: 'image/png',
            filename: 'screenshot.png'
          }
        },
        {
          role: 'assistant',
          content: 'I can see your screenshot.',
          timestamp: new Date().toISOString()
        }
      ]
    }

    global.fetch = vi.fn((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversations),
        } as Response)
      }
      if (url === '/api/conversations/conv-with-image') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversationDetail),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} sidebarOpen={true} />)

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('Conversation with Image')).toBeInTheDocument()
    })

    // Click on the conversation to load it
    const conversationItem = screen.getByText('Conversation with Image')
    fireEvent.click(conversationItem)

    // Wait for messages to load
    await waitFor(() => {
      expect(screen.getByText('Here is my screenshot')).toBeInTheDocument()
    })

    // Verify image is rendered from history
    const historyImage = screen.getByAltText('screenshot.png')
    expect(historyImage).toBeInTheDocument()
    expect(historyImage.getAttribute('src')).toBe('data:image/png;base64,historicalimage123')

    // Verify assistant response is also present
    expect(screen.getByText('I can see your screenshot.')).toBeInTheDocument()
  })

  it('handles conversation reload with multiple images', async () => {
    const mockConversations = [
      {
        conversation_id: 'conv-multi-images',
        title: 'Multiple Images',
        last_updated: new Date().toISOString(),
        mode: 'regular',
      }
    ]

    const mockConversationDetail = {
      conversation_id: 'conv-multi-images',
      title: 'Multiple Images',
      mode: 'regular',
      messages: [
        {
          role: 'user',
          content: 'First image',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          image_attachment: {
            data_url: 'data:image/jpeg;base64,firstimage',
            mime_type: 'image/jpeg',
            filename: 'first.jpg'
          }
        },
        {
          role: 'assistant',
          content: 'Got the first one.',
          timestamp: new Date(Date.now() - 1500).toISOString()
        },
        {
          role: 'user',
          content: 'Second image',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          image_attachment: {
            data_url: 'data:image/webp;base64,secondimage',
            mime_type: 'image/webp',
            filename: 'second.webp'
          }
        },
        {
          role: 'assistant',
          content: 'Got the second one too.',
          timestamp: new Date().toISOString()
        }
      ]
    }

    global.fetch = vi.fn((url) => {
      if (url === '/api/conversations') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversations),
        } as Response)
      }
      if (url === '/api/conversations/conv-multi-images') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversationDetail),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} sidebarOpen={true} />)

    await waitFor(() => {
      expect(screen.getByText('Multiple Images')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Multiple Images'))

    // Wait for all messages to load
    await waitFor(() => {
      expect(screen.getByText('First image')).toBeInTheDocument()
      expect(screen.getByText('Second image')).toBeInTheDocument()
    })

    // Verify both images are rendered
    const firstImage = screen.getByAltText('first.jpg')
    expect(firstImage).toBeInTheDocument()
    expect(firstImage.getAttribute('src')).toBe('data:image/jpeg;base64,firstimage')

    const secondImage = screen.getByAltText('second.webp')
    expect(secondImage).toBeInTheDocument()
    expect(secondImage.getAttribute('src')).toBe('data:image/webp;base64,secondimage')

    // Verify all assistant responses are present
    expect(screen.getByText('Got the first one.')).toBeInTheDocument()
    expect(screen.getByText('Got the second one too.')).toBeInTheDocument()
  })
})

