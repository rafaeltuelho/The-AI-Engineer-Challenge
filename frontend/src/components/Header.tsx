import React from 'react'
import { ChevronDown, Sun, Moon } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  modelDescriptions: Record<string, string>
}

const Header: React.FC<HeaderProps> = ({
  theme,
  onThemeChange,
  selectedModel,
  setSelectedModel,
  modelDescriptions
}) => {
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    onThemeChange(newTheme)
  }

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value)
  }

  return (
    <header className="header">
      <div className="model-selector">
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="model-dropdown"
          title="Select AI model"
        >
          {Object.keys(modelDescriptions).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="dropdown-chevron" />
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
