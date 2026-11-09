import { CalendarDays, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  EmptyRow,
  LoadingRow,
  PageHead,
  Pager,
  RefreshButton,
  SearchInput,
  StatCard,
} from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const DRILL_PAGE_SIZE = 10

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDayString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthStartLocal() {
  const now = new Date()
  return toDayString(new Date(now.getFullYear(), now.getMonth(), 1))
}

function todayLocal() {
  return toDayString(new Date())
}

function formatWhen(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

async function fetchAll(path) {
  const results = []
  let page = 1
  while (page <= 50) {
    const data = await api.get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`)
    if (Array.isArray(data)) return [...results, ...data]
    results.push(...(data.results || []))
    if (!data.next) break
    page += 1
  }
  return results
}

function DateField({ label, value, onChange }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3.5 text-muted-foreground">
      <CalendarDays className="h-[16px] w-[16px] shrink-0" />
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 bg-transparent text-[13.5px] text-foreground outline-none"
      />
    </label>
  )
}

export default function StaffReport() {
  const [range, setRange] = useState(() => ({ from: monthStartLocal(), to: todayLocal() }))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [events, setEvents] = useState([])
  const [eventFilter, setEventFilter] = useState('all')
  const [staff, setStaff] = useState([])
  const [staffFilter, setStaffFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [active, setActive] = useState(null)
  const [sales, setSales] = useState({ count: 0, results: [] })
  const [salesPage, setSalesPage] = useState(1)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState('')

  const invalidRange = range.from > range.to

  useEffect(() => {
    document.title = 'Tixelise | Staff report'
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAll('/admin/events/')
      .then((rows) => !cancelled && setEvents(rows))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAll('/admin/staff/')
      .then((rows) => !cancelled && setStaff(rows))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (invalidRange) {
      setLoading(false)
      setError('The start date must be on or before the end date.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const qs = new URLSearchParams({ date_from: range.from, date_to: range.to })
    if (eventFilter !== 'all') qs.set('event', eventFilter)
    if (staffFilter !== 'all') qs.set('staff', staffFilter)

    api
      .get(`/admin/reports/staff/?${qs}`)
      .then((res) => !cancelled && setReport(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [range.from, range.to, eventFilter, staffFilter, reloadToken, invalidRange])

  const selectedRow =
    staffFilter !== 'all'
      ? (report?.staff || []).find((r) => String(r.staff_id) === staffFilter) || null
      : active

  useEffect(() => {
    if (!selectedRow) return
    let cancelled = false
    setSalesLoading(true)
    setSalesError('')
    const qs = new URLSearchParams({
      staff: String(selectedRow.staff_id),
      date_from: range.from,
      date_to: range.to,
      page: String(salesPage),
      page_size: String(DRILL_PAGE_SIZE),
    })
    api
      .get(`/admin/sales/?${qs}`)
      .then((res) => !cancelled && setSales(res))
      .catch((err) => !cancelled && setSalesError(err.message))
      .finally(() => !cancelled && setSalesLoading(false))
    return () => {
      cancelled = true
    }
  }, [selectedRow?.staff_id, salesPage, range.from, range.to])

  function openSales(row) {
    setActive(row)
    setSalesPage(1)
    setSalesError('')
  }

  const rows = report?.staff || []
  const term = search.trim().toLowerCase()
  const visible = rows.filter((row) => `${row.staff_code} ${row.display_name}`.toLowerCase().includes(term))
  const currency = report?.currency || ''
  const totals = report?.totals
  const salesTotalPages = Math.max(1, Math.ceil(sales.count / DRILL_PAGE_SIZE))

  return (
    <>
      <PageHead
        eyebrow="ANALYTICS"
        title="Staff report"
        subtitle="Ticket sales per staff member for the selected date range."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <DateField label="From" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
          <DateField label="To" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} />
          <Select
            value={staffFilter}
            onValueChange={(value) => {
              setStaffFilter(value)
              setSalesPage(1)
            }}
          >
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={String(member.id)}>
                  {member.staff_code} — {member.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RefreshButton loading={loading} onClick={() => setReloadToken((token) => token + 1)} />
        </div>
      </PageHead>

      {error && (
        <Alert variant="error" className="mb-5">
          {error}
        </Alert>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Staff with sales"
          value={!totals ? '—' : totals.staff_with_sales}
          icon={Users}
          surface="blue"
        />
        <StatCard label="Transactions" value={!totals ? '—' : totals.transactions} tone="gray" surface="gray" />
        <StatCard label="Tickets sold" value={!totals ? '—' : totals.tickets} tone="gray" surface="green" />
        <StatCard
          label="Gross sales"
          value={!totals ? '—' : `${currency} ${totals.gross}`}
          tone="amber"
          surface="amber"
        />
      </div>

      {report && !invalidRange ? (
        <p className="mb-5 text-sm text-muted-foreground">
          {report.date_from} → {report.date_to} · {report.timezone} · Gross {currency} {report.totals.gross} · Refunds{' '}
          {currency} {report.totals.refunds}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by staff name or code…" />
            <Select
              value={eventFilter}
              onValueChange={(value) => {
                setEventFilter(value)
                setActive(null)
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {events.map((event) => (
                  <SelectItem key={event.id} value={String(event.id)}>
                    {event.code} — {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Refunds</TableHead>
                <TableHead>Avg ticket</TableHead>
                <TableHead>Last sale</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !report ? (
                <LoadingRow colSpan={9} />
              ) : visible.length === 0 ? (
                <EmptyRow
                  colSpan={9}
                  message={rows.length === 0 ? 'No staff members yet.' : `No staff match “${search.trim()}”.`}
                />
              ) : (
                visible.map((row) => (
                  <TableRow key={row.staff_id} className={cn(row.transactions === 0 && 'text-muted-foreground')}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ee] text-[11.5px] font-bold text-primary">
                          {initials(row.display_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">{row.display_name}</p>
                          <p className="font-mono text-[11.5px]">{row.staff_code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{row.transactions}</span>
                      {row.voided_transactions > 0 ? (
                        <span className="ml-2 text-[11.5px]">{row.voided_transactions} voided</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.tickets}</TableCell>
                    <TableCell className="font-semibold">
                      {currency} {row.gross}
                    </TableCell>
                    <TableCell>{currency} {row.refunds}</TableCell>
                    <TableCell>{row.avg_ticket_value ? `${currency} ${row.avg_ticket_value}` : '—'}</TableCell>
                    <TableCell className="text-[12.5px]">{formatWhen(row.last_sale_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" disabled={row.transactions === 0} onClick={() => openSales(row)}>
                        View sales
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRow && (
        <Card className="mt-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Sales — {selectedRow.display_name} ({selectedRow.staff_code})
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {range.from} → {range.to} · {selectedRow.transactions} transactions · {selectedRow.tickets} tickets ·{' '}
                <span className="font-semibold text-foreground">
                  Gross {currency} {selectedRow.gross}
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActive(null)
                if (staffFilter !== 'all') setStaffFilter('all')
              }}
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRow.by_event.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {selectedRow.by_event.map((bucket) => (
                  <div key={bucket.event_id} className="rounded-md border border-border px-3.5 py-2.5 text-[13px]">
                    <p className="truncate font-semibold">
                      {bucket.event_code} — {bucket.event_name}
                    </p>
                    <p className="text-muted-foreground">
                      {bucket.transactions} transactions · {bucket.tickets} tickets · gross {currency} {bucket.gross}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {salesError && <Alert variant="error">{salesError}</Alert>}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Refunds</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading ? (
                  <LoadingRow colSpan={7} />
                ) : sales.results.length === 0 ? (
                  <EmptyRow colSpan={7} message="No sales in this range." />
                ) : (
                  sales.results.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-[12.5px]">{sale.sale_reference}</TableCell>
                      <TableCell className="font-mono text-[12.5px]">{sale.event_code}</TableCell>
                      <TableCell className="text-[12.5px]">
                        {(sale.items || []).map((item) => `${item.category_code} ×${item.quantity}`).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {sale.currency} {sale.gross_total}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.currency} {sale.refund_total}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={sale.status} />
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">{formatWhen(sale.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <Pager
              page={salesPage}
              totalPages={salesTotalPages}
              onPrev={() => setSalesPage((page) => page - 1)}
              onNext={() => setSalesPage((page) => page + 1)}
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
