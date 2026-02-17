import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsModal from './SettingsModal'

describe('SettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    apiKey: '',
    setApiKey: vi.fn(),
    selectedProvider: 'openai',
    setSelectedProvider: vi.fn(),
    selectedModel: 'gpt-4',
    setSelectedModel: vi.fn(),
    developerMessage: '',
    setDeveloperMessage: vi.fn(),
    modelDescriptions: {
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'deepseek-ai/DeepSeek-V3.1': 'DeepSeek V3.1',
    },
    isWhitelisted: false,
    freeTurnsRemaining: 3,
    hasFreeTurns: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('renders provider, model, API key, and system message sections', () => {
    render(<SettingsModal {...defaultProps} />)

    expect(screen.getByText('Provider')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('API Key')).toBeInTheDocument()
    expect(screen.getByText('System Message')).toBeInTheDocument()
  })

  it('shows whitelisted status message', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={true} />)

    expect(screen.getByText('Using server-provided API keys (unlimited access)')).toBeInTheDocument()
  })

  it('shows free tier status with remaining turns', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={true} freeTurnsRemaining={5} />)

    expect(screen.getByText(/You have 5 free messages remaining/)).toBeInTheDocument()
  })

  it('shows singular message when freeTurnsRemaining is 1', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={true} freeTurnsRemaining={1} />)

    expect(screen.getByText(/You have 1 free message remaining/)).toBeInTheDocument()
  })

  it('shows exhausted free turns warning', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={false} apiKey="" />)

    expect(screen.getByText(/⚠️ Free turns used up! Enter your API key to continue chatting./)).toBeInTheDocument()
  })

  it('disables provider select during free trial without API key', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={true} apiKey="" />)

    const selects = screen.getAllByRole('combobox')
    const providerSelect = selects[0] // First select is provider
    expect(providerSelect).toBeDisabled()
    expect(screen.getByText('Provider is locked during free trial')).toBeInTheDocument()
  })

  it('disables model select during free trial without API key', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={true} apiKey="" />)

    const selects = screen.getAllByRole('combobox')
    const modelSelect = selects[1] // Second select is model
    expect(modelSelect).toBeDisabled()
    expect(screen.getByText('Model is locked during free trial')).toBeInTheDocument()
  })

  it('enables provider and model select when API key is provided', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} hasFreeTurns={true} apiKey="sk-test-key" />)

    const selects = screen.getAllByRole('combobox')
    const providerSelect = selects[0]
    const modelSelect = selects[1]

    expect(providerSelect).not.toBeDisabled()
    expect(modelSelect).not.toBeDisabled()
  })

  it('API key input uses password type', () => {
    render(<SettingsModal {...defaultProps} isWhitelisted={false} />)

    const apiKeyInput = screen.getByPlaceholderText(/OpenAI key: sk-/)
    expect(apiKeyInput).toHaveAttribute('type', 'password')
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal {...defaultProps} onClose={onClose} />)

    const backdrop = document.querySelector('.settings-modal-backdrop')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal {...defaultProps} onClose={onClose} />)

    const closeButton = screen.getByLabelText('Close settings')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Done button clicked', () => {
    const onClose = vi.fn()
    render(<SettingsModal {...defaultProps} onClose={onClose} />)

    const doneButton = screen.getByText('Done')
    fireEvent.click(doneButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls setApiKey when API key input changes', () => {
    const setApiKey = vi.fn()
    render(<SettingsModal {...defaultProps} setApiKey={setApiKey} isWhitelisted={false} />)

    const apiKeyInput = screen.getByPlaceholderText(/OpenAI key: sk-/)
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } })

    expect(setApiKey).toHaveBeenCalledWith('sk-new-key')
  })

  it('calls setSelectedProvider when provider select changes', () => {
    const setSelectedProvider = vi.fn()
    render(
      <SettingsModal
        {...defaultProps}
        setSelectedProvider={setSelectedProvider}
        isWhitelisted={false}
        apiKey="sk-test"
      />
    )

    const selects = screen.getAllByRole('combobox')
    const providerSelect = selects[0]
    fireEvent.change(providerSelect, { target: { value: 'together' } })

    expect(setSelectedProvider).toHaveBeenCalledWith('together')
  })

  it('calls setSelectedModel when model select changes', () => {
    const setSelectedModel = vi.fn()
    render(
      <SettingsModal {...defaultProps} setSelectedModel={setSelectedModel} isWhitelisted={false} apiKey="sk-test" />
    )

    const selects = screen.getAllByRole('combobox')
    const modelSelect = selects[1]
    fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } })

    expect(setSelectedModel).toHaveBeenCalledWith('gpt-3.5-turbo')
  })

  it('calls setDeveloperMessage when system message textarea changes', () => {
    const setDeveloperMessage = vi.fn()
    render(<SettingsModal {...defaultProps} setDeveloperMessage={setDeveloperMessage} />)

    const textarea = screen.getByPlaceholderText("Define the AI's behavior and role")
    fireEvent.change(textarea, { target: { value: 'You are a helpful assistant' } })

    expect(setDeveloperMessage).toHaveBeenCalledWith('You are a helpful assistant')
  })
})

