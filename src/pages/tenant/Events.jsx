import { LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20
const STATUSES = ['draft', 'active', 'completed', 'cancelled']

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  venue: '',
  address: '',
  start_at: '',
  end_at: '',
  sales_start_at: '',
  sales_end_at: '',
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(value) {
  return value ? `${value}:00` : ''
}

export default function Events() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [reloadToken, setReloadToken] = useState(0)

  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState(EMPTY_FORM)
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Events'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    api
      .get(`/admin/events/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((e) =>
    `${e.code} ${e.name} ${e.venue || ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function transition(ev, target) {
    if (!window.confirm(`Mark event ${ev.code} as ${target}?`)) return
    setBusyId(ev.id)
    setActionError('')
    setNotice('')
    try {
      await api.post(`/admin/events/${ev.id}/${target}/`)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError('')
    setNotice('')
    try {
      await api.delete(`/admin/events/${pendingDelete.id}/`)
      setNotice(`${pendingDelete.code} was permanently deleted from the database.`)
      setPendingDelete(null)
      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        reload()
      }
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.post('/admin/events/', {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        address: form.address.trim(),
        start_at: toIso(form.start_at),
        end_at: toIso(form.end_at),
        ...(form.sales_start_at ? { sales_start_at: toIso(form.sales_start_at) } : {}),
        ...(form.sales_end_at ? { sales_end_at: toIso(form.sales_end_at) } : {}),
      })
      setForm(EMPTY_FORM)
      setCreateOpen(false)
      setPage(1)
      reload()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function openDetail(ev) {
    setActionError('')
    setDetailError('')
    setDetail(ev)
    setDetailForm({
      code: ev.code,
      name: ev.name,
      description: ev.description || '',
      venue: ev.venue || '',
      address: ev.address || '',
      start_at: toLocalInput(ev.start_at),
      end_at: toLocalInput(ev.end_at),
      sales_start_at: toLocalInput(ev.sales_start_at),
      sales_end_at: toLocalInput(ev.sales_end_at),
    })
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/admin/events/${detail.id}/`, {
        code: detailForm.code.trim().toUpperCase(),
        name: detailForm.name.trim(),
        description: detailForm.description.trim(),
        venue: detailForm.venue.trim(),
        address: detailForm.address.trim(),
        start_at: toIso(detailForm.start_at),
        end_at: toIso(detailForm.end_at),
        sales_start_at: detailForm.sales_start_at ? toIso(detailForm.sales_start_at) : null,
        sales_end_at: detailForm.sales_end_at ? toIso(detailForm.sales_end_at) : null,
      })
      reload()
      setDetail(null)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  function actionButtons(ev) {
    const busy = busyId === ev.id
    return (
      <div className="flex flex-wrap items-center gap-2">
        {ev.status === 'draft' && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => transition(ev, 'active')}>
            Activate
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => openDetail(ev)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || deleting}
          onClick={() => {
            setActionError('')
            setPendingDelete(ev)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    )
  }

  return (
    <>
      <PageHead
        eyebrow="EVENT MANAGEMENT"
        title="Events"
        subtitle="Create events, set their schedule and move them through their lifecycle."
      >
        <RefreshButton loading={loading} onClick={reload} />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New event
        </Button>
      </PageHead>

      {actionError && <Alert variant="error" className="mb-5">{actionError}</Alert>}
      {error && !actionError && <Alert variant="error" className="mb-5">{error}</Alert>}
      {notice && <Alert variant="success" className="mb-5">{notice}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by code, name or venue…" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-md border border-border bg-background p-1" aria-label="Event view">
                <Button
                  type="button"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={viewMode === 'list'}
                  title="List view"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" /> List
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={viewMode === 'grid'}
                  title="Grid view"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" /> Grid
                </Button>
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {viewMode === 'list' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRow colSpan={7} />
                ) : rows.length === 0 ? (
                  <EmptyRow colSpan={7} message="No events found." />
                ) : (
                  rows.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-[13.5px]">{ev.code}</TableCell>
                      <TableCell className="font-medium">{ev.name}</TableCell>
                      <TableCell className="text-muted-foreground">{ev.venue || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(ev.start_at).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(ev.end_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={ev.status} />
                      </TableCell>
                      <TableCell>{actionButtons(ev)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading events…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No events found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((ev) => (
                <article key={ev.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{ev.code}</p>
                      <h3 className="mt-1 truncate font-display text-base font-extrabold">{ev.name}</h3>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Venue</dt>
                      <dd className="truncate text-right font-medium">{ev.venue || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Starts</dt>
                      <dd className="text-right font-medium">{new Date(ev.start_at).toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">Ends</dt>
                      <dd className="text-right font-medium">{new Date(ev.end_at).toLocaleString()}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-border pt-3">{actionButtons(ev)}</div>
                </article>
              ))}
            </div>
          )}

          <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(v) => !v && (setCreateOpen(false), setCreateError(''))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Event code" hint="Alphanumeric, unique — e.g. EV004">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="EV004"
                  required
                />
              </Field>
              <Field label="Event name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Music Fest 2026"
                  required
                />
              </Field>
            </div>

            <Field label="Description" hint="Optional">
              <Textarea
                rows="2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description of the event…"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Venue" hint="Optional">
                <Input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Central Auditorium"
                />
              </Field>
              <Field label="Address" hint="Optional">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </Field>
            </div>

            <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Schedule
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Starts at">
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required />
              </Field>
              <Field label="Ends at">
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} required />
              </Field>
              <Field label="Sales open" hint="Optional">
                <Input type="datetime-local" value={form.sales_start_at} onChange={(e) => setForm({ ...form, sales_start_at: e.target.value })} />
              </Field>
              <Field label="Sales close" hint="Optional">
                <Input type="datetime-local" value={form.sales_end_at} onChange={(e) => setForm({ ...form, sales_end_at: e.target.value })} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event {detail?.code}</DialogTitle>
          </DialogHeader>
          {detail && (
            <form onSubmit={handleSaveDetail} className="space-y-4">
              {detailError && <Alert variant="error">{detailError}</Alert>}

              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span>ID {detail.id}</span>
                <span>Created {new Date(detail.created_at).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Event code">
                  <Input
                    value={detailForm.code}
                    onChange={(e) => setDetailForm({ ...detailForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    required
                  />
                </Field>
                <Field label="Event name">
                  <Input value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} required />
                </Field>
              </div>

              <Field label="Description">
                <Textarea rows="2" value={detailForm.description} onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Venue">
                  <Input value={detailForm.venue} onChange={(e) => setDetailForm({ ...detailForm, venue: e.target.value })} />
                </Field>
                <Field label="Address">
                  <Input value={detailForm.address} onChange={(e) => setDetailForm({ ...detailForm, address: e.target.value })} />
                </Field>
              </div>

              <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Schedule
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Starts at">
                  <Input type="datetime-local" value={detailForm.start_at} onChange={(e) => setDetailForm({ ...detailForm, start_at: e.target.value })} required />
                </Field>
                <Field label="Ends at">
                  <Input type="datetime-local" value={detailForm.end_at} onChange={(e) => setDetailForm({ ...detailForm, end_at: e.target.value })} required />
                </Field>
                <Field label="Sales open">
                  <Input type="datetime-local" value={detailForm.sales_start_at} onChange={(e) => setDetailForm({ ...detailForm, sales_start_at: e.target.value })} />
                </Field>
                <Field label="Sales close">
                  <Input type="datetime-local" value={detailForm.sales_end_at} onChange={(e) => setDetailForm({ ...detailForm, sales_end_at: e.target.value })} />
                </Field>
              </div>

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

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setPendingDelete(null)
            setActionError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {pendingDelete?.code}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionError && <Alert variant="error">{actionError}</Alert>}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{pendingDelete?.name}</span> and its unused
              prices and staff assignments will be permanently removed from the database. This cannot be restored.
            </p>
            <p className="text-sm text-muted-foreground">
              Events with sales or issued tickets cannot be deleted, to retain their history.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
