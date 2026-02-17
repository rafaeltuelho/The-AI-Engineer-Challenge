import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Header from './Header'
import { useAuth } from '../contexts/AuthContext'

// Mock AuthContext
vi.mock('../contexts/AuthContext')

describe('Header', () => {
  const defaultProps = {
    theme: 'light' as const,
    onThemeChange: vi.fn(),
    selectedModel: 'gpt-4',
    selectedProvider: 'openai',
    onSettingsClick: vi.fn(),
    isSidebarOpen: true,
    onToggleSidebar: vi.fn(),
    isWhitelisted: false,
    freeTurnsRemaining: 3,
    authType: 'guest' as const,
    userName: 'Test User',
    userPicture: null,
  }

  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      logout: mockLogout,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authConfig: null,
      loginAsGuest: vi.fn(),
      loginWithGoogle: vi.fn(),
    })
  })

  it('renders user name and avatar for Google auth', () => {
    render(
      <Header
        {...defaultProps}
        authType="google"
        userName="John Doe"
        userPicture="https://example.com/avatar.jpg"
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    const avatar = screen.getByAltText('John Doe')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('renders guest avatar placeholder for guest auth', () => {
    render(<Header {...defaultProps} authType="guest" userName="Guest" userPicture={null} />)

    expect(screen.getByText('Guest')).toBeInTheDocument()
    // The placeholder is a div with a User icon, not an img
    expect(screen.queryByRole('img', { name: /guest/i })).not.toBeInTheDocument()
  })

  it('shows free turns badge when user is not whitelisted', () => {
    render(<Header {...defaultProps} isWhitelisted={false} freeTurnsRemaining={5} />)

    expect(screen.getByText('5 free messages')).toBeInTheDocument()
  })

  it('shows singular message when freeTurnsRemaining is 1', () => {
    render(<Header {...defaultProps} isWhitelisted={false} freeTurnsRemaining={1} />)

    expect(screen.getByText('1 free message')).toBeInTheDocument()
  })

  it('hides free turns badge when user is whitelisted', () => {
    render(<Header {...defaultProps} isWhitelisted={true} freeTurnsRemaining={5} />)

    expect(screen.queryByText(/free message/i)).not.toBeInTheDocument()
  })

  it('hides free turns badge when freeTurnsRemaining is -1 (unlimited)', () => {
    render(<Header {...defaultProps} isWhitelisted={false} freeTurnsRemaining={-1} />)

    expect(screen.queryByText(/free message/i)).not.toBeInTheDocument()
  })

  it('calls logout when logout button clicked', async () => {
    render(<Header {...defaultProps} />)

    const logoutButton = screen.getByTitle('Logout')
    fireEvent.click(logoutButton)

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('calls onThemeChange when theme toggle clicked', () => {
    const onThemeChange = vi.fn()
    render(<Header {...defaultProps} theme="light" onThemeChange={onThemeChange} />)

    const themeToggle = screen.getByTitle('Switch to dark theme')
    fireEvent.click(themeToggle)

    expect(onThemeChange).toHaveBeenCalledWith('dark')
  })

  it('shows model name and provider', () => {
    render(<Header {...defaultProps} selectedModel="gpt-4-turbo" selectedProvider="OpenAI" />)

    expect(screen.getByText('gpt-4-turbo')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
  })

  it('calls onSettingsClick when model indicator is clicked', () => {
    const onSettingsClick = vi.fn()
    render(<Header {...defaultProps} onSettingsClick={onSettingsClick} />)

    const modelIndicator = screen.getByTitle('Change model in Settings')
    fireEvent.click(modelIndicator)

    expect(onSettingsClick).toHaveBeenCalledTimes(1)
  })

  it('calls onToggleSidebar when sidebar toggle is clicked', () => {
    const onToggleSidebar = vi.fn()
    render(<Header {...defaultProps} onToggleSidebar={onToggleSidebar} />)

    const sidebarToggle = screen.getByTitle('Close sidebar')
    fireEvent.click(sidebarToggle)

    expect(onToggleSidebar).toHaveBeenCalledTimes(1)
  })
})

