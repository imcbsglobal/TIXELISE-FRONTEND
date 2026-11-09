import { CalendarDays } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { PageHead, RefreshButton, StatCard } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

function Breakdown({ title, rows, codeKey, idKey, label, showAmount = false }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{label}</TableHead>
                <TableHead>Tickets</TableHead>
                {showAmount ? <TableHead>Amount</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r[idKey]}>
                  <TableCell className="font-mono text-[13.5px]">{r[codeKey] || '—'}</TableCell>
                  <TableCell className="font-semibold">{r.tickets}</TableCell>
                  {showAmount ? (
                    <TableCell className="font-semibold">{r.amount ?? '—'}</TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const [range, setRange] = useState(() => ({ from: monthStartLocal(), to: todayLocal() }))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const invalidRange = range.from > range.to

  useEffect(() => {
    document.title = 'Tixelise | Overview'
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
      .get(`/admin/reports/daily/?${qs}`)
      .then((res) => !cancelled && setReport(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, reloadToken, invalidRange])

  return (
    <>
      <PageHead
        eyebrow="ANALYTICS"
        title="Overview"
        subtitle="Sales, tickets and breakdowns for the selected date range in your timezone."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <DateField label="From" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
          <DateField label="To" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} />
          <RefreshButton loading={loading} onClick={() => setReloadToken((token) => token + 1)} />
        </div>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tickets sold" value={loading || !report ? '—' : report.tickets_sold} surface="blue" />
        <StatCard label="Transactions" value={loading || !report ? '—' : report.transactions} surface="gray" />
        <StatCard label="Gross sales" value={loading || !report ? '—' : report.gross_sales} surface="green" />
        <StatCard label="Today sales" value={loading || !report ? '—' : report.sales_today} tone="amber" surface="amber" />
      </div>

      {report && !invalidRange && (
        <p className="mb-5 text-sm text-muted-foreground">
          {report.date_from || report.date} → {report.date_to || report.date} · {report.timezone}
        </p>
      )}

      {loading && !report ? (
        <p className="text-sm text-muted-foreground">Loading report…</p>
      ) : report ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Breakdown title="By event" rows={report.by_event || []} codeKey="event_code" idKey="event_id" label="Event" showAmount />
          <Breakdown title="By category" rows={report.by_category || []} codeKey="category_code" idKey="category_id" label="Category" />
          <Breakdown title="By staff" rows={report.by_staff || []} codeKey="staff_code" idKey="staff_id" label="Staff" />
        </div>
      ) : null}
    </>
  )
}
