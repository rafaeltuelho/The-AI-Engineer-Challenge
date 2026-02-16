import React from 'react'
import { Sun, Moon, PanelLeft, PanelLeftClose, LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './Header.css'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  selectedModel: string
  selectedProvider: string
  onSettingsClick: () => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  isWhitelisted: boolean
  freeTurnsRemaining: number
  authType: 'guest' | 'google'
  userName: string | null
  userPicture: string | null
}

const Header: React.FC<HeaderProps> = ({
  theme,
  onThemeChange,
  selectedModel,
  selectedProvider,
  onSettingsClick,
  isSidebarOpen,
  onToggleSidebar,
  isWhitelisted,
  freeTurnsRemaining,
  authType,
  userName,
  userPicture
}) => {
  const { logout } = useAuth()
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    onThemeChange(newTheme)
  }

  const handleLogout = async () => {
    await logout()
  }

  const showFreeTurnsBadge = !isWhitelisted && freeTurnsRemaining >= 0

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
        </button>
        <button
          className="model-indicator"
          onClick={onSettingsClick}
          title="Change model in Settings"
        >
          <span className="model-name">{selectedModel}</span>
          <span className="model-provider">{selectedProvider}</span>
        </button>
      </div>

      <div className="header-right">
        {showFreeTurnsBadge && (
          <div className="free-turns-badge" title="Free messages remaining">
            {freeTurnsRemaining} free {freeTurnsRemaining === 1 ? 'message' : 'messages'}
          </div>
        )}

        <div className="user-display">
          {authType === 'google' && userPicture ? (
            <img src={userPicture} alt={userName || 'User'} className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              <User size={20} />
            </div>
          )}
          <span className="user-name">{userName || 'Guest'}</span>
        </div>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button
          className="logout-button"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}

export default Header
