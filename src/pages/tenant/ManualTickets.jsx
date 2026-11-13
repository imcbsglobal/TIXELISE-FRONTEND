import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Printer, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead } from '@/components/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PrintTicketDialog from '@/components/PrintTicketDialog'
import { getSession } from '@/session'

const MAX_PER_CATEGORY = 100
const SELF = '__self__'
const NO_AGENT = '__none__'

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

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function money(value) {
  return round2(value).toFixed(2)
}

function resolveTax(event, setting) {
  const mode = event?.tax_mode || 'inherit'
  if (mode === 'disabled') return null
  if (mode === 'event') {
    const rate = Number(event?.tax_rate || 0)
    if (!(rate > 0)) return null
    return { rate, inclusive: Boolean(event?.prices_include_tax), label: 'Event tax' }
  }
  if (!setting || !setting.configured || !setting.enabled) return null
  const rate = Number(setting.rate || 0)
  if (!(rate > 0)) return null
  return {
    rate,
    inclusive: Boolean(setting.prices_include_tax),
    label: setting.code || setting.name || 'Tax',
  }
}

function lineTotals(amount, quantity, tax) {
  const gross = round2(Number(amount) * quantity)
  if (!tax) return { base: gross, tax: 0, total: gross }
  if (tax.inclusive) {
    const taxAmount = round2(gross - gross / (1 + tax.rate / 100))
    return { base: round2(gross - taxAmount), tax: taxAmount, total: gross }
  }
  const taxAmount = round2((gross * tax.rate) / 100)
  return { base: gross, tax: taxAmount, total: round2(gross + taxAmount) }
}

function BillRow({ label, value, muted, strong }) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3',
        strong ? 'text-[15px] font-extrabold' : 'text-[13px]',
        muted ? 'text-muted-foreground' : '',
      ].join(' ')}
    >
      <span>{label}</span>
      <span className={strong ? '' : 'font-mono'}>{value}</span>
    </div>
  )
}

