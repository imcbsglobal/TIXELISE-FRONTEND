import React, { useEffect, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/setup/FieldError'
import { RowStatus } from '@/components/setup/RowStatus'
import { BubblePattern } from '@/components/ui/bubble-pattern'
import { StepShell } from '@/components/setup/StepShell'
import { codeFromName, friendlyError, isDuplicateMessage, uid } from '@/lib/setup'
import { cn } from '@/lib/utils'

const PRESETS = [
  { name: 'Adult', price: '499.00' },
  { name: 'Child', price: '199.00' },
  { name: 'VIP', price: '1499.00' },
]

function blankRow() {
  return {
    uid: uid(),
    name: '',
    code: '',
    codeTouched: false,
    price: '',
    currency: 'INR',
    status: 'pending',
    message: '',
    categoryId: null,
    priceId: null,
    reuseCandidate: null,
  }
}

export default function TicketTypesStep({ event, rows, setRows, categories, onCategoryCreated, onNext, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    setRows((current) =>
      current.filter((row) => row.name.trim() || row.code.trim() || row.price !== '' || row.categoryId),
    )
  }, [setRows])

  const updateRow = (rowUid, patch) =>
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, ...patch } : row)))

  const addRow = (preset) => {
    setRows((current) => {
      // Drop the untouched starting row so the user is not left with a blank to fill in.
      const kept = current.filter((row) => row.name.trim() || row.code.trim() || row.price !== '')
      return [
        ...kept,
        preset
          ? { ...blankRow(), name: preset.name, code: codeFromName(preset.name), price: preset.price }
          : blankRow(),
      ]
    })
    setSummary(null)
  }

  const addExistingCategory = (category) => {
    setRows((current) => {
      // Replace the untouched starter row with the selected category.
      const kept = current.filter((row) => row.name.trim() || row.code.trim() || row.price !== '')
      return [
        ...kept,
        {
          ...blankRow(),
          categoryId: category.id,
          code: category.code,
          codeTouched: true,
          name: category.name,
        },
      ]
    })
    setFieldErrors({})
    setSummary(null)
  }

  const removeRow = (rowUid) => {
    setRows((current) => current.filter((row) => row.uid !== rowUid))
    setSummary(null)
  }

  function updateName(rowUid, name) {
    setRows((current) =>
      current.map((row) =>
        row.uid === rowUid
          ? { ...row, name, code: row.codeTouched ? row.code : codeFromName(name) }
          : row,
      ),
    )
  }

  function updateCode(rowUid, code) {
    setRows((current) =>
      current.map((row) =>
        row.uid === rowUid ? { ...row, code: code.toUpperCase().replace(/[^A-Z0-9]/g, ''), codeTouched: true } : row,
      ),
    )
  }

  function updateField(rowUid, key, value) {
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, [key]: value } : row)))
  }

  function validate() {
    const problems = {}
    if (!rows.length) {
      problems.general = 'Add at least one ticket type — an event needs a price before it can go live.'
      return problems
    }
    rows.forEach((row) => {
      if (!row.name.trim()) problems[`${row.uid}.name`] = 'Give this ticket type a name.'
      if (!row.code.trim()) problems[`${row.uid}.code`] = 'A short code is required.'
      if (row.price === '' || row.price === null || row.price === undefined) {
        problems[`${row.uid}.price`] = 'Enter a price.'
      } else if (Number.isNaN(Number(row.price)) || Number(row.price) < 0) {
        problems[`${row.uid}.price`] = 'Enter a price of zero or more.'
      }
    })
    return problems
  }

  async function ensureCategory(row) {
    if (row.categoryId) return row.categoryId
    try {
      const category = await api.post('/admin/categories/', {
        code: row.code.trim().toUpperCase(),
        name: row.name.trim(),
        description: '',
      })
      updateRow(row.uid, { categoryId: category.id, message: '', reuseCandidate: null })
      onCategoryCreated(category)
      return category.id
    } catch (err) {
      if (isDuplicateMessage(err.message)) {
        const existing = categories.find((c) => c.code === row.code.trim().toUpperCase())
        if (existing) {
          if (existing.status && existing.status !== 'active') {
            updateRow(row.uid, {
              status: 'failed',
              message: `${existing.code} was deleted in Categories. Restore it there before adding a price for it.`,
              reuseCandidate: null,
            })
            return null
          }
          updateRow(row.uid, {
            status: 'failed',
            message: `A ticket type called ${existing.code} already exists in your organization.`,
            reuseCandidate: { id: existing.id, code: existing.code },
          })
          return null
        }
      }
      updateRow(row.uid, { status: 'failed', message: friendlyError(err).message })
      return null
    }
  }

  async function ensurePrice(row, categoryId) {
    try {
      const price = await api.post('/admin/prices/', {
        event: event.id,
        category: categoryId,
        amount: Number(row.price).toFixed(2),
        currency: (row.currency || 'INR').trim().toUpperCase() || 'INR',
      })
      updateRow(row.uid, { status: 'created', priceId: price.id, message: '', reuseCandidate: null })
      return true
    } catch (err) {
      if (/already exists for this event and category/i.test(err.message)) {
        updateRow(row.uid, {
          status: 'created',
          message: 'A price was already set for this ticket type.',
          reuseCandidate: null,
        })
        return true
      }
      updateRow(row.uid, { status: 'failed', message: friendlyError(err).message })
      return false
    }
  }

  async function processRow(row) {
    updateRow(row.uid, { status: 'creating', message: '', reuseCandidate: null })
    const categoryId = await ensureCategory(row)
    if (!categoryId) return false
    return ensurePrice(row, categoryId)
  }

  async function handleSave() {
    const problems = validate()
    setFieldErrors(problems)
    if (Object.keys(problems).length) {
      setError(null)
      return
    }

    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      const pending = rows.filter((row) => row.status !== 'created' && row.status !== 'reused')
      const alreadyDone = rows.length - pending.length
      const outcomes = []

      for (const row of pending) {
        // Sequential on purpose — parallel writes would race on the unique
        // (event, category) price constraint and hide which row actually failed.
        // eslint-disable-next-line no-await-in-loop
        outcomes.push(await processRow(row))
      }

      const failed = outcomes.filter((ok) => !ok).length
      setSummary({
        created: alreadyDone + (pending.length - failed),
        failed,
        total: rows.length,
      })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function reuseExisting(row) {
    if (!row.reuseCandidate) return
    updateRow(row.uid, {
      categoryId: row.reuseCandidate.id,
      reuseCandidate: null,
      status: 'creating',
      message: '',
    })
    await ensurePrice({ ...row, categoryId: row.reuseCandidate.id }, row.reuseCandidate.id)
    setRows((current) =>
      current.map((candidate) =>
        candidate.uid === row.uid && candidate.status === 'created' ? { ...candidate, status: 'reused' } : candidate,
      ),
    )
  }

  const allSettled = rows.length > 0 && rows.every((row) => row.status === 'created' || row.status === 'reused')
  const selectedCategoryIds = new Set(rows.map((row) => row.categoryId).filter(Boolean))
  const activeCategories = categories.filter((category) => category.status === 'active')
  const inactiveCategories = categories.filter((category) => category.status && category.status !== 'active')

  return (
    <StepShell
      step={2}
      title="What kinds of tickets will you sell?"
      hint="Ticket types are reusable — create “Adult”, “Child” or “VIP” once and price them for this event."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex items-center gap-2.5">
            {!allSettled ? (
              <Button type="button" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : 'Save ticket types'}
              </Button>
            ) : (
              <Button type="button" onClick={onNext}>
                Continue
              </Button>
            )}
          </div>
        </>
      }
    >
      {error ? (
        <Alert variant="error">
          <p className="font-bold">{error.title}</p>
          <p className="mt-1">{error.message}</p>
        </Alert>
      ) : null}

      {fieldErrors.general ? <Alert variant="error">{fieldErrors.general}</Alert> : null}

      {summary && summary.failed === 0 ? (
        <Alert variant="success">
          {summary.created} ticket {summary.created === 1 ? 'type' : 'types'} saved with prices. You can now make the
          event live.
        </Alert>
      ) : null}

      {summary && summary.failed > 0 ? (
        <Alert variant="error">
          {summary.created} of {summary.total} saved. Fix the highlighted {summary.failed === 1 ? 'row' : 'rows'} and save
          again.
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold">Choose a ticket category</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a category to add its price for this event, or create a new ticket type.
            </p>
          </div>
          <Button type="button" onClick={() => addRow(null)} disabled={busy}>
            <Plus className="h-4 w-4" /> Create new ticket type
          </Button>
        </div>
        {activeCategories.length ? (
          <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeCategories.map((category) => {
              const selected = selectedCategoryIds.has(category.id)
              return (
                <Button
                  key={category.id}
                  type="button"
                  variant="outline"
                  disabled={busy || selected}
                  onClick={() => addExistingCategory(category)}
                  className="relative h-full min-h-[76px] justify-between gap-4 overflow-hidden whitespace-normal rounded-xl bg-card px-4 py-3 text-left hover:bg-accent/40"
                >
                  <BubblePattern />
                  <span className="relative z-10 flex min-w-0 flex-col items-start gap-1">
                    <span className="font-display text-base font-bold text-foreground">{category.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{category.code}</span>
                  </span>
                  <span className="relative z-10 flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                    {selected ? 'Added' : <><Plus className="h-4 w-4" /> Add</>}
                  </span>
                </Button>
              )
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No active categories yet. Create a new ticket type to get started.
          </p>
        )}
        {inactiveCategories.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Inactive categories are unavailable: {inactiveCategories.map((category) => category.code).join(', ')}.
          </p>
        ) : null}
      </section>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.uid} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <RowStatus status={row.status} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(row.uid)}
                disabled={busy || row.status === 'created' || row.status === 'reused'}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <Field label="Ticket type">
                  <Input
                    value={row.name}
                    onChange={(e) => updateName(row.uid, e.target.value)}
                    placeholder="Adult"
                    disabled={busy || !!row.categoryId}
                    className={fieldErrors[`${row.uid}.name`] ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.name`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Code">
                  <Input
                    value={row.code}
                    onChange={(e) => updateCode(row.uid, e.target.value)}
                    placeholder="ADULT"
                    disabled={busy || !!row.categoryId}
                    className={fieldErrors[`${row.uid}.code`] ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.code`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Price">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateField(row.uid, 'price', e.target.value)}
                    placeholder="499.00"
                    disabled={busy}
                    className={cn('no-spinner', fieldErrors[`${row.uid}.price`] ? 'border-destructive/40' : undefined)}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.price`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Currency">
                  <Input
                    value={row.currency}
                    onChange={(e) => updateField(row.uid, 'currency', e.target.value.toUpperCase())}
                    placeholder="INR"
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>

            {row.message ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{row.message}</p>
            ) : null}

            {row.categoryId && row.status === 'pending' ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Using the existing {row.code} category. Enter a price, then save ticket types.
              </p>
            ) : null}

            {row.reuseCandidate ? (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Button type="button" variant="outline" size="sm" onClick={() => reuseExisting(row)} disabled={busy}>
                  Use existing {row.reuseCandidate.code}
                </Button>
                <span className="text-xs text-muted-foreground">
                  This keeps the existing ticket type and only adds the price for this event.
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs text-muted-foreground">Quick add:</span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addRow(preset)}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5" /> {preset.name} · {preset.price}
          </Button>
        ))}
      </div>
    </StepShell>
  )
}
