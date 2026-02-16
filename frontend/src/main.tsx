import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext.tsx'
import AppWrapper from './AppWrapper.tsx'
import './index.css'

// Google Client ID will be fetched from the auth config endpoint
// For now, we use a placeholder that will be replaced by the actual client ID from the backend
const GOOGLE_CLIENT_ID = 'placeholder-client-id'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppWrapper />
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
