import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
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

// Tax records live in the central tax master, not in Tixelise. This page edits
// them, and also decides which one applies to ticket sales. That choice, plus a
// frozen copy of its rate, is the only thing Tixelise stores locally - so a sale
// never has to call the master, and a later rate change never rewrites history.
//
// The master splits its records into two lists - India's GST components and one
// flat rate for everywhere else. That split is not offered as a filter on this
// page: both lists are fetched and shown together, and the choice is made as
// the first step of creating a record, where it actually belongs.
//
// The calculation method is not offered at all. Tixelise works in percentages,
// so the backend writes PERCENTAGE itself and refuses the key if a caller tries
// to send anything else.
//
// Charging tax out of an inclusive price is still supported by the backend (the
// flag is stored per tenant), but it is not offered here: the price in Prices is
// the taxable amount and tax is added on top of it.
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

// GST is the combined rate, so it is never typed by hand on the India form:
// it follows CGST + SGST as those two are edited. "9" + "9" becomes "18".
function rateTotal(a, b) {
  const left = String(a ?? '').trim()
  const right = String(b ?? '').trim()
  if (!left && !right) return ''
  const sum = (Number(left) || 0) + (Number(right) || 0)
  return String(sum)
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

// The record that applies is chosen for the tenant, so the dropdown is never
// empty. GST leads, because that is the rate a ticket sale actually carries; a
// 0% row is only used when nothing else is left.
function defaultTaxId(rows) {
  const active = (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row.status || '').toUpperCase() === 'ACTIVE',
  )
  const india = active.filter((row) => row.scheme === 'india')
  const chosen =
    india.find((row) => Number(row.gst) > 0) ||
    india[0] ||
    active.find((row) => row.scheme === 'other')
  return chosen ? `${chosen.scheme}:${chosen.id}` : ''
}

