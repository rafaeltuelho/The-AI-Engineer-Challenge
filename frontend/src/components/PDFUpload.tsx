import React, { useState, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import './PDFUpload.css'

interface DocumentUploadProps {
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

const DocumentUpload: React.FC<DocumentUploadProps> = ({ sessionId, apiKey, onDocumentUploaded }) => {
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
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint'
    ]
    
    const supportedFiles = files.filter(file => supportedTypes.includes(file.type))
    
    if (supportedFiles.length > 0) {
      handleFileUpload(supportedFiles[0])
    } else {
      setUploadError('Please upload a PDF, Word, or PowerPoint file')
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

    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint'
    ]
    
    if (!supportedTypes.includes(file.type)) {
      setUploadError('Please select a PDF, Word, or PowerPoint file')
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

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        headers: {
          'X-Session-ID': sessionId,
          'X-API-Key': apiKey
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
      setUploadSuccess(`${data.file_type.toUpperCase()} document "${data.file_name}" uploaded and processed successfully! ${data.chunk_count} chunks created.`)
      
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


  return (
    <div className="pdf-upload-container">
      <div className="pdf-upload-header">
        <FileText size={20} />
        <h3>Document Upload & RAG</h3>
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
          accept=".pdf,.docx,.doc,.pptx,.ppt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="upload-status">
            <Loader className="spinning" size={24} />
            <p>Processing document...</p>
            <p className="upload-hint">This may take a few moments</p>
          </div>
        ) : (
          <div className="upload-content">
            <Upload size={32} />
            <p className="upload-text">Drop your document here or click to browse</p>
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
            You can now ask questions about your uploaded documents. The AI will only use information from these documents to answer your questions.
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentUpload
