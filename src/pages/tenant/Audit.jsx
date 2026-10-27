import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20

export default function Audit() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [detail, setDetail] = useState(null)

  useEffect(() => {
    document.title = 'Tixelise | Audit log'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
    if (actionFilter) qs.set('action', actionFilter)
    if (targetFilter) qs.set('target_type', targetFilter)
    api
      .get(`/admin/audit-logs/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, actionFilter, targetFilter, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((a) =>
    `${a.action} ${a.actor} ${a.target_type} ${a.target_id}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  return (
    <>
      <PageHead
        eyebrow="SECURITY"
        title="Audit log"
        subtitle="A chronological record of sensitive actions in your organization."
      >
        <RefreshButton loading={loading} onClick={reload} />
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search action, actor or target…" />
            <div className="flex flex-wrap items-center gap-3">
              <Input
                className="w-[210px]"
                placeholder="Action e.g. sale.created"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value.trim())
                  setPage(1)
                }}
              />
              <Input
                className="w-[190px]"
                placeholder="Target type e.g. sale"
                value={targetFilter}
                onChange={(e) => {
                  setTargetFilter(e.target.value.trim())
                  setPage(1)
                }}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Correlation</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={6} message="No audit entries found." />
              ) : (
                rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono normal-case">
                        {a.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.actor || '—'}</TableCell>
                    <TableCell className="font-mono text-[13.5px]">
                      {a.target_type}
                      {a.target_id ? `#${a.target_id}` : ''}
                    </TableCell>
                    <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                      {a.correlation_id ? `${a.correlation_id.slice(0, 8)}…` : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetail(a)}>
                        Details
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

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit #{detail?.id}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <Badge variant="secondary" className="font-mono normal-case">
                  {detail.action}
                </Badge>
                <span>{detail.actor || 'system'}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">Target</p>
                  <p className="font-mono text-[14px]">
                    {detail.target_type}
                    {detail.target_id ? `#${detail.target_id}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">When</p>
                  <p className="text-[14px]">{new Date(detail.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">Correlation ID</p>
                <p className="font-mono text-[13px]">{detail.correlation_id || '—'}</p>
              </div>

              <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Metadata
              </p>
              {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
                <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
                  {JSON.stringify(detail.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No metadata recorded.</p>
              )}

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
