import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppWrapper from './AppWrapper'
import { useAuth } from './contexts/AuthContext'

// Mock the dependencies
vi.mock('./contexts/AuthContext')
vi.mock('./App', () => ({
  default: () => <div>App Component</div>,
}))
vi.mock('./components/EntryScreen', () => ({
  default: () => <div>Entry Screen Component</div>,
}))

describe('AppWrapper', () => {
  it('shows loading spinner when isLoading is true', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      authConfig: null,
      loginAsGuest: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
    })

    render(<AppWrapper />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows EntryScreen when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      loginAsGuest: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
    })

    render(<AppWrapper />)

    expect(screen.getByText('Entry Screen Component')).toBeInTheDocument()
  })

  it('shows App when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: {
        sessionId: 'test-session',
        email: 'test@example.com',
        name: 'Test User',
        picture: null,
        authType: 'guest',
        isWhitelisted: false,
        freeTurnsRemaining: 3,
        hasOwnApiKey: false,
      },
      authConfig: {
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'test-model',
        freeProvider: 'test-provider',
      },
      loginAsGuest: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
    })

    render(<AppWrapper />)

    expect(screen.getByText('App Component')).toBeInTheDocument()
  })
})

