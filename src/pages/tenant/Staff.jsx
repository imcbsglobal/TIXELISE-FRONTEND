import { KeyRound, Pencil, UserPlus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20
const EMPTY_FORM = { staff_code: '', display_name: '', username: '', email: '', phone: '', password: '' }

export default function Staff() {
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
  const [detailForm, setDetailForm] = useState({ display_name: '', email: '', phone: '' })
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  const [resetFor, setResetFor] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | User management'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/admin/staff/?page=${page}&page_size=${PAGE_SIZE}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((s) =>
    `${s.staff_code} ${s.display_name} ${s.email || ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function deactivate(staff) {
    if (!window.confirm(`Deactivate ${staff.display_name} (${staff.staff_code})? Their login will stop working immediately.`)) return
    setBusyId(staff.id)
    setActionError('')
    try {
      await api.post(`/admin/staff/${staff.id}/deactivate/`)
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
      const res = await api.post('/admin/staff/', {
        staff_code: form.staff_code.trim().toUpperCase(),
        display_name: form.display_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      setCreated({
        staff_code: res.staff_code,
        username: form.username.trim(),
        registration: res.central_user_registration || null,
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
  }

  function openDetail(staff) {
    setActionError('')
    setDetailError('')
    setDetail(staff)
    setDetailForm({ display_name: staff.display_name, email: staff.email || '', phone: staff.phone || '' })
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/admin/staff/${detail.id}/`, {
        display_name: detailForm.display_name.trim(),
        email: detailForm.email.trim(),
        phone: detailForm.phone.trim(),
      })
      reload()
      setDetail(null)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  function openReset(staff) {
    setResetFor(staff)
    setResetPassword('')
    setResetError('')
    setResetDone(false)
  }

  async function handleReset(event) {
    event.preventDefault()
    setResetError('')
    setResetting(true)
    try {
      await api.post(`/admin/staff/${resetFor.id}/reset-password/`, { password: resetPassword })
      setResetDone(true)
      setResetPassword('')
    } catch (err) {
      setResetError(err.message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <PageHead eyebrow="TEAM" title="User management" subtitle="POS staff who can sell tickets at your events.">
        <RefreshButton loading={loading} onClick={reload} />
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" /> New staff
        </Button>
      </PageHead>

      {actionError && <Alert variant="error" className="mb-5">{actionError}</Alert>}
      {error && !actionError && <Alert variant="error" className="mb-5">{error}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by code, name or email…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={7} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={7} message="No staff found." />
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[13.5px]">{s.staff_code}</TableCell>
                    <TableCell className="font-medium">{s.display_name}</TableCell>
                    <TableCell>{s.username || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openReset(s)}>
                          <KeyRound className="h-3.5 w-3.5" /> Password
                        </Button>
                        {s.status === 'active' && (
                          <Button variant="destructive" size="sm" disabled={busyId === s.id} onClick={() => deactivate(s)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(v) => !v && closeCreate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{created ? 'Staff created' : 'New staff member'}</DialogTitle>
          </DialogHeader>
          {created ? (
            <div className="space-y-4">
              <Alert variant="success">
                Staff member <strong className="font-mono">{created.staff_code}</strong> can now log in to the POS with
                username <strong>{created.username}</strong> and the password you set.
              </Alert>
              {created.registration && created.registration.status !== 'registered' && (
                <Alert variant="warning">{created.registration.detail}</Alert>
              )}
              <p className="text-xs text-muted-foreground">The password is never shown again — share it securely.</p>
              <DialogFooter>
                <Button onClick={closeCreate}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <Alert variant="error">{createError}</Alert>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Staff code" hint="Unique within your org — e.g. ST012">
                  <Input
                    value={form.staff_code}
                    onChange={(e) => setForm({ ...form, staff_code: e.target.value.toUpperCase() })}
                    placeholder="ST012"
                    required
                  />
                </Field>
                <Field label="Display name">
                  <Input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="Ravi Kumar"
                    required
                  />
                </Field>
              </div>

              <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                POS login
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Username" hint="Must be unique across Tixelise.">
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="ravi"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Password" hint="Min 8 characters, letters and numbers required.">
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email" hint="Required">
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ravi@dreams.example"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Phone" hint="Required, unique per tenant">
                  <Input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </Field>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreate}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create staff'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Staff {detail?.staff_code}</DialogTitle>
          </DialogHeader>
          {detail && (
            <form onSubmit={handleSaveDetail} className="space-y-4">
              {detailError && <Alert variant="error">{detailError}</Alert>}
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span>ID {detail.id}</span>
                <span>Created {new Date(detail.created_at).toLocaleString()}</span>
              </div>
              <Field label="Display name">
                <Input
                  value={detailForm.display_name}
                  onChange={(e) => setDetailForm({ ...detailForm, display_name: e.target.value })}
                  required
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <Input
                    type="email"
                    value={detailForm.email}
                    onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input value={detailForm.phone} onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Username and staff code cannot be changed here.</p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                <Button type="submit" disabled={savingDetail}>
                  {savingDetail ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password — {resetFor?.staff_code}</DialogTitle>
          </DialogHeader>
          {resetDone ? (
            <div className="space-y-4">
              <Alert variant="success">Password updated for {resetFor.display_name}.</Alert>
              <DialogFooter>
                <Button onClick={() => setResetFor(null)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {resetError && <Alert variant="error">{resetError}</Alert>}
              <Field label="New password" hint="Min 8 characters, letters and numbers required.">
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetFor(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetting}>
                  {resetting ? 'Updating…' : 'Update password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
