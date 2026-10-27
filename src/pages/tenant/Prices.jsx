import { ArrowLeft, CalendarDays, MapPin, Pencil, Plus } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20

async function fetchAll(path) {
  const results = []
  let page = 1
  while (page <= 50) {
    const data = await api.get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`)
    results.push(...data.results)
    if (!data.next) break
    page += 1
  }
  return results
}

function toLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM = { event: '', category: '', amount: '', currency: 'INR', effective_from: '', effective_to: '' }

export default function Prices() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventsError, setEventsError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState({ amount: '', currency: '', effective_from: '', effective_to: '' })
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Prices'
  }, [])

  useEffect(() => {
    let cancelled = false
    setEventsLoading(true)
    setEventsError('')
    Promise.all([fetchAll('/admin/events/'), fetchAll('/admin/categories/')])
      .then(([evs, cats]) => {
        if (cancelled) return
        setEvents(evs)
        setCategories(cats)
      })
      .catch((err) => {
        if (!cancelled) setEventsError(err.message)
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    let cancelled = false
    if (!selectedEvent) {
      setData({ count: 0, results: [] })
      setLoading(false)
      setError('')
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    qs.set('event', selectedEvent)
    api
      .get(`/admin/prices/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, selectedEvent, reloadToken])

  const eventById = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events])
  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((p) => {
    const ev = eventById[p.event]
    const cat = categoryById[p.category]
    const hay = `${p.category_code || ''} ${ev?.code || ''} ${ev?.name || ''} ${cat?.name || ''}`.toLowerCase()
    return hay.includes(search.trim().toLowerCase())
  })

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.post('/admin/prices/', {
        event: Number(form.event),
        category: Number(form.category),
        amount: Number(form.amount).toFixed(2),
        currency: form.currency.trim().toUpperCase() || 'INR',
        ...(form.effective_from ? { effective_from: `${form.effective_from}:00` } : {}),
        ...(form.effective_to ? { effective_to: `${form.effective_to}:00` } : {}),
      })
      setSelectedEvent(form.event)
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

  function selectEvent(eventId) {
    setSelectedEvent(String(eventId))
    setSearch('')
    setPage(1)
  }

  function openDetail(price) {
    setDetailError('')
    setDetail(price)
    setDetailForm({
      amount: String(price.amount),
      currency: price.currency,
      effective_from: toLocal(price.effective_from),
      effective_to: toLocal(price.effective_to),
    })
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/admin/prices/${detail.id}/`, {
        amount: Number(detailForm.amount).toFixed(2),
        currency: detailForm.currency.trim().toUpperCase() || 'INR',
        effective_from: detailForm.effective_from ? `${detailForm.effective_from}:00` : null,
        effective_to: detailForm.effective_to ? `${detailForm.effective_to}:00` : null,
      })
      reload()
      setDetail(null)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="PRICING"
        title="Event prices"
        subtitle="Set a price per category for each event. One price per event-category pair."
      >
        <RefreshButton loading={loading || eventsLoading} onClick={reload} />
        <Button
          onClick={() => {
            setForm({ ...EMPTY_FORM, event: selectedEvent })
            setCreateError('')
            setCreateOpen(true)
          }}
          disabled={events.length === 0}
        >
          <Plus className="h-4 w-4" /> New price
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {eventsError && <Alert variant="error" className="mb-5">{eventsError}</Alert>}

      {!selectedEvent ? (
        <section aria-label="Available events">
          <h2 className="mb-4 font-display text-lg font-extrabold">Select an event to view its prices</h2>
          {eventsLoading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading events…</CardContent>
            </Card>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No events available.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => selectEvent(event.id)}
                  className="rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ee] text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </span>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{event.code}</p>
                  <h3 className="mt-1 font-display text-base font-extrabold">{event.name}</h3>
                  {event.venue && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {event.venue}
                    </p>
                  )}
                  {event.start_at && (
                    <p className="mt-1 text-sm text-muted-foreground">{new Date(event.start_at).toLocaleString()}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEvent('')}>
                  <ArrowLeft className="h-4 w-4" /> All events
                </Button>
                <h2 className="mt-2 font-display text-lg font-extrabold">
                  {events.find((event) => String(event.id) === selectedEvent)?.name || 'Event prices'}
                </h2>
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Search by category…" />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Effective to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <LoadingRow colSpan={8} />
                ) : rows.length === 0 ? (
                  <EmptyRow colSpan={8} message="No prices found for this event." />
                ) : (
                  rows.map((p) => {
                    const ev = eventById[p.event]
                    const cat = categoryById[p.category]
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-[13.5px]">{ev ? ev.code : p.event}</TableCell>
                        <TableCell className="font-mono text-[13.5px]">{cat?.name || p.category_code || '—'}</TableCell>
                        <TableCell className="font-semibold">{p.amount}</TableCell>
                        <TableCell className="text-muted-foreground">{p.currency}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.effective_from ? new Date(p.effective_from).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.effective_to ? new Date(p.effective_to).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetail(p)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={(v) => !v && (setCreateOpen(false), setCreateError(''))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New price</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}

            <Field label="Event">
              <Select value={form.event} onValueChange={(v) => setForm({ ...form, event: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event…" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)}>
                      {ev.code} — {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Category" hint="Each category can have only one price per event.">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Amount" hint="Zero or positive — e.g. 499.00">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="499.00"
                  required
                />
              </Field>
              <Field label="Currency">
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  placeholder="INR"
                />
              </Field>
              <Field label="Effective from" hint="Optional">
                <Input type="datetime-local" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </Field>
              <Field label="Effective to" hint="Optional">
                <Input type="datetime-local" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !form.event || !form.category}>
                {creating ? 'Creating…' : 'Create price'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit price</DialogTitle>
          </DialogHeader>
          {detail && (
            <form onSubmit={handleSaveDetail} className="space-y-4">
              {detailError && <Alert variant="error">{detailError}</Alert>}
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span className="font-mono">{detail.category_code}</span>
                <span>Event {eventById[detail.event]?.code || detail.event}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Amount">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detailForm.amount}
                    onChange={(e) => setDetailForm({ ...detailForm, amount: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={detailForm.currency}
                    onChange={(e) => setDetailForm({ ...detailForm, currency: e.target.value.toUpperCase() })}
                    required
                  />
                </Field>
                <Field label="Effective from">
                  <Input type="datetime-local" value={detailForm.effective_from} onChange={(e) => setDetailForm({ ...detailForm, effective_from: e.target.value })} />
                </Field>
                <Field label="Effective to">
                  <Input type="datetime-local" value={detailForm.effective_to} onChange={(e) => setDetailForm({ ...detailForm, effective_to: e.target.value })} />
                </Field>
              </div>

              <p className="text-xs text-muted-foreground">
                Past sales keep their original price — edits only affect future sales.
              </p>

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
    </>
  )
}
