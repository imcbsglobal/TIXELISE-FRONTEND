import { Building2, Pencil, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead, RefreshButton } from '@/components/ui/page'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// One company per logged-in tenant. The central master holds it; Tixelise only
// proxies the call, so the client ID comes from the JWT, never from this form.
// Product access is not part of this form: a new company is registered for
// Tixelise alone (the backend default), and an edit sends no flags at all so any
// access granted outside Tixelise is preserved. Status is left out too, so a new
// record starts ACTIVE and an edit never re-activates one that was stopped.
const ENDPOINT = '/admin/company-master/'

const PRODUCTS = [
  { key: 'trellisco', label: 'Trellisco' },
  { key: 'claudius', label: 'Claudius' },
  { key: 'melone', label: 'Melone' },
  { key: 'tixelise', label: 'Tixelise' },
  { key: 'trellisco_crm', label: 'Trellisco CRM' },
  { key: 'melone_stay', label: 'Melone Stay' },
  { key: 'trellisco_books', label: 'Trellisco Books' },
]

const MAX_LENGTHS = {
  company_name: 255,
  license_key: 100,
  gst_number: 20,
  pan_number: 10,
  email: 254,
  phone_number: 20,
  address_line_1: 255,
  address_line_2: 255,
  city: 100,
  district: 100,
  state: 100,
  country: 100,
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_LOGO_BYTES = 2 * 1024 * 1024

// Read a chosen file as raw base64 (the data-URL prefix is stripped, matching
// the master's "base64 image" field). If the master later insists on the full
// data URL, send reader.result as-is instead.
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

const REQUIRED_FIELDS = [
  ['company_name', 'Company name'],
  ['license_key', 'License key'],
  ['gst_number', 'GST number'],
  ['pan_number', 'PAN number'],
  ['email', 'Email'],
  ['phone_number', 'Phone number'],
  ['address_line_1', 'Address line 1'],
  ['city', 'City'],
  ['district', 'District'],
  ['state', 'State'],
  ['country', 'Country'],
]

const DETAIL_FIELDS = [
  ['client_id', 'Client ID'],
  ...REQUIRED_FIELDS,
  ['address_line_2', 'Address line 2'],
  ['status', 'Status'],
]

const BLANK = {
  company_name: '',
  license_key: '',
  gst_number: '',
  pan_number: '',
  email: '',
  phone_number: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  district: '',
  state: '',
  country: 'INDIA',
}

function fromCompany(company) {
  if (!company) return { ...BLANK }
  const next = {}
  Object.keys(BLANK).forEach((key) => {
    next[key] = company[key] ?? BLANK[key]
  })
  return next
}

function validate(form) {
  const errors = {}
  REQUIRED_FIELDS.forEach(([key, label]) => {
    if (!String(form[key] || '').trim()) errors[key] = `${label} is required.`
  })
  if (!errors.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}

function enabledProducts(row) {
  return PRODUCTS.filter((product) => row[product.key]).map((product) => product.label)
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

function CompanyForm({
  clientId,
  licenseKey,
  countries = [],
  company,
  submitLabel,
  onSubmit,
  onCancel,
  busy,
  error,
}) {
  const [form, setForm] = useState(() => {
    const initial = company ? fromCompany(company) : { ...BLANK }
    // A new company has no licence key of its own, so start from the one this
    // client was licensed with. Editable, and sent as an ordinary field.
    if (!initial.license_key) initial.license_key = licenseKey
    return initial
  })
  const [errors, setErrors] = useState({})

  // The logo is write-only upstream, so it is kept apart from the text form: an
  // edit that never touches it sends no logo key and leaves the stored image
  // alone. logoData is the base64 to send; logoPreview is display-only.
  const [logoData, setLogoData] = useState(null)
  const [logoPreview, setLogoPreview] = useState(company?.logo_url || '')
  const [logoError, setLogoError] = useState('')

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function handleLogoChange(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) {
      setLogoData(null)
      setLogoPreview(company?.logo_url || '')
      setLogoError('')
      return
    }
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError('Use a PNG, JPEG or WEBP image.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('The image must be 2 MB or smaller.')
      return
    }
    try {
      setLogoData(await readAsBase64(file))
      setLogoPreview(URL.createObjectURL(file))
      setLogoError('')
    } catch (err) {
      setLogoError(err.message)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length || logoError) return

    const payload = {}
    Object.keys(BLANK).forEach((key) => {
      payload[key] = typeof form[key] === 'string' ? form[key].trim() : form[key]
    })
    // Only sent when a new file was chosen, so an edit can never blank the logo.
    if (logoData) payload.logo = logoData
    onSubmit(payload)
  }

  // Keep whatever is already stored selectable even when the central list no
  // longer offers it, so an edit can never quietly rewrite the country.
  const countryOptions =
    form.country && !countries.includes(form.country) ? [form.country, ...countries] : countries

  const textField = (key, label, hint) => (
    <Field label={label} hint={hint}>
      <Input
        value={form[key]}
        maxLength={MAX_LENGTHS[key]}
        onChange={(event) => setField(key, event.target.value)}
      />
      {errors[key] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[key]}</p> : null}
    </Field>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Client ID" className="sm:col-span-2">
          <Input value={clientId} readOnly tabIndex={-1} className="font-mono cursor-default" />
        </Field>
        {textField('company_name', 'Company name')}
        {textField('license_key', 'License key')}
        {textField('gst_number', 'GST number')}
        {textField('pan_number', 'PAN number')}
        {textField('email', 'Email')}
        {textField('phone_number', 'Phone number')}
        {textField('address_line_1', 'Address line 1')}
        {textField('address_line_2', 'Address line 2', 'Optional.')}
        {textField('city', 'City')}
        {textField('district', 'District')}
        {textField('state', 'State')}
        <Field label="Country">
          <Select value={form.country} onValueChange={(value) => setField('country', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {countryOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Logo" hint="Optional. PNG, JPEG or WEBP, up to 2 MB." className="sm:col-span-2">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[13px] border border-input bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo preview" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              )}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-[#eaf3ee] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#053f33] hover:file:bg-[#dcece2]"
            />
          </div>
          {logoError ? <p className="mt-1 text-xs font-semibold text-destructive">{logoError}</p> : null}
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2.5">
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

export default function Company() {
  const [clientId, setClientId] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [countries, setCountries] = useState([])
  const [company, setCompany] = useState(null)
  const [extra, setExtra] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Company'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(ENDPOINT)
      .then((res) => {
        if (cancelled) return
        const rows = Array.isArray(res?.results) ? res.results : []
        setClientId(res?.client_id || '')
        setLicenseKey(res?.license_key || '')
        setCountries(Array.isArray(res?.countries) ? res.countries : [])
        setCompany(rows[0] || null)
        setExtra(Math.max(0, rows.length - 1))
        setEditing(false)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (company) {
        await api.patch(`${ENDPOINT}${company.id}/`, payload)
        setNotice('Company updated in the central master.')
        setEditing(false)
      } else {
        await api.post(ENDPOINT, payload)
        setNotice('Company created in the central master.')
      }
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`${ENDPOINT}${pendingDelete.id}/`)
      setNotice('Company removed. You can register a new one.')
      setPendingDelete(null)
      setEditing(false)
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const showForm = !company || editing

  return (
    <>
      <PageHead
        eyebrow="CENTRAL MASTER"
        title="Company setup"
        subtitle={
          clientId
            ? `The company registered under client ID ${clientId}. Held by the central master, not by Tixelise.`
            : 'Your company record, held by the central company master.'
        }
      >
        <RefreshButton loading={loading} onClick={reload} />
      </PageHead>

      <div className="mx-auto w-full max-w-[1040px]">
        {error && <Alert variant="error" className="mb-5">{error}</Alert>}
        {notice && !error && <Alert variant="success" className="mb-5">{notice}</Alert>}
        {extra > 0 && (
          <Alert variant="error" className="mb-5">
            The central master holds {extra + 1} companies for this client ID. Only the first is
            shown here - the extra records were created outside Tixelise.
          </Alert>
        )}

        <Card>
          <CardContent className="p-6 md:p-8">
            {loading ? (
              <p className="py-16 text-center text-muted-foreground">Loading…</p>
            ) : showForm ? (
              <CompanyForm
                key={company?.id ?? 'new'}
                clientId={clientId}
                licenseKey={licenseKey}
                countries={countries}
                company={editing ? company : null}
                submitLabel={company ? 'Save changes' : 'Create company'}
                onSubmit={handleSubmit}
                onCancel={company ? () => setEditing(false) : undefined}
                busy={saving}
              />
            ) : (
              <>
                <div className="mb-6 flex items-start gap-3.5">
                  {company.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={`${company.company_name} logo`}
                      className="h-11 w-11 shrink-0 rounded-[13px] bg-white object-contain ring-1 ring-border"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#eaf3ee] text-[#053f33]">
                      <Building2 className="h-[19px] w-[19px]" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-[19px] font-extrabold">{company.company_name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {company.city}, {company.state}, {company.country} · master ID {company.id}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  {DETAIL_FIELDS.map(([key, label]) => (
                    <Detail key={key} label={label} value={company[key]} />
                  ))}
                </dl>

                <div className="mt-6 border-t border-border pt-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Product access
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {enabledProducts(company).map((label) => (
                      <span key={label} className="rounded-md bg-muted px-2.5 py-1 text-[12.5px] font-semibold">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-end gap-2.5 border-t border-border pt-5">
                  <Button variant="outline" onClick={() => setPendingDelete(company)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                  <Button onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Edit company
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(v) => {
          if (!v && !deleting) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.company_name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the record from the{' '}
            <span className="font-medium text-foreground">central company master</span> under client{' '}
            <span className="font-mono">{pendingDelete?.client_id}</span>. Sales and staff data are
            not affected, but you will need to register the company again.
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
