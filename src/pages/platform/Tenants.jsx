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
  phone: '',
  admin_username: '',
  admin_password: '',
  admin_email: '',
  admin_first_name: '',
  admin_last_name: '',
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
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupHint, setLookupHint] = useState('')

  const [currencyOptions, setCurrencyOptions] = useState([])
  const [currencySource, setCurrencySource] = useState('')
  const [currencyLoading, setCurrencyLoading] = useState(false)

  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState({ name: '', timezone: '', currency: '', phone: '' })
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncPassword, setSyncPassword] = useState('')
  const [syncError, setSyncError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteCode, setDeleteCode] = useState('')

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

  async function loadCurrencyOptions() {
    if (currencyOptions.length) return
    setCurrencyLoading(true)
    try {
      const res = await api.get('/platform/tenant-currencies/')
      setCurrencyOptions(res.results || [])
      setCurrencySource(res.source || '')
    } catch {
      setCurrencyOptions([])
      setCurrencySource('unavailable')
    } finally {
      setCurrencyLoading(false)
    }
  }

  // Country/currency choices from the central financial-year master. When the
  // list cannot be loaded the form falls back to a free-text currency input.
  function currencyChoices(current) {
    const choices = currencyOptions.map((item) => ({
      value: item.currency_code,
      label: `${item.currency_code} — ${item.country_name} (${item.country_code})`,
    }))
    const value = (current || '').trim().toUpperCase()
    if (value && !choices.some((choice) => choice.value === value)) {
      choices.unshift({ value, label: `${value} (not in central list)` })
    }
    return choices
  }

  function currencyHint() {
    if (currencyLoading) return 'Loading countries and currencies…'
    if (currencySource === 'fallback') {
      return 'Central master unreachable — showing built-in defaults.'
    }
    if (currencySource === 'unavailable') return 'Currency list unavailable — enter a code manually.'
    return 'Country and currency from the central financial-year master.'
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
    const currency = form.currency.trim().toUpperCase() || 'INR'
    const country = currencyOptions.find((item) => item.currency_code === currency)
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      timezone: form.timezone.trim() || 'UTC',
      currency,
      phone: form.phone.trim(),
      admin_username: form.admin_username.trim(),
      admin_password: form.admin_password,
      admin_email: form.admin_email.trim(),
      admin_first_name: form.admin_first_name.trim(),
      admin_last_name: form.admin_last_name.trim(),
    }
    if (country) {
      payload.settings = {
        country_code: country.country_code,
        country_name: country.country_name,
        fiscal_year: { from: country.fy_from_month, to: country.fy_to_month },
      }
    }
    try {
      const tenant = await api.post('/platform/tenants/', payload)
      setCreated({
        code: tenant.code,
        admin: form.admin_username.trim(),
      })
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
    setLookupHint('')
    setLookupLoading(false)
  }

  useEffect(() => {
    const code = form.code.trim().toUpperCase()
    if (!createOpen || created || code.length < 3) {
      setLookupHint('')
      setLookupLoading(false)
      return
    }
    let cancelled = false
    setLookupLoading(true)
    setLookupHint('')
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/platform/tenants/lookup/?code=${encodeURIComponent(code)}`)
        if (cancelled) return
        if (res.found && res.name) {
          setForm((prev) => (prev.name ? prev : { ...prev, name: res.name }))
          setLookupHint(`Auto-filled from license: ${res.name}`)
        } else if (res.reason === 'inactive') {
          setLookupHint('License found but not active')
        } else {
          setLookupHint('')
        }
      } catch (err) {
        if (!cancelled) setLookupHint('')
      } finally {
        if (!cancelled) setLookupLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [form.code, createOpen, created])

  useEffect(() => {
    if (createOpen || detail) loadCurrencyOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, detail])

  async function openDetail(tenant) {
    setActionError('')
    setDetailError('')
    setSyncError('')
    setSyncPassword('')
    try {
      const full = await api.get(`/platform/tenants/${tenant.id}/`)
      setDetail(full)
      setDetailForm({
        name: full.name,
        timezone: full.timezone,
        currency: full.currency,
        phone: full.phone || '',
      })
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

  // The central registration is best effort, so a failed attempt has to be
  // retryable: re-submitting the create form would collide on the tenant code.
  async function handleSyncCentral() {
    setSyncError('')
    setSyncing(true)
    try {
      const res = await api.post(`/platform/tenants/${detail.id}/sync-central/`, {
        password: syncPassword,
      })
      if ((res.user || {}).status === 'failed') {
        setSyncError(res.user.detail || 'Central registration failed.')
        return
      }
      setSyncPassword('')
      await openDetail(detail)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  function openDeleteConfirm() {
    if (!detail) return
    setDetailError('')
    setDeleteCode('')
    setDeleteConfirm({ id: detail.id, code: detail.code, name: detail.name })
  }

  function closeDeleteConfirm() {
    setDeleteConfirm(null)
    setDeleteCode('')
  }

  async function handleDeleteTenant() {
    if (!deleteConfirm) return
    if (deleteCode.trim().toUpperCase() !== deleteConfirm.code) {
      setDetailError('Tenant code did not match. Deletion cancelled.')
      return
    }
    setDetailError('')
    setDeleting(true)
    try {
      await api.delete(`/platform/tenants/${deleteConfirm.id}/`)
      reload()
      setDetail(null)
      closeDeleteConfirm()
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  function actionButtons(tenant) {
    const busy = busyId === tenant.id
    return (
      <div className="row-actions">
        {tenant.status === 'active' && (
          <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={() => doAction(tenant, 'deactivate')}>
            Deactivate
          </button>
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
                  {(lookupLoading || lookupHint) && (
                    <p className="field-hint">{lookupLoading ? 'Looking up license…' : lookupHint}</p>
                  )}
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
                <Field label="Currency" hint={currencyHint()}>
                  {currencyOptions.length === 0 ? (
                    <input
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                      placeholder="INR"
                    />
                  ) : (
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                      {currencyChoices(form.currency).map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <Field label="Phone number">
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  required
                />
              </Field>

              <p className="form-section">First tenant admin</p>

              <div className="grid-2">
                <Field label="First name" hint="Optional">
                  <input
                    value={form.admin_first_name}
                    onChange={(e) => setForm({ ...form, admin_first_name: e.target.value })}
                    placeholder="John"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Last name" hint="Optional">
                  <input
                    value={form.admin_last_name}
                    onChange={(e) => setForm({ ...form, admin_last_name: e.target.value })}
                    placeholder="Doe"
                    autoComplete="off"
                  />
                </Field>
              </div>

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
                <Field label="Admin email">
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                    placeholder="admin@dreams.example"
                    autoComplete="off"
                    required
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
            {detailError && !deleteConfirm && <p className="alert alert-error">{detailError}</p>}

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

            <Field label="Currency" hint={currencyHint()}>
              {currencyOptions.length === 0 ? (
                <input
                  value={detailForm.currency}
                  onChange={(e) => setDetailForm({ ...detailForm, currency: e.target.value.toUpperCase() })}
                  required
                />
              ) : (
                <select
                  value={detailForm.currency}
                  onChange={(e) => setDetailForm({ ...detailForm, currency: e.target.value })}
                  required
                >
                  {currencyChoices(detailForm.currency).map((choice) => (
                    <option key={choice.value} value={choice.value}>{choice.label}</option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Phone number">
              <input
                type="tel"
                inputMode="tel"
                value={detailForm.phone}
                onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })}
                placeholder="+91 98765 43210"
                required
              />
            </Field>

            <div className="detail-meta">
              <span className="muted">Central account</span>
              {detail.admin_central_user_id ? (
                <span className="badge active">linked #{detail.admin_central_user_id}</span>
              ) : (
                <span className="badge suspended">not linked</span>
              )}
            </div>

            {!detail.admin_central_user_id && (
              <>
                {syncError && <p className="alert alert-error">{syncError}</p>}
                <Field label="Admin password" hint="Required to create the central account.">
                  <input
                    type="password"
                    value={syncPassword}
                    onChange={(e) => setSyncPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleSyncCentral}
                    disabled={syncing}
                  >
                    {syncing ? 'Registering…' : 'Register central account'}
                  </button>
                </div>
              </>
            )}

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-outline danger"
                disabled={savingDetail || deleting}
                onClick={openDeleteConfirm}
              >
                Delete permanently
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={savingDetail || deleting}>
                  {savingDetail ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="Confirm permanent deletion" onClose={closeDeleteConfirm}>
          <div className="modal-body">
            {detailError && <p className="alert alert-error">{detailError}</p>}
            <p className="alert alert-error">
              <strong>Warning:</strong> This will permanently delete tenant{' '}
              <strong className="mono">{deleteConfirm.code}</strong> ({deleteConfirm.name}).
            </p>
            <p className="muted">
              This action cannot be undone. All tenant-owned data — events, ticket types,
              prices, staff, assignments, sales and tickets — will be removed, and the tenant
              admin's central account is deleted from the user master. User accounts and audit
              history are kept.
            </p>
            <Field label={`Type "${deleteConfirm.code}" to confirm`}>
              <input
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value.toUpperCase())}
                placeholder={deleteConfirm.code}
                autoFocus
              />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={closeDeleteConfirm} disabled={deleting}>
                Cancel
              </button>
              <button
                type="button"
 className="btn btn-danger"
                disabled={deleting || deleteCode.trim().toUpperCase() !== deleteConfirm.code}
                onClick={handleDeleteTenant}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
