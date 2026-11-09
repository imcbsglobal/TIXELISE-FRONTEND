import { EyeOff, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PAGE_SIZE = 20
const EMPTY_FORM = { code: '', name: '', description: '' }

export default function Categories() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
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
    document.title = 'Tixelise | Categories'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(`/admin/categories/?page=${page}&page_size=${PAGE_SIZE}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
  const rows = data.results.filter((c) =>
    `${c.code} ${c.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function changeStatus(category, status) {
    setBusyId(category.id)
    setActionError('')
    setNotice('')
    try {
      await api.post(`/admin/categories/${category.id}/status/`, { status })
      setNotice(
        status === 'active'
          ? `${category.code} is active again.`
          : `${category.code} was deactivated and is hidden from the POS catalogue.`,
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
      const res = await api.delete(`/admin/categories/${pendingDelete.id}/`)
      const removed = res?.prices_removed || 0
      setNotice(
        `${pendingDelete.code} was permanently deleted from the database.` +
          (removed ? ` ${removed} price${removed > 1 ? 's' : ''} removed with it.` : ''),
      )
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
      await api.post('/admin/categories/', {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
      })
      setForm(EMPTY_FORM)
      setCreateOpen(false)
      setPage(1)
      reload()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function openDetail(cat) {
    setDetailError('')
    setDetail(cat)
    setDetailForm({ code: cat.code, name: cat.name, description: cat.description || '' })
  }

  async function handleSaveDetail(event) {
    event.preventDefault()
    setDetailError('')
    setSavingDetail(true)
    try {
      await api.patch(`/admin/categories/${detail.id}/`, {
        code: detailForm.code.trim().toUpperCase(),
        name: detailForm.name.trim(),
        description: detailForm.description.trim(),
      })
      reload()
      setDetail(null)
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setSavingDetail(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="TICKET CATALOG"
        title="Categories"
        subtitle="Define ticket categories such as Adult, Child or VIP."
      >
        <RefreshButton loading={loading} onClick={reload} />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New type
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {actionError && <Alert variant="error" className="mb-5">{actionError}</Alert>}
      {notice && <Alert variant="success" className="mb-5">{notice}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by code or name…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={6} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={6} message="No categories found." />
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-[13.5px]">{c.code}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-muted-foreground">{c.description || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(c)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {c.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(c, 'inactive')}
                            disabled={busyId === c.id}
                          >
                            <EyeOff className="h-3.5 w-3.5" /> Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(c, 'active')}
                            disabled={busyId === c.id}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setActionError('')
                            setPendingDelete(c)
                          }}
                          disabled={busyId === c.id}
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

          <Pager page={page} totalPages={totalPages} onPrev={() => setPage(page - 1)} onNext={() => setPage(page + 1)} />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(v) => !v && (setCreateOpen(false), setCreateError(''))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category code" hint="Unique within your organization — e.g. ADULT">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="ADULT"
                  required
                />
              </Field>
              <Field label="Display name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Adult" required />
              </Field>
            </div>
            <Field label="Description" hint="Optional">
              <Textarea
                rows="2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Standard entry ticket…"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Category {detail?.code}</DialogTitle>
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
                <Field label="Category code">
                  <Input value={detailForm.code} onChange={(e) => setDetailForm({ ...detailForm, code: e.target.value.toUpperCase() })} required />
                </Field>
                <Field label="Display name">
                  <Input value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} required />
                </Field>
              </div>
              <Field label="Description">
                <Textarea rows="2" value={detailForm.description} onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })} />
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
        onOpenChange={(v) => {
          if (!v && !deleting) {
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
              permanently removed from the database. Its prices are deleted with it and it cannot be
              restored.
            </p>
            <p className="text-sm text-muted-foreground">
              If it was already used for sales, use <span className="font-medium text-foreground">Deactivate</span>{' '}
              instead - that hides it from the POS catalogue while keeping the sales history.
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
