import React, { useState } from 'react'
import { Search, Send, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import './RAGQuery.css'

interface RAGQueryProps {
  sessionId: string
  apiKey: string
  onQueryResult: (result: any) => void
  provider?: string
  ollamaBaseUrl?: string
}

interface QueryResult {
  answer: string
  relevant_chunks_count: number
  document_info: {
    document_count: number
    documents: Record<string, any>
  }
}

const RAGQuery: React.FC<RAGQueryProps> = ({
  sessionId,
  apiKey,
  onQueryResult,
  provider = 'openai',
  ollamaBaseUrl = ''
}) => {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<QueryResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !sessionId || !apiKey) return

    setIsLoading(true)
    setError(null)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-API-Key': apiKey
      }

      // Add Ollama base URL header if using Ollama provider
      if (provider === 'ollama' && ollamaBaseUrl) {
        headers['X-Ollama-Base-URL'] = ollamaBaseUrl
      }

      const response = await fetch('/api/rag-query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: query.trim(),
          k: 5,
          provider,
          ...(provider === 'ollama' && ollamaBaseUrl ? { ollama_base_url: ollamaBaseUrl } : {})
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Query failed')
      }

      const result: QueryResult = await response.json()
      setLastResult(result)
      onQueryResult(result)
      setQuery('')

    } catch (error) {
      console.error('RAG query error:', error)
      setError(error instanceof Error ? error.message : 'Query failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="rag-query-container">
      <div className="rag-query-header">
        <Search size={20} />
        <h3>Ask about your documents</h3>
      </div>

      <form onSubmit={handleSubmit} className="rag-query-form">
        <div className="query-input-container">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your uploaded PDF documents..."
            className="query-input"
            disabled={isLoading || !sessionId || !apiKey}
            rows={2}
          />
          <button
            type="submit"
            className="query-submit-btn"
            disabled={isLoading || !query.trim() || !sessionId || !apiKey}
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="query-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {lastResult && (
        <div className="query-result">
          <div className="result-header">
            <CheckCircle size={16} />
            <span>Answer based on {lastResult.relevant_chunks_count} relevant chunks</span>
          </div>
          <div className="result-content">
            {lastResult.answer}
          </div>
          <div className="result-meta">
            <div className="document-count">
              <FileText size={14} />
              <span>{lastResult.document_info.document_count} document(s) indexed</span>
            </div>
          </div>
        </div>
      )}

      {!sessionId || !apiKey ? (
        <div className="query-warning">
          <AlertCircle size={16} />
          <span>Session ID and API key are required to query documents</span>
        </div>
      ) : null}
    </div>
  )
}

export default RAGQuery
