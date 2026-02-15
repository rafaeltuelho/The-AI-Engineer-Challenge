import React, { useState } from 'react'
import { X, Key, Settings, MessageSquare } from 'lucide-react'
import './SettingsModal.css'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  apiKey: string
  setApiKey: (key: string) => void
  selectedProvider: string
  setSelectedProvider: (provider: string) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  developerMessage: string
  setDeveloperMessage: (message: string) => void
  modelDescriptions: Record<string, string>
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  selectedProvider,
  setSelectedProvider,
  selectedModel,
  setSelectedModel,
  developerMessage,
  setDeveloperMessage,
  modelDescriptions
}) => {
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)

  if (!isOpen) return null

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
    setShowApiKeySuccess(false)
  }

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      setShowApiKeySuccess(true)
      setTimeout(() => setShowApiKeySuccess(false), 3000)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="settings-modal-backdrop" onClick={onClose} />
      
      {/* Modal */}
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-content">
          {/* Provider Section */}
          <div className="settings-section">
            <label className="settings-label">
              <Settings size={16} />
              <span>Provider</span>
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="settings-select"
            >
              <option value="openai">OpenAI</option>
              <option value="together">Together.ai</option>
            </select>
          </div>

          {/* API Key Section */}
          <div className="settings-section">
            <label className="settings-label">
              <Key size={16} />
              <span>API Key</span>
            </label>
            <div className="api-key-input-group">
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder={`${selectedProvider === 'together' ? 'Together.ai key: tgp_' : 'OpenAI key: sk-'} ...`}
                className="settings-input"
              />
              <button
                className="api-key-save-btn"
                onClick={handleSaveApiKey}
              >
                Save
              </button>
            </div>
            {showApiKeySuccess && (
              <div className="api-key-success">✓ API key saved</div>
            )}
          </div>

          {/* Model Section */}
          <div className="settings-section">
            <label className="settings-label">
              <Settings size={16} />
              <span>Model</span>
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="settings-select"
            >
              {Object.entries(modelDescriptions)
                .filter(([key]) => {
                  if (selectedProvider === 'together') {
                    return key.includes('/')
                  }
                  return !key.includes('/')
                })
                .map(([key, description]) => (
                  <option key={key} value={key}>
                    {description}
                  </option>
                ))}
            </select>
          </div>

          {/* System Message Section */}
          <div className="settings-section">
            <label className="settings-label">
              <MessageSquare size={16} />
              <span>System Message</span>
            </label>
            <textarea
              value={developerMessage}
              onChange={(e) => setDeveloperMessage(e.target.value)}
              placeholder="Define the AI's behavior and role"
              className="settings-textarea"
              rows={6}
            />
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="settings-close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </>
  )
}

export default SettingsModal

