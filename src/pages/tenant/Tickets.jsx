import { Eye, Printer } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20
const STATUSES = ['issued', 'voided', 'refunded']

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

export default function Tickets() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  const [events, setEvents] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')

  const [reprint, setReprint] = useState(null)

  useEffect(() => {
    document.title = 'Tixelise | Tickets'
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAll('/admin/events/').then((evs) => !cancelled && setEvents(evs)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    if (eventFilter !== 'all') qs.set('event', eventFilter)
    api
      .get(`/admin/tickets/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, eventFilter, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((t) =>
    `${t.ticket_code} ${t.event_code} ${t.staff_code} ${t.category_name}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function openDetail(ticket) {
    setDetailError('')
    try {
      const full = await api.get(`/admin/tickets/${ticket.id}/`)
      setDetail(full)
    } catch (err) {
      setDetailError(err.message)
    }
  }

  async function doReprint(ticket) {
    setBusyId(ticket.id)
    setActionError('')
    try {
      const res = await api.post(`/admin/tickets/${ticket.id}/reprint/`)
      setReprint(res)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHead eyebrow="ISSUED TICKETS" title="Tickets" subtitle="Every ticket issued by your staff, with reprint history.">
        <RefreshButton loading={loading} onClick={reload} />
      </PageHead>

      {actionError && <Alert variant="error" className="mb-5">{actionError}</Alert>}
      {error && !actionError && <Alert variant="error" className="mb-5">{error}</Alert>}
      {detailError && <Alert variant="error" className="mb-5">{detailError}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by ticket, event, staff or category…" />
            <div className="flex items-center gap-3">
              <Select
                value={eventFilter}
                onValueChange={(v) => {
                  setEventFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)}>
                      {ev.code} — {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket code</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Seq</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Reprints</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={9} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={9} message="No tickets found." />
              ) : (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-[12.5px]">{t.ticket_code}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{t.event_code}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{t.staff_code}</TableCell>
                    <TableCell>{t.category_name}</TableCell>
                    <TableCell>{t.sequence_number}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(t.issued_at).toLocaleString()}</TableCell>
                    <TableCell>{t.reprint_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(t)}>
                          <Eye className="h-3.5 w-3.5" /> Details
                        </Button>
                        <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => doReprint(t)}>
                          <Printer className="h-3.5 w-3.5" /> Reprint
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ticket details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <p className="break-all rounded-md bg-muted px-4 py-3.5 font-mono text-sm text-[#053f33]">
                {detail.ticket_code}
              </p>
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span>Event {detail.event_code}</span>
                <span>Staff {detail.staff_code}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">Category</p>
                  <p className="text-[15px]">{detail.category_name}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">Sequence number</p>
                  <p className="text-[15px]">{detail.sequence_number}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">Issued at</p>
                  <p className="text-[15px]">{new Date(detail.issued_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">Reprint count</p>
                  <p className="text-[15px]">{detail.reprint_count}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                <Button disabled={busyId === detail.id} onClick={() => doReprint(detail)}>
                  <Printer className="h-4 w-4" /> Reprint
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reprint} onOpenChange={(v) => !v && setReprint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprint ready</DialogTitle>
          </DialogHeader>
          {reprint && (
            <div className="space-y-4">
              <Alert variant="success">
                Reprint recorded for <strong className="font-mono">{reprint.ticket_code}</strong>. Reprint count is now{' '}
                <strong>{reprint.reprint_count}</strong>.
              </Alert>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Print payload</p>
              <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
                {JSON.stringify(reprint.print_payload, null, 2)}
              </pre>
              <DialogFooter>
                <Button onClick={() => setReprint(null)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
