import { Pencil, Plus } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const ASSIGNMENTS_PER_PAGE = 12
const STATUSES = ['active', 'revoked', 'expired']

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

const EMPTY_FORM = {
  staff: '',
  event: '',
  valid_from: '',
  valid_until: '',
  restrict_categories: false,
  allowed_category_ids: [],
}

export default function Assignments() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reloadToken, setReloadToken] = useState(0)

  const [staff, setStaff] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [lookupError, setLookupError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [staffEdit, setStaffEdit] = useState(null)
  const [replacementStaff, setReplacementStaff] = useState('')
  const [savingStaff, setSavingStaff] = useState(false)
  const [staffEditError, setStaffEditError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Assignments'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLookupError('')
    Promise.all([fetchAll('/admin/staff/'), fetchAll('/admin/events/'), fetchAll('/admin/categories/')])
      .then(([s, e, c]) => {
        if (cancelled) return
        setStaff(s)
        setEvents(e)
        setCategories(c)
      })
      .catch((err) => {
        if (!cancelled) setLookupError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const qs = new URLSearchParams({ page: String(page), page_size: String(ASSIGNMENTS_PER_PAGE) })
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    api
      .get(`/admin/assignments/?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, statusFilter, reloadToken])

  const staffById = useMemo(() => Object.fromEntries(staff.map((member) => [member.id, member])), [staff])
  const eventById = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events])
  const rows = data.results.filter((assignment) =>
    `${assignment.staff_code || ''} ${assignment.event_code || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )

  function reload() {
    setReloadToken((token) => token + 1)
  }

  function openStaffEdit(assignment) {
    setStaffEdit(assignment)
    setReplacementStaff(String(assignment.staff))
    setStaffEditError('')
  }

  async function handleStaffEdit(event) {
    event.preventDefault()
    if (!staffEdit) return
    setStaffEditError('')
    setSavingStaff(true)
    try {
      await api.patch(`/admin/assignments/${staffEdit.id}/`, {
        staff: Number(replacementStaff),
      })
      setStaffEdit(null)
      reload()
    } catch (err) {
      setStaffEditError(err.message)
    } finally {
      setSavingStaff(false)
    }
  }

  function toggleCategory(id) {
    setForm((f) => {
      const set = new Set(f.allowed_category_ids)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...f, allowed_category_ids: [...set] }
    })
  }

  async function handleCreate(event) {
    event.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.post('/admin/assignments/', {
        staff: Number(form.staff),
        event: Number(form.event),
        restrict_categories: form.restrict_categories,
        ...(form.valid_from ? { valid_from: `${form.valid_from}:00` } : {}),
        ...(form.valid_until ? { valid_until: `${form.valid_until}:00` } : {}),
        ...(form.restrict_categories ? { allowed_category_ids: form.allowed_category_ids } : {}),
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

  return (
    <>
      <PageHead
        eyebrow="ACCESS CONTROL"
        title="Assignments"
        subtitle="Grant staff permission to sell tickets for specific events."
      >
        <RefreshButton loading={loading} onClick={reload} />
        <Button onClick={() => setCreateOpen(true)} disabled={staff.length === 0 || events.length === 0}>
          <Plus className="h-4 w-4" /> New assignment
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {lookupError && <Alert variant="error" className="mb-5">{lookupError}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by staff or event code…" />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Valid from</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Category limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={7} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={7} message="No assignments found." />
              ) : (
                rows.map((assignment) => {
                  const assignedStaff = staffById[assignment.staff]
                  const assignedEvent = eventById[assignment.event]
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <span className="font-mono text-[13.5px]">{assignment.staff_code}</span>
                        {assignedStaff ? ` — ${assignedStaff.display_name}` : ''}
                      </TableCell>
                      <TableCell className="font-mono text-[13.5px]">
                        {assignedEvent
                          ? `${assignedEvent.code} — ${assignedEvent.name}`
                          : assignment.event_code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignment.valid_from ? new Date(assignment.valid_from).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignment.valid_until ? new Date(assignment.valid_until).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignment.restrict_categories
                          ? `${(assignment.allowed_category_ids || []).length} categories`
                          : 'All'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={assignment.status} />
                      </TableCell>
                      <TableCell>
                        {assignment.status === 'active' && (
                          <Button variant="outline" size="sm" onClick={() => openStaffEdit(assignment)}>
                            <Pencil className="h-3.5 w-3.5" /> Change staff
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {data.count > ASSIGNMENTS_PER_PAGE && (
            <div className="mt-6 flex justify-center">
              <Pager
                page={page}
                totalPages={Math.ceil(data.count / ASSIGNMENTS_PER_PAGE)}
                onPrev={() => setPage(Math.max(1, page - 1))}
                onNext={() => setPage(Math.min(Math.ceil(data.count / ASSIGNMENTS_PER_PAGE), page + 1))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(v) => !v && (setCreateOpen(false), setCreateError(''))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New assignment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Staff member">
                <Select value={form.staff} onValueChange={(v) => setForm({ ...form, staff: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.staff_code} — {s.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Event">
                <Select value={form.event} onValueChange={(v) => setForm({ ...form, event: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={String(ev.id)}>
                        {ev.code} — {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valid from" hint="Optional">
                <Input type="datetime-local" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </Field>
              <Field label="Valid until" hint="Optional">
                <Input type="datetime-local" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </Field>
            </div>

            <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Category restriction
            </p>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] font-medium">
              <Checkbox
                checked={form.restrict_categories}
                onCheckedChange={(v) => setForm({ ...form, restrict_categories: !!v })}
              />
              Limit this staff member to specific categories
            </label>

            {form.restrict_categories && (
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories defined yet.</p>
                ) : (
                  categories.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors',
                        form.allowed_category_ids.includes(c.id)
                          ? 'border-[#72c9ad] bg-[#e3f6ee] text-[#00794e]'
                          : 'border-input bg-background text-muted-foreground hover:border-primary/40',
                      )}
                      onClick={() => toggleCategory(c.id)}
                    >
                      {c.code}
                    </button>
                  ))
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !form.staff || !form.event}>
                {creating ? 'Assigning…' : 'Create assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!staffEdit}
        onOpenChange={(open) => {
          if (!open && !savingStaff) {
            setStaffEdit(null)
            setStaffEditError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change assigned staff</DialogTitle>
          </DialogHeader>
          {staffEdit && (
            <form onSubmit={handleStaffEdit} className="space-y-4">
              {staffEditError && <Alert variant="error">{staffEditError}</Alert>}
              <p className="text-sm text-muted-foreground">
                Select a different staff member for event {staffEdit.event_code}. The assignment’s access dates and category limits will remain unchanged.
              </p>
              <Field label="Staff member">
                <Select value={replacementStaff} onValueChange={setReplacementStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={String(member.id)}>
                        {member.staff_code} — {member.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStaffEdit(null)} disabled={savingStaff}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingStaff || !replacementStaff || replacementStaff === String(staffEdit.staff)}
                >
                  {savingStaff ? 'Saving…' : 'Save assignment'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </>
  )
}
