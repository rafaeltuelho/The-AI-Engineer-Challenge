import React from 'react'
import { Sun, Moon, PanelLeft, PanelLeftClose } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  selectedModel: string
  selectedProvider: string
  onSettingsClick: () => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

const Header: React.FC<HeaderProps> = ({
  theme,
  onThemeChange,
  selectedModel,
  selectedProvider,
  onSettingsClick,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    onThemeChange(newTheme)
  }

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

      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
    </header>
  )
}

export default Header
