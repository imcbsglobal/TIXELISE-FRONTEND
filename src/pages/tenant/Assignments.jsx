import { ArrowLeft, CalendarRange, Pencil, Plus, X } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { PageHead, RefreshButton, SearchInput } from '@/components/ui/page'
import { BubblePattern } from '@/components/ui/bubble-pattern'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const STATUS_RANK = { active: 0, expired: 1, revoked: 2 }

async function fetchAll(path) {
  const results = []
  let page = 1
  while (page <= 50) {
    const data = await api.get(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`)
    if (Array.isArray(data)) return [...results, ...data]
    results.push(...(data.results || []))
    if (!data.next) break
    page += 1
  }
  return results
}

const EMPTY_FORM = {
  staff: '',
  event: '',
  restrict_categories: false,
  allowed_category_ids: [],
}

function formatWhen(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StaffCard({ member, activeCount, totalCount, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BubblePattern />
      <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ee] text-[13px] font-bold text-primary">
          {initials(member.display_name)}
        </span>
        <StatusBadge status={member.status} />
      </div>
      <p className="relative z-10 font-mono text-xs text-muted-foreground">{member.staff_code}</p>
      <h3 className="relative z-10 mt-1 line-clamp-2 font-display text-base font-extrabold">{member.display_name}</h3>
      <p className="relative z-10 mt-auto flex items-center gap-1.5 pt-2 text-sm text-muted-foreground">
        <CalendarRange className="h-4 w-4 shrink-0" />
        {totalCount === 0
          ? 'No events assigned'
          : `${activeCount} active ${activeCount === 1 ? 'event' : 'events'} of ${totalCount}`}
      </p>
    </button>
  )
}

export default function Assignments() {
  const [staff, setStaff] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Assignments'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchAll('/admin/staff/'),
      fetchAll('/admin/events/'),
      fetchAll('/admin/categories/'),
      fetchAll('/admin/assignments/'),
    ])
      .then(([staffList, eventList, categoryList, assignmentList]) => {
        if (cancelled) return
        setStaff(staffList)
        setEvents(eventList)
        setCategories(categoryList)
        setAssignments(assignmentList)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const eventById = useMemo(() => Object.fromEntries(events.map((event) => [event.id, event])), [events])
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories],
  )
  const assignmentsByStaff = useMemo(() => {
    const map = new Map()
    assignments.forEach((assignment) => {
      const list = map.get(assignment.staff) || []
      list.push(assignment)
      map.set(assignment.staff, list)
    })
    return map
  }, [assignments])

  const visibleStaff = staff.filter((member) =>
    `${member.staff_code} ${member.display_name} ${member.email || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  const selected = staff.find((member) => String(member.id) === selectedId) || null

  const selectedAssignments = useMemo(() => {
    const list = selected ? assignmentsByStaff.get(selected.id) || [] : []
    return [...list].sort((a, b) => {
      const rank = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3)
      return rank !== 0 ? rank : String(a.event_code).localeCompare(String(b.event_code))
    })
  }, [assignmentsByStaff, selected])

  const activeCount = selectedAssignments.filter((assignment) => assignment.status === 'active').length

  function reload() {
    setReloadToken((token) => token + 1)
  }

  function countFor(member) {
    const list = assignmentsByStaff.get(member.id) || []
    return {
      total: list.length,
      active: list.filter((assignment) => assignment.status === 'active').length,
    }
  }

  function selectStaff(memberId) {
    setSelectedId(String(memberId))
    setSearch('')
    setActionError('')
  }

  function limitLabel(assignment) {
    if (!assignment.restrict_categories) return 'All ticket types'
    const codes = (assignment.allowed_category_ids || [])
      .map((id) => categoryById[id]?.code)
      .filter(Boolean)
    return codes.length ? codes.join(', ') : 'None selected'
  }

  function openCreate() {
    setEditor({ mode: 'create' })
    setForm({ ...EMPTY_FORM, staff: selected ? String(selected.id) : '', allowed_category_ids: [] })
    setFormError('')
  }

  function openEdit(assignment) {
    setEditor({ mode: 'edit', id: assignment.id })
    setForm({
      staff: String(assignment.staff),
      event: String(assignment.event),
      restrict_categories: !!assignment.restrict_categories,
      allowed_category_ids: assignment.allowed_category_ids || [],
    })
    setFormError('')
  }

  function closeEditor() {
    setEditor(null)
    setFormError('')
  }

  function toggleCategory(id) {
    setForm((current) => {
      const ids = new Set(current.allowed_category_ids)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return { ...current, allowed_category_ids: [...ids] }
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    const payload = {
      staff: Number(form.staff),
      event: Number(form.event),
      restrict_categories: form.restrict_categories,
      allowed_category_ids: form.restrict_categories ? form.allowed_category_ids : [],
    }
    try {
      if (editor?.mode === 'edit') await api.patch(`/admin/assignments/${editor.id}/`, payload)
      else await api.post('/admin/assignments/', payload)
      if (editor?.mode === 'create' && form.staff) setSelectedId(form.staff)
      closeEditor()
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function revoke(assignment) {
    const name = selected ? selected.display_name : assignment.staff_code
    if (
      !window.confirm(`Revoke ${name}'s access to ${assignment.event_code}? They stop selling for this event immediately.`)
    ) {
      return
    }
    setBusyId(assignment.id)
    setActionError('')
    try {
      await api.post(`/admin/assignments/${assignment.id}/revoke/`)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
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
      </PageHead>

      {error ? (
        <Alert variant="error" className="mb-5">
          {error}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="error" className="mb-5">
          {actionError}
        </Alert>
      ) : null}

      {!selected ? (
        <section aria-label="Staff members">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold">Select a staff member to see their access</h2>
            {staff.length > 0 ? (
              <SearchInput value={search} onChange={setSearch} placeholder="Search staff…" />
            ) : null}
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading staff…</CardContent>
            </Card>
          ) : staff.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No staff members yet. Create a login for your counter staff first.{' '}
                <Link to="/tenant/staff" className="font-semibold text-primary underline">
                  Go to User management
                </Link>
              </CardContent>
            </Card>
          ) : visibleStaff.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No staff match “{search}”.</CardContent>
            </Card>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleStaff.map((member) => {
                const counts = countFor(member)
                return (
                  <StaffCard
                    key={member.id}
                    member={member}
                    activeCount={counts.active}
                    totalCount={counts.total}
                    onSelect={() => selectStaff(member.id)}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setSelectedId(null)}
                    aria-label="All staff"
                    title="All staff"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ee] text-[12.5px] font-bold text-primary">
                    {initials(selected.display_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[15px] font-extrabold leading-tight">{selected.display_name}</h2>
                      <StatusBadge status={selected.status} />
                      <span className="font-mono text-[12px] text-muted-foreground">{selected.staff_code}</span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                      <span>{selected.email || 'No email'}</span>
                      <span>{selected.phone || 'No phone'}</span>
                      <span>Last login {selected.last_login ? formatWhen(selected.last_login) : 'never'}</span>
                      <span>
                        {activeCount} active of {selectedAssignments.length} assigned
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tenant/staff">Edit staff</Link>
                  </Button>
                  <Button onClick={openCreate} disabled={events.length === 0 || selected.status !== 'active'}>
                    <Plus className="h-4 w-4" /> Assign event
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-extrabold">Assigned events</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Where {selected.display_name} can sell tickets, how long for, and which ticket types are allowed.
              </p>

              {selectedAssignments.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  <p>Not assigned to any event yet — this person cannot sell tickets.</p>
                  {selected.status === 'active' && events.length > 0 ? (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                      <Plus className="h-3.5 w-3.5" /> Assign {selected.staff_code} to an event
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {selectedAssignments.map((assignment) => {
                    const assignmentEvent = eventById[assignment.event]
                    return (
                      <li key={assignment.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[13px] font-semibold">{assignment.event_code}</span>
                              <span className="text-[14.5px] font-semibold">
                                {assignmentEvent ? assignmentEvent.name : 'Event unavailable'}
                              </span>
                              <StatusBadge status={assignment.status} />
                            </div>
                            <p className="mt-1 text-[12.5px] text-muted-foreground">
                              {assignmentEvent
                                ? `Event ${assignmentEvent.status} · starts ${formatWhen(assignmentEvent.start_at)}`
                                : `Assignment for ${assignment.event_code}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(assignment)}
                              disabled={busyId === assignment.id}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Change
                            </Button>
                            {assignment.status === 'active' ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => revoke(assignment)}
                                disabled={busyId === assignment.id}
                              >
                                <X className="h-3.5 w-3.5" />
                                {busyId === assignment.id ? 'Revoking…' : 'Revoke'}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-border pt-3 text-[12.5px] sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">Valid from</dt>
                            <dd className="font-medium">{formatWhen(assignment.valid_from)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Valid until</dt>
                            <dd className="font-medium">{formatWhen(assignment.valid_until)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Ticket types</dt>
                            <dd className="font-medium">{limitLabel(assignment)}</dd>
                          </div>
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!editor} onOpenChange={(open) => !open && !saving && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'edit' ? 'Change assignment' : 'Assign an event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {formError ? <Alert variant="error">{formError}</Alert> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Staff member">
                <Select value={form.staff} onValueChange={(value) => setForm({ ...form, staff: value })}>
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
              <Field label="Event">
                <Select value={form.event} onValueChange={(value) => setForm({ ...form, event: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.code} — {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <p className="border-t border-border pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Category restriction
            </p>

            <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] font-medium">
              <Checkbox
                checked={form.restrict_categories}
                onCheckedChange={(value) => setForm({ ...form, restrict_categories: !!value })}
              />
              Limit this staff member to specific ticket types
            </label>

            {form.restrict_categories ? (
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ticket types defined yet.</p>
                ) : (
                  categories.map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors',
                        form.allowed_category_ids.includes(category.id)
                          ? 'border-[#72c9ad] bg-[#e3f6ee] text-[#00794e]'
                          : 'border-input bg-background text-muted-foreground hover:border-primary/40',
                      )}
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.code}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !form.staff || !form.event}>
                {saving ? 'Saving…' : editor?.mode === 'edit' ? 'Save changes' : 'Create assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
