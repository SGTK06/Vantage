export default function InvoiceDetailsModal({
  selectedInvoice,
  onClose,
}) {
  if (!selectedInvoice) return null

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>
              {selectedInvoice.vendors?.name || selectedInvoice.supplier_name || 'Vendor Details'}
            </h2>
            <p className="wb-subtitle">
              Invoice #{selectedInvoice.invoice_number} • {selectedInvoice.invoice_date || 'No date'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="wb-button-ghost">
            Close
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: 'var(--surface-hover)',
          padding: '1rem',
          borderRadius: '6px',
        }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Customer</p>
            <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{selectedInvoice.customer_name || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due Date</p>
            <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{selectedInvoice.due_date || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Currency</p>
            <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{selectedInvoice.currency || 'USD'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Original File</p>
            <p style={{ fontWeight: 500, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>{selectedInvoice.file_name}</p>
          </div>
        </div>

        {/* Line Items list in inspector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Line Items & Categories ({selectedInvoice.line_items?.length || 0})
          </h3>
          {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 ? (
            <table className="wb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.line_items.map((li, idx) => (
                  <tr key={li.id || idx}>
                    <td style={{ color: 'var(--text-muted)', width: '30px' }}>{li.line_no || idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{li.description}</td>
                    <td>
                      <span className="wb-badge">
                        {li.product_categories?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td>{li.quantity ?? '—'}</td>
                    <td>{li.unit_cost !== null ? `$${parseFloat(li.unit_cost).toFixed(2)}` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {li.total_cost !== null ? `$${parseFloat(li.total_cost).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No line items recorded for this invoice.
            </p>
          )}
        </div>

        {/* Financial summary */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '240px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span>${parseFloat(selectedInvoice.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
              <span>Tax:</span>
              <span>${parseFloat(selectedInvoice.tax_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              <span>Discount:</span>
              <span>-${parseFloat(selectedInvoice.discount_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
              <span>Total Amount:</span>
              <span>${parseFloat(selectedInvoice.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
