import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  apiParseInvoice,
  apiConfirmInvoice,
  apiGetInvoices,
  apiGetCategories,
  apiCreateCategory,
  apiGetSpendingAnalytics,
} from '../lib/api.js'

import Header from '../components/dashboard/Header'
import EmptyState from '../components/dashboard/EmptyState'
import SpendingAnalytics from '../components/dashboard/SpendingAnalytics'
import InvoicesTable from '../components/dashboard/InvoicesTable'
import CategoryManagerModal from '../components/dashboard/CategoryManagerModal'
import UploadInvoiceModal from '../components/dashboard/UploadInvoiceModal'
import VerificationModal from '../components/dashboard/VerificationModal'
import InvoiceDetailsModal from '../components/dashboard/InvoiceDetailsModal'

export default function Dashboard() {
  const { user, logout } = useAuth()

  // Invoices & Analytics State
  const [invoices, setInvoices] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Categories State
  const [categories, setCategories] = useState([])
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Upload & Verification States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Feedback State
  const [status, setStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const fetchData = async () => {
    try {
      setLoadingInvoices(true)
      setLoadingAnalytics(true)
      const [invData, catData, analyticsData] = await Promise.all([
        apiGetInvoices(),
        apiGetCategories(),
        apiGetSpendingAnalytics(5),
      ])
      setInvoices(Array.isArray(invData) ? invData : [])
      setCategories(Array.isArray(catData) ? catData : [])
      setAnalytics(analyticsData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoadingInvoices(false)
      setLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    fetchData()
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
      const catData = await apiGetCategories()
      setCategories(Array.isArray(catData) ? catData : [])
    } catch (err) {
      setErrorMessage(err.message || 'OCR parsing or categorization failed.')
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

  const handleLineItemCategoryChange = (index, categoryName) => {
    const matched = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())
    setParsedData((prev) => {
      const updatedItems = [...(prev.line_items || [])]
      updatedItems[index] = {
        ...updatedItems[index],
        category_name: categoryName,
        category_id: matched ? matched.id : null,
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
        { description: '', quantity: 1, unit_cost: 0, total_cost: 0, category_name: 'General', category_id: null },
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
      await fetchData()
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save confirmed invoice.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateCategory = async (name, desc) => {
    const created = await apiCreateCategory(name, desc)
    const catData = await apiGetCategories()
    setCategories(Array.isArray(catData) ? catData : [])
    return created
  }

  const handleReset = () => {
    setFile(null)
    setParsedData(null)
    setStatus(null)
    setErrorMessage(null)
    setIsUploadModalOpen(false)
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Component */}
      <Header
        user={user}
        categoriesCount={categories.length}
        onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
        onSignOut={logout}
      />

      {/* 2. Main Content Area */}
      <main style={{
        flex: 1,
        padding: '2rem',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
      }}>
        {loadingInvoices ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <p>Loading invoices and spending metrics...</p>
          </div>
        ) : invoices.length === 0 && !isUploadModalOpen && !parsedData ? (
          /* Empty State Component */
          <EmptyState
            file={file}
            isDragging={isDragging}
            isParsing={isParsing}
            errorMessage={errorMessage}
            status={status}
            onFileSelect={handleFileSelect}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onParse={handleParse}
          />
        ) : (
          /* Formal Dashboard View */
          <div>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 className="wb-title">Spending Analytics & Invoices</h1>
                <p className="wb-subtitle">Live expense breakdown, category distribution, and recorded SME invoices.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setErrorMessage(null)
                  setStatus(null)
                  setIsUploadModalOpen(true)
                }}
                className="wb-button-primary"
                style={{ width: 'auto' }}
              >
                + Upload Invoice
              </button>
            </div>

            {/* 3. Server-Driven Spending Analytics Component */}
            <SpendingAnalytics analytics={analytics} loading={loadingAnalytics} />

            {/* Invoices List Header */}
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Recorded Invoices ({invoices.length})
              </h2>
            </div>

            {/* 4. Invoices Data Table Component */}
            <InvoicesTable
              invoices={invoices}
              onSelectInvoice={(inv) => setSelectedInvoice(inv)}
            />
          </div>
        )}

        {/* 5. Product Categories Manager Modal */}
        <CategoryManagerModal
          isOpen={isCategoryModalOpen}
          categories={categories}
          onClose={() => setIsCategoryModalOpen(false)}
          onCreateCategory={handleCreateCategory}
        />

        {/* 6. Upload Invoice Modal */}
        <UploadInvoiceModal
          isOpen={isUploadModalOpen && !parsedData}
          file={file}
          isDragging={isDragging}
          isParsing={isParsing}
          errorMessage={errorMessage}
          onClose={handleReset}
          onFileSelect={handleFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onParse={handleParse}
        />

        {/* 7. Verification Modal */}
        <VerificationModal
          isOpen={Boolean(parsedData)}
          file={file}
          parsedData={parsedData}
          categories={categories}
          isSaving={isSaving}
          errorMessage={errorMessage}
          onReset={handleReset}
          onFieldChange={handleFieldChange}
          onLineItemChange={handleLineItemChange}
          onLineItemCategoryChange={handleLineItemCategoryChange}
          onAddLineItem={handleAddLineItem}
          onRemoveLineItem={handleRemoveLineItem}
          onConfirmAndSave={handleConfirmAndSave}
        />

        {/* 8. Invoice Details Inspector Modal */}
        <InvoiceDetailsModal
          selectedInvoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      </main>
    </div>
  )
}