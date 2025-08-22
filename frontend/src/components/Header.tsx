import React from 'react'
import { Bot, Sparkles, Sun, Moon } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
}

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange }) => {
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
            <span>Powered by GPT-4.1-mini</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
