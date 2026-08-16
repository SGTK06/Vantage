import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      if (isSignup) {
        const res = await signup(email, password)
        if (res.access_token) {
          navigate('/dashboard')
        } else {
          setNotice(res.message || 'Signup successful. Please verify your account.')
        }
      } else {
        await login(email, password)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-info" aria-labelledby="auth-info-heading">
          <p className="auth-brand">Vantage</p>
          <h1 id="auth-info-heading" className="auth-heading">See the story behind your spending.</h1>
          <p className="auth-description">
            Vantage helps small and growing businesses turn PDF invoices into clear,
            actionable spending insights.
          </p>
          <ul className="auth-features" aria-label="What Vantage helps you do">
            <li>Upload invoices and keep them in one place</li>
            <li>See spending organized by category and vendor</li>
            <li>Ask questions about your business spending in plain language</li>
          </ul>
        </section>

        <div className="wb-card auth-card" role="dialog" aria-labelledby="auth-dialog-heading">
          <div className="auth-dialog-header">
            <h2 id="auth-dialog-heading" className="wb-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="wb-subtitle">
              {isSignup ? 'Get started with Vantage.' : 'Log in to continue to your workspace.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </label>
            <input
              className="wb-input"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              className="wb-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className="wb-alert-error">{error}</div>}
          {notice && <div className="wb-alert-success">{notice}</div>}

          <button type="submit" className="wb-button-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup)
              setError(null)
              setNotice(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}
