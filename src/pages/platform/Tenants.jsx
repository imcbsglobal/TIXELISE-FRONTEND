import { Plus, RefreshCw, Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import Modal from '../../components/Modal'

const PAGE_SIZE = 20

const EMPTY_FORM = {
  code: '',
  name: '',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  admin_username: '',
  admin_password: '',
  admin_email: '',
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export default function Tenants() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState(null)

  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState({ name: '', timezone: '', currency: '' })
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Tenants'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/platform/tenants/?page=${page}&page_size=${PAGE_SIZE}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((t) =>
    `${t.code} ${t.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function doAction(tenant, action) {
    const verb = action === 'activate' ? 'Activate' : action === 'suspend' ? 'Suspend' : 'Deactivate'
    if (!window.confirm(`${verb} tenant ${tenant.code}?`)) return
    setBusyId(tenant.id)
    setActionError('')
    try {
      await api.post(`/platform/tenants/${tenant.id}/${action}/`)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      const tenant = await api.post('/platform/tenants/', {
        code: form.code.trim(),
        name: form.name.trim(),
        timezone: form.timezone.trim() || 'UTC',
        currency: form.currency.trim() || 'INR',
        admin_username: form.admin_username.trim(),
        admin_password: form.admin_password,
        admin_email: form.admin_email.trim(),
      })
      setCreated({ code: tenant.code, admin: form.admin_username.trim() })
      setForm(EMPTY_FORM)
      setPage(1)
      reload()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function closeCreate() {
    setCreateOpen(false)
    setCreated(null)
    setCreateError('')
  }

  async function openDetail(tenant) {
    setActionError('')
    setDetailError('')
    try {
      const full = await api.get(`/platform/tenants/${tenant.id}/`)
      setDetail(full)
      setDetailForm({ name: full.name, timezone: full.timezone, currency: full.currency })
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/platform/tenants/${detail.id}/`, detailForm)
      reload()
      setDetail(null)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  function actionButtons(tenant) {
    const busy = busyId === tenant.id
    return (
      <div className="row-actions">
        {tenant.status === 'active' && (
          <>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => doAction(tenant, 'suspend')}>
              Suspend
            </button>
            <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={() => doAction(tenant, 'deactivate')}>
              Deactivate
            </button>
          </>
        )}
        {tenant.status !== 'active' && (
          <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => doAction(tenant, 'activate')}>
            Activate
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => openDetail(tenant)}>
          Details
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">ORGANIZATIONS</p>
          <h1 className="page-title">Tenants</h1>
          <p className="page-sub">Create tenant organizations and manage their lifecycle.</p>
        </div>
        <div className="page-head-actions">
          <button className="icon-btn lg" onClick={reload} aria-label="Refresh" title="Refresh">
            <RefreshCw size={17} className={loading ? 'spinning' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={17} /> New tenant
          </button>
        </div>
      </div>

      {actionError && <p className="alert alert-error">{actionError}</p>}
      {error && !actionError && <p className="alert alert-error">{error}</p>}

      <section className="card">
        <div className="toolbar">
          <label className="search-shell">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search by code or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="muted">{data.count} tenant{data.count === 1 ? '' : 's'}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Timezone</th>
                <th>Currency</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="muted center">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="muted center">No tenants found.</td></tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.code}</td>
                    <td>{t.name}</td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                    <td>{t.timezone}</td>
                    <td>{t.currency}</td>
                    <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>{actionButtons(t)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </section>

      {createOpen && (
        <Modal title={created ? 'Tenant created' : 'New tenant'} onClose={closeCreate}>
          {created ? (
            <div className="modal-body">
              <p className="alert alert-success">
                Tenant <strong className="mono">{created.code}</strong> is live. Its admin can log
                in now with username <strong>{created.admin}</strong> and the password you set.
              </p>
              <p className="field-hint">The password is never shown again — share it securely.</p>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={closeCreate}>Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="modal-body">
              {createError && <p className="alert alert-error">{createError}</p>}

              <div className="grid-2">
                <Field label="Tenant code">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="DREAMS001"
                    required
                  />
                </Field>
                <Field label="Organization name">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Dreams Events"
                    required
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    placeholder="Asia/Kolkata"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    placeholder="INR"
                  />
                </Field>
              </div>

              <p className="form-section">First tenant admin</p>

              <div className="grid-2">
                <Field label="Admin username">
                  <input
                    value={form.admin_username}
                    onChange={(e) => setForm({ ...form, admin_username: e.target.value })}
                    placeholder="dreams_admin"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Admin email" hint="Optional">
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    placeholder="admin@dreams.example"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <Field label="Admin password" hint="Min 8 characters, letters and numbers required.">
                <input
                  type="password"
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </Field>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeCreate}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create tenant'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {detail && (
        <Modal title={`Tenant ${detail.code}`} onClose={() => setDetail(null)}>
          <form onSubmit={handleSaveDetail} className="modal-body">
            {detailError && <p className="alert alert-error">{detailError}</p>}

            <div className="detail-meta">
              <span className={`badge ${detail.status}`}>{detail.status}</span>
              <span className="muted">ID {detail.id}</span>
              <span className="muted">Created {new Date(detail.created_at).toLocaleString()}</span>
            </div>

            <div className="grid-2">
              <Field label="Organization name">
                <input
                  value={detailForm.name}
                  onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Timezone">
                <input
                  value={detailForm.timezone}
                  onChange={(e) => setDetailForm({ ...detailForm, timezone: e.target.value })}
                  required
                />
              </Field>
            </div>

            <Field label="Currency">
              <input
                value={detailForm.currency}
                onChange={(e) => setDetailForm({ ...detailForm, currency: e.target.value.toUpperCase() })}
                required
              />
            </Field>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={savingDetail}>
                {savingDetail ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
