import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Printer, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead, RefreshButton } from '@/components/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PrintTicketDialog from '@/components/PrintTicketDialog'
import { getSession } from '@/session'

const MAX_PER_CATEGORY = 100
const HISTORY_PAGE_SIZE = 20
// Sentinel for the logged-in admin as the ticket holder. A real holder is a
// staff id; this one is sent to the API as `staff: null`.
const SELF = '__self__'

async function fetchAll(path) {
  const rows = []
  let page = 1
  while (page <= 20) {
    const data = await api.get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`)
    const batch = Array.isArray(data) ? data : data.results || []
    rows.push(...batch)
    if (Array.isArray(data) || !data.next) break
    page += 1
  }
  return rows
}

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function blankRow() {
  return { uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`, category: '', quantity: 1 }
}

function DateFilter({ label, value, min, max, onChange }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} date`}
        className="h-9 w-[172px] rounded-md border border-transparent bg-muted pl-3 pr-1.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-[#72c9ad] focus-visible:ring-4 focus-visible:ring-ring/25 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-[15px] [&::-webkit-calendar-picker-indicator]:w-[15px] [&::-webkit-calendar-picker-indicator]:shrink-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
      />
    </label>
  )
}

function toDayString(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function monthStartString() {
  const now = new Date()
  return toDayString(new Date(now.getFullYear(), now.getMonth(), 1))
}

function formatWhen(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ManualTickets() {
  const session = getSession()
  const adminLabel = session?.username || 'admin'
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [events, setEvents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [staff, setStaff] = useState([])
  const [categories, setCategories] = useState([])

  const [eventId, setEventId] = useState('')
  const [staffId, setStaffId] = useState(SELF)
  const [rows, setRows] = useState([blankRow()])

  const [prices, setPrices] = useState([])
  const [pricesLoading, setPricesLoading] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [dateFrom, setDateFrom] = useState(monthStartString)
  const [dateTo, setDateTo] = useState(() => toDayString(new Date()))

  const [printId, setPrintId] = useState(null)
  const keyRef = useRef(newIdempotencyKey())

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    const params = new URLSearchParams({ source: 'manual', page_size: String(HISTORY_PAGE_SIZE) })
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    try {
      const data = await api.get(`/admin/sales/?${params.toString()}`)
      setHistory(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setHistoryError(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([
      fetchAll('/admin/events/'),
      fetchAll('/admin/assignments/'),
      fetchAll('/admin/staff/'),
      fetchAll('/admin/categories/'),
    ])
      .then(([eventRows, assignmentRows, staffRows, categoryRows]) => {
        if (cancelled) return
        setEvents(eventRows.filter((row) => row.status === 'active'))
        setAssignments(assignmentRows.filter((row) => row.status === 'active'))
        setStaff(staffRows.filter((row) => row.status !== 'inactive'))
        setCategories(categoryRows)
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!eventId) {
      setPrices([])
      return
    }
    let cancelled = false
    setPricesLoading(true)
    fetchAll(`/admin/prices/?event=${eventId}`)
      .then((list) => !cancelled && setPrices(list.filter((price) => price.status === 'active')))
      .catch(() => !cancelled && setPrices([]))
      .finally(() => !cancelled && setPricesLoading(false))
    return () => {
      cancelled = true
    }
  }, [eventId])

  const staffOptions = useMemo(() => {
    if (!eventId) return []
    const assigned = new Set(
      assignments.filter((row) => String(row.event) === String(eventId)).map((row) => String(row.staff)),
    )
    return staff.filter((row) => assigned.has(String(row.id)))
  }, [assignments, staff, eventId])

  const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const usedCategoryIds = rows.map((row) => String(row.category)).filter(Boolean)

  function categoryLabel(price) {
    const match = categories.find((category) => String(category.id) === String(price.category))
    return match ? `${match.name} · ${price.category_code}` : price.category_code
  }

  function changeEvent(value) {
    setEventId(value)
    setStaffId(SELF)
    setRows([blankRow()])
    setError('')
  }

  function updateRow(uid, patch) {
    setRows((current) => current.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
  }

  function removeRow(uid) {
    setRows((current) => (current.length === 1 ? [blankRow()] : current.filter((row) => row.uid !== uid)))
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    setError('')

    const items = rows
      .filter((row) => row.category)
      .map((row) => ({ category: Number(row.category), quantity: Number(row.quantity) }))

    if (!eventId) return setError('Choose an event first.')
    if (!staffId) return setError('Choose who these tickets belong to.')
    if (items.length === 0) return setError('Add at least one ticket category.')
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_PER_CATEGORY)) {
      return setError(`Quantity must be between 1 and ${MAX_PER_CATEGORY} for each category.`)
    }
    if (new Set(items.map((item) => item.category)).size !== items.length) {
      return setError('Each category can only appear once.')
    }

    setBusy(true)
    try {
      const result = await api.post('/admin/tickets/manual/', {
        event: Number(eventId),
        // null tells the API to issue as the logged-in admin (no assignment).
        staff: staffId === SELF ? null : Number(staffId),
        items,
        idempotency_key: keyRef.current,
      })
      setIssued(result)
      keyRef.current = newIdempotencyKey()
      setRows([blankRow()])
      loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="MANUAL TICKETS"
        title="Manual ticket"
        subtitle="Issue complimentary tickets as yourself or on behalf of assigned staff. They print and reprint like normal tickets but never count as revenue."
      >
        <RefreshButton loading={historyLoading} onClick={loadHistory} />
      </PageHead>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="space-y-4">
            {loadError ? <Alert variant="error">{loadError}</Alert> : null}
            {error ? <Alert variant="error">{error}</Alert> : null}

            {issued ? (
              <Alert variant="success">
                <span>
                  {issued.tickets?.length || 0} ticket{(issued.tickets?.length || 0) === 1 ? '' : 's'} issued for{' '}
                  {issued.event_code} under <strong className="font-mono">{issued.sale_reference}</strong>.
                </span>
              </Alert>
            ) : null}

            <Field label="Event" hint="Only active events can issue tickets.">
              <Select value={eventId} onValueChange={changeEvent} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loading ? 'Loading events…' : 'Choose an event'} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={String(event.id)}>
                      {event.code} — {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {eventId && !pricesLoading && prices.length === 0 ? (
              <Alert variant="error">
                <span>
                  This event has no active prices, so tickets cannot be issued.{' '}
                  <Link to="/tenant/prices" className="font-semibold underline">
                    Add prices
                  </Link>
                </span>
              </Alert>
            ) : null}

            <Field
              label="Tickets belong to"
              hint="Issue as yourself, or on behalf of a staff member assigned to this event."
            >
              <Select value={staffId} onValueChange={setStaffId} disabled={!eventId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={!eventId ? 'Choose an event first' : 'Choose a holder'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELF}>Me ({adminLabel})</SelectItem>
                  {staffOptions.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.display_name} ({member.staff_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {eventId && staffOptions.length === 0 && !loading ? (
              <p className="text-xs text-muted-foreground">
                No staff is assigned to this event, so only <strong>Me ({adminLabel})</strong> is
                available. To issue on a staff member&apos;s behalf,{' '}
                <Link to="/tenant/assignments" className="font-semibold text-primary underline">
                  open Assignments
                </Link>
                .
              </p>
            ) : null}

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Ticket categories</p>

              {rows.map((row) => (
                <div key={row.uid} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={row.category}
                      onValueChange={(value) => updateRow(row.uid, { category: value })}
                      disabled={!eventId || prices.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={pricesLoading ? 'Loading…' : 'Category'} />
                      </SelectTrigger>
                      <SelectContent>
                        {prices
                          .filter(
                            (price) =>
                              !usedCategoryIds.includes(String(price.category)) ||
                              String(price.category) === String(row.category),
                          )
                          .map((price) => (
                            <SelectItem key={price.id} value={String(price.category)}>
                              {categoryLabel(price)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    max={MAX_PER_CATEGORY}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.uid, { quantity: e.target.value })}
                    className="w-24"
                    aria-label="Quantity"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.uid)}
                    aria-label="Remove category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRows((current) => [...current, blankRow()])}
                  disabled={!eventId || usedCategoryIds.length >= prices.length}
                >
                  <Plus className="h-3.5 w-3.5" /> Add category
                </Button>
                <p className="text-xs text-muted-foreground">{total} complimentary ticket{total === 1 ? '' : 's'}</p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy || !eventId || !staffId || total === 0}>
              {busy ? 'Issuing…' : `Issue ${total} ticket${total === 1 ? '' : 's'}`}
            </Button>
          </div>
        </form>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-extrabold tracking-[-0.01em]">Complimentary tickets issued</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Manual entries only — POS sales are on the Sales page.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <DateFilter
                label="From"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={setDateFrom}
              />
              <DateFilter label="To" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />
              {dateFrom || dateTo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {historyError ? <Alert variant="error">{historyError}</Alert> : null}

          {historyLoading && history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {dateFrom || dateTo
                ? 'No complimentary tickets were issued in this date range.'
                : 'Nothing issued yet. Complimentary tickets you create will be listed here.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((sale) => {
                const expanded = expandedId === sale.id
                return (
                  <li key={sale.id} className="py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : sale.id)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12.5px] font-semibold">{sale.sale_reference}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                          {sale.event_code} · {sale.staff_name || sale.staff_code} · {formatWhen(sale.created_at)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        {(sale.tickets || []).length} comp{(sale.tickets || []).length === 1 ? '' : 's'}
                      </span>
                    </button>

                    {expanded ? (
                      <ul className="mt-2 space-y-1.5 pl-7">
                        {(sale.tickets || []).map((ticket) => (
                          <li key={ticket.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 break-all font-mono text-[11.5px] text-muted-foreground">
                              {ticket.ticket_code}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => setPrintId(ticket.id)}>
                              <Printer className="h-3.5 w-3.5" /> Print
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <PrintTicketDialog ticketId={printId} open={!!printId} onOpenChange={(value) => !value && setPrintId(null)} />
    </>
  )
}
