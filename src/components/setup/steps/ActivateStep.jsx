import React, { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StepShell } from '@/components/setup/StepShell'
import { friendlyError } from '@/lib/setup'

function formatWhen(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString()
}

export default function ActivateStep({
  event,
  ticketTypes,
  staffRows,
  assignRows,
  activated,
  onActivated,
  onBack,
  onKeepDraft,
  onRestart,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(activated)

  const createdTypes = ticketTypes.filter((row) => row.status === 'created' || row.status === 'reused')
  const createdStaff = staffRows.filter((row) => row.status === 'created' || row.status === 'reused')
  const assigned = assignRows.filter((row) => row.status === 'created')
  const alreadyLive = event?.status === 'active'

  async function handleActivate() {
    setBusy(true)
    setError(null)
    try {
      const result = await api.post(`/admin/events/${event.id}/active/`)
      setDone(true)
      onActivated(result)
    } catch (err) {
      const friendly = friendlyError(err)
      if (err.code === 'INVALID_TRANSITION' || /already/i.test(err.message || '')) {
        setDone(true)
        onActivated({ id: event.id, status: 'active' })
        return
      }
      setError(friendly)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <StepShell
        step={5}
        title="All set — your event is live"
        hint="Your staff can now log in to the POS app and sell tickets for this event."
      >
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e3f6ee] text-[#00794e]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#00794e]">Event is live</p>
                <h4 className="mt-0.5 font-display text-lg font-extrabold tracking-tight">
                  {event.code} — {event.name}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assigned.length > 0
                    ? `${assigned.length} ${assigned.length === 1 ? 'staff member is' : 'staff members are'} assigned and ready to sell.`
                    : 'No staff are assigned yet. You can assign staff from the Assignments page.'}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Starts</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatWhen(event.start_at) || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Ticket types</dt>
                <dd className="mt-0.5 text-sm font-medium">{createdTypes.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Staff assigned</dt>
                <dd className="mt-0.5 text-sm font-medium">{assigned.length}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button asChild>
                <Link to="/tenant/events">
                  View event <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/tenant">Go to dashboard</Link>
              </Button>
              <Button variant="ghost" onClick={onRestart}>
                Set up another event
              </Button>
            </div>
          </CardContent>
        </Card>
      </StepShell>
    )
  }

  return (
    <StepShell
      step={5}
      title="Review and open the event for sales"
      hint="Nothing is sellable until the event is active. Check the summary below, then make it live when you are ready."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="button" variant="outline" onClick={onKeepDraft}>
              Keep as draft
            </Button>
            <Button type="button" onClick={handleActivate} disabled={busy || alreadyLive}>
              {busy ? 'Opening…' : alreadyLive ? 'Already live' : `Make ${event.code} live`}
            </Button>
          </div>
        </>
      }
    >
      {error ? (
        <Alert variant="error">
          <p className="font-bold">{error.title}</p>
          <p className="mt-1">{error.message}</p>
          {error.code === 'CONFIGURATION_INCOMPLETE' ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
              Go back to ticket types
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {alreadyLive ? (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {event.code} is already active — your staff can sell tickets for it right now.
          </span>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">{event.code}</span>
                <StatusBadge status={event.status} />
              </div>
              <h4 className="mt-1 font-display text-lg font-extrabold">{event.name}</h4>
              {event.venue ? <p className="mt-0.5 text-sm text-muted-foreground">{event.venue}</p> : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="font-medium">{formatWhen(event.start_at) || '—'}</dd>
              <dt className="text-muted-foreground">Ends</dt>
              <dd className="font-medium">{formatWhen(event.end_at) || '—'}</dd>
            </dl>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-5 md:grid-cols-2">
            <section className="md:border-r md:border-border md:pr-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h5 className="text-sm font-bold">Ticket types</h5>
                <span className="text-xs text-muted-foreground">{createdTypes.length}</span>
              </div>
              {createdTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ticket types saved. Go back and add at least one.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {createdTypes.map((row) => (
                    <li key={row.uid} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <span className="font-medium">{row.name}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{row.code}</span>
                      </span>
                      <span className="shrink-0 font-semibold">
                        {row.currency} {Number(row.price).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="md:pl-1">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h5 className="text-sm font-bold">Staff</h5>
                <span className="text-xs text-muted-foreground">{assigned.length} assigned</span>
              </div>
              {createdStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff accounts created in this setup.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {createdStaff.map((row) => (
                    <li key={row.uid} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <span className="font-medium">{row.display_name}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{row.staff_code}</span>
                      </span>
                      {assigned.some((entry) => entry.staffId === row.staffId) ? (
                        <Badge variant="success">Assigned</Badge>
                      ) : (
                        <Badge variant="muted">Not assigned</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </CardContent>
      </Card>
    </StepShell>
  )
}
