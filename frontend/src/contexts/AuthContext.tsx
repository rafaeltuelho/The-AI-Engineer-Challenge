import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'

interface User {
  sessionId: string
  email: string | null
  name: string | null
  picture: string | null
  authType: 'guest' | 'google'
  isWhitelisted: boolean
  freeTurnsRemaining: number  // -1 = unlimited
  hasOwnApiKey: boolean
}

interface AuthConfig {
  googleAuthEnabled: boolean
  googleClientId: string | null
  maxFreeTurns: number
  freeModel: string
  freeProvider: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  authConfig: AuthConfig | null
  loginAsGuest: () => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  logout: () => Promise<void>
  updateFreeTurns: (turns: number) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null)

  // Fetch auth configuration on mount
  useEffect(() => {
    const fetchAuthConfig = async () => {
      try {
        const response = await fetch('/api/auth/config')
        if (response.ok) {
          const config = await response.json()
          setAuthConfig({
            googleAuthEnabled: config.google_auth_enabled,
            googleClientId: config.google_client_id || null,
            maxFreeTurns: config.max_free_turns,
            freeModel: config.free_model,
            freeProvider: config.free_provider
          })
        } else {
          // Default config if endpoint fails
          setAuthConfig({
            googleAuthEnabled: false,
            googleClientId: null,
            maxFreeTurns: 3,
            freeModel: 'deepseek-ai/DeepSeek-V3.1',
            freeProvider: 'together'
          })
        }
      } catch (error) {
        console.error('Failed to fetch auth config:', error)
        // Default config on error
        setAuthConfig({
          googleAuthEnabled: false,
          googleClientId: null,
          maxFreeTurns: 3,
          freeModel: 'deepseek-ai/DeepSeek-V3.1',
          freeProvider: 'together'
        })
      }
    }

    fetchAuthConfig()
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const sessionId = localStorage.getItem('sessionId')
      if (!sessionId) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'X-Session-ID': sessionId
          }
        })

        if (response.ok) {
          const data = await response.json()
          setUser({
            sessionId: sessionId,
            email: data.email,
            name: data.name || (data.auth_type === 'guest' ? 'Guest' : null),
            picture: data.picture,
            authType: data.auth_type,
            isWhitelisted: data.is_whitelisted,
            freeTurnsRemaining: data.free_turns_remaining,
            hasOwnApiKey: data.has_own_api_key
          })
        } else {
          // Invalid session, clear it
          localStorage.removeItem('sessionId')
        }
      } catch (error) {
        console.error('Failed to verify session:', error)
        localStorage.removeItem('sessionId')
      } finally {
        setIsLoading(false)
      }
    }

    if (authConfig) {
      checkSession()
    }
  }, [authConfig])

  const loginAsGuest = async () => {
    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('sessionId', data.session_id)
        setUser({
          sessionId: data.session_id,
          email: data.user.email,
          name: data.user.name || 'Guest',
          picture: data.user.picture,
          authType: data.user.auth_type,
          isWhitelisted: data.user.is_whitelisted,
          freeTurnsRemaining: data.user.free_turns_remaining,
          hasOwnApiKey: data.user.has_own_api_key
        })
      } else {
        throw new Error('Failed to login as guest')
      }
    } catch (error) {
      console.error('Guest login failed:', error)
      throw error
    }
  }

  const loginWithGoogle = async (credential: string) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('sessionId', data.session_id)
        setUser({
          sessionId: data.session_id,
          email: data.user.email,
          name: data.user.name,
          picture: data.user.picture,
          authType: data.user.auth_type,
          isWhitelisted: data.user.is_whitelisted,
          freeTurnsRemaining: data.user.free_turns_remaining,
          hasOwnApiKey: data.user.has_own_api_key
        })
      } else {
        throw new Error('Failed to login with Google')
      }
    } catch (error) {
      console.error('Google login failed:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId')
      if (sessionId) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'X-Session-ID': sessionId
          }
        })
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      localStorage.removeItem('sessionId')
      setUser(null)
    }
  }

  const updateFreeTurns = (turns: number) => {
    if (user && !user.isWhitelisted) {
      setUser({ ...user, freeTurnsRemaining: turns })
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    authConfig,
    loginAsGuest,
    loginWithGoogle,
    logout,
    updateFreeTurns
  }

  return (
    <AuthContext.Provider value={value}>
      {authConfig?.googleClientId ? (
        <GoogleOAuthProvider clientId={authConfig.googleClientId}>
          {children}
        </GoogleOAuthProvider>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}


