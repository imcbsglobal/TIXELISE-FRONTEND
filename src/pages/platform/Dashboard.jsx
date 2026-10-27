import React from 'react'
import { ArrowRight, Building2, PauseCircle, PlayCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

async function fetchAllTenants() {
  const results = []
  let page = 1
  while (page <= 50) {
    const data = await api.get(`/platform/tenants/?page=${page}&page_size=100`)
    results.push(...data.results)
    if (!data.next) break
    page += 1
  }
  return results
}

const STAT_META = [
  { key: 'total', label: 'Total tenants', icon: Building2, tone: 'green' },
  { key: 'active', label: 'Active', icon: PlayCircle, tone: 'green' },
  { key: 'suspended', label: 'Suspended', icon: PauseCircle, tone: 'amber' },
  { key: 'inactive', label: 'Inactive', icon: XCircle, tone: 'gray' },
]

export default function Dashboard() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Platform dashboard'
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAllTenants()
      .then((list) => !cancelled && setTenants(list))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    inactive: tenants.filter((t) => t.status === 'inactive').length,
  }

  const recent = [...tenants]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">PLATFORM OVERVIEW</p>
          <h1 className="page-title">Welcome back</h1>
          <p className="page-sub">Every tenant organization on Tixelise, at a glance.</p>
        </div>
        <Link className="btn btn-primary" to="/platform/tenants">
          Manage tenants <ArrowRight size={17} />
        </Link>
      </div>

      {error && <p className="alert alert-error">{error}</p>}

      <div className="stat-grid">
        {STAT_META.map(({ key, label, icon: Icon, tone }) => (
          <div className="stat-card" key={key}>
            <span className={`stat-icon ${tone}`}>
              <Icon size={19} />
            </span>
            <div>
              <p className="stat-label">{label}</p>
              <p className="stat-value">{loading ? '—' : stats[key]}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Recent tenants</h3>
          <Link className="btn btn-ghost btn-sm" to="/platform/tenants">
            View all <ArrowRight size={15} />
          </Link>
        </div>

        {loading ? (
          <p className="muted">Loading tenants…</p>
        ) : recent.length === 0 ? (
          <p className="muted">
            No tenants yet — create your first one from the Tenants page.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Timezone</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.code}</td>
                    <td>{t.name}</td>
                    <td>{t.timezone}</td>
                    <td>
                      <span className={`badge ${t.status}`}>{t.status}</span>
                    </td>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
