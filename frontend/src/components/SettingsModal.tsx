import React, { useState, useEffect } from 'react'
import { X, Key, Settings, MessageSquare, CheckCircle, AlertCircle, Volume2, Play } from 'lucide-react'
import './SettingsModal.css'

const VOICES = [
  { id: 'marin',  name: 'Marin',  label: 'Female · Natural' },
  { id: 'nova',   name: 'Nova',   label: 'Female · Bright' },
  { id: 'onyx',   name: 'Onyx',   label: 'Male · Deep' },
  { id: 'cedar',  name: 'Cedar',  label: 'Male · Warm' },
]

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
  ttsVoice: string
  setTtsVoice: (v: string) => void
  sessionId: string
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
  hasFreeTurns = false,
  ttsVoice,
  setTtsVoice,
  sessionId
}) => {
  const [showApiKeySuccess, setShowApiKeySuccess] = useState(false)
  const [localDeveloperMessage, setLocalDeveloperMessage] = useState(developerMessage)
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)

  // Sync local state with prop changes (e.g., when Study & Learn is toggled)
  useEffect(() => {
    setLocalDeveloperMessage(developerMessage)
  }, [developerMessage])

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

  const handleVoicePreview = async (voiceId: string) => {
    setPreviewingVoice(voiceId)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify({ text: 'Hello! This is how I sound.', voice: voiceId }),
      })
      if (!response.ok) throw new Error('Preview failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      // Ensure URL is revoked in all cases
      audio.onended = () => URL.revokeObjectURL(url)
      audio.onerror = () => URL.revokeObjectURL(url)

      try {
        await audio.play()
      } catch {
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Voice preview error:', e)
    } finally {
      setPreviewingVoice(null)
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

          {/* Read Aloud Voice Section */}
          {(selectedProvider === 'openai' || isWhitelisted) && (
            <div className="settings-section">
              <label className="settings-label">
                <Volume2 size={16} />
                <span>Read Aloud Voice</span>
              </label>
              <div className="voice-options">
                {VOICES.map(v => (
                  <div key={v.id} className={`voice-option${ttsVoice === v.id ? ' selected' : ''}`}>
                    <button className="voice-select-btn" onClick={() => setTtsVoice(v.id)}>
                      <span className="voice-name">{v.name}</span>
                      <span className="voice-label">{v.label}</span>
                    </button>
                    <button
                      className="voice-preview-btn"
                      onClick={() => handleVoicePreview(v.id)}
                      title="Preview voice"
                      disabled={previewingVoice !== null}
                    >
                      {previewingVoice === v.id
                        ? <div className="preview-spinner" />
                        : <Play size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Message Section */}
          <div className="settings-section">
            <label className="settings-label">
              <MessageSquare size={16} />
              <span>System Message</span>
            </label>
            <textarea
              value={localDeveloperMessage}
              onChange={(e) => {
                setLocalDeveloperMessage(e.target.value)
                setDeveloperMessage(e.target.value)
              }}
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

