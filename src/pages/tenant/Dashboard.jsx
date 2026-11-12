import { ArrowRight, CalendarDays, Receipt, Tags, Ticket, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { EmptyRow, LoadingRow, PageHead, StatCard } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STAT_META = [
  { key: 'tickets_sold_today', label: 'Tickets sold today', icon: Ticket, tone: 'green' },
  { key: 'total_sales_today', label: 'Total collected today', icon: Receipt, tone: 'green' },
  { key: 'completed_sales_today', label: 'Transactions today', icon: Receipt, tone: 'gray' },
  { key: 'active_events', label: 'Active events', icon: CalendarDays, tone: 'amber' },
  { key: 'active_ticket_types', label: 'Active ticket types', icon: Tags, tone: 'green' },
  { key: 'active_staff', label: 'Active staff', icon: Users, tone: 'gray' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [staffSummary, setStaffSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Tenant dashboard'
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/admin/dashboard/'),
      api.get('/admin/sales/?page=1&page_size=5').catch(() => ({ results: [] })),
      api.get('/admin/reports/staff-summary/').catch(() => null),
    ])
      .then(([dash, sales, staff]) => {
        if (cancelled) return
        setStats(dash)
        setRecentSales(sales.results || [])
        setStaffSummary(staff)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const staffRows = staffSummary?.staff || []
  const currency = staffSummary?.currency || ''

  return (
    <>
      <PageHead
        eyebrow="TENANT OVERVIEW"
        title="Welcome back"
        subtitle={`Today's ticketing activity for your organization${stats ? ` · ${stats.date} (${stats.timezone})` : ''}.`}
      >
        <Button asChild>
          <Link to="/tenant/events">
            Setup event <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STAT_META.map(({ key, label, icon, tone }) => (
          <StatCard key={key} label={label} icon={icon} tone={tone} value={loading || !stats ? '—' : stats[key]} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent sales</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tenant/sales">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : recentSales.length === 0 ? (
                <EmptyRow colSpan={6} icon={Ticket} message="No sales recorded yet — they appear here once POS staff start selling." />
              ) : (
                recentSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[13.5px]">{s.sale_reference}</TableCell>
                    <TableCell>{s.event_name}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{s.staff_code}</TableCell>
                    <TableCell>
                      {s.currency} {s.total_payable}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Sales by staff</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tenant/reports/staff">
              Full report <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Tickets sold</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={4} />
              ) : staffRows.length === 0 ? (
                <EmptyRow colSpan={4} icon={Users} message="No staff in this organization yet." />
              ) : (
                staffRows.map((s) => (
                  <TableRow key={s.staff_id}>
                    <TableCell>
                      <span className="font-mono text-[13.5px]">{s.staff_code}</span>
                      <span className="ml-2 text-muted-foreground">{s.display_name}</span>
                    </TableCell>
                    <TableCell className="font-semibold">{s.tickets}</TableCell>
                    <TableCell>{s.transactions}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency} {s.amount}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {staffSummary && (
            <p className="mt-3 text-sm text-muted-foreground">
              {staffSummary.date_from === staffSummary.date_to
                ? staffSummary.date_from
                : `${staffSummary.date_from} → ${staffSummary.date_to}`}
              {' · '}
              {staffSummary.totals.tickets} tickets · {staffSummary.totals.transactions} transactions ·{' '}
              {staffSummary.currency} {staffSummary.totals.amount}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
