import { useRef } from 'react'

export default function EmptyState({
  file,
  isDragging,
  isParsing,
  errorMessage,
  status,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onParse,
}) {
  const fileInputRef = useRef(null)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="wb-card" style={{ width: '100%', maxWidth: '520px', padding: '2.25rem' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className="wb-title">Upload First Invoice</h1>
          <p className="wb-subtitle">
            Upload your invoice PDF to extract structured data via LlamaParse OCR and auto-categorize with Google AI.
          </p>
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

        {status && (
          <div className="wb-alert-success" style={{ marginBottom: '1.25rem' }}>
            {status}
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
