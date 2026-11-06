import { Pencil, Plus, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { EmptyRow, LoadingRow, PageHead, Pager, RefreshButton, SearchInput } from '@/components/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Tax records live in the central tax master, not in Tixelise. This page only
// edits them: nothing is mirrored into a local table, and no price, ticket or
// report in Tixelise reads these records.
//
// The master splits its records into two lists - India's GST components and one
// flat rate for everywhere else. That split is not offered as a filter on this
// page: both lists are fetched and shown together, and the choice is made as
// the first step of creating a record, where it actually belongs.
//
// The calculation method is not offered at all. Tixelise works in percentages,
// so the backend writes PERCENTAGE itself and refuses the key if a caller tries
// to send anything else.
const BASE = '/admin/tax-master/'
const PAGE_SIZE = 20

const SCHEMES = [
  { value: 'india', label: 'India (GST)', note: 'Separate CGST, SGST, IGST and GST rates.' },
  { value: 'other', label: 'Other countries', note: 'One flat rate, such as VAT or sales tax.' },
]

// [key, label, max length, required, hint]
// Name comes first; the code is generated from it (see codeFromName), so the
// two are entered in the order they depend on.
const TEXT_FIELDS = {
  india: [
    ['name', 'Name', 100, true, ''],
    ['code', 'Code', 20, true, ''],
    ['type', 'Type', 50, false, 'Optional — e.g. GST, CGST, Service tax'],
  ],
  other: [
    ['name', 'Name', 100, true, ''],
    ['code', 'Code', 20, true, ''],
  ],
}

// Condense a name into the short code the master expects: uppercase, alphanumerics
// only, capped at the field's 20 characters. "GST 18%" becomes "GST18", the same
// shape as the existing records, so nothing here looks foreign next to them.
function codeFromName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20)
}

const RATE_FIELDS = {
  india: [
    ['cgst', 'CGST %'],
    ['sgst', 'SGST %'],
    ['igst', 'IGST %'],
    ['gst', 'GST %'],
  ],
  other: [['tax', 'Tax %']],
}

const COLUMNS = ['Code', 'Name', 'Scheme', 'Type', 'Rate', 'Status', 'Actions']

function withScheme(results, scheme) {
  return (Array.isArray(results) ? results : []).map((row) => ({ ...row, scheme }))
}

function schemeLabel(scheme) {
  return (SCHEMES.find((item) => item.value === scheme) || SCHEMES[0]).label
}

