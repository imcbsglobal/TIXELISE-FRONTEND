import React, { useState } from 'react'
import { Info, UserCheck } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/setup/FieldError'
import { RowStatus } from '@/components/setup/RowStatus'
import { StepShell } from '@/components/setup/StepShell'
import { cn } from '@/lib/utils'
import { friendlyError, toUtcIso } from '@/lib/setup'

export default function AssignStep({ event, rows, setRows, ticketTypes, onNext, onSkip, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [summary, setSummary] = useState(null)

  const updateRow = (rowUid, patch) =>
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, ...patch } : row)))

  function toggleSelected(rowUid) {
    updateRow(rowUid, { selected: !rowOf(rowUid).selected })
  }

  function rowOf(rowUid) {
    return rows.find((row) => row.uid === rowUid) || { selected: false }
  }

  function toggleCategory(rowUid, categoryId) {
    const row = rowOf(rowUid)
    const allowed = row.allowed.includes(categoryId)
      ? row.allowed.filter((id) => id !== categoryId)
      : [...row.allowed, categoryId]
    updateRow(rowUid, { allowed })
  }

  function validate() {
    const problems = {}
    const selected = rows.filter((row) => row.selected)
    if (!selected.length) {
      problems.general = 'Tick at least one staff member so somebody can sell tickets for this event.'
      return problems
    }
    selected.forEach((row) => {
      if (row.valid_from && row.valid_until && new Date(row.valid_until) <= new Date(row.valid_from)) {
        problems[`${row.uid}.valid_until`] = 'The end must be later than the start.'
      }
      if (row.restrict && !row.allowed.length) {
        problems[`${row.uid}.allowed`] = 'Pick at least one ticket type, or turn the limit off.'
      }
    })
    return problems
  }

  async function processRow(row) {
    updateRow(row.uid, { status: 'creating', message: '' })
    try {
      await api.post('/admin/assignments/', {
        staff: Number(row.staffId),
        event: Number(event.id),
        restrict_categories: !!row.restrict,
        ...(row.valid_from ? { valid_from: toUtcIso(row.valid_from) } : {}),
        ...(row.valid_until ? { valid_until: toUtcIso(row.valid_until) } : {}),
        ...(row.restrict ? { allowed_category_ids: row.allowed } : {}),
      })
      updateRow(row.uid, { status: 'created', message: '' })
      return true
    } catch (err) {
      if (/already assigned|already exists|already in use/i.test(err.message || '')) {
        updateRow(row.uid, { status: 'created', message: 'This person was already assigned to the event.' })
        return true
      }
      updateRow(row.uid, { status: 'failed', message: friendlyError(err).message })
      return false
    }
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
      const selected = rows.filter((row) => row.selected)
      const outcomes = []
      for (const row of selected) {
        // eslint-disable-next-line no-await-in-loop
        outcomes.push(await processRow(row))
      }
      const failed = outcomes.filter((ok) => !ok).length
      setSummary({ created: selected.length - failed, failed, total: selected.length })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const allSettled = rows.some((row) => row.selected) && rows.filter((row) => row.selected).every((row) => row.status === 'created')

  return (
    <StepShell
      step={4}
      title="Let your staff sell for this event"
      hint="A staff member can only sell tickets for events they are assigned to. Tick the people who should work at this event."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2.5">
            {rows.length === 0 ? (
              <Button type="button" onClick={onNext}>
                Continue
              </Button>
            ) : allSettled ? (
              <Button type="button" onClick={onNext}>
                Continue
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
                  Skip for now
                </Button>
                <Button type="button" onClick={handleSave} disabled={busy}>
                  {busy ? 'Assigning…' : 'Save assignments'}
                </Button>
              </>
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
          {summary.created} {summary.created === 1 ? 'person can' : 'people can'} now sell tickets for {event.code}.
        </Alert>
      ) : null}

      {summary && summary.failed > 0 ? (
        <Alert variant="error">
          {summary.created} of {summary.total} assigned. Fix the highlighted {summary.failed === 1 ? 'row' : 'rows'} and try
          again.
        </Alert>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.uid} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox checked={row.selected} onCheckedChange={() => toggleSelected(row.uid)} disabled={busy} />
                <span>
                  <span className="block text-[14.5px] font-semibold">{row.display_name}</span>
                  <span className="block font-mono text-[12.5px] text-muted-foreground">{row.staff_code}</span>
                </span>
              </label>
              {row.status !== 'pending' ? <RowStatus status={row.status} /> : null}
            </div>

            {row.selected ? (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Valid from" hint="Optional — leave blank for no limit.">
                    <Input
                      type="datetime-local"
                      value={row.valid_from}
                      onChange={(e) => updateRow(row.uid, { valid_from: e.target.value })}
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Valid until" hint="Optional — leave blank for no limit.">
                    <Input
                      type="datetime-local"
                      value={row.valid_until}
                      onChange={(e) => updateRow(row.uid, { valid_until: e.target.value })}
                      disabled={busy}
                      className={fieldErrors[`${row.uid}.valid_until`] ? 'border-destructive/40' : undefined}
                    />
                    <FieldError>{fieldErrors[`${row.uid}.valid_until`]}</FieldError>
                  </Field>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
                  <Checkbox
                    checked={row.restrict}
                    onCheckedChange={(value) => updateRow(row.uid, { restrict: !!value, allowed: value ? row.allowed : [] })}
                    disabled={busy}
                  />
                  Limit {row.display_name.split(' ')[0]} to specific ticket types
                </label>

                {row.restrict ? (
                  <div className="flex flex-wrap gap-2">
                    {ticketTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No ticket types yet — go back a step and add one first.
                      </p>
                    ) : (
                      ticketTypes.map((type) => (
                        <button
                          type="button"
                          key={type.categoryId || type.uid}
                          onClick={() => toggleCategory(row.uid, type.categoryId)}
                          disabled={busy}
                          className={cn(
                            'rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors',
                            row.allowed.includes(type.categoryId)
                              ? 'border-[#72c9ad] bg-[#e3f6ee] text-[#00794e]'
                              : 'border-input bg-background text-muted-foreground hover:border-primary/40',
                          )}
                        >
                          {type.code}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
                <FieldError>{fieldErrors[`${row.uid}.allowed`]}</FieldError>
              </div>
            ) : null}

            {row.message ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{row.message}</p>
            ) : null}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            No staff members found yet. Go back a step to create one, or add them from the User management page.
          </span>
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <UserCheck className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        <span>
          Assignments are checked on every sale, so you can revoke access at any time from the Assignments page.
        </span>
      </p>
    </StepShell>
  )
}
