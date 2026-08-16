export default function VerificationModal({
  isOpen,
  file,
  parsedData,
  categories,
  isSaving,
  errorMessage,
  onReset,
  onFieldChange,
  onLineItemChange,
  onLineItemCategoryChange,
  onAddLineItem,
  onRemoveLineItem,
  onConfirmAndSave,
}) {
  if (!isOpen || !parsedData) return null

  return (
    <div className="wb-modal-overlay" onClick={onReset}>
      <div className="wb-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>Verify Extracted Invoice</h2>
            <p className="wb-subtitle">
              Review invoice details and AI-classified product categories from <strong>{file?.name}</strong>.
            </p>
          </div>
          <button type="button" onClick={onReset} className="wb-button-ghost">
            Discard
          </button>
        </div>

        {errorMessage && (
          <div className="wb-alert-error" style={{ marginBottom: '1.25rem' }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Supplier / Vendor Name
            </label>
            <input
              className="wb-input"
              value={parsedData.supplier_name || ''}
              onChange={(e) => onFieldChange('supplier_name', e.target.value)}
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Invoice Number
            </label>
            <input
              className="wb-input"
              value={parsedData.invoice_number || ''}
              onChange={(e) => onFieldChange('invoice_number', e.target.value)}
              placeholder="e.g. INV-2026-001"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Customer Name
            </label>
            <input
              className="wb-input"
              value={parsedData.customer_name || ''}
              onChange={(e) => onFieldChange('customer_name', e.target.value)}
              placeholder="e.g. Customer Inc"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Invoice Date
            </label>
            <input
              className="wb-input"
              type="date"
              value={parsedData.invoice_date || ''}
              onChange={(e) => onFieldChange('invoice_date', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Due Date
            </label>
            <input
              className="wb-input"
              type="date"
              value={parsedData.due_date || ''}
              onChange={(e) => onFieldChange('due_date', e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Currency
            </label>
            <input
              className="wb-input"
              value={parsedData.currency || 'USD'}
              onChange={(e) => onFieldChange('currency', e.target.value)}
              placeholder="USD, EUR, MYR..."
            />
          </div>
        </div>

        {/* Line Items Section with Categories */}
        <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Line Items & AI Categorization
            </h3>
            <button onClick={onAddLineItem} type="button" className="wb-button-ghost" style={{ fontSize: '0.75rem' }}>
              + Add Item
            </button>
          </div>

          {parsedData.line_items && parsedData.line_items.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Description</th>
                    <th style={{ padding: '0.5rem', width: '170px', color: 'var(--text-secondary)' }}>AI Category</th>
                    <th style={{ padding: '0.5rem', width: '70px', color: 'var(--text-secondary)' }}>Qty</th>
                    <th style={{ padding: '0.5rem', width: '90px', color: 'var(--text-secondary)' }}>Unit Price</th>
                    <th style={{ padding: '0.5rem', width: '90px', color: 'var(--text-secondary)' }}>Total</th>
                    <th style={{ padding: '0.5rem', width: '30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.line_items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.375rem' }}>
                        <input
                          className="wb-input"
                          value={item.description || ''}
                          onChange={(e) => onLineItemChange(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '0.375rem' }}>
                        <input
                          className="wb-input"
                          list={`categories-list-${idx}`}
                          value={item.category_name || ''}
                          onChange={(e) => onLineItemCategoryChange(idx, e.target.value)}
                          placeholder="Type or select category"
                        />
                        <datalist id={`categories-list-${idx}`}>
                          {categories.map((c) => (
                            <option key={c.id} value={c.name} />
                          ))}
                        </datalist>
                      </td>
                      <td style={{ padding: '0.375rem' }}>
                        <input
                          className="wb-input"
                          type="number"
                          step="any"
                          value={item.quantity !== null && item.quantity !== undefined ? item.quantity : ''}
                          onChange={(e) => onLineItemChange(idx, 'quantity', parseFloat(e.target.value) || null)}
                        />
                      </td>
                      <td style={{ padding: '0.375rem' }}>
                        <input
                          className="wb-input"
                          type="number"
                          step="any"
                          value={item.unit_cost !== null && item.unit_cost !== undefined ? item.unit_cost : ''}
                          onChange={(e) => onLineItemChange(idx, 'unit_cost', parseFloat(e.target.value) || null)}
                        />
                      </td>
                      <td style={{ padding: '0.375rem' }}>
                        <input
                          className="wb-input"
                          type="number"
                          step="any"
                          value={item.total_cost !== null && item.total_cost !== undefined ? item.total_cost : ''}
                          onChange={(e) => onLineItemChange(idx, 'total_cost', parseFloat(e.target.value) || null)}
                        />
                      </td>
                      <td style={{ padding: '0.375rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onRemoveLineItem(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '1rem' }}
                          title="Delete row"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No line items extracted. Click "+ Add Item" if you wish to record individual items.
            </p>
          )}
        </div>

        {/* Totals Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Subtotal
            </label>
            <input
              className="wb-input"
              type="number"
              step="any"
              value={parsedData.subtotal !== null && parsedData.subtotal !== undefined ? parsedData.subtotal : ''}
              onChange={(e) => onFieldChange('subtotal', parseFloat(e.target.value) || null)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Tax Amount
            </label>
            <input
              className="wb-input"
              type="number"
              step="any"
              value={parsedData.tax_amount !== null && parsedData.tax_amount !== undefined ? parsedData.tax_amount : ''}
              onChange={(e) => onFieldChange('tax_amount', parseFloat(e.target.value) || null)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
              Discount Amount
            </label>
            <input
              className="wb-input"
              type="number"
              step="any"
              value={parsedData.discount_amount !== null && parsedData.discount_amount !== undefined ? parsedData.discount_amount : ''}
              onChange={(e) => onFieldChange('discount_amount', parseFloat(e.target.value) || null)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
              Total Amount (Required)
            </label>
            <input
              className="wb-input"
              type="number"
              step="any"
              style={{ fontWeight: 600 }}
              value={parsedData.total_amount !== null && parsedData.total_amount !== undefined ? parsedData.total_amount : ''}
              onChange={(e) => onFieldChange('total_amount', parseFloat(e.target.value) || 0)}
              required
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onConfirmAndSave}
          disabled={isSaving || !parsedData.total_amount || !parsedData.supplier_name || !parsedData.invoice_number}
          className="wb-button-primary"
          style={{ width: '100%' }}
        >
          {isSaving ? 'Saving to Database & Storage...' : 'Confirm & Save to Supabase'}
        </button>
      </div>
    </div>
  )
}
