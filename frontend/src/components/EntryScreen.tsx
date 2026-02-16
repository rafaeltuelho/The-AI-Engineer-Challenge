import React, { useState } from 'react'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { User, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './EntryScreen.css'

const EntryScreen: React.FC = () => {
  const { loginAsGuest, loginWithGoogle, authConfig } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGuestLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await loginAsGuest()
    } catch (err) {
      setError('Failed to continue as guest. Please try again.')
      console.error('Guest login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Failed to get Google credentials')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      await loginWithGoogle(credentialResponse.credential)
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.')
      console.error('Google login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed')
  }

  return (
    <div className="entry-screen">
      <div className="entry-container">
        <div className="entry-header">
          <div className="entry-logo">
            <MessageSquareIcon />
          </div>
          <h1 className="entry-title">Welcome to AI Chat</h1>
          <p className="entry-subtitle">
            Choose how you'd like to get started
          </p>
        </div>

        <div className="entry-options">
          {/* Guest Login Option */}
          <button
            className="entry-option guest-option"
            onClick={handleGuestLogin}
            disabled={isLoading}
          >
            <div className="option-icon">
              <User size={24} />
            </div>
            <div className="option-content">
              <h3 className="option-title">Continue as Guest</h3>
              <p className="option-description">
                {authConfig?.guestFreeTurns 
                  ? `Get ${authConfig.guestFreeTurns} free turns to try the chat`
                  : 'Try the chat with limited turns'}
              </p>
            </div>
            {isLoading && <Loader2 className="option-loader" size={20} />}
          </button>

          {/* Google Sign-In Option */}
          {authConfig?.googleAuthEnabled && authConfig.googleClientId && (
            <div className="entry-option google-option">
              <div className="google-option-content">
                <h3 className="option-title">Sign in with Google</h3>
                <p className="option-description">
                  Get unlimited access with your Google account
                </p>
              </div>
              <div className="google-button-wrapper">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="entry-error">
            <p>{error}</p>
          </div>
        )}

        <div className="entry-footer">
          <p className="entry-footer-text">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}

// Simple MessageSquare icon component
const MessageSquareIcon: React.FC = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export default EntryScreen

