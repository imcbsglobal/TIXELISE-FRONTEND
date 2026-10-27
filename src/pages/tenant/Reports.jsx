import { CalendarDays } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { PageHead, StatCard } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function Breakdown({ title, rows, codeKey, idKey, label }) {
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r[idKey]}>
                  <TableCell className="font-mono text-[13.5px]">{r[codeKey] || '—'}</TableCell>
                  <TableCell className="font-semibold">{r.tickets}</TableCell>
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
  const [date, setDate] = useState(todayLocal())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Reports'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/admin/reports/daily/?date=${date}`)
      .then((res) => !cancelled && setReport(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [date])

  return (
    <>
      <PageHead
        eyebrow="ANALYTICS"
        title="Daily report"
        subtitle="Sales, tickets and breakdowns for a single day in your timezone."
      >
        <label className="flex h-11 items-center gap-2.5 rounded-md border border-input bg-background px-4 text-muted-foreground">
          <CalendarDays className="h-[17px] w-[17px]" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-0 bg-transparent text-[14.5px] text-foreground outline-none"
          />
        </label>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tickets sold" value={loading || !report ? '—' : report.tickets_sold} />
        <StatCard label="Transactions" value={loading || !report ? '—' : report.transactions} />
        <StatCard label="Gross sales" value={loading || !report ? '—' : report.gross_sales} />
        <StatCard label="Net sales" value={loading || !report ? '—' : report.net_sales} />
      </div>

      {report && (
        <p className="mb-5 text-sm text-muted-foreground">
          {report.date} · {report.timezone} · Refunds {report.refunds}
        </p>
      )}

      {loading && !report ? (
        <p className="text-sm text-muted-foreground">Loading report…</p>
      ) : report ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Breakdown title="By event" rows={report.by_event || []} codeKey="event_code" idKey="event_id" label="Event" />
          <Breakdown title="By category" rows={report.by_category || []} codeKey="category_code" idKey="category_id" label="Category" />
          <Breakdown title="By staff" rows={report.by_staff || []} codeKey="staff_code" idKey="staff_id" label="Staff" />
        </div>
      ) : null}
    </>
  )
}
