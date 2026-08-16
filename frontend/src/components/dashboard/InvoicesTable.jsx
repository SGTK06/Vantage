export default function InvoicesTable({ invoices, onSelectInvoice }) {
  if (!invoices || invoices.length === 0) {
    return null
  }

  return (
    <div className="wb-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="wb-table">
          <thead>
            <tr>
              <th>Supplier / Vendor</th>
              <th>Invoice #</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th>Line Items</th>
              <th style={{ textAlign: 'right' }}>Total Amount</th>
              <th style={{ textAlign: 'center' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="wb-table-row"
                onClick={() => onSelectInvoice(inv)}
              >
                <td style={{ fontWeight: 500 }}>
                  {inv.vendors?.name || inv.supplier_name || '—'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                  {inv.invoice_number}
                </td>
                <td>{inv.invoice_date || '—'}</td>
                <td>{inv.due_date || '—'}</td>
                <td>
                  <span className="wb-badge">
                    {inv.line_items ? `${inv.line_items.length} items` : '0 items'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {inv.currency || 'USD'} {parseFloat(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectInvoice(inv)
                    }}
                    className="wb-button-ghost"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
