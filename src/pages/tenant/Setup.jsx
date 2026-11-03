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
import StaffStep from '@/components/setup/steps/StaffStep'
import AssignStep from '@/components/setup/steps/AssignStep'
import ActivateStep from '@/components/setup/steps/ActivateStep'
import { SETUP_STEPS, clearDraft, fetchAll, loadDraft, nextCode, saveDraft, uid } from '@/lib/setup'

const EMPTY_EVENT = {
  code: '',
  codeTouched: false,
  name: '',
  description: '',
  venue: '',
  address: '',
  start_at: '',
  end_at: '',
  sales_start_at: '',
  sales_end_at: '',
}

function blankAssignRow(member, selected) {
  return {
    uid: uid(),
    staffId: member.id,
    staff_code: member.staff_code,
    display_name: member.display_name,
    selected,
    restrict: false,
    allowed: [],
    valid_from: '',
    valid_until: '',
    status: 'pending',
    message: '',
  }
}

export default function Setup() {
  const navigate = useNavigate()
  const session = getSession()
  const tenantCode = session?.tenant?.code || 'default'

  const [step, setStep] = useState(1)
  const [event, setEvent] = useState(null)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [ticketRows, setTicketRows] = useState([])
  const [staffRows, setStaffRows] = useState([])
  const [assignRows, setAssignRows] = useState([])
  const [refs, setRefs] = useState({ events: [], categories: [], staff: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activated, setActivated] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Setup'
  }, [])

  const loadRefs = useCallback(async () => {
    try {
      const [events, categories, staff] = await Promise.all([
        fetchAll('/admin/events/'),
        fetchAll('/admin/categories/'),
        fetchAll('/admin/staff/'),
      ])
      setRefs({ events, categories, staff })
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
        if (draft.eventForm) setEventForm({ ...EMPTY_EVENT, ...draft.eventForm })
        if (Array.isArray(draft.ticketTypes)) setTicketRows(draft.ticketTypes)
        // Only keep picked staff rows — older drafts could hold typed-in accounts.
        if (Array.isArray(draft.staff)) setStaffRows(draft.staff.filter((row) => row.staffId))
        if (Array.isArray(draft.assign)) setAssignRows(draft.assign)
        if (draft.step) setStep(draft.step)
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
      staff: staffRows,
      assign: assignRows,
      activated,
    })
  }, [step, event, eventForm, ticketRows, staffRows, assignRows, activated, loading, tenantCode])

  const ticketTypesReady = ticketRows.length > 0 && ticketRows.every((row) => row.status === 'created' || row.status === 'reused')
  const staffReady =
    staffRows.length === 0 || staffRows.every((row) => row.status === 'created' || row.status === 'reused')
  const assignedCount = assignRows.filter((row) => row.selected && row.status === 'created').length

  const statuses = useMemo(
    () => ({
      1: step === 1 ? 'current' : event ? 'done' : 'pending',
      2: step === 2 ? 'current' : ticketTypesReady ? 'done' : 'pending',
      3: step === 3 ? 'current' : staffRows.length && staffReady ? 'done' : 'pending',
      4: step === 4 ? 'current' : assignedCount > 0 ? 'done' : 'pending',
      5: step === 5 ? (activated ? 'done' : 'current') : activated ? 'done' : 'pending',
    }),
    [event, ticketTypesReady, staffReady, staffRows.length, assignedCount, step, activated],
  )

  function buildAssignRows() {
    const list = []
    const seen = new Set()

    staffRows.forEach((row) => {
      if (row.status !== 'created' && row.status !== 'reused') return
      if (!row.staffId) return
      seen.add(row.staffId)
      list.push(blankAssignRow({ id: row.staffId, staff_code: row.staff_code, display_name: row.display_name }, true))
    })

    refs.staff.forEach((member) => {
      if (seen.has(member.id)) return
      if (member.status !== 'active') return
      list.push(blankAssignRow(member, false))
    })

    return list
  }

  function goToAssign() {
    setAssignRows((current) => (current.length ? current : buildAssignRows()))
    setStep(4)
  }

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
    setStaffRows([])
    setAssignRows([])
    setActivated(false)
  }

  function keepAsDraft() {
    clearDraft(tenantCode)
    navigate('/tenant/events')
  }

  const ticketTypeOptions = ticketRows
    .filter((row) => row.categoryId)
    .map((row) => ({ uid: row.uid, code: row.code, categoryId: row.categoryId }))

  return (
    <>
      <PageHead
        eyebrow="SETUP"
        title="Set up your first event"
        subtitle="Five short steps: create the event, add ticket types and prices, pick staff, let them sell, then go live."
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

      {step === 3 ? (
        <StaffStep
          rows={staffRows}
          setRows={setStaffRows}
          staff={refs.staff}
          onNext={goToAssign}
          onBack={() => setStep(2)}
        />
      ) : null}

      {step === 4 ? (
        <AssignStep
          event={event}
          rows={assignRows}
          setRows={setAssignRows}
          ticketTypes={ticketTypeOptions}
          onNext={() => setStep(5)}
          onSkip={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      ) : null}

      {step === 5 && event ? (
        <ActivateStep
          event={event}
          ticketTypes={ticketRows}
          staffRows={staffRows}
          assignRows={assignRows}
          activated={activated}
          onActivated={() => {
            setActivated(true)
            clearDraft(tenantCode)
          }}
          onBack={() => setStep(4)}
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
