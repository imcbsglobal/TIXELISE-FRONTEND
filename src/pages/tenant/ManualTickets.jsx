import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Plus, Printer, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead } from '@/components/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import GroupedTicketPrintDialog from '@/components/GroupedTicketPrintDialog'
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

function blankRow(eventId = '') {
  return {
    uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventId: eventId ? String(eventId) : '',
    category: '',
    quantity: 1,
  }
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

function groupBillLines(lines) {
  const groups = []
  const byEvent = new Map()

  for (const line of lines) {
    const key = String(line.event.id)
    let group = byEvent.get(key)
    if (!group) {
      group = {
        key,
        event: line.event,
        currency: line.price.currency,
        lines: [],
        quantity: 0,
        subtotal: 0,
        taxTotal: 0,
        total: 0,
        taxMeta: line.taxMeta,
      }
      byEvent.set(key, group)
      groups.push(group)
    }
    group.lines.push(line)
    group.quantity += line.quantity
    group.subtotal = round2(group.subtotal + line.base)
    group.taxTotal = round2(group.taxTotal + line.tax)
    group.total = round2(group.total + line.total)
    if (!group.taxMeta && line.taxMeta) group.taxMeta = line.taxMeta
  }

  return groups
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

function MobileLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
      {children}
    </p>
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

  const [staffId, setStaffId] = useState(SELF)
  const [agentId, setAgentId] = useState(NO_AGENT)
  const [rows, setRows] = useState(() => [blankRow()])
  const ticketRowsRef = useRef(null)
  const pendingTicketRowFocusRef = useRef('')

  const [pricesByEvent, setPricesByEvent] = useState({})
  const [pricesLoading, setPricesLoading] = useState({})
  const priceRequestsRef = useRef(new Set())
  const mountedRef = useRef(true)
  const idempotencyRef = useRef(new Map())

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [issued, setIssued] = useState(null)
  const [printSelection, setPrintSelection] = useState(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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
    const uid = pendingTicketRowFocusRef.current
    if (!uid || loading) return
    const eventField = ticketRowsRef.current?.querySelector(
      `[data-ticket-row="${uid}"] [data-ticket-field="event"]`,
    )
    if (eventField && !eventField.disabled) {
      eventField.focus()
      pendingTicketRowFocusRef.current = ''
    }
  }, [rows, loading])

  const loadPricesForEvent = useCallback(async (rawEventId) => {
    const eventId = String(rawEventId || '')
    if (!eventId || priceRequestsRef.current.has(eventId)) return

    priceRequestsRef.current.add(eventId)
    setPricesLoading((current) => ({ ...current, [eventId]: true }))
    try {
      const list = await fetchAll(`/admin/prices/?event=${eventId}`)
      if (!mountedRef.current) return
      setPricesByEvent((current) => ({
        ...current,
        [eventId]: list.filter((price) => price.status === 'active'),
      }))
    } catch {
      if (!mountedRef.current) return
      setPricesByEvent((current) => ({ ...current, [eventId]: [] }))
    } finally {
      priceRequestsRef.current.delete(eventId)
      if (mountedRef.current) {
        setPricesLoading((current) => ({ ...current, [eventId]: false }))
      }
    }
  }, [])

  const eventById = useMemo(
    () => Object.fromEntries(events.map((event) => [String(event.id), event])),
    [events],
  )

  const selectedEventIds = useMemo(() => {
    const seen = new Set()
    const ids = []
    for (const row of rows) {
      const eventId = String(row.eventId || '')
      if (!eventId || seen.has(eventId)) continue
      seen.add(eventId)
      ids.push(eventId)
    }
    return ids
  }, [rows])

  const selectedEventKey = selectedEventIds.join('|')

  useEffect(() => {
    if (!selectedEventKey) return
    for (const eventId of selectedEventKey.split('|')) loadPricesForEvent(eventId)
  }, [selectedEventKey, loadPricesForEvent])

  const staffOptions = useMemo(() => {
    if (selectedEventIds.length === 0) return []

    const assignedStaff = new Map()
    for (const assignment of assignments) {
      const eventId = String(assignment.event)
      if (!assignedStaff.has(eventId)) assignedStaff.set(eventId, new Set())
      assignedStaff.get(eventId).add(String(assignment.staff))
    }

    return staff.filter((member) =>
      selectedEventIds.every((eventId) => assignedStaff.get(eventId)?.has(String(member.id))),
    )
  }, [assignments, selectedEventIds, staff])

  useEffect(() => {
    if (staffId === SELF) return
    if (!staffOptions.some((member) => String(member.id) === String(staffId))) {
      setStaffId(SELF)
    }
  }, [staffId, staffOptions])

  const pricesLoadingForSelected = selectedEventIds.some((eventId) => pricesLoading[eventId])

  const emptyPriceEventIds = selectedEventIds.filter((eventId) => {
    const list = pricesByEvent[eventId]
    return !pricesLoading[eventId] && Array.isArray(list) && list.length === 0
  })

  const usedCategoriesByEvent = useMemo(() => {
    const used = {}
    for (const row of rows) {
      if (!row.eventId || !row.category) continue
      const eventId = String(row.eventId)
      if (!used[eventId]) used[eventId] = new Set()
      used[eventId].add(String(row.category))
    }
    return used
  }, [rows])

  const billLines = useMemo(() => {
    const lines = []
    for (const row of rows) {
      if (!row.eventId || !row.category) continue
      const eventId = String(row.eventId)
      const event = eventById[eventId]
      const price = (pricesByEvent[eventId] || []).find(
        (entry) => String(entry.category) === String(row.category),
      )
      if (!event || !price) continue

      const quantity = Number(row.quantity) || 0
      const taxMeta = resolveTax(event, taxSetting)
      lines.push({
        uid: row.uid,
        event,
        price,
        quantity,
        taxMeta,
        ...lineTotals(price.amount, quantity, taxMeta),
      })
    }
    return lines
  }, [eventById, pricesByEvent, rows, taxSetting])

  const lineByUid = useMemo(
    () => Object.fromEntries(billLines.map((line) => [line.uid, line])),
    [billLines],
  )

  const billGroups = useMemo(() => groupBillLines(billLines), [billLines])
  const subtotal = round2(billLines.reduce((sum, line) => sum + line.base, 0))
  const taxTotal = round2(billLines.reduce((sum, line) => sum + line.tax, 0))
  const grandTotal = round2(billLines.reduce((sum, line) => sum + line.total, 0))
  const total = billLines.reduce((sum, line) => sum + line.quantity, 0)
  const currencies = Array.from(new Set(billLines.map((line) => line.price.currency)))
  const currency = currencies.length === 1 ? currencies[0] : ''
  const mixedCurrency = currencies.length > 1

  function categoryLabel(price) {
    const match = categories.find((category) => String(category.id) === String(price.category))
    const name = match ? `${match.name} · ${price.category_code}` : price.category_code
    return `${name} — ${price.currency} ${price.amount}`
  }

  function priceOptionsFor(row) {
    const eventId = String(row.eventId || '')
    const prices = pricesByEvent[eventId] || []
    const used = usedCategoriesByEvent[eventId] || new Set()
    return prices.filter(
      (price) => String(price.category) === String(row.category) || !used.has(String(price.category)),
    )
  }

  function updateRow(uid, patch) {
    setRows((current) => current.map((row) => (row.uid === uid ? { ...row, ...patch } : row)))
    setError('')
  }

  function changeRowEvent(uid, value) {
    updateRow(uid, { eventId: value, category: '' })
    loadPricesForEvent(value)
  }

  function addRow({ focusFirst = false } = {}) {
    const previousEventId = [...rows].reverse().find((row) => row.eventId)?.eventId || ''
    const row = blankRow(previousEventId)
    if (focusFirst) pendingTicketRowFocusRef.current = row.uid
    setRows((current) => [...current, row])
    setError('')
  }

  function handleTicketShortcuts(event) {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return

    if (event.key === 'Enter') {
      event.preventDefault()
      addRow({ focusFirst: true })
      return
    }

    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const field = event.target.closest?.('[data-ticket-field]')
    const row = field?.closest('[data-ticket-row]')
    if (!field || !row) return

    const fields = ['event', 'category', 'quantity']
    const currentIndex = fields.indexOf(field.dataset.ticketField)
    if (currentIndex < 0) return

    event.preventDefault()
    const nextIndex = currentIndex + (event.key === 'ArrowRight' ? 1 : -1)
    if (nextIndex < 0 || nextIndex >= fields.length) return

    row.querySelector(`[data-ticket-field="${fields[nextIndex]}"]`)?.focus()
  }

  function removeRow(uid) {
    setRows((current) => {
      if (current.length === 1) return [blankRow(current[0]?.eventId || '')]
      return current.filter((row) => row.uid !== uid)
    })
    setError('')
  }

  function resetForm() {
    setRows([blankRow()])
    setStaffId(SELF)
    setAgentId(NO_AGENT)
    setError('')
  }

  function startFresh() {
    idempotencyRef.current = new Map()
    setIssued(null)
    setPrintSelection(null)
    resetForm()
  }

  function continueRemaining() {
    const completedEventIds = new Set(issued.sales.map((sale) => String(sale.event)))
    const message = (issued.failures || [])
      .map((failure) => `${failure.event.code} — ${failure.event.name}: ${failure.message}`)
      .join(' ')

    setRows((current) => {
      const remaining = current.filter((row) => !completedEventIds.has(String(row.eventId)))
      return remaining.length ? remaining : [blankRow()]
    })
    setIssued(null)
    setPrintSelection(null)
    setError(message)
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    setError('')

    const incomplete = rows.find((row) => (row.eventId || row.category) && (!row.eventId || !row.category))
    if (incomplete) return setError('Choose both an event and a category for every ticket row.')

    const lineRows = rows.filter((row) => row.eventId && row.category)
    if (lineRows.length === 0) return setError('Add at least one event ticket.')
    if (selectedEventIds.length === 0) return setError('Choose at least one event.')
    if (pricesLoadingForSelected) return setError('Wait for ticket prices to finish loading.')
    if (staffId !== SELF && !staffOptions.some((member) => String(member.id) === String(staffId))) {
      return setError('Choose a ticket holder who is assigned to every selected event.')
    }

    const groupsByEvent = new Map()
    for (const row of lineRows) {
      const eventId = String(row.eventId)
      const event = eventById[eventId]
      if (!event) return setError('One of the selected events is no longer available.')

      const prices = pricesByEvent[eventId]
      if (!prices || prices.length === 0) {
        return setError(`${event.code} has no active prices, so tickets cannot be issued.`)
      }

      const quantity = Number(row.quantity)
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_PER_CATEGORY
      ) {
        return setError(`Quantity must be between 1 and ${MAX_PER_CATEGORY} for each category.`)
      }

      if (!prices.some((price) => String(price.category) === String(row.category))) {
        return setError(`Choose a valid category for ${event.code}.`)
      }

      if (!groupsByEvent.has(eventId)) {
        groupsByEvent.set(eventId, { event, items: [], categories: new Set() })
      }
      const group = groupsByEvent.get(eventId)
      if (group.categories.has(String(row.category))) {
        return setError(`${event.code} has the same category twice. Each category can only appear once per event.`)
      }
      group.categories.add(String(row.category))
      group.items.push({ category: Number(row.category), quantity })
    }

    const groups = Array.from(groupsByEvent.values())
    setBusy(true)
    const sales = []

    try {
      for (const group of groups) {
        const eventId = String(group.event.id)
        let idempotencyKey = idempotencyRef.current.get(eventId)
        if (!idempotencyKey) {
          idempotencyKey = newIdempotencyKey()
          idempotencyRef.current.set(eventId, idempotencyKey)
        }

        try {
          const result = await api.post('/admin/tickets/manual/', {
            event: Number(group.event.id),
            staff: staffId === SELF ? null : Number(staffId),
            agent: agentId === NO_AGENT ? null : Number(agentId),
            items: group.items,
            idempotency_key: idempotencyKey,
          })
          idempotencyRef.current.delete(eventId)
          sales.push(result)
        } catch (err) {
          if (sales.length === 0) {
            setError(`${group.event.code} — ${group.event.name}: ${err.message}`)
            return
          }
          setIssued({
            sales,
            failures: [{ event: group.event, message: err.message }],
          })
          return
        }
      }

      setIssued({ sales, failures: [] })
      resetForm()
    } finally {
      setBusy(false)
    }
  }

  if (issued) {
    const sales = issued.sales || []
    const failures = issued.failures || []
    const allTickets = sales.flatMap((sale) => sale.tickets || [])
    const groupedSales = []
    const salesByEvent = new Map()

    for (const sale of sales) {
      const key = String(sale.event)
      let group = salesByEvent.get(key)
      if (!group) {
        group = {
          key,
          code: sale.event_code,
          name: sale.event_name,
          currency: sale.currency,
          references: [],
          items: [],
          tickets: [],
          grossTotal: 0,
          taxTotal: 0,
          totalPayable: 0,
        }
        salesByEvent.set(key, group)
        groupedSales.push(group)
      }
      group.references.push(sale.sale_reference)
      group.items.push(...(sale.items || []))
      group.tickets.push(...(sale.tickets || []))
      group.grossTotal = round2(group.grossTotal + Number(sale.gross_total || 0))
      group.taxTotal = round2(group.taxTotal + Number(sale.tax_total || 0))
      group.totalPayable = round2(group.totalPayable + Number(sale.total_payable || 0))
    }

    const firstSale = sales[0]
    const allTicketIds = allTickets.map((ticket) => ticket.id)

    return (
      <>
        <PageHead eyebrow="MANUAL TICKETS" title="Tickets issued" />

        <div className="mx-auto max-w-6xl space-y-5">
          <div className="rounded-lg border-[1.5px] border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[17px] font-extrabold tracking-[-0.01em]">
                  {allTickets.length} ticket{allTickets.length === 1 ? '' : 's'} issued across{' '}
                  {groupedSales.length} event{groupedSales.length === 1 ? '' : 's'}
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {firstSale?.staff_name || firstSale?.staff_code}
                  {firstSale?.agent_id
                    ? ` · Agent: ${firstSale.agent_code} — ${firstSale.agent_name}${firstSale.agent_place ? ` · ${firstSale.agent_place}` : ''}`
                    : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allTicketIds.length ? (
                    <Button
                      type="button"
                      onClick={() =>
                        setPrintSelection({ ids: allTicketIds, label: 'all issued tickets' })
                      }
                    >
                      <Printer className="h-4 w-4" /> Print all issued
                    </Button>
                  ) : null}
                  {failures.length ? (
                    <Button type="button" variant="outline" onClick={continueRemaining}>
                      Continue remaining events
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={startFresh}>
                      Issue more tickets
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {failures.length ? (
            <Alert variant="error">
              <p className="font-semibold">Some events were not issued.</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {failures.map((failure) => (
                  <li key={failure.event.id}>
                    {failure.event.code} — {failure.event.name}: {failure.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                The successful events above are already saved. Continue with the remaining events from the form.
              </p>
            </Alert>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-2">
            {groupedSales.map((group) => {
              const sortedTickets = [...group.tickets].sort(
                (a, b) => Number(a.sequence_number) - Number(b.sequence_number),
              )
              const firstTicket = sortedTickets[0]
              const lastTicket = sortedTickets[sortedTickets.length - 1]

              return (
                <div key={group.key} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Event
                      </p>
                      <h3 className="font-display text-[16px] font-extrabold tracking-[-0.01em]">
                        {group.code} — {group.name}
                      </h3>
                      <p className="mt-1 break-all font-mono text-[12px] text-muted-foreground">
                        Sale {group.references.join(', ')}
                      </p>
                    </div>
                    <p className="shrink-0 text-[12px] font-semibold text-muted-foreground">
                      {group.tickets.length} ticket{group.tickets.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <ul className="mt-4 divide-y divide-border">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {item.category_name || item.category_code} × {item.quantity}
                          </span>
                          <span className="block text-[11.5px] text-muted-foreground">
                            {group.currency} {item.unit_price_snapshot} each
                            {Number(item.tax_amount) > 0 ? ` · tax ${item.tax_amount}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono font-semibold">
                          {group.currency} {money(item.line_total)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 space-y-1.5 border-t border-border pt-3">
                    <BillRow
                      label="Subtotal"
                      value={`${group.currency} ${money(group.grossTotal)}`}
                      muted
                    />
                    {group.taxTotal > 0 ? (
                      <BillRow label="Tax" value={`${group.currency} ${money(group.taxTotal)}`} muted />
                    ) : null}
                    <BillRow
                      label="Total"
                      value={`${group.currency} ${money(group.totalPayable)}`}
                      strong
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-border pt-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Ticket numbers
                      </p>
                      <p className="break-all font-mono text-[12px] font-semibold">
                        {firstTicket && lastTicket
                          ? firstTicket.id === lastTicket.id
                            ? firstTicket.ticket_code
                            : `${firstTicket.ticket_code} … ${lastTicket.ticket_code}`
                          : '—'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPrintSelection({
                          ids: group.tickets.map((ticket) => ticket.id),
                          label: 'event tickets',
                        })
                      }
                      disabled={group.tickets.length === 0}
                    >
                      <Printer className="h-4 w-4" /> Print event tickets
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <GroupedTicketPrintDialog
          ticketIds={printSelection?.ids || []}
          open={!!printSelection}
          onOpenChange={(value) => !value && setPrintSelection(null)}
          label={printSelection?.label}
        />
      </>
    )
  }

  return (
    <>
      <PageHead
        eyebrow="MANUAL TICKETS"
        title="Manual ticket"
        subtitle="Issue tickets for one or more events in a single entry. Choose the holder and agent once, then add event and category rows; each event is saved as its own sale."
      />

      <form onSubmit={(event) => event.preventDefault()} className="mx-auto max-w-[1320px] space-y-5">
        {loadError ? <Alert variant="error">{loadError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          <div className="order-1 space-y-4">
            <div
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
              onKeyDown={handleTicketShortcuts}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[220px] flex-1">
                  <h2 className="font-display text-[18px] font-extrabold tracking-[-0.01em]">
                    Event tickets
                  </h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Select an event and category, then use Add ticket row for more event tickets.
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Keyboard: Ctrl+→ / Ctrl+← to move between fields · Ctrl+Enter to add a row
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
                    {selectedEventIds.length} event{selectedEventIds.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[440px] xl:shrink-0">
                  <Field label="Tickets belong to">
                    <Select
                      value={staffId}
                      onValueChange={setStaffId}
                      disabled={loading || selectedEventIds.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            selectedEventIds.length === 0
                              ? 'Choose an event first'
                              : 'Choose a holder'
                          }
                        />
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

                  <Field label="Agent">
                    <Select
                      value={agentId}
                      onValueChange={setAgentId}
                      disabled={loading || agents.length === 0}
                    >
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
              </div>

              {selectedEventIds.length > 0 && staffOptions.length === 0 && !loading ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No staff is assigned to all selected events, so only{' '}
                  <strong>Me ({adminLabel})</strong> is available. To issue on a staff member&apos;s
                  behalf,{' '}
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

              {emptyPriceEventIds.length > 0 ? (
                <Alert variant="error" className="mt-4">
                  <span>
                    {emptyPriceEventIds
                      .map((eventId) => eventById[eventId]?.code)
                      .filter(Boolean)
                      .join(', ')}{' '}
                    {emptyPriceEventIds.length === 1 ? 'has' : 'have'} no active prices, so tickets
                    cannot be issued for {emptyPriceEventIds.length === 1 ? 'it' : 'them'}.{' '}
                    <Link to="/tenant/prices" className="font-semibold underline">
                      Add prices
                    </Link>
                  </span>
                </Alert>
              ) : null}

              <div className="mt-4 hidden grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_78px_180px_36px] items-end gap-2 md:grid">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Event</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Category
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Qty
                </p>
                <p className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Price + tax
                </p>
                <span />
              </div>

              <div ref={ticketRowsRef} className="mt-3 space-y-3">
                {rows.map((row) => {
                  const line = lineByUid[row.uid]
                  const eventId = String(row.eventId || '')
                  const prices = pricesByEvent[eventId] || []
                  const loadingPrices = Boolean(pricesLoading[eventId])
                  const event = eventById[eventId]

                  return (
                    <div
                      key={row.uid}
                      data-ticket-row={row.uid}
                      className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.25fr)_78px_180px_36px] md:items-center md:gap-2 md:border-0 md:p-0"
                    >
                      <div className="space-y-1 md:contents">
                        <MobileLabel>Event</MobileLabel>
                        <Select
                          value={row.eventId}
                          onValueChange={(value) => changeRowEvent(row.uid, value)}
                          disabled={loading}
                        >
                          <SelectTrigger className="w-full" data-ticket-field="event">
                            <SelectValue placeholder={loading ? 'Loading events…' : 'Choose an event'} />
                          </SelectTrigger>
                          <SelectContent>
                            {events.map((eventOption) => (
                              <SelectItem key={eventOption.id} value={String(eventOption.id)}>
                                {eventOption.code} — {eventOption.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:contents">
                        <MobileLabel>Category</MobileLabel>
                        <Select
                          value={row.category}
                          onValueChange={(value) => updateRow(row.uid, { category: value })}
                          disabled={!row.eventId || loadingPrices || prices.length === 0}
                        >
                          <SelectTrigger className="w-full" data-ticket-field="category">
                            <SelectValue
                              placeholder={
                                !row.eventId
                                  ? 'Choose an event first'
                                  : loadingPrices
                                    ? 'Loading prices…'
                                    : prices.length === 0
                                      ? 'No active prices'
                                      : 'Choose a category'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {priceOptionsFor(row).map((price) => (
                              <SelectItem key={price.id} value={String(price.category)}>
                                {categoryLabel(price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:contents">
                        <MobileLabel>Qty</MobileLabel>
                        <Input
                          type="number"
                          min="1"
                          max={MAX_PER_CATEGORY}
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.uid, { quantity: event.target.value })
                          }
                          aria-label="Quantity"
                          data-ticket-field="quantity"
                        />
                      </div>

                      <div className="space-y-1 md:text-right">
                        <MobileLabel>Price + tax</MobileLabel>
                        {line ? (
                          <>
                            <p className="font-mono text-[12.5px] font-semibold">
                              {line.price.currency} {money(line.price.amount)}
                              {line.tax > 0 ? ` + ${money(line.tax)} tax` : ' · no tax'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Line {line.price.currency} {money(line.total)}
                            </p>
                          </>
                        ) : (
                          <p className="text-[12px] text-muted-foreground">
                            {row.category && event ? 'Calculating…' : '—'}
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.uid)}
                        aria-label="Remove ticket row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
                  <Plus className="h-4 w-4" /> Add ticket row
                </Button>
                <p className="text-xs text-muted-foreground">
                  {total} ticket{total === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          <div className="order-2 flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm xl:sticky xl:top-4 xl:col-start-2 xl:h-[min(680px,calc(100vh-2rem))] xl:overflow-hidden">
            <h3 className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Billing
            </h3>

            {billGroups.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No ticket lines yet.</p>
            ) : (
              <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {billGroups.map((group) => (
                  <div key={group.key} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3 text-[12px] font-semibold">
                      <span className="min-w-0">
                        {group.event.code} — {group.event.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {group.quantity} ticket{group.quantity === 1 ? '' : 's'}
                      </span>
                    </div>
                    <BillRow
                      label="Subtotal"
                      value={`${group.currency} ${money(group.subtotal)}`}
                      muted
                    />
                    {group.taxTotal > 0 ? (
                      <BillRow
                        label={
                          group.taxMeta
                            ? `${group.taxMeta.label} (${group.taxMeta.rate}%)${group.taxMeta.inclusive ? ' incl.' : ''}`
                            : 'Tax'
                        }
                        value={`${group.currency} ${money(group.taxTotal)}`}
                        muted
                      />
                    ) : null}
                    <BillRow
                      label="Event total"
                      value={`${group.currency} ${money(group.total)}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 shrink-0 space-y-1.5 border-t border-border pt-3">
              <BillRow
                label="Subtotal"
                value={mixedCurrency ? money(subtotal) : `${currency} ${money(subtotal)}`}
                muted
              />
              {taxTotal > 0 ? (
                <BillRow
                  label="Tax"
                  value={mixedCurrency ? money(taxTotal) : `${currency} ${money(taxTotal)}`}
                  muted
                />
              ) : null}
              <BillRow
                label="Grand total"
                value={mixedCurrency ? money(grandTotal) : `${currency} ${money(grandTotal)}`}
                strong
              />
              {mixedCurrency ? (
                <p className="text-[11px] text-muted-foreground">
                  Selected events use different currencies.
                </p>
              ) : null}
            </div>

            <Button
              type="button"
              onClick={handleSubmit}
              className="mt-4 w-full shrink-0"
              disabled={busy || total === 0 || pricesLoadingForSelected}
            >
              {busy
                ? 'Issuing…'
                : `Confirm & issue ${total} ticket${total === 1 ? '' : 's'}${
                    total > 0
                      ? mixedCurrency
                        ? ` · ${money(grandTotal)}`
                        : ` · ${currency} ${money(grandTotal)}`
                      : ''
                  }`}
            </Button>
            <p className="mt-2 shrink-0 text-[11px] text-muted-foreground">
              Each event is issued as a separate sale.
            </p>
          </div>
        </div>
      </form>
    </>
  )
}
