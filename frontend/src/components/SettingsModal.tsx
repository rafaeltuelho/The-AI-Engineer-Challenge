import React, { useState } from 'react'
import { X, Key, Settings, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react'
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
  isWhitelisted?: boolean
  freeTurnsRemaining?: number
  hasFreeTurns?: boolean
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
  modelDescriptions,
  isWhitelisted = false,
  freeTurnsRemaining = 0,
  hasFreeTurns = false
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
              disabled={!isWhitelisted && hasFreeTurns && !apiKey.trim()}
            >
              <option value="openai">OpenAI</option>
              <option value="together">Together.ai</option>
            </select>
            {!isWhitelisted && hasFreeTurns && !apiKey.trim() && (
              <div className="settings-info-message">
                <AlertCircle size={14} />
                <span>Provider is locked during free trial</span>
              </div>
            )}
          </div>

          {/* API Key Section */}
          <div className="settings-section">
            <label className="settings-label">
              <Key size={16} />
              <span>API Key</span>
            </label>

            {isWhitelisted ? (
              <div className="api-key-status whitelisted">
                <CheckCircle size={16} />
                <span>Using server-provided API keys (unlimited access)</span>
              </div>
            ) : hasFreeTurns && !apiKey.trim() ? (
              <div className="api-key-status free-tier">
                <AlertCircle size={16} />
                <span>
                  You have {freeTurnsRemaining} free message{freeTurnsRemaining === 1 ? '' : 's'} remaining.
                  Add your API key for unlimited access.
                </span>
              </div>
            ) : !hasFreeTurns && !apiKey.trim() ? (
              <div className="api-key-status exhausted">
                <AlertCircle size={16} />
                <span>
                  ⚠️ Free turns used up! Enter your API key to continue chatting.
                </span>
              </div>
            ) : null}

            {!isWhitelisted && (
              <>
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
              </>
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
              disabled={!isWhitelisted && hasFreeTurns && !apiKey.trim()}
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
            {!isWhitelisted && hasFreeTurns && !apiKey.trim() && (
              <div className="settings-info-message">
                <AlertCircle size={14} />
                <span>Model is locked during free trial</span>
              </div>
            )}
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

