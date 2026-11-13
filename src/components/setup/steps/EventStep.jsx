import React, { useState } from 'react'
import { CalendarClock, Info, Pencil } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EventTaxFields } from '@/components/EventTaxFields'
import { ProgramDurationField } from '@/components/ProgramDurationField'
import VenueInput from '@/components/VenueInput'
import { FieldError } from '@/components/setup/FieldError'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StepShell } from '@/components/setup/StepShell'
import { friendlyError, isDuplicateMessage, localTimeZone, toUtcIso, uniqueCodeFromName } from '@/lib/setup'
import { eventTaxSummary, validateEventTax } from '@/lib/tax'
import { formatProgramWindow, toApiTime, validateProgramWindow } from '@/lib/time'
import { collectVenues } from '@/lib/venues'

const EVENT_TYPES = [
  { value: 'regular', label: 'Regular event' },
  { value: 'periodical', label: 'Periodical event' },
]

function validate(form) {
  const problems = {}
  const code = form.code.trim()
  if (!code) problems.code = 'Give the event a short code, for example EV001.'
  else if (!/^[A-Za-z0-9]+$/.test(code)) problems.code = 'Use only letters and numbers.'
  if (!form.name.trim()) problems.name = 'Give the event a name people will recognise.'
  // A regular event starts now and never ends, so it has no schedule to fill in.
  if (form.event_type === 'periodical') {
    if (!form.start_at) problems.start_at = 'When does the event start?'
    if (!form.end_at) problems.end_at = 'When does the event end?'
    if (form.start_at && form.end_at && new Date(form.end_at) <= new Date(form.start_at)) {
      problems.end_at = 'The end time must be later than the start time.'
    }
    if (form.sales_start_at && form.sales_end_at && new Date(form.sales_end_at) <= new Date(form.sales_start_at)) {
      problems.sales_end_at = 'Sales close must be later than sales open.'
    }
  }
  const programError = validateProgramWindow(form.program_start_time, form.program_end_time)
  if (programError) problems.program = programError
  Object.assign(problems, validateEventTax(form))
  return problems
}

function formatWhen(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString()
}

