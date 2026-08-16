import { useRef } from 'react'

export default function UploadInvoiceModal({
  isOpen,
  file,
  isDragging,
  isParsing,
  errorMessage,
  onClose,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onParse,
}) {
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>Upload Invoice</h2>
            <p className="wb-subtitle">
              Upload your invoice PDF to extract structured data via LlamaParse OCR and auto-categorize with Google AI.
            </p>
          </div>
          <button type="button" onClick={onClose} className="wb-button-ghost">
            Cancel
          </button>
        </div>

        <div
          className={`wb-dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ marginBottom: '1.25rem' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => onFileSelect(e.target.files[0])}
          />
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {file ? (
              <div>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {file.name}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB • Click to choose another file
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

        <button
          type="button"
          onClick={onParse}
          disabled={!file || isParsing}
          className="wb-button-primary"
          style={{ width: '100%' }}
        >
          {isParsing ? 'Running OCR & AI Categorization...' : 'Parse & Categorize Invoice'}
        </button>
      </div>
    </div>
  )
}
