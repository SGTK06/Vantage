import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiParseInvoice, apiConfirmInvoice, apiGetInvoices } from '../lib/api.js'

export default function Dashboard() {
  const { user, logout } = useAuth()

  // Invoices list state
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Upload & OCR states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Dedicated file input refs for empty state vs modal to prevent stale/unattached DOM ref issues
  const emptyFileInputRef = useRef(null)
  const modalFileInputRef = useRef(null)

  // Verification state
  const [parsedData, setParsedData] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Feedback states
  const [status, setStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true)
      const data = await apiGetInvoices()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setLoadingInvoices(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file.')
      setFile(null)
      return
    }
    setErrorMessage(null)
    setStatus(null)
    setParsedData(null)
    setFile(selectedFile)
  }

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setStatus(null)
    setErrorMessage(null)

    try {
      const data = await apiParseInvoice(file)
      setParsedData(data)
    } catch (err) {
      setErrorMessage(err.message || 'OCR parsing failed.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleFieldChange = (field, value) => {
    setParsedData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLineItemChange = (index, field, value) => {
    setParsedData((prev) => {
      const updatedItems = [...(prev.line_items || [])]
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      }
      return {
        ...prev,
        line_items: updatedItems,
      }
    })
  }

  const handleAddLineItem = () => {
    setParsedData((prev) => ({
      ...prev,
      line_items: [
        ...(prev.line_items || []),
        { description: '', quantity: 1, unit_cost: 0, total_cost: 0 },
      ],
    }))
  }

  const handleRemoveLineItem = (index) => {
    setParsedData((prev) => ({
      ...prev,
      line_items: (prev.line_items || []).filter((_, idx) => idx !== index),
    }))
  }

  const handleConfirmAndSave = async () => {
    if (!file || !parsedData) return
    setIsSaving(true)
    setStatus(null)
    setErrorMessage(null)

    try {
      await apiConfirmInvoice(file, parsedData)
      setStatus('Invoice and extracted data saved successfully.')
      setParsedData(null)
      setFile(null)
      setIsUploadModalOpen(false)
      if (emptyFileInputRef.current) emptyFileInputRef.current.value = ''
      if (modalFileInputRef.current) modalFileInputRef.current.value = ''
      await fetchInvoices()
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save confirmed invoice.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenUploadModal = () => {
    setFile(null)
    setParsedData(null)
    setErrorMessage(null)
    setStatus(null)
    if (modalFileInputRef.current) modalFileInputRef.current.value = ''
    setIsUploadModalOpen(true)
  }

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false)
    setFile(null)
    setParsedData(null)
    setErrorMessage(null)
    setStatus(null)
    if (modalFileInputRef.current) modalFileInputRef.current.value = ''
  }

  const handleReset = () => {
    setFile(null)
    setParsedData(null)
    setStatus(null)
    setErrorMessage(null)
    if (emptyFileInputRef.current) emptyFileInputRef.current.value = ''
    if (modalFileInputRef.current) modalFileInputRef.current.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const totalSpend = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0.875rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.02em' }}>Vantage</span>
          <span style={{ color: 'var(--border)', fontSize: '0.875rem' }}>/</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{user?.email}</span>
          <button onClick={logout} className="wb-button-ghost">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: '2rem',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
      }}>
        {loadingInvoices ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <p>Loading invoices...</p>
          </div>
        ) : invoices.length === 0 && !isUploadModalOpen ? (
          /* Empty State: Prompt for the first upload */
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="wb-card" style={{ width: '100%', maxWidth: '520px', padding: '2.25rem' }}>
              <div style={{ marginBottom: '1.75rem' }}>
                <h1 className="wb-title">Upload First Invoice</h1>
                <p className="wb-subtitle">Upload your invoice PDF to extract structured data via LlamaParse OCR.</p>
              </div>

              <div
                className={`wb-dropzone ${isDragging ? 'active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => emptyFileInputRef.current?.click()}
                style={{ marginBottom: '1.25rem' }}
              >
                <input
                  ref={emptyFileInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
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
                onClick={handleParse}
                disabled={!file || isParsing}
                className="wb-button-primary"
                style={{ width: '100%' }}
              >
                {isParsing ? 'Running OCR Extraction...' : 'Parse Invoice'}
              </button>
            </div>
          </div>
        ) : (
          /* Formal Minimalist Dashboard View */
          <div>
            {/* Dashboard Controls & KPI Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 className="wb-title">Invoices</h1>
                <p className="wb-subtitle">Overview of parsed and recorded vendor invoices.</p>
              </div>
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className="wb-button-primary"
                style={{ width: 'auto' }}
              >
                + Upload Invoice
              </button>
            </div>

            {/* Metrics Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Invoices
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                  {invoices.length}
                </p>
              </div>

              <div className="wb-card" style={{ padding: '1.25rem 1.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Recorded Amount
                </p>
                <p style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
                  ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Invoices Data Table */}
            <div className="wb-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="wb-table">
                  <thead>
                    <tr>
                      <th>Supplier</th>
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
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td style={{ fontWeight: 500 }}>{inv.supplier_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{inv.invoice_number}</td>
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
                              setSelectedInvoice(inv)
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
          </div>
        )}

        {/* Upload & Verification Modal / Overlay */}
        {(isUploadModalOpen || parsedData) && (
          <div className="wb-modal-overlay" onClick={handleCloseUploadModal}>
            <div className="wb-modal-content" onClick={(e) => e.stopPropagation()}>
              {!parsedData ? (
                /* Step 1: Upload Modal */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>Upload Invoice</h2>
                      <p className="wb-subtitle">Upload your invoice PDF to extract structured data via LlamaParse OCR.</p>
                    </div>
                    <button type="button" onClick={handleCloseUploadModal} className="wb-button-ghost">
                      Cancel
                    </button>
                  </div>

                  <div
                    className={`wb-dropzone ${isDragging ? 'active' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => modalFileInputRef.current?.click()}
                    style={{ marginBottom: '1.25rem' }}
                  >
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileSelect(e.target.files[0])}
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
                    onClick={handleParse}
                    disabled={!file || isParsing}
                    className="wb-button-primary"
                    style={{ width: '100%' }}
                  >
                    {isParsing ? 'Running OCR Extraction...' : 'Parse Invoice'}
                  </button>
                </div>
              ) : (
                /* Step 2: Verification Modal */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>Verify Extracted Invoice</h2>
                      <p className="wb-subtitle">Review and verify the data extracted from <strong>{file?.name}</strong>.</p>
                    </div>
                    <button type="button" onClick={handleReset} className="wb-button-ghost">
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
                        Supplier Name
                      </label>
                      <input
                        className="wb-input"
                        value={parsedData.supplier_name || ''}
                        onChange={(e) => handleFieldChange('supplier_name', e.target.value)}
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
                        onChange={(e) => handleFieldChange('invoice_number', e.target.value)}
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
                        onChange={(e) => handleFieldChange('customer_name', e.target.value)}
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
                        onChange={(e) => handleFieldChange('invoice_date', e.target.value)}
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
                        onChange={(e) => handleFieldChange('due_date', e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                        Currency
                      </label>
                      <input
                        className="wb-input"
                        value={parsedData.currency || 'USD'}
                        onChange={(e) => handleFieldChange('currency', e.target.value)}
                        placeholder="USD, EUR, MYR..."
                      />
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Line Items</h3>
                      <button onClick={handleAddLineItem} type="button" className="wb-button-ghost" style={{ fontSize: '0.75rem' }}>
                        + Add Item
                      </button>
                    </div>

                    {parsedData.line_items && parsedData.line_items.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              <th style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Description</th>
                              <th style={{ padding: '0.5rem', width: '80px', color: 'var(--text-secondary)' }}>Qty</th>
                              <th style={{ padding: '0.5rem', width: '100px', color: 'var(--text-secondary)' }}>Unit Price</th>
                              <th style={{ padding: '0.5rem', width: '100px', color: 'var(--text-secondary)' }}>Total</th>
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
                                    onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: '0.375rem' }}>
                                  <input
                                    className="wb-input"
                                    type="number"
                                    step="any"
                                    value={item.quantity !== null && item.quantity !== undefined ? item.quantity : ''}
                                    onChange={(e) => handleLineItemChange(idx, 'quantity', parseFloat(e.target.value) || null)}
                                  />
                                </td>
                                <td style={{ padding: '0.375rem' }}>
                                  <input
                                    className="wb-input"
                                    type="number"
                                    step="any"
                                    value={item.unit_cost !== null && item.unit_cost !== undefined ? item.unit_cost : ''}
                                    onChange={(e) => handleLineItemChange(idx, 'unit_cost', parseFloat(e.target.value) || null)}
                                  />
                                </td>
                                <td style={{ padding: '0.375rem' }}>
                                  <input
                                    className="wb-input"
                                    type="number"
                                    step="any"
                                    value={item.total_cost !== null && item.total_cost !== undefined ? item.total_cost : ''}
                                    onChange={(e) => handleLineItemChange(idx, 'total_cost', parseFloat(e.target.value) || null)}
                                  />
                                </td>
                                <td style={{ padding: '0.375rem', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLineItem(idx)}
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
                        onChange={(e) => handleFieldChange('subtotal', parseFloat(e.target.value) || null)}
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
                        onChange={(e) => handleFieldChange('tax_amount', parseFloat(e.target.value) || null)}
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
                        onChange={(e) => handleFieldChange('discount_amount', parseFloat(e.target.value) || null)}
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
                        onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAndSave}
                    disabled={isSaving || !parsedData.total_amount || !parsedData.supplier_name || !parsedData.invoice_number}
                    className="wb-button-primary"
                    style={{ width: '100%' }}
                  >
                    {isSaving ? 'Saving to Database & Storage...' : 'Confirm & Save to Supabase'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice Details Inspector Modal */}
        {selectedInvoice && (
          <div className="wb-modal-overlay" onClick={() => setSelectedInvoice(null)}>
            <div className="wb-modal-content" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 className="wb-title" style={{ fontSize: '1.25rem' }}>{selectedInvoice.supplier_name}</h2>
                  <p className="wb-subtitle">Invoice #{selectedInvoice.invoice_number} • {selectedInvoice.invoice_date || 'No date'}</p>
                </div>
                <button type="button" onClick={() => setSelectedInvoice(null)} className="wb-button-ghost">
                  Close
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: 'var(--surface-hover)', padding: '1rem', borderRadius: '6px' }}>
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
                  Line Items ({selectedInvoice.line_items?.length || 0})
                </h3>
                {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 ? (
                  <table className="wb-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.line_items.map((li, idx) => (
                        <tr key={li.id || idx}>
                          <td style={{ color: 'var(--text-muted)', width: '40px' }}>{li.line_no || idx + 1}</td>
                          <td style={{ fontWeight: 500 }}>{li.description}</td>
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
        )}
      </main>
    </div>
  )
}