function rateText(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${Number(value).toFixed(2)}%`
}

// One column has to carry both shapes, so each row reads as a sentence rather
// than as four columns three of which are empty for most tenants.
function rateSummary(row) {
  if (row.scheme === 'india') {
    return `CGST ${rateText(row.cgst)} · SGST ${rateText(row.sgst)} · IGST ${rateText(row.igst)} · GST ${rateText(row.gst)}`
  }
  return rateText(row.tax)
}

function blankForm(scheme) {
  const form = {}
  TEXT_FIELDS[scheme].forEach(([key]) => {
    form[key] = ''
  })
  RATE_FIELDS[scheme].forEach(([key]) => {
    form[key] = ''
  })
  form.status = 'ACTIVE'
  return form
}

function fromRecord(scheme, record) {
  const form = blankForm(scheme)
  TEXT_FIELDS[scheme].forEach(([key]) => {
    form[key] = record[key] ?? ''
  })
  // Stored as "9.00"; the trailing zeros are noise in a text box.
  RATE_FIELDS[scheme].forEach(([key]) => {
    const value = record[key]
    form[key] = value === null || value === undefined || value === '' ? '' : String(Number(value))
  })
  form.status = record.status || 'ACTIVE'
  return form
}

function validate(scheme, form) {
  const errors = {}
  TEXT_FIELDS[scheme].forEach(([key, label, maximum, required]) => {
    const text = String(form[key] || '').trim()
    if (!text) {
      if (required) errors[key] = `${label} is required.`
    } else if (text.length > maximum) {
      errors[key] = `No more than ${maximum} characters.`
    }
  })
  RATE_FIELDS[scheme].forEach(([key, label]) => {
    const text = String(form[key] || '').trim()
    if (!text) return
    if (!/^\d*\.?\d+$/.test(text)) {
      errors[key] = 'Enter a number.'
    } else if (Number(text) > 100) {
      errors[key] = `${label} must be between 0 and 100.`
    }
  })
  return errors
}

function buildPayload(scheme, form) {
  const payload = { status: form.status }
  TEXT_FIELDS[scheme].forEach(([key]) => {
    payload[key] = String(form[key] || '').trim()
  })
  RATE_FIELDS[scheme].forEach(([key]) => {
    const text = String(form[key] || '').trim()
    payload[key] = text || '0'
  })
  return payload
}

function TaxForm({ scheme, record, clientId, submitLabel, onSubmit, onBack, onCancel, busy, error }) {
  const [form, setForm] = useState(() => (record ? fromRecord(scheme, record) : blankForm(scheme)))
  const [errors, setErrors] = useState({})

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      // The code is never typed - it follows the name so the two cannot drift
      // apart. Editing the name on an existing record regenerates its code the
      // same way; leaving the name alone keeps the stored code untouched.
      if (key === 'name') next.code = codeFromName(value)
      return next
    })
    setErrors((current) => {
      if (!current[key] && !(key === 'name' && current.code)) return current
      const next = { ...current }
      delete next[key]
      if (key === 'name') delete next.code
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const found = validate(scheme, form)
    setErrors(found)
    if (Object.keys(found).length) return
    onSubmit(buildPayload(scheme, form))
  }

  const rateField = ([key, label]) => (
    <Field label={label}>
      <Input
        value={form[key]}
        inputMode="decimal"
        placeholder="0"
        onChange={(event) => setField(key, event.target.value)}
      />
      {errors[key] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[key]}</p> : null}
    </Field>
  )

  const textField = ([key, label, maximum, , hint]) => {
    const isCode = key === 'code'
    return (
      <Field label={label} hint={isCode ? 'Generated from the name.' : hint || undefined}>
        <Input
          value={form[key]}
          maxLength={maximum}
          readOnly={isCode}
          tabIndex={isCode ? -1 : undefined}
          placeholder={isCode ? 'Auto from name' : undefined}
          className={isCode ? 'font-mono cursor-default' : undefined}
          onChange={isCode ? undefined : (event) => setField(key, event.target.value)}
        />
        {errors[key] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[key]}</p> : null}
      </Field>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client ID" className="sm:col-span-2">
          <Input value={clientId} readOnly tabIndex={-1} className="font-mono cursor-default" />
        </Field>
        {TEXT_FIELDS[scheme].map(textField)}
        {RATE_FIELDS[scheme].map(rateField)}
        <Field label="Status">
          <Select value={form.status} onValueChange={(value) => setField('status', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2.5">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default function TaxMaster() {
  const [clientId, setClientId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // 'choose' is the first step of creating - which list this record belongs to.
  // Editing skips it, because a record's list is already decided and moving one
  // between lists would mean deleting and recreating it.
  const [formOpen, setFormOpen] = useState(false)
  const [step, setStep] = useState('choose')
  const [formScheme, setFormScheme] = useState('india')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Tax master'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([api.get(`${BASE}india/`), api.get(`${BASE}other/`)])
      .then(([india, other]) => {
        if (cancelled) return
        setClientId(india?.client_id || other?.client_id || '')
        setRows([...withScheme(india?.results, 'india'), ...withScheme(other?.results, 'other')])
        setPage(1)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      `${row.code} ${row.name} ${row.type || ''} ${row.scheme}`.toLowerCase().includes(term),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function reload() {
    setReloadToken((token) => token + 1)
  }

  function closeForm() {
    setFormOpen(false)
    setFormError('')
    setEditing(null)
  }

  function openCreate() {
    setEditing(null)
    setFormError('')
    setStep('choose')
    setFormOpen(true)
  }

  function openEdit(record) {
    setEditing(record)
    setFormError('')
    setFormScheme(record.scheme)
    setStep('form')
    setFormOpen(true)
  }

  function chooseScheme(scheme) {
    setFormScheme(scheme)
    setStep('form')
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setFormError('')
    setError('')
    try {
      if (editing) {
        await api.patch(`${BASE}${editing.scheme}/${editing.id}/`, payload)
        setNotice(`${payload.code} updated in the central tax master.`)
      } else {
        await api.post(`${BASE}${formScheme}/`, payload)
        setNotice(`${payload.code} created in the central tax master.`)
      }
      closeForm()
      reload()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`${BASE}${pendingDelete.scheme}/${pendingDelete.id}/`)
      setNotice(`${pendingDelete.code} removed from the central tax master.`)
      setPendingDelete(null)
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHead eyebrow="CENTRAL MASTER" title="Tax master">
        <RefreshButton loading={loading} onClick={reload} />
        {/* One record per list, the same convention as Company: once anything is
            held the create option disappears and the table's Edit is the way in.
            Judged on `rows`, not the searched view, so clearing the search box
            cannot bring the button back. */}
        {rows.length === 0 && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New tax record
          </Button>
        )}
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {notice && !error && <Alert variant="success" className="mb-5">{notice}</Alert>}

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by code, name or type…" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((heading) => (
                  <TableHead key={heading}>{heading}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={COLUMNS.length} />
              ) : visible.length === 0 ? (
                <EmptyRow
                  colSpan={COLUMNS.length}
                  message={
                    rows.length
                      ? `No tax records match “${search}”.`
                      : 'No tax records for this client ID yet.'
                  }
                />
              ) : (
                visible.map((row) => (
                  <TableRow key={`${row.scheme}-${row.id}`}>
                    <TableCell className="font-mono text-[13.5px]">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{schemeLabel(row.scheme)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.type || '—'}</TableCell>
                    <TableCell className="tabular-nums">{rateSummary(row)}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(row.status || '').toLowerCase()} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setError('')
                            setPendingDelete(row)
                          }}
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
            page={Math.min(page, totalPages)}
            totalPages={totalPages}
            onPrev={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => (open ? null : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `Tax ${editing.code}`
                : step === 'choose'
                  ? 'New tax record'
                  : `New ${schemeLabel(formScheme)} tax record`}
            </DialogTitle>
          </DialogHeader>

          {step === 'choose' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Which tax list should this record go into? The two hold different fields, and a
                record cannot be moved between them later.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SCHEMES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => chooseScheme(item.value)}
                    className="rounded-[14px] border border-input bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    <span className="block text-[15px] font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          ) : (
            // key remounts the form per record and per scheme, so going back and
            // picking the other list can never carry the first one's fields over.
            <TaxForm
              key={`${formScheme}-${editing?.id ?? 'new'}`}
              scheme={formScheme}
              record={editing}
              clientId={clientId}
              submitLabel={editing ? 'Save changes' : 'Create tax record'}
              onSubmit={handleSubmit}
              onBack={editing ? undefined : () => setStep('choose')}
              onCancel={closeForm}
              busy={saving}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.code}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Removes{' '}
            <span className="font-medium text-foreground">{pendingDelete?.name}</span> from the{' '}
            <span className="font-medium text-foreground">central tax master</span> under client{' '}
            <span className="font-mono">{pendingDelete?.client_id}</span>. Nothing in Tixelise
            references these records, so no event, price or sale is affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
