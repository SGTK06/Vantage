const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getStoredToken() {
  return localStorage.getItem('vantage_access_token')
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('vantage_access_token', token)
  } else {
    localStorage.removeItem('vantage_access_token')
  }
}

export function getStoredUser() {
  const user = localStorage.getItem('vantage_user')
  return user ? JSON.parse(user) : null
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem('vantage_user', JSON.stringify(user))
  } else {
    localStorage.removeItem('vantage_user')
  }
}

function getAuthHeaders() {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiSignUp(email, password) {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Signup failed')
  }
  return data
}

export async function apiSignIn(email, password) {
  const res = await fetch(`${API_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed')
  }
  return data
}

export async function apiGetMe() {
  const authHeaders = getAuthHeaders()
  if (!authHeaders.Authorization) {
    return null
  }
  const res = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: { ...authHeaders },
  })
  if (!res.ok) {
    throw new Error('Session invalid or expired')
  }
  return await res.json()
}

export async function apiParseInvoice(file) {
  const authHeaders = getAuthHeaders()
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/api/invoices/parse`, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to parse invoice with OCR')
  }

  return data
}

export async function apiConfirmInvoice(file, invoiceData) {
  const authHeaders = getAuthHeaders()
  const formData = new FormData()
  formData.append('file', file)
  formData.append('invoice_data_str', JSON.stringify(invoiceData))

  const res = await fetch(`${API_URL}/api/invoices/confirm`, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to save confirmed invoice')
  }

  return data
}

export async function apiGetInvoices() {
  const authHeaders = getAuthHeaders()

  const res = await fetch(`${API_URL}/api/invoices`, {
    method: 'GET',
    headers: {
      ...authHeaders,
    },
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to retrieve invoices')
  }

  return data.data || []
}

export async function apiGetCategories() {
  const authHeaders = getAuthHeaders()

  const res = await fetch(`${API_URL}/api/categories`, {
    method: 'GET',
    headers: {
      ...authHeaders,
    },
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to retrieve product categories')
  }

  return data || []
}

export async function apiCreateCategory(name, description = '') {
  const authHeaders = getAuthHeaders()

  const res = await fetch(`${API_URL}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ name, description }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to create product category')
  }

  return data
}

export async function apiGetSpendingAnalytics(topN = 5) {
  const authHeaders = getAuthHeaders()

  const res = await fetch(`${API_URL}/api/analytics/spending?top_n=${topN}`, {
    method: 'GET',
    headers: {
      ...authHeaders,
    },
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to fetch spending analytics')
  }

  return data
}

export async function apiAskAnalyticsAgent(question) {
  const res = await fetch(`${API_URL}/api/analytics/insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ question }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'The analyst could not answer right now')
  }

  return data.answer
}
