export default function Header({ user, onSignOut }) {
  return (
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
        <button type="button" onClick={onSignOut} className="wb-button-ghost">
          Sign out
        </button>
      </div>
    </header>
  )
}
