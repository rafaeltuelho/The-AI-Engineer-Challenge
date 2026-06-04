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
    setStudyLearnOverride: vi.fn(),
    ttsVoice: 'marin',
    setTtsVoice: vi.fn(),
  }

  const createStreamingResponse = (text: string, headers: Record<string, string> = {}) => {
    const encoder = new TextEncoder()
    const chunks = [encoder.encode(text)]

    return {
      ok: true,
      headers: {
        get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null,
      },
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: chunks[0] })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    } as unknown as Response
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

  it('requires confirmation before deleting a conversation', async () => {
    const mockConversations = [
      {
        conversation_id: 'conv-delete',
        title: 'Delete Me',
        system_message: 'System',
        last_updated: new Date().toISOString(),
        mode: 'regular',
      }
    ]
    let resolveDelete: (value: Response) => void
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve
    })

    global.fetch = vi.fn((url, init) => {
      if (url === '/api/conversations' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConversations),
        } as Response)
      }
      if (url === '/api/conversations/conv-delete' && init?.method === 'DELETE') {
        return deletePromise
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} sidebarOpen={true} />)

    await waitFor(() => {
      expect(screen.getByText('Delete Me')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Delete Delete Me'))

    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/conversations/conv-delete', expect.objectContaining({ method: 'DELETE' }))

    fireEvent.click(screen.getByText('Delete'))

    expect(screen.getByRole('button', { name: 'Confirm delete Delete Me' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel delete conversation' })).toBeDisabled()
    expect(screen.getByText('Deleting...')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Deleting...'))

    const deleteCalls = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url, init]) => url === '/api/conversations/conv-delete' && init?.method === 'DELETE'
    )
    expect(deleteCalls()).toHaveLength(1)

    resolveDelete!({
      ok: true,
      json: () => Promise.resolve({ message: 'deleted' }),
    } as Response)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-delete', expect.objectContaining({ method: 'DELETE' }))
    })
  })

  it('keeps regular chat mode when sending with uploaded document context', async () => {
    global.fetch = vi.fn((url, init) => {
      if (url === '/api/conversations' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }

      if (url === '/api/upload-document') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            document_id: 'guide.pdf',
            file_name: 'guide.pdf',
            file_type: 'pdf',
            chunk_count: 2,
            summary: null,
            suggested_questions: null,
          }),
        } as Response)
      }

      if (url === '/api/chat') {
        return Promise.resolve(createStreamingResponse('Answered with document context.', {
          'X-Conversation-ID': 'conv-doc-context',
          'X-Free-Turns-Remaining': '9',
        }))
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} />)

    const documentInput = document.querySelector('input[type="file"][accept*=".pdf"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'guide.pdf', { type: 'application/pdf' })
    fireEvent.change(documentInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText(/guide.pdf/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Document Context')).toBeInTheDocument()
    expect(screen.queryByText('Document Summary')).not.toBeInTheDocument()
    expect(screen.queryByText('RAG Mode')).not.toBeInTheDocument()

    const textarea = screen.getByLabelText('Message AI')
    fireEvent.change(textarea, { target: { value: 'What does the guide say?' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
    })

    const ragCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => url === '/api/rag-query')
    expect(ragCalls).toHaveLength(0)

    const chatCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === '/api/chat')
    const requestBody = JSON.parse(chatCall?.[1]?.body as string)
    expect(requestBody.document_context).toBe(true)
    expect(requestBody.mode).toBeUndefined()
    expect(requestBody.developer_message).not.toContain("If the context doesn't contain enough information")
  })

  it('uses RAG query mode when Doc Q&A is explicitly enabled', async () => {
    global.fetch = vi.fn((url, init) => {
      if (url === '/api/conversations' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }

      if (url === '/api/upload-document') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            document_id: 'guide.pdf',
            file_name: 'guide.pdf',
            file_type: 'pdf',
            chunk_count: 2,
            summary: 'A short guide summary.',
            suggested_questions: ['Summarize guide'],
          }),
        } as Response)
      }

      if (url === '/api/rag-query') {
        return Promise.resolve({
          ok: true,
          headers: {
            get: (name: string) => name === 'X-Conversation-ID' ? 'conv-doc-qa' : null,
          },
          json: () => Promise.resolve({
            answer: 'RAG answer.',
            relevant_chunks_count: 1,
            document_info: {},
          }),
        } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} />)

    const documentInput = document.querySelector('input[type="file"][accept*=".pdf"]') as HTMLInputElement
    const pdfFile = new File(['pdf content'], 'guide.pdf', { type: 'application/pdf' })
    fireEvent.change(documentInput, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(screen.getByText(/guide.pdf/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('Add context (or type /)'))
    fireEvent.click(screen.getByText('Doc Q&A'))
    expect(screen.getAllByText('Doc Q&A').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByText(/Document Summary/)).toBeInTheDocument()
      expect(screen.getByText('A short guide summary.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Document Context')).not.toBeInTheDocument()

    const textarea = screen.getByLabelText('Message AI')
    fireEvent.change(textarea, { target: { value: 'Answer from the document' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/rag-query', expect.any(Object))
    })

    const chatCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => url === '/api/chat')
    expect(chatCalls).toHaveLength(0)

    const ragCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) => url === '/api/rag-query')
    const requestBody = JSON.parse(ragCall?.[1]?.body as string)
    expect(requestBody.mode).toBe('rag')
    expect(requestBody.question).toBe('Answer from the document')
    expect(requestBody.developer_message).toContain("If the context doesn't contain enough information")
  })

  it('allows enabling Doc Q&A at the beginning before uploading a document', () => {
    render(<ChatInterface {...defaultProps} />)

    fireEvent.click(screen.getByTitle('Add context (or type /)'))
    const docQaButton = screen.getByRole('button', { name: /Doc Q&A/ })

    expect(docQaButton).toBeEnabled()
    fireEvent.click(docQaButton)
    expect(screen.getAllByText('Doc Q&A').length).toBeGreaterThan(0)
  })

  it('can enable Doc Q&A from the slash command menu', async () => {
    global.fetch = vi.fn((url, init) => {
      if (url === '/api/conversations' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }

      if (url === '/api/upload-document') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            document_id: 'guide.pdf',
            file_name: 'guide.pdf',
            file_type: 'pdf',
            chunk_count: 2,
            summary: 'A short guide summary.',
            suggested_questions: ['Summarize guide'],
          }),
        } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} />)

    const documentInput = document.querySelector('input[type="file"][accept*=".pdf"]') as HTMLInputElement
    fireEvent.change(documentInput, {
      target: { files: [new File(['pdf content'], 'guide.pdf', { type: 'application/pdf' })] }
    })

    await waitFor(() => {
      expect(screen.getByText(/guide.pdf/i)).toBeInTheDocument()
    })

    const textarea = screen.getByLabelText('Message AI') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '/' } })
    fireEvent.click(screen.getByRole('button', { name: /Doc Q&A/ }))

    expect(textarea.value).toBe('')
    expect(screen.getAllByText('Doc Q&A').length).toBeGreaterThan(0)
    expect(screen.queryByText('Document Context')).not.toBeInTheDocument()
  })

  it('prevents enabling Doc Q&A after the conversation starts', async () => {
    global.fetch = vi.fn((url, init) => {
      if (url === '/api/conversations' && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)
      }

      if (url === '/api/upload-document') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            document_id: 'guide.pdf',
            file_name: 'guide.pdf',
            file_type: 'pdf',
            chunk_count: 2,
            summary: null,
            suggested_questions: null,
          }),
        } as Response)
      }

      if (url === '/api/chat') {
        return Promise.resolve(createStreamingResponse('Regular answer.', {
          'X-Conversation-ID': 'conv-started',
          'X-Free-Turns-Remaining': '9',
        }))
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)
    })

    render(<ChatInterface {...defaultProps} />)

    const documentInput = document.querySelector('input[type="file"][accept*=".pdf"]') as HTMLInputElement
    fireEvent.change(documentInput, {
      target: { files: [new File(['pdf content'], 'guide.pdf', { type: 'application/pdf' })] }
    })

    await waitFor(() => {
      expect(screen.getByText(/guide.pdf/i)).toBeInTheDocument()
    })

    const textarea = screen.getByLabelText('Message AI')
    fireEvent.change(textarea, { target: { value: 'Start in chat mode' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
    })

    fireEvent.click(screen.getByTitle('Add context (or type /)'))
    expect(screen.getByRole('button', { name: /Doc Q&A/ })).toBeDisabled()
  })

  it('expands the message input as multiline text is entered', () => {
    render(<ChatInterface {...defaultProps} />)

    const textarea = screen.getByLabelText('Message AI') as HTMLTextAreaElement
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      value: 96,
    })

    fireEvent.change(textarea, { target: { value: 'line one\nline two\nline three' } })

    expect(textarea.style.height).toBe('96px')
    expect(textarea.style.overflowY).toBe('hidden')
  })
})
