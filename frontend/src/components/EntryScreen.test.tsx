import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EntryScreen from './EntryScreen'
import { useAuth } from '../contexts/AuthContext'
import type { CredentialResponse } from '@react-oauth/google'

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess, onError }: { onSuccess: (response: CredentialResponse) => void; onError: () => void }) => (
    <button
      data-testid="google-login-button"
      onClick={() => onSuccess({ credential: 'test-google-credential' } as CredentialResponse)}
    >
      Sign in with Google
    </button>
  ),
}))

// Mock AuthContext
vi.mock('../contexts/AuthContext')

describe('EntryScreen', () => {
  const mockLoginAsGuest = vi.fn()
  const mockLoginWithGoogle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders guest login button', () => {
    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    expect(screen.getByText('Continue as Guest')).toBeInTheDocument()
    expect(screen.getByText('Get 3 free turns to try the chat')).toBeInTheDocument()
  })

  it('shows Google sign-in when googleAuthEnabled is true', () => {
    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: true,
        googleClientId: 'test-client-id',
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    expect(screen.getByTestId('google-login-button')).toBeInTheDocument()
  })

  it('hides Google sign-in when googleAuthEnabled is false', () => {
    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    expect(screen.queryByTestId('google-login-button')).not.toBeInTheDocument()
  })

  it('clicking guest login calls loginAsGuest', async () => {
    mockLoginAsGuest.mockResolvedValue(undefined)

    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    const guestButton = screen.getByText('Continue as Guest')
    fireEvent.click(guestButton)

    await waitFor(() => {
      expect(mockLoginAsGuest).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error message on login failure', async () => {
    mockLoginAsGuest.mockRejectedValue(new Error('Login failed'))

    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    const guestButton = screen.getByText('Continue as Guest')
    fireEvent.click(guestButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to continue as guest. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows loading state while login is in progress', async () => {
    let resolveLogin: () => void
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve
    })
    mockLoginAsGuest.mockReturnValue(loginPromise)

    vi.mocked(useAuth).mockReturnValue({
      loginAsGuest: mockLoginAsGuest,
      loginWithGoogle: mockLoginWithGoogle,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      user: null,
      isAuthenticated: false,
      isLoading: false,
      logout: vi.fn(),
    })

    render(<EntryScreen />)

    const guestButton = screen.getByRole('button', { name: /continue as guest/i })
    fireEvent.click(guestButton)

    // Button should be disabled during loading
    await waitFor(() => {
      expect(guestButton).toBeDisabled()
    })

    // Resolve the login
    resolveLogin!()
  })
})

