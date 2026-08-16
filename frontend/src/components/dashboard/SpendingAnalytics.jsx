export default function SpendingAnalytics({ analytics, loading }) {
  if (loading && !analytics) {
    return (
      <div style={{ marginBottom: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Calculating spending statistics...
      </div>
    )
  }

  if (!analytics || analytics.invoice_count === 0) {
    return null
  }

  const {
    total_spend,
    invoice_count,
    average_invoice_amount,
    vendor_count,
    top_category_name,
    top_category_spend,
    top_category_share,
    top_vendor_name,
    top_vendor_spend,
    top_vendors = [],
    category_breakdown = [],
    monthly_trend = [],
    largest_invoice,
  } = analytics

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* 4 Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem',
      }}>
        {/* Card 1: Total Spend */}
        <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Expenditure
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.375rem' }}>
            ${total_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Across {invoice_count} {invoice_count === 1 ? 'invoice' : 'invoices'}
          </p>
        </div>

        {/* Card 2: Top Category */}
        <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Expense Category
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {top_category_name || 'None'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            ${top_category_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({top_category_share}%)
          </p>
        </div>

        {/* Card 3: Top Vendor */}
        <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Highest Paid Vendor
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {top_vendor_name || 'None'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            ${top_vendor_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Card 4: Average Invoice */}
        <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Avg Invoice Size
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.375rem' }}>
            ${average_invoice_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {vendor_count} distinct {vendor_count === 1 ? 'vendor' : 'vendors'}
          </p>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Panel 1: Top Vendors by Spend */}
        <div className="wb-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Top Vendors by Spending
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top {top_vendors.length}</span>
          </div>

          {top_vendors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {top_vendors.map((vendor, idx) => (
                <div key={vendor.vendor_name || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>#{idx + 1}</span>
                      {vendor.vendor_name}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      ${vendor.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.375rem', fontSize: '0.75rem' }}>
                        ({vendor.spend_percentage}%)
                      </span>
                    </span>
                  </div>
                  {/* Share Progress Bar */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(2, vendor.spend_percentage))}%`,
                      height: '100%',
                      backgroundColor: 'var(--text-primary)',
                      borderRadius: '3px',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No vendor statistics available yet.
            </p>
          )}
        </div>

        {/* Panel 2: Product Category Spending Breakdown */}
        <div className="wb-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Category Spending Breakdown
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{category_breakdown.length} categories</span>
          </div>

          {category_breakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '280px', overflowY: 'auto' }}>
              {category_breakdown.map((cat, idx) => (
                <div key={cat.category_name || idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>
                      {cat.category_name}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.375rem' }}>
                        ({cat.item_count} items)
                      </span>
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      ${cat.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.375rem', fontSize: '0.75rem' }}>
                        ({cat.spend_percentage}%)
                      </span>
                    </span>
                  </div>
                  {/* Category Progress Bar */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(2, cat.spend_percentage))}%`,
                      height: '100%',
                      backgroundColor: 'var(--text-secondary)',
                      borderRadius: '3px',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No categorized line items available yet.
            </p>
          )}
        </div>

        {/* Panel 3: Monthly Spend Trend & Highlights */}
        {monthly_trend.length > 0 && (
          <div className="wb-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Monthly Outflow Timeline
              </h3>
              {largest_invoice && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Largest Invoice: <strong>${largest_invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> ({largest_invoice.vendor_name})
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              {monthly_trend.map((m) => (
                <div key={m.month} style={{
                  padding: '0.875rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{m.month}</p>
                  <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    ${m.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    {m.invoice_count} {m.invoice_count === 1 ? 'invoice' : 'invoices'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