export default function ManualTickets() {
  const session = getSession()
  const adminLabel = session?.username || 'admin'
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [events, setEvents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [staff, setStaff] = useState([])
  const [agents, setAgents] = useState([])
  const [categories, setCategories] = useState([])
  const [taxSetting, setTaxSetting] = useState(null)

  const [eventId, setEventId] = useState('')
  const [staffId, setStaffId] = useState(SELF)
  const [agentId, setAgentId] = useState(NO_AGENT)
  const [rows, setRows] = useState([blankRow()])

  const [prices, setPrices] = useState([])
  const [pricesLoading, setPricesLoading] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)

  const [printId, setPrintId] = useState(null)
  const keyRef = useRef(newIdempotencyKey())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    Promise.all([
      fetchAll('/admin/events/'),
      fetchAll('/admin/assignments/'),
      fetchAll('/admin/staff/'),
      fetchAll('/admin/agents/?status=active'),
      fetchAll('/admin/categories/'),
      api.get('/admin/tax-settings/').catch(() => null),
    ])
      .then(([eventRows, assignmentRows, staffRows, agentRows, categoryRows, setting]) => {
        if (cancelled) return
        setEvents(eventRows.filter((row) => row.status === 'active'))
        setAssignments(assignmentRows.filter((row) => row.status === 'active'))
        setStaff(staffRows.filter((row) => row.status !== 'inactive'))
        setAgents(agentRows.filter((row) => row.status === 'active'))
        setCategories(categoryRows)
        setTaxSetting(setting)
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

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

  const selectedEvent = events.find((row) => String(row.id) === String(eventId)) || null
  const tax = useMemo(() => resolveTax(selectedEvent, taxSetting), [selectedEvent, taxSetting])
  const currency = prices[0]?.currency || ''

  const billLines = useMemo(
    () =>
      rows
        .filter((row) => row.category)
        .map((row) => {
          const price = prices.find((entry) => String(entry.category) === String(row.category))
          if (!price) return null
          const quantity = Number(row.quantity) || 0
          return {
            uid: row.uid,
            price,
            quantity,
            ...lineTotals(price.amount, quantity, tax),
          }
        })
        .filter(Boolean),
    [rows, prices, tax],
  )

  const lineByUid = useMemo(
    () => Object.fromEntries(billLines.map((line) => [line.uid, line])),
    [billLines],
  )
  const subtotal = round2(billLines.reduce((sum, line) => sum + line.base, 0))
  const taxTotal = round2(billLines.reduce((sum, line) => sum + line.tax, 0))
  const grandTotal = round2(billLines.reduce((sum, line) => sum + line.total, 0))
  const total = billLines.reduce((sum, line) => sum + line.quantity, 0)
  const usedCategoryIds = rows.map((row) => String(row.category)).filter(Boolean)

  function categoryLabel(price) {
    const match = categories.find((category) => String(category.id) === String(price.category))
    const name = match ? `${match.name} · ${price.category_code}` : price.category_code
    return `${name} — ${price.currency} ${price.amount}`
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

  function resetAfterSuccess() {
    setIssued(null)
    setRows([blankRow()])
    setAgentId(NO_AGENT)
    setError('')
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
        staff: staffId === SELF ? null : Number(staffId),
        agent: agentId === NO_AGENT ? null : Number(agentId),
        items,
        idempotency_key: keyRef.current,
      })
      setIssued(result)
      keyRef.current = newIdempotencyKey()
      setRows([blankRow()])
      setAgentId(NO_AGENT)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (issued) {
    const issuedCurrency = issued.currency || currency
    const tickets = issued.tickets || []
    const ticketCount = tickets.length
    const lastTicket = tickets.reduce(
      (latest, ticket) =>
        !latest || Number(ticket.sequence_number) > Number(latest.sequence_number) ? ticket : latest,
      null,
    )
    return (
      <>
        <PageHead eyebrow="MANUAL TICKETS" title="Tickets issued" />

        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <h2 className="font-display text-[17px] font-extrabold tracking-[-0.01em]">
                  {ticketCount} ticket{ticketCount === 1 ? '' : 's'} issued
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {issued.event_code} · {issued.staff_name || issued.staff_code} · Sale{' '}
                  <span className="font-mono">{issued.sale_reference}</span>
                </p>
                {issued.agent_id ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Agent: {issued.agent_code} — {issued.agent_name}
                    {issued.agent_place ? ` · ${issued.agent_place}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Sale</p>
                <p className="font-mono text-[13px] font-semibold">{issued.sale_reference}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Sale ID</p>
                <p className="font-mono text-[13px] font-semibold">#{issued.id}</p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-border">
              {(issued.items || []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {item.category_name || item.category_code} × {item.quantity}
                    </span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {issuedCurrency} {item.unit_price_snapshot} each
                    </span>
                  </span>
                  <span className="shrink-0 font-mono font-semibold">
                    {issuedCurrency} {money(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-2 space-y-1.5 border-t border-border pt-3">
              <BillRow label="Subtotal" value={`${issuedCurrency} ${money(issued.gross_total)}`} muted />
              {Number(issued.tax_total) > 0 ? (
                <BillRow label="Tax" value={`${issuedCurrency} ${money(issued.tax_total)}`} muted />
              ) : null}
              <BillRow label="Total" value={`${issuedCurrency} ${money(issued.total_payable)}`} strong />
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-border pt-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Last ticket no.
                </p>
                <p className="break-all font-mono text-[12px] font-semibold">{lastTicket?.ticket_code || '—'}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => lastTicket && setPrintId(lastTicket.id)}
                disabled={!lastTicket}
              >
                <Printer className="h-4 w-4" /> Preview / print
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={resetAfterSuccess}>Issue more tickets</Button>
          </div>
        </div>

        <PrintTicketDialog ticketId={printId} open={!!printId} onOpenChange={(value) => !value && setPrintId(null)} />
      </>
    )
  }

  return (
    <>
      <PageHead
        eyebrow="MANUAL TICKETS"
        title="Manual ticket"
        subtitle="Issue manual tickets as yourself or on behalf of assigned staff. Optionally attribute the sale to an agent. The price and tax are charged like a POS sale."
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-5">
        {loadError ? <Alert variant="error">{loadError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <Field label="Agent" hint="Optional. Used for agent sales reporting.">
              <Select value={agentId} onValueChange={setAgentId} disabled={loading || agents.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AGENT}>No agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.code} — {agent.name} ({agent.place})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {eventId && !pricesLoading && prices.length === 0 ? (
            <Alert variant="error" className="mt-4">
              <span>
                This event has no active prices, so tickets cannot be issued.{' '}
                <Link to="/tenant/prices" className="font-semibold underline">
                  Add prices
                </Link>
              </span>
            </Alert>
          ) : null}

          {eventId && staffOptions.length === 0 && !loading ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No staff is assigned to this event, so only <strong>Me ({adminLabel})</strong> is available. To issue
              on a staff member&apos;s behalf,{' '}
              <Link to="/tenant/assignments" className="font-semibold text-primary underline">
                open Assignments
              </Link>
              .
            </p>
          ) : null}

          {!loading && agents.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No active agents yet, so agent attribution is unavailable.{' '}
              <Link to="/tenant/agents" className="font-semibold text-primary underline">
                Create an agent
              </Link>
              .
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_84px_120px_36px] items-end gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Category</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Qty</p>
            <p className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Amount</p>
            <span />
          </div>

          <div className="space-y-3">
            {rows.map((row) => {
              const line = lineByUid[row.uid]
              return (
                <div key={row.uid} className="grid grid-cols-[minmax(0,1fr)_84px_120px_36px] items-center gap-2">
                  <Select
                    value={row.category}
                    onValueChange={(value) => updateRow(row.uid, { category: value })}
                    disabled={!eventId || prices.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={pricesLoading ? 'Loading…' : 'Choose a category'} />
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

                  <Input
                    type="number"
                    min="1"
                    max={MAX_PER_CATEGORY}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.uid, { quantity: e.target.value })}
                    aria-label="Quantity"
                  />

                  <div className="text-right">
                    <p className="font-mono text-[13px] font-semibold">
                      {line ? `${currency} ${money(line.total)}` : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {line ? `${currency} ${money(line.price.amount)} each` : ''}
                    </p>
                  </div>

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
              )
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <p className="text-xs text-muted-foreground">
              {total} ticket{total === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Billing</h3>
          <div className="mt-3 space-y-1.5">
            <BillRow label="Subtotal" value={`${currency} ${money(subtotal)}`} muted />
            {tax ? (
              <BillRow
                label={`${tax.label} (${tax.rate}%)${tax.inclusive ? ' incl.' : ''}`}
                value={`${currency} ${money(taxTotal)}`}
                muted
              />
            ) : null}
            <div className="border-t border-border pt-2">
              <BillRow label="Total" value={`${currency} ${money(grandTotal)}`} strong />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={busy || !eventId || !staffId || total === 0}
        >
          {busy ? 'Issuing…' : `Confirm & issue ${total} ticket${total === 1 ? '' : 's'}${currency ? ` · ${currency} ${money(grandTotal)}` : ''}`}
        </Button>
      </form>
    </>
  )
}
