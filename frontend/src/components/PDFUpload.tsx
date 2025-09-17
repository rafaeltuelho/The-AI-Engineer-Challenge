import React, { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import './PDFUpload.css'

interface PDFUploadProps {
  sessionId: string
  apiKey: string
  onDocumentUploaded: (documentInfo: any) => void
}

interface UploadedDocument {
  document_id: string
  file_name: string
  chunk_count: number
  upload_time: Date
}

const PDFUpload: React.FC<PDFUploadProps> = ({ sessionId, apiKey, onDocumentUploaded }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const pdfFiles = files.filter(file => file.type === 'application/pdf')
    
    if (pdfFiles.length > 0) {
      handleFileUpload(pdfFiles[0])
    } else {
      setUploadError('Please upload a PDF file')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!sessionId || !apiKey) {
      setUploadError('Session ID and API key are required')
      return
    }

    if (file.type !== 'application/pdf') {
      setUploadError('Please select a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setUploadError('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey)

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Upload failed')
      }

      const data = await response.json()
      
      const newDocument: UploadedDocument = {
        document_id: data.document_id,
        file_name: data.file_name,
        chunk_count: data.chunk_count,
        upload_time: new Date()
      }

      setUploadedDocuments(prev => [newDocument, ...prev])
      setUploadSuccess(`PDF "${data.file_name}" uploaded and processed successfully! ${data.chunk_count} chunks created.`)
      
      // Notify parent component
      onDocumentUploaded(newDocument)

      // Clear success message after 5 seconds
      setTimeout(() => setUploadSuccess(null), 5000)

    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const removeDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.document_id !== documentId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="pdf-upload-container">
      <div className="pdf-upload-header">
        <FileText size={20} />
        <h3>PDF Upload & RAG</h3>
      </div>

      <div 
        className={`pdf-upload-area ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="upload-status">
            <Loader className="spinning" size={24} />
            <p>Processing PDF...</p>
            <p className="upload-hint">This may take a few moments</p>
          </div>
        ) : (
          <div className="upload-content">
            <Upload size={32} />
            <p className="upload-text">Drop your PDF here or click to browse</p>
            <p className="upload-hint">Max file size: 10MB</p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="upload-message error">
          <AlertCircle size={16} />
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="upload-message success">
          <CheckCircle size={16} />
          <span>{uploadSuccess}</span>
          <button onClick={() => setUploadSuccess(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {uploadedDocuments.length > 0 && (
        <div className="uploaded-documents">
          <h4>Uploaded Documents</h4>
          <div className="documents-list">
            {uploadedDocuments.map((doc) => (
              <div key={doc.document_id} className="document-item">
                <div className="document-info">
                  <FileText size={16} />
                  <div className="document-details">
                    <div className="document-name">{doc.file_name}</div>
                    <div className="document-meta">
                      {doc.chunk_count} chunks • {doc.upload_time.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button 
                  className="remove-document-btn"
                  onClick={() => removeDocument(doc.document_id)}
                  title="Remove document"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadedDocuments.length > 0 && (
        <div className="rag-info">
          <div className="info-icon">ℹ️</div>
          <div className="info-text">
            You can now ask questions about your uploaded PDF documents. The AI will only use information from these documents to answer your questions.
          </div>
        </div>
      )}
    </div>
  )
}

export default PDFUpload
