import React, { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { homeFor, login } from '../auth'
import { getSession } from '../session'

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg>
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
}

function BuildingIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>
}

export default function Login() {
  const session = getSession()
  const navigate = useNavigate()
  const location = useLocation()
  const isPlatformLogin = location.pathname === '/login/suser' || location.pathname === '/login/superuser'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tenantCode, setTenantCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = isPlatformLogin ? 'Tixelise | Platform admin login' : 'Tixelise | Log in'
  }, [isPlatformLogin])

  if (session?.access) return <Navigate to={homeFor(session.role)} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login({ username, password, tenantCode })
      navigate(homeFor(data.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-card">
      <section className="art-panel" aria-label="Tixelise event management illustration">
        <div className="brand">
          <img className="brand-logo" src="/assets/tixelise-logo-green.png" alt="Tixelise" />
        </div>
        <img src="/assets/Login_vector.png" alt="Event attendant holding a ticket scanner" />
      </section>

      <section className="form-panel">
        <div className="form-wrap">
          {/* Only shown once the art panel is hidden, so small screens keep the
              brand without carrying the illustration. */}
          <img className="mobile-brand" src="/assets/tixelise-logo-green.png" alt="Tixelise" />
          <div className="welcome-copy">
            <p className="eyebrow">WELCOME BACK</p>
            <h1>{isPlatformLogin ? 'Platform admin login' : 'Log in'}</h1>
            <p>
              {isPlatformLogin
                ? 'Sign in to manage tenants and platform settings.'
                : 'Sign in to manage your events, tickets, staff and more with Tixelise.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <p className="form-alert" role="alert">{error}</p>}

            <label className="input-shell">
              <span className="sr-only">Username</span>
              <MailIcon />
              <input
                type="text"
                placeholder="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label className="input-shell">
              <span className="sr-only">Password</span>
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button className="show-password" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <EyeIcon />
              </button>
            </label>

            {!isPlatformLogin && (
              <div className="tenant-field">
                <label className="input-shell">
                  <span className="sr-only">Tenant code</span>
                  <BuildingIcon />
                  <input
                    type="text"
                    placeholder="Tenant code (platform admins: leave empty)"
                    autoComplete="organization"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                  />
                </label>
              </div>
            )}

            {isPlatformLogin && (
              <p className="signup-copy" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Platform administrators can sign in without a tenant code.
              </p>
            )}

            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : <>Let’s start! <span>→</span></>}
            </button>
          </form>
          <p className="signup-copy">
            {isPlatformLogin ? (
              <a href="/login">Tenant login</a>
            ) : (
              <>
                Platform admin? <a href="/login/suser">Use platform admin login</a>
              </>
            )}
          </p>
        </div>
      </section>
    </main>
  )
}
