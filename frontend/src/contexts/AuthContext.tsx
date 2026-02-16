import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email?: string
  name?: string
  picture?: string
  authType: 'guest' | 'google'
  freeTurns?: number
}

interface AuthConfig {
  googleAuthEnabled: boolean
  googleClientId?: string
  guestFreeTurns: number
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
          setAuthConfig(config)
        } else {
          // Default config if endpoint fails
          setAuthConfig({
            googleAuthEnabled: false,
            guestFreeTurns: 5
          })
        }
      } catch (error) {
        console.error('Failed to fetch auth config:', error)
        // Default config on error
        setAuthConfig({
          googleAuthEnabled: false,
          guestFreeTurns: 5
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
          const userData = await response.json()
          setUser(userData)
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
        localStorage.setItem('sessionId', data.sessionId)
        setUser(data.user)
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
        localStorage.setItem('sessionId', data.sessionId)
        setUser(data.user)
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
    if (user && user.authType === 'guest') {
      setUser({ ...user, freeTurns: turns })
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