// A styled button rather than a checkbox, so the control reads as on/off at a
// glance. Its state is still announced to assistive tech by role="switch".
function ToggleSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-45 ${
        checked ? 'bg-primary' : 'bg-input'
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
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
      // GST is derived from the two halves, so the three can never disagree.
      if (scheme === 'india' && (key === 'cgst' || key === 'sgst')) {
        next.gst = rateTotal(next.cgst, next.sgst)
      }
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

  const rateField = ([key, label]) => {
    const isAutoGst = scheme === 'india' && key === 'gst'
    return (
      <Field label={label}>
        <Input
          value={form[key]}
          inputMode="decimal"
          placeholder="0"
          readOnly={isAutoGst}
          tabIndex={isAutoGst ? -1 : undefined}
          className={isAutoGst ? 'cursor-default' : undefined}
          onChange={isAutoGst ? undefined : (event) => setField(key, event.target.value)}
        />
        {errors[key] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[key]}</p> : null}
      </Field>
    )
  }

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

  // Ticket-sale tax: the only part of this page that Tixelise stores locally.
  const [taxSetting, setTaxSetting] = useState(null)
  const [selectedTaxId, setSelectedTaxId] = useState('')
  const [taxSaving, setTaxSaving] = useState(false)
  const [taxError, setTaxError] = useState('')
  // Set once the default record has been stored, so a remount or a refresh click
  // can never repeat that call.
  const autoSelected = useRef(false)

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
    Promise.all([
      api.get(`${BASE}india/`),
      api.get(`${BASE}other/`),
      api.get('/admin/tax-settings/').catch(() => null),
    ])
      .then(([india, other, applied]) => {
        if (cancelled) return
        const merged = [
          ...withScheme(india?.results, 'india'),
          ...withScheme(other?.results, 'other'),
        ]
        setClientId(india?.client_id || other?.client_id || '')
        setRows(merged)
        setTaxSetting(applied)
        setPage(1)
        if (applied?.tax_master_id) {
          setSelectedTaxId(`${applied.kind}:${applied.tax_master_id}`)
          return undefined
        }
        // Nothing applied yet: select a record for the tenant, and store it,
        // because enabling tax is refused while no record is saved. `enabled` is
        // deliberately left out of the call, so tax stays off.
        const fallback = defaultTaxId(merged)
        if (!fallback || autoSelected.current) return undefined
        setSelectedTaxId(fallback)
        autoSelected.current = true
        const [kind, taxMasterId] = fallback.split(':')
        return api
          .patch('/admin/tax-settings/', { kind, tax_master_id: taxMasterId })
          .then((saved) => {
            if (cancelled) return
            setTaxSetting(saved)
            setSelectedTaxId(saved.tax_master_id ? `${saved.kind}:${saved.tax_master_id}` : '')
          })
          .catch((err) => {
            if (cancelled) return
            autoSelected.current = false
            setTaxError(`Could not select a tax record automatically: ${err.message}`)
          })
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

  const activeRows = rows.filter((row) => String(row.status || '').toUpperCase() === 'ACTIVE')
  const enabled = Boolean(taxSetting?.enabled)

  async function patchTaxSetting(payload, successMessage) {
    setTaxSaving(true)
    setTaxError('')
    setNotice('')
    try {
      const saved = await api.patch('/admin/tax-settings/', payload)
      setTaxSetting(saved)
      setSelectedTaxId(saved.tax_master_id ? `${saved.kind}:${saved.tax_master_id}` : '')
      setNotice(successMessage(saved))
    } catch (err) {
      setTaxError(err.message)
    } finally {
      setTaxSaving(false)
    }
  }

  function toggleEnabled(enabled) {
    patchTaxSetting({ enabled }, (saved) =>
      enabled
        ? `Tax on: every ticket now charges ${saved.rate}% (${saved.code}).`
        : 'Tax off: ticket prices are charged exactly as configured.',
    )
  }

  function selectTax(value) {
    const row = activeRows.find((item) => `${item.scheme}:${item.id}` === value)
    if (!row) return
    patchTaxSetting(
      { kind: row.scheme, tax_master_id: String(row.id) },
      (saved) => `${saved.code} applied to ticket sales at ${saved.rate}%.`,
    )
  }

  

  async function refreshTaxSetting() {
    setTaxSaving(true)
    setTaxError('')
    setNotice('')
    try {
      const saved = await api.post('/admin/tax-settings/refresh/', {})
      setTaxSetting(saved)
      if (saved.found) {
        setNotice(`Re-read ${saved.code} from the master: ${saved.rate}%.`)
      } else {
        setTaxError(saved.warning)
      }
    } catch (err) {
      setTaxError(err.message)
    } finally {
      setTaxSaving(false)
    }
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

      <Card className="mb-5">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Ticket sales
              </p>
              <h2 className="mt-1 font-display text-lg font-extrabold">Apply tax to ticket sales</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                When enabled, every ticket charges the selected rate on top of the price set in
                Prices. Sale lines and reports keep the taxable amount and the tax separate, and
                each past sale keeps the rate it was sold at.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[13px] border border-input bg-background px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Enable tax</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {enabled ? 'Charging on new sales' : 'Not charged'}
                </p>
              </div>
              <ToggleSwitch
                checked={enabled}
                disabled={taxSaving || !taxSetting?.configured}
                onChange={toggleEnabled}
                label="Enable tax on ticket sales"
              />
            </div>
          </div>

          {taxError ? (
            <Alert variant="error" className="mt-4">
              {taxError}
            </Alert>
          ) : null}

          {taxSetting?.enabled && taxSetting?.stale ? (
            <Alert variant="error" className="mt-4">
              This rate was last read from the master more than {taxSetting.stale_after_days} days
              ago. Refresh it to pick up any change made there.
            </Alert>
          ) : null}

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1">
              <Field label="Tax record">
                <Select value={selectedTaxId} onValueChange={selectTax} disabled={taxSaving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tax record" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRows.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No active tax records yet
                      </SelectItem>
                    ) : (
                      activeRows.map((row) => (
                        <SelectItem key={`${row.scheme}:${row.id}`} value={`${row.scheme}:${row.id}`}>
                          {row.code} — {row.name} ({row.scheme === 'india' ? rateText(row.gst) : rateText(row.tax)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Button
              variant="outline"
              className="mb-0.5"
              onClick={refreshTaxSetting}
              disabled={taxSaving || !taxSetting?.tax_master_id}
            >
              <RefreshCw className="h-4 w-4" /> Refresh from master
            </Button>
          </div>

          {taxSetting?.configured ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Applied:{' '}
              <span className="font-semibold text-foreground">
                {taxSetting.code} · {taxSetting.rate}%
              </span>
              {taxSetting.kind === 'india'
                ? ` · CGST ${taxSetting.cgst}% · SGST ${taxSetting.sgst}% · IGST ${taxSetting.igst}%`
                : ''}
              {' · '}
              {taxSetting.enabled ? 'charging on new sales' : 'not charged'}
              {taxSetting.synced_at
                ? ` · last read ${new Date(taxSetting.synced_at).toLocaleString()}`
                : ''}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No tax is applied to ticket sales yet. Select a record above and enable tax.
            </p>
          )}
        </CardContent>
      </Card>

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
                                <span className="font-mono">{pendingDelete?.client_id}</span>. Past sales keep their own
            frozen rate, so nothing already sold changes. If this is the record applied to
            ticket sales, select another one afterwards.
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
