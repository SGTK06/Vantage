import { TimelineLineChart, HorizontalBarChart } from './SpendingCharts'

const formatMoney = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`

export default function SpendingAnalytics({ analytics, loading }) {
  if (loading && !analytics) {
    return (
      <div className="analytics-loading" role="status">
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
    active_categories_count,
    top_category_name,
    top_category_spend,
    top_category_share,
    top_vendor_name,
    top_vendor_spend,
    total_tax_paid,
    total_discount_received,
    top_vendors = [],
    category_breakdown = [],
    monthly_trend = [],
    largest_invoice,
  } = analytics

  return (
    <section className="analytics-shell" aria-labelledby="analytics-heading">
      <div className="analytics-section-heading">
        <div>
          <h2 id="analytics-heading">At a glance</h2>
          <p>Your spending picture, based on {invoice_count} recorded {invoice_count === 1 ? 'invoice' : 'invoices'}.</p>
        </div>
      </div>

      <div className="analytics-overview">
        <div className="analytics-total">
          <span className="analytics-label">Total spend</span>
          <strong>{formatMoney(total_spend)}</strong>
          <span className="analytics-supporting">Across all recorded invoices</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-label">Invoices</span>
          <strong>{invoice_count}</strong>
          <span className="analytics-supporting">{vendor_count} {vendor_count === 1 ? 'vendor' : 'vendors'}</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-label">Average invoice</span>
          <strong>{formatMoney(average_invoice_amount)}</strong>
          <span className="analytics-supporting">Per recorded invoice</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-label">Active categories</span>
          <strong>{active_categories_count}</strong>
          <span className="analytics-supporting">With categorized line items</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-label">Tax paid</span>
          <strong>{formatMoney(total_tax_paid)}</strong>
          <span className="analytics-supporting">Included in total spend</span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-label">Discounts received</span>
          <strong>{formatMoney(total_discount_received)}</strong>
          <span className="analytics-supporting">Recorded savings</span>
        </div>
      </div>

      <div className="analytics-insights">
        <div className="analytics-insight">
          <span className="analytics-label">Top category</span>
          <strong>{top_category_name || 'None yet'}</strong>
          <span className="analytics-supporting">{formatMoney(top_category_spend)} · {top_category_share}% of categorized spend</span>
        </div>
        <div className="analytics-insight">
          <span className="analytics-label">Top vendor</span>
          <strong>{top_vendor_name || 'None yet'}</strong>
          <span className="analytics-supporting">{formatMoney(top_vendor_spend)} total spend</span>
        </div>
        <div className="analytics-insight">
          <span className="analytics-label">Largest invoice</span>
          <strong>{largest_invoice ? formatMoney(largest_invoice.amount) : 'None yet'}</strong>
          <span className="analytics-supporting">{largest_invoice ? `${largest_invoice.vendor_name} · ${largest_invoice.invoice_number}` : 'Upload an invoice to see it here'}</span>
        </div>
      </div>

      <div className="analytics-chart-grid">
        <div className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>Where your money goes</h3>
              <p>Top vendors ranked by total spend.</p>
            </div>
            <span>{top_vendors.length} shown</span>
          </div>
          <HorizontalBarChart
            data={top_vendors}
            labelKey="vendor_name"
            valueKey="total_spend"
            percentageKey="spend_percentage"
            maxScale={total_spend}
            scaleLabel="spend"
          />
        </div>

        <div className="analytics-panel">
          <div className="analytics-panel-heading">
            <div>
              <h3>What you spend on</h3>
              <p>Line items grouped by category.</p>
            </div>
            <span>{category_breakdown.length} categories</span>
          </div>
          <HorizontalBarChart
            data={category_breakdown}
            labelKey="category_name"
            valueKey="total_spend"
            percentageKey="spend_percentage"
            maxScale={total_spend}
            scaleLabel="spend"
          />
        </div>

        {monthly_trend.length > 0 && (
          <div className="analytics-panel analytics-trend-panel">
            <div className="analytics-panel-heading">
              <div>
                <h3>Monthly spending</h3>
                <p>Track how your expenditure changes over time.</p>
              </div>
              <span>{monthly_trend.length} months</span>
            </div>
            <TimelineLineChart data={monthly_trend} />
          </div>
        )}
      </div>
    </section>
  )
}
