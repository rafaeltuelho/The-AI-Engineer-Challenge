import React from 'react'
import { Bot, Sparkles, Sun, Moon } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  selectedModel: string
  modelDescription: string
}

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange, selectedModel, modelDescription }) => {
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    onThemeChange(newTheme)
  }

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Bot className="logo-icon" />
          <h1>AI Chat Assistant</h1>
        </div>
        <div className="header-controls">
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div className="header-badge">
            <Sparkles className="badge-icon" />
            <div className="badge-content">
              <span className="badge-title">Powered by {selectedModel}</span>
              <span className="badge-description">{modelDescription}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