export default function EventStep({
  form,
  setForm,
  event,
  events,
  onCreated,
  onUseEvent,
  onNext,
  onReplace,
  onBack,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [reuse, setReuse] = useState(null)

  const existingCodes = events.map((item) => item.code)
  const venueOptions = collectVenues(events)

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }))
    setFieldErrors((current) => {
      const next = { ...current }
      Object.keys(patch).forEach((key) => delete next[key])
      return next
    })
  }

  // The code follows the name until the user edits it themselves. A code that is
  // already taken gets a number appended, so the suggestion is always free.
  function updateName(name) {
    const derived = uniqueCodeFromName(name, existingCodes)
    update({ name, ...(form.codeTouched || !derived ? {} : { code: derived }) })
  }

  function updateCode(value) {
    setReuse(null)
    update({ code: value.toUpperCase().replace(/[^A-Z0-9]/g, ''), codeTouched: true })
  }

  function updateProgram(start, end) {
    setForm((current) => ({ ...current, program_start_time: start, program_end_time: end }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.program
      return next
    })
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault()
    const problems = validate(form)
    const typedCode = form.code.trim().toUpperCase()
    const clash = events.find((item) => String(item.code).toUpperCase() === typedCode)
    if (clash) {
      problems.code = `${clash.code} is already used by “${clash.name}”. Pick a different code, or set up that event instead.`
      setReuse(clash)
    } else {
      setReuse(null)
    }
    if (Object.keys(problems).length) {
      setFieldErrors(problems)
      setError(null)
      return
    }

    setBusy(true)
    setError(null)
    setReuse(null)
    setFieldErrors({})

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        event_type: form.event_type,
        description: form.description.trim(),
        venue: form.venue.trim(),
        address: form.address.trim(),
        program_start_time: toApiTime(form.program_start_time),
        program_end_time: toApiTime(form.program_end_time),
        tax_mode: form.tax_mode || 'inherit',
        tax_rate: form.tax_rate === '' || form.tax_rate === undefined ? null : form.tax_rate,
        hsn_code: String(form.hsn_code || '').trim(),
        prices_include_tax: Boolean(form.prices_include_tax),
      }
      if (form.event_type === 'periodical') {
        payload.start_at = toUtcIso(form.start_at)
        payload.end_at = toUtcIso(form.end_at)
        if (form.sales_start_at) payload.sales_start_at = toUtcIso(form.sales_start_at)
        if (form.sales_end_at) payload.sales_end_at = toUtcIso(form.sales_end_at)
      }
      const created = await api.post('/admin/events/', payload)
      onCreated(created)
    } catch (err) {
      const friendly = friendlyError(err)
      setError(friendly)
      setFieldErrors(friendly.fieldErrors)
      if (isDuplicateMessage(err.message)) {
        const match = events.find((ev) => ev.code === form.code.trim().toUpperCase())
        if (match) setReuse(match)
      }
    } finally {
      setBusy(false)
    }
  }

  if (event) {
    return (
      <StepShell
        step={1}
        title="Your event is ready"
        hint="This is the event you are setting up. Everything in the next steps belongs to it."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onBack}>
              Cancel
            </Button>
            <Button type="button" onClick={onNext}>
              Continue
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-bold">{event.code}</span>
            <span className="text-[15px] font-semibold">{event.name}</span>
          </div>
          <dl className="mt-3 space-y-1.5 text-[13.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="font-medium">{formatWhen(event.start_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ends</dt>
              <dd className="font-medium">{event.end_at ? formatWhen(event.end_at) : 'No end'}</dd>
            </div>
            {event.program_start_time && event.program_end_time ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Program</dt>
                <dd className="font-medium">
                  {formatProgramWindow(event.program_start_time, event.program_end_time)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium">{eventTaxSummary(event)}</dd>
            </div>
            {event.venue ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Venue</dt>
                <dd className="font-medium">{event.venue}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <Button type="button" variant="outline" onClick={onReplace}>
          <Pencil className="h-4 w-4" /> Use a different event
        </Button>
      </StepShell>
    )
  }

  return (
    <StepShell
      step={1}
      title="Create your event"
      hint="An event is the show itself — for example “Music Fest 2026”. We start it as a draft so nothing goes live until you are ready."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Cancel
          </Button>
          <Button type="submit" form="setup-event-form" disabled={busy}>
            {busy ? 'Creating…' : 'Create event and continue'}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert variant="error">
          <p className="font-bold">{error.title}</p>
          <p className="mt-1">{error.message}</p>
          {reuse ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => onUseEvent(reuse)}>
              Use existing event {reuse.code}
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {reuse && !error ? (
        <Alert>
          <p className="font-bold">{reuse.code} is already taken</p>
          <p className="mt-1">
            “{reuse.name}” already uses that code. Pick a different code above, or continue with the event that exists.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => onUseEvent(reuse)}>
            Use existing event {reuse.code}
          </Button>
        </Alert>
      ) : null}

      <form id="setup-event-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Event name" hint="The name your staff will see on the POS screen.">
            <Input
              value={form.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Music Fest 2026"
              className={fieldErrors.name ? 'border-destructive/40' : undefined}
            />
            <FieldError>{fieldErrors.name}</FieldError>
          </Field>

          <Field label="Event code" hint="Filled in from the name — edit it if you prefer something else.">
            <Input
              value={form.code}
              onChange={(e) => updateCode(e.target.value)}
              placeholder="MUSICFEST2026"
              className={fieldErrors.code ? 'border-destructive/40' : undefined}
            />
            <FieldError>{fieldErrors.code}</FieldError>
          </Field>
        </div>

        <Field label="Description" hint="Optional — a short note about the event.">
          <Textarea
            rows="2"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Annual music festival"
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Venue" hint="Optional — existing event sections appear as suggestions.">
            <VenueInput
              value={form.venue}
              onChange={(value) => update({ venue: value })}
              venues={venueOptions}
              placeholder="Central Auditorium"
            />
          </Field>
          <Field label="Address" hint="Optional.">
            <Input
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="Kochi, Kerala"
            />
          </Field>
        </div>

        <div className="border-t border-border pt-5">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            Schedule
          </p>

          <Field
            label="Event type"
            hint="Regular events start now, have no end date, and need no schedule."
            className="mb-5"
          >
            <Select value={form.event_type} onValueChange={(value) => update({ event_type: value })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {form.event_type === 'regular' ? (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" />
              <span>
                Starts now with sales open immediately. A regular event has no end date — it keeps
                selling until you mark it completed or cancelled.
              </span>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Starts at">
                  <Input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => update({ start_at: e.target.value })}
                    className={fieldErrors.start_at ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors.start_at}</FieldError>
                </Field>
                <Field label="Ends at">
                  <Input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => update({ end_at: e.target.value })}
                    className={fieldErrors.end_at ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors.end_at}</FieldError>
                </Field>
                <Field label="Sales open" hint="Optional — when the POS may start selling.">
                  <Input
                    type="datetime-local"
                    value={form.sales_start_at}
                    onChange={(e) => update({ sales_start_at: e.target.value })}
                    className={fieldErrors.sales_start_at ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors.sales_start_at}</FieldError>
                </Field>
                <Field label="Sales close" hint="Optional — when selling stops.">
                  <Input
                    type="datetime-local"
                    value={form.sales_end_at}
                    onChange={(e) => update({ sales_end_at: e.target.value })}
                    className={fieldErrors.sales_end_at ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors.sales_end_at}</FieldError>
                </Field>
              </div>

              <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                <span>
                  Times are entered in your device time zone ({localTimeZone()}) and stored safely in UTC.
                </span>
              </p>
            </>
          )}

          <div className="mt-5">
            <ProgramDurationField
              start={form.program_start_time}
              end={form.program_end_time}
              error={fieldErrors.program}
              onChange={updateProgram}
            />
          </div>
        </div>

        <EventTaxFields
          taxMode={form.tax_mode || 'inherit'}
          taxRate={form.tax_rate || ''}
          hsnCode={form.hsn_code || ''}
          pricesIncludeTax={Boolean(form.prices_include_tax)}
          errors={fieldErrors}
          onChange={update}
        />
      </form>
    </StepShell>
  )
}
