import { TimelineLineChart, HorizontalBarChart } from './SpendingCharts'

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

      {/* Analytics Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Chart 1: Top Vendors by Spend (Standardized 0-100% Bar Chart) */}
        <div className="wb-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Top Vendors by Spend
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                Ranked expenditure distribution across suppliers
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top {top_vendors.length}</span>
          </div>

          <HorizontalBarChart
            data={top_vendors}
            labelKey="vendor_name"
            valueKey="total_spend"
            percentageKey="spend_percentage"
            maxScale={total_spend}
            scaleLabel="% of total spend"
          />
        </div>

        {/* Chart 2: Category Breakdown (Standardized 0-100% Bar Chart) */}
        <div className="wb-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Category Spend Distribution
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                Product categories classified by AI
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{category_breakdown.length} categories</span>
          </div>

          <HorizontalBarChart
            data={category_breakdown}
            labelKey="category_name"
            valueKey="total_spend"
            percentageKey="spend_percentage"
            maxScale={total_spend}
            scaleLabel="% of total spend"
          />
        </div>

        {/* Chart 3: Monthly Expenses Timeline (Line Graph) */}
        {monthly_trend.length > 0 && (
          <div className="wb-card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Expenses Timeline Trend
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  Chronological monthly expenditure curve
                </p>
              </div>
              {largest_invoice && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Largest Invoice: <strong>${largest_invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> ({largest_invoice.vendor_name})
                </span>
              )}
            </div>

            <TimelineLineChart data={monthly_trend} />
          </div>
        )}
      </div>
    </div>
  )
}
