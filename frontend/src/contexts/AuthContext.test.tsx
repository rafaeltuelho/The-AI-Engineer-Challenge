import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import React from 'react'

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('AuthContext', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let mockLocalStorage: Record<string, string>

  beforeEach(() => {
    // Reset mocks
    mockLocalStorage = {}
    mockFetch = vi.fn()
    global.fetch = mockFetch

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {}
      }),
    })
  })

  it('fetches auth config on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: true,
        google_client_id: 'test-client-id',
        max_free_turns: 5,
        free_model: 'gpt-4',
        free_provider: 'openai',
      }),
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.authConfig).toEqual({
        googleAuthEnabled: true,
        googleClientId: 'test-client-id',
        maxFreeTurns: 5,
        freeModel: 'gpt-4',
        freeProvider: 'openai',
      })
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/config')
  })

  it('falls back to default config if /api/auth/config fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.authConfig).toEqual({
        googleAuthEnabled: false,
        googleClientId: null,
        maxFreeTurns: 3,
        freeModel: 'deepseek-ai/DeepSeek-V3.1',
        freeProvider: 'together',
      })
    })
  })

  it('loginAsGuest calls /api/auth/guest and stores session in localStorage', async () => {
    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: false,
        google_client_id: null,
        max_free_turns: 3,
        free_model: 'test-model',
        free_provider: 'test-provider',
      }),
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.authConfig).not.toBeNull()
    })

    // Mock guest login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_id: 'guest-session-123',
        user: {
          email: null,
          name: 'Guest',
          picture: null,
          auth_type: 'guest',
          is_whitelisted: false,
          free_turns_remaining: 3,
          has_own_api_key: false,
        },
      }),
    })

    await result.current.loginAsGuest()

    await waitFor(() => {
      expect(result.current.user).not.toBeNull()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/guest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('sessionId', 'guest-session-123')
    expect(result.current.user).toEqual({
      sessionId: 'guest-session-123',
      email: null,
      name: 'Guest',
      picture: null,
      authType: 'guest',
      isWhitelisted: false,
      freeTurnsRemaining: 3,
      hasOwnApiKey: false,
    })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('loginWithGoogle calls /api/auth/google and stores session in localStorage', async () => {
    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: true,
        google_client_id: 'test-client-id',
        max_free_turns: 3,
        free_model: 'test-model',
        free_provider: 'test-provider',
      }),
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.authConfig).not.toBeNull()
    })

    // Mock Google login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_id: 'google-session-456',
        user: {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/pic.jpg',
          auth_type: 'google',
          is_whitelisted: true,
          free_turns_remaining: -1,
          has_own_api_key: false,
        },
      }),
    })

    await result.current.loginWithGoogle('test-credential')

    await waitFor(() => {
      expect(result.current.user).not.toBeNull()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential: 'test-credential' }),
    })

    expect(localStorage.setItem).toHaveBeenCalledWith('sessionId', 'google-session-456')
    expect(result.current.user).toEqual({
      sessionId: 'google-session-456',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/pic.jpg',
      authType: 'google',
      isWhitelisted: true,
      freeTurnsRemaining: -1,
      hasOwnApiKey: false,
    })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout calls /api/auth/logout and clears localStorage', async () => {
    // Set up a session first
    mockLocalStorage['sessionId'] = 'test-session-789'

    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: false,
        google_client_id: null,
        max_free_turns: 3,
        free_model: 'test-model',
        free_provider: 'test-provider',
      }),
    })

    // Mock /api/auth/me to restore session
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        email: 'test@example.com',
        name: 'Test User',
        picture: null,
        auth_type: 'guest',
        is_whitelisted: false,
        free_turns_remaining: 2,
        has_own_api_key: false,
      }),
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    // Mock logout
    mockFetch.mockResolvedValueOnce({
      ok: true,
    })

    await result.current.logout()

    await waitFor(() => {
      expect(result.current.user).toBeNull()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      headers: {
        'X-Session-ID': 'test-session-789',
      },
    })

    expect(localStorage.removeItem).toHaveBeenCalledWith('sessionId')
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('restores session from localStorage on mount', async () => {
    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: false,
        google_client_id: null,
        max_free_turns: 3,
        free_model: 'test-model',
        free_provider: 'test-provider',
      }),
    })

    // Set up a session in localStorage
    mockLocalStorage['sessionId'] = 'existing-session-999'

    // Mock /api/auth/me
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        email: 'restored@example.com',
        name: 'Restored User',
        picture: null,
        auth_type: 'guest',
        is_whitelisted: false,
        free_turns_remaining: 1,
        has_own_api_key: false,
      }),
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
      headers: {
        'X-Session-ID': 'existing-session-999',
      },
    })

    expect(result.current.user).toEqual({
      sessionId: 'existing-session-999',
      email: 'restored@example.com',
      name: 'Restored User',
      picture: null,
      authType: 'guest',
      isWhitelisted: false,
      freeTurnsRemaining: 1,
      hasOwnApiKey: false,
    })
  })

  it('clears invalid session from localStorage', async () => {
    // Mock config fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        google_auth_enabled: false,
        google_client_id: null,
        max_free_turns: 3,
        free_model: 'test-model',
        free_provider: 'test-provider',
      }),
    })

    // Set up an invalid session in localStorage
    mockLocalStorage['sessionId'] = 'invalid-session'

    // Mock /api/auth/me to return error
    mockFetch.mockResolvedValueOnce({
      ok: false,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(localStorage.removeItem).toHaveBeenCalledWith('sessionId')
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})

