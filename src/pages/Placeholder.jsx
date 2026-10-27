import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRouteForRole, logout } from '../auth'
import { getSession } from '../session'

export default function Placeholder({ title }) {
  const session = getSession()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = `Tixelise | ${title}`
  }, [title])

  async function handleLogout() {
    await logout()
    navigate(loginRouteForRole(session?.role), { replace: true })
  }

  return (
    <main className="placeholder-page">
      <div className="placeholder-card">
        <div className="brand-inline"><span className="brand-mark">t</span><span>Tixelise</span></div>
        <p className="eyebrow">{session?.tenant?.code || 'TIXELISE'}</p>
        <h1>{title}</h1>
        <p>This part of the panel is coming in the next phase. Your login and role routing already work.</p>
        <div className="placeholder-actions">
          <span className="muted">Signed in as {session?.username} ({session?.role})</span>
          <button className="btn btn-outline" onClick={handleLogout}>Log out</button>
        </div>
      </div>
    </main>
  )
}
