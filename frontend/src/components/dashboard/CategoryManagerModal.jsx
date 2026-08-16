import { useState } from 'react'

export default function CategoryManagerModal({
  isOpen,
  categories,
  onClose,
  onCreateCategory,
}) {
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const created = await onCreateCategory(newCatName.trim(), newCatDesc.trim())
      setSuccess(`Category "${created.name}" created with embedding.`)
      setNewCatName('')
      setNewCatDesc('')
    } catch (err) {
      setError(err.message || 'Failed to create category.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>Product Categories</h2>
            <p className="wb-subtitle">Manage product categories and vector embeddings for AI item classification.</p>
          </div>
          <button type="button" onClick={onClose} className="wb-button-ghost">
            Close
          </button>
        </div>

        {/* Add category form */}
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface-hover)', padding: '1.25rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Add New Category</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              className="wb-input"
              placeholder="Category Name (e.g. Office Equipment, Raw Materials)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <input
              className="wb-input"
              placeholder="Brief description (optional, helps improve embedding matching)"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
            />
            {error && <div className="wb-alert-error">{error}</div>}
            {success && <div className="wb-alert-success">{success}</div>}
            <button
              type="submit"
              disabled={isCreating || !newCatName.trim()}
              className="wb-button-primary"
              style={{ width: 'auto', alignSelf: 'flex-start' }}
            >
              {isCreating ? 'Generating Embedding...' : '+ Add Category'}
            </button>
          </div>
        </form>

        {/* Existing categories list */}
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Existing Categories ({categories.length})
          </h3>
          {categories.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {categories.map((c) => (
                <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', background: 'var(--surface)', fontSize: '0.8125rem' }}>
                  <strong>{c.name}</strong>
                  {c.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{c.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No categories created yet. Categories will be created automatically when you parse an invoice using Gemma LLM.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
