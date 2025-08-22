import React from 'react'
import { Bot, Sparkles } from 'lucide-react'
import './Header.css'

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Bot className="logo-icon" />
          <h1>AI Chat Assistant</h1>
        </div>
        <div className="header-badge">
          <Sparkles className="badge-icon" />
          <span>Powered by GPT-4.1-mini</span>
        </div>
      </div>
    </header>
  )
}

export default Header
