import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiUploadInvoice } from '../lib/api.js'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.')
      setFile(null)
      return
    }
    setErrorMessage(null)
    setStatus(null)
    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setStatus(null)
    setErrorMessage(null)

    try {
      await apiUploadInvoice(file)
      setStatus('Invoice uploaded successfully.')
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setErrorMessage(err.message || 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal Top Header */}
      <header style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0.875rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.02em' }}>Vantage</span>
          <span style={{ color: 'var(--border)', fontSize: '0.875rem' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{user?.email}</span>
          <button onClick={logout} className="wb-button-ghost">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Dashboard Canvas */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div className="wb-card" style={{ width: '100%', maxWidth: '520px', padding: '2.25rem' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 className="wb-title">Upload Invoice</h1>
            <p className="wb-subtitle">Upload your invoice PDF to begin processing.</p>
          </div>

          <div
            className={`wb-dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginBottom: '1.25rem' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {file ? (
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {(file.size / 1024).toFixed(1)} KB • Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Drag and drop PDF invoice here
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    or click to browse from device
                  </p>
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="wb-alert-error" style={{ marginBottom: '1.25rem' }}>
              {errorMessage}
            </div>
          )}

          {status && (
            <div className="wb-alert-success" style={{ marginBottom: '1.25rem' }}>
              {status}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="wb-button-primary"
          >
            {isUploading ? 'Uploading...' : 'Upload Invoice'}
          </button>
        </div>
      </main>
    </div>
  )
}