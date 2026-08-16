import { useState } from 'react'

/**
 * Clean Minimalist Line Graph Component (SVG-based)
 * Renders monthly timeline expenses with data points, grid lines, and interactive tooltips.
 */
export function TimelineLineChart({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        No timeline data available.
      </div>
    )
  }

  const width = 600
  const height = 210
  const padding = { top: 25, right: 35, bottom: 35, left: 55 }

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxVal = Math.max(...data.map((d) => d.total_spend || 0), 10)
  const minVal = 0

  const getY = (val) => {
    return padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight
  }

  const getX = (idx) => {
    if (data.length === 1) return padding.left + chartWidth / 2
    return padding.left + (idx / (data.length - 1)) * chartWidth
  }

  const points = data.map((d, i) => `${getX(i)},${getY(d.total_spend || 0)}`).join(' ')
  
  // Area fill under line
  const areaPoints = data.length > 1
    ? `${points} ${getX(data.length - 1)},${padding.top + chartHeight} ${getX(0)},${padding.top + chartHeight}`
    : ''

  // Y-axis grid marks
  const yTicks = [0, maxVal * 0.5, maxVal]

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        {/* Horizontal Grid lines */}
        {yTicks.map((tickVal, i) => {
          const yPos = getY(tickVal)
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={width - padding.right}
                y2={yPos}
                stroke="var(--border-subtle)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={yPos + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >
                ${Math.round(tickVal).toLocaleString()}
              </text>
            </g>
          )
        })}

        {/* Gradient fill area under the line */}
        {areaPoints && (
          <>
            <defs>
              <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text-primary)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="var(--text-primary)" stopOpacity="0.00" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#lineAreaGradient)" />
          </>
        )}

        {/* The line itself */}
        {data.length > 1 ? (
          <polyline
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        ) : (
          <line
            x1={padding.left}
            y1={getY(data[0].total_spend || 0)}
            x2={width - padding.right}
            y2={getY(data[0].total_spend || 0)}
            stroke="var(--text-primary)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        )}

        {/* Data points and X labels */}
        {data.map((d, i) => {
          const cx = getX(i)
          const cy = getY(d.total_spend || 0)
          const isHovered = hoveredPoint === i

          return (
            <g key={i}>
              {/* X label */}
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-secondary)"
                fontFamily="var(--font-mono)"
              >
                {d.month}
              </text>

              {/* Hover trigger zone */}
              <circle
                cx={cx}
                cy={cy}
                r="14"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* Data circle point */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : 4}
                fill="var(--surface)"
                stroke="var(--text-primary)"
                strokeWidth="2"
                style={{ transition: 'r 0.15s ease' }}
              />

              {/* Tooltip on hover */}
              {isHovered && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={cx - 50}
                    y={cy - 38}
                    width="100"
                    height="28"
                    rx="4"
                    fill="var(--accent)"
                  />
                  <text
                    x={cx}
                    y={cy - 20}
                    textAnchor="middle"
                    fill="var(--accent-contrast)"
                    fontSize="10.5"
                    fontWeight="600"
                  >
                    ${d.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * Standardized High-Legibility Horizontal Bar Chart Component
 * Standardizes scale against total budget / max benchmark, with clear baseline axis and prominent labels.
 */
export function HorizontalBarChart({
  data = [],
  labelKey = 'name',
  valueKey = 'total_spend',
  percentageKey = 'spend_percentage',
  maxScale = null, // Standardized max scale (e.g. total spend or benchmark)
  scaleLabel = '% of total expenditure',
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        No breakdown data available.
      </div>
    )
  }

  // Standardized ceiling: either user-provided maxScale (e.g., total spend) or highest element
  const ceiling = maxScale && maxScale > 0
    ? maxScale
    : Math.max(...data.map((d) => d[valueKey] || 0), 1)

  return (
    <div>
      {/* Standardized Scale Axis Header (0% -> 25% -> 50% -> 75% -> 100%) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingBottom: '0.5rem',
        marginBottom: '0.75rem',
        borderBottom: '1px dashed var(--border)',
        fontSize: '0.6875rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100% {scaleLabel ? `(${scaleLabel})` : ''}</span>
      </div>

      {/* Bar items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data.map((item, idx) => {
          const val = item[valueKey] || 0
          const percentage = item[percentageKey] !== undefined
            ? item[percentageKey]
            : Math.round((val / ceiling) * 100)
          
          // Width standardized to 0-100% of the total budget / max scale
          const barWidth = Math.min(100, Math.max(1.5, (val / ceiling) * 100))
          const isHovered = hoveredIndex === idx

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                padding: '0.5rem 0.625rem',
                borderRadius: '6px',
                backgroundColor: isHovered ? 'var(--surface-hover)' : 'transparent',
                border: isHovered ? '1px solid var(--border)' : '1px solid transparent',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Row Top: Label and Amount */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '0.45rem',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--surface-active)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    #{idx + 1}
                  </span>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item[labelKey]}
                  </span>
                  {item.invoice_count !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • {item.invoice_count} {item.invoice_count === 1 ? 'invoice' : 'invoices'}
                    </span>
                  )}
                  {item.item_count !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • {item.item_count} {item.item_count === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>

                {/* Amount and Percentage Value */}
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginLeft: '0.4rem',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    ({percentage}%)
                  </span>
                </div>
              </div>

              {/* Standardized Bar Track & Fill */}
              <div style={{
                width: '100%',
                height: '10px',
                backgroundColor: 'var(--border-subtle)',
                borderRadius: '5px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* 25%, 50%, 75% tick indicators inside the track */}
                <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />
                <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />

                {/* Bar Fill */}
                <div style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  backgroundColor: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderRadius: '5px',
                  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
