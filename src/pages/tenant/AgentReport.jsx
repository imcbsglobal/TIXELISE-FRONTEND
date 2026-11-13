import { CalendarDays, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  EmptyRow,
  LoadingRow,
  PageHead,
  RefreshButton,
  SearchInput,
  StatCard,
} from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

export default function AgentReport() {
  const [range, setRange] = useState(() => ({ from: monthStartLocal(), to: todayLocal() }))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')

  const invalidRange = range.from > range.to

  useEffect(() => {
    document.title = 'Tixelise | Agent report'
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

    api
      .get(`/admin/reports/agents/?${qs}`)
      .then((res) => !cancelled && setReport(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [range.from, range.to, reloadToken, invalidRange])

  const rows = report?.agents || []
  const term = search.trim().toLowerCase()
  const visible = rows.filter((row) =>
    `${row.agent_code} ${row.agent_name} ${row.place}`.toLowerCase().includes(term),
  )
  const currency = report?.currency || ''
  const totals = report?.totals

  return (
    <>
      <PageHead
        eyebrow="ANALYTICS"
        title="Agent report"
        subtitle="Tickets sold and revenue attributed to each agent for the selected date range."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <DateField label="From" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
          <DateField label="To" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} />
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
          label="Agents with sales"
          value={!totals ? '—' : totals.agents_with_sales}
          icon={Users}
          surface="blue"
        />
        <StatCard label="Transactions" value={!totals ? '—' : totals.transactions} tone="gray" surface="gray" />
        <StatCard label="Tickets sold" value={!totals ? '—' : totals.tickets} tone="gray" surface="green" />
        <StatCard
          label="Total collected"
          value={!totals ? '—' : `${currency} ${totals.total}`}
          tone="gray"
          surface="green"
        />
      </div>

      {report && !invalidRange ? (
        <p className="mb-5 text-sm text-muted-foreground">
          {report.date_from} → {report.date_to} · {report.timezone} · Gross {currency} {report.totals.gross} · Tax{' '}
          {currency} {report.totals.tax} · Refunds {currency} {report.totals.refunds} · Total {currency}{' '}
          {report.totals.total}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by agent name, code or place…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Last sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !report ? (
                <LoadingRow colSpan={9} />
              ) : visible.length === 0 ? (
                <EmptyRow
                  colSpan={9}
                  message={
                    rows.length === 0
                      ? 'No agents yet. Create agents from the Agents master.'
                      : `No agents match “${search.trim()}”.`
                  }
                />
              ) : (
                visible.map((row) => (
                  <TableRow key={row.agent_id} className={cn(row.transactions === 0 && 'text-muted-foreground')}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eaf3ee] text-[11.5px] font-bold text-primary">
                          {initials(row.agent_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">{row.agent_name}</p>
                          <p className="font-mono text-[11.5px]">{row.agent_code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.place || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="font-semibold">{row.transactions}</TableCell>
                    <TableCell>{row.tickets}</TableCell>
                    <TableCell className="font-semibold">
                      {currency} {row.gross}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {currency} {row.tax}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {currency} {row.total}
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">
                      {formatWhen(row.last_sale_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
