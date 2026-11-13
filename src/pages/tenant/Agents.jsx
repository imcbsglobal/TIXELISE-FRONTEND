import { EyeOff, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20
const EMPTY_FORM = { code: '', name: '', place: '' }

export default function Agents() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [detail, setDetail] = useState(null)
  const [detailForm, setDetailForm] = useState(EMPTY_FORM)
  const [detailError, setDetailError] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    document.title = 'Tixelise | Agents'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const statusQuery = statusFilter === 'all' ? '' : `&status=${statusFilter}`
    api
      .get(`/admin/agents/?page=${page}&page_size=${PAGE_SIZE}${statusQuery}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((agent) =>
    `${agent.code} ${agent.name} ${agent.place}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function changeStatus(agent, status) {
    setBusyId(agent.id)
    setActionError('')
    setNotice('')
    try {
      await api.post(`/admin/agents/${agent.id}/status/`, { status })
      setNotice(
        status === 'active'
          ? `${agent.code} is active again.`
          : `${agent.code} was deactivated and is hidden from ticket issuance.`,
      )
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError('')
    try {
      await api.delete(`/admin/agents/${pendingDelete.id}/`)
      setNotice(`${pendingDelete.code} was permanently deleted.`)
      setPendingDelete(null)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.post('/admin/agents/', {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        place: form.place.trim(),
      })
      setForm(EMPTY_FORM)
      setCreateOpen(false)
      setPage(1)
      setNotice('Agent created.')
      reload()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function openDetail(agent) {
    setDetailError('')
    setDetail(agent)
    setDetailForm({ code: agent.code, name: agent.name, place: agent.place })
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/admin/agents/${detail.id}/`, {
        code: detailForm.code.trim().toUpperCase(),
        name: detailForm.name.trim(),
        place: detailForm.place.trim(),
      })
      setDetail(null)
      setNotice('Agent updated.')
      reload()
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="SALES MASTER"
        title="Agents"
        subtitle="Create agents and attribute manual ticket sales to them."
      >
        <RefreshButton loading={loading} onClick={reload} />
        <Button
          onClick={() => {
            setForm(EMPTY_FORM)
            setCreateError('')
            setCreateOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> New agent
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {actionError && <Alert variant="error" className="mb-5">{actionError}</Alert>}
      {notice && <Alert variant="success" className="mb-5">{notice}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by code, name or place…" />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : rows.length === 0 ? (
                <EmptyRow
                  colSpan={6}
                  message={
                    data.results.length === 0
                      ? 'No agents yet.'
                      : `No agents match “${search.trim()}”.`
                  }
                />
              ) : (
                rows.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-mono text-[13.5px]">{agent.code}</TableCell>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-muted-foreground">{agent.place}</TableCell>
                    <TableCell>
                      <StatusBadge status={agent.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(agent.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(agent)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {agent.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(agent, 'inactive')}
                            disabled={busyId === agent.id}
                          >
                            <EyeOff className="h-3.5 w-3.5" /> Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(agent, 'active')}
                            disabled={busyId === agent.id}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setActionError('')
                            setPendingDelete(agent)
                          }}
                          disabled={busyId === agent.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(value) => !value && (setCreateOpen(false), setCreateError(''))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Agent code" hint="Unique within your organization.">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="AG001"
                  required
                />
              </Field>
              <Field label="Agent name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name"
                  required
                />
              </Field>
            </div>
            <Field label="Place">
              <Input
                value={form.place}
                onChange={(e) => setForm({ ...form, place: e.target.value })}
                placeholder="City or branch"
                required
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create agent'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(value) => !value && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent {detail?.code}</DialogTitle>
          </DialogHeader>
          {detail && (
            <form onSubmit={handleSaveDetail} className="space-y-4">
              {detailError && <Alert variant="error">{detailError}</Alert>}
              <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
                <StatusBadge status={detail.status} />
                <span>ID {detail.id}</span>
                <span>Created {new Date(detail.created_at).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Agent code">
                  <Input
                    value={detailForm.code}
                    onChange={(e) => setDetailForm({ ...detailForm, code: e.target.value.toUpperCase() })}
                    required
                  />
                </Field>
                <Field label="Agent name">
                  <Input
                    value={detailForm.name}
                    onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field label="Place">
                <Input
                  value={detailForm.place}
                  onChange={(e) => setDetailForm({ ...detailForm, place: e.target.value })}
                  required
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                <Button type="submit" disabled={savingDetail}>
                  {savingDetail ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(value) => {
          if (!value && !deleting) {
            setPendingDelete(null)
            setActionError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {pendingDelete?.code}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionError && <Alert variant="error">{actionError}</Alert>}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{pendingDelete?.name}</span> will be
              permanently removed. This is only possible when the agent has no ticket sales.
            </p>
            <p className="text-sm text-muted-foreground">
              If it was already used for sales, use{' '}
              <span className="font-medium text-foreground">Deactivate</span> instead to keep the
              history.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
