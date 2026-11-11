import { Eye } from 'lucide-react'
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
const STATUSES = ['completed', 'voided', 'refunded']

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

export default function Sales() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  const [events, setEvents] = useState([])
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Sales'
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
      .get(`/admin/sales/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, eventFilter, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((s) =>
    `${s.sale_reference} ${s.event_code} ${s.staff_code} ${s.event_name}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function openDetail(sale) {
    setDetailError('')
    setLoadingDetail(true)
    try {
      const full = await api.get(`/admin/sales/${sale.id}/`)
      setDetail(full)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <>
      <PageHead eyebrow="TRANSACTIONS" title="Sales" subtitle="Read-only history of sales and admin-issued ticket batches.">
        <RefreshButton loading={loading} onClick={reload} />
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {detailError && <Alert variant="error" className="mb-5">{detailError}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by reference, event or staff…" />
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
                <TableHead>Reference</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Refunds</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={9} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={9} message="No sales found." />
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[13.5px]">{s.sale_reference}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{s.event_code}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">{s.staff_code}</TableCell>
                    <TableCell>{(s.items || []).reduce((n, i) => n + i.quantity, 0)}</TableCell>
                    <TableCell className="font-semibold">
                      {s.currency} {s.gross_total}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.currency} {s.refund_total}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(s)}>
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
        </CardContent>
      </Card>

      {loadingDetail && <p className="mt-4 text-sm text-muted-foreground">Loading sale…</p>}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="w-[min(100%-2rem,720px)]">
          <DialogHeader>
            <DialogTitle>Sale {detail?.sale_reference}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span>
                  {detail.event_code} — {detail.event_name}
                </span>
                <span>
                  Staff {detail.staff_code} ({detail.staff_name})
                </span>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Line items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit price</TableHead>
                      <TableHead>Line total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items || []).map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-[13.5px]">{i.category_code}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>
                          {detail.currency} {i.unit_price_snapshot}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {detail.currency} {i.line_total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  Tickets ({(detail.tickets || []).length})
                </p>
                {(detail.tickets || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets attached.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket code</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Seq</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.tickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-[12.5px]">{t.ticket_code}</TableCell>
                          <TableCell className="font-mono text-[13.5px]">{t.category_name}</TableCell>
                          <TableCell>{t.sequence_number}</TableCell>
                          <TableCell>
                            <StatusBadge status={t.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3.5 border-t border-border pt-4 text-sm text-muted-foreground">
                <span>
                  Gross {detail.currency} {detail.gross_total}
                </span>
                <span>
                  Refunds {detail.currency} {detail.refund_total}
                </span>
                <span>Created {new Date(detail.created_at).toLocaleString()}</span>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
