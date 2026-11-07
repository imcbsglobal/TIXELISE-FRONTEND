import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { getSession } from '@/session'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHead } from '@/components/ui/page'
import { Stepper } from '@/components/setup/Stepper'
import EventStep from '@/components/setup/steps/EventStep'
import TicketTypesStep from '@/components/setup/steps/TicketTypesStep'
import ActivateStep from '@/components/setup/steps/ActivateStep'
import { SETUP_STEPS, clearDraft, fetchAll, loadDraft, nextCode, saveDraft } from '@/lib/setup'

const EMPTY_EVENT = {
  code: '',
  codeTouched: false,
  name: '',
  event_type: 'regular',
  description: '',
  venue: '',
  address: '',
  start_at: '',
  end_at: '',
  sales_start_at: '',
  sales_end_at: '',
}

export default function Setup() {
  const navigate = useNavigate()
  const session = getSession()
  const tenantCode = session?.tenant?.code || 'default'

  const [step, setStep] = useState(1)
  const [event, setEvent] = useState(null)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [ticketRows, setTicketRows] = useState([])
  const [refs, setRefs] = useState({ events: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activated, setActivated] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Setup'
  }, [])

  const loadRefs = useCallback(async () => {
    try {
      const [events, categories] = await Promise.all([
        fetchAll('/admin/events/'),
        fetchAll('/admin/categories/'),
      ])
      setRefs({ events, categories })
      setLoadError(null)
      // Suggest the first free event code once we know what already exists.
      setEventForm((current) => {
        if (current.code) return current
        return { ...current, code: nextCode('EV', events.map((item) => item.code)) }
      })
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const draft = loadDraft(tenantCode)
      if (draft && !draft.startedOver) {
        if (draft.event) setEvent(draft.event)
        if (draft.eventForm) {
          // Drafts saved before event types existed keep their original schedule.
          const saved = draft.eventForm
          setEventForm({
            ...EMPTY_EVENT,
            ...saved,
            event_type: saved.event_type || (saved.start_at ? 'periodical' : EMPTY_EVENT.event_type),
          })
        }
        if (Array.isArray(draft.ticketTypes)) setTicketRows(draft.ticketTypes)
        // Clamp: older drafts could be saved on the removed step 4/5.
        if (draft.step) setStep(Math.min(Math.max(Number(draft.step) || 1, 1), 3))
        if (draft.activated) setActivated(true)
      }
      await loadRefs()
      if (cancelled) return
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [loadRefs, tenantCode])

  // Draft persistence — the wizard survives a page reload.
  useEffect(() => {
    if (loading) return
    saveDraft(tenantCode, {
      step,
      event,
      eventForm,
      ticketTypes: ticketRows,
      activated,
    })
  }, [step, event, eventForm, ticketRows, activated, loading, tenantCode])

  const ticketTypesReady = ticketRows.length > 0 && ticketRows.every((row) => row.status === 'created' || row.status === 'reused')

  const statuses = useMemo(
    () => ({
      1: step === 1 ? 'current' : event ? 'done' : 'pending',
      2: step === 2 ? 'current' : ticketTypesReady ? 'done' : 'pending',
      3: step === 3 ? (activated ? 'done' : 'current') : activated ? 'done' : 'pending',
    }),
    [event, ticketTypesReady, step, activated],
  )

  function handleEventCreated(created) {
    setEvent(created)
    setStep(2)
  }

  function handleUseExistingEvent(existing) {
    setEvent(existing)
    setEventForm((current) => ({ ...current, code: existing.code, name: existing.name }))
    setStep(2)
  }

  function handleReplaceEvent() {
    setEvent(null)
    setEventForm((current) => ({
      ...current,
      code: nextCode('EV', refs.events.map((item) => item.code)),
      codeTouched: false,
    }))
    setStep(1)
  }

  function handleCategoryCreated(category) {
    setRefs((current) => ({
      ...current,
      categories: current.categories.some((item) => item.id === category.id)
        ? current.categories.map((item) => (item.id === category.id ? { ...item, ...category } : item))
        : [...current.categories, category],
    }))
  }

  function startOver() {
    clearDraft(tenantCode)
    setStep(1)
    setEvent(null)
    setEventForm(EMPTY_EVENT)
    setTicketRows([])
    setActivated(false)
  }

  function keepAsDraft() {
    clearDraft(tenantCode)
    navigate('/tenant/events')
  }

  return (
    <>
      <PageHead
        eyebrow="SETUP"
        title="Set up your first event"
        subtitle="Three short steps: create the event, add ticket types and prices, then go live."
      >
        <Button variant="outline" onClick={startOver}>
          <RotateCcw className="h-4 w-4" /> Start over
        </Button>
      </PageHead>

      {loadError ? (
        <Alert variant="error" className="mb-5">
          <p className="font-bold">We could not load your organization data</p>
          <p className="mt-1">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadRefs}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="mb-5">
        <Stepper steps={SETUP_STEPS} current={step} statuses={statuses} onSelect={setStep} />
      </div>

      {step === 1 ? (
        <EventStep
          form={eventForm}
          setForm={setEventForm}
          event={event}
          events={refs.events}
          onCreated={handleEventCreated}
          onUseEvent={handleUseExistingEvent}
          onNext={() => setStep(2)}
          onReplace={handleReplaceEvent}
          onBack={() => navigate('/tenant')}
        />
      ) : null}

      {step === 2 ? (
        <TicketTypesStep
          event={event}
          rows={ticketRows}
          setRows={setTicketRows}
          categories={refs.categories}
          onCategoryCreated={handleCategoryCreated}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 && event ? (
        <ActivateStep
          event={event}
          ticketTypes={ticketRows}
          activated={activated}
          onActivated={() => {
            setActivated(true)
            clearDraft(tenantCode)
          }}
          onBack={() => setStep(2)}
          onKeepDraft={keepAsDraft}
          onRestart={startOver}
        />
      ) : null}

      {!event && step > 1 ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/tenant" className="underline">
            Back to the dashboard
          </Link>
        </p>
      ) : null}
    </>
  )
}
