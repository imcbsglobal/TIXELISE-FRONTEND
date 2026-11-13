import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHead, RefreshButton, SearchInput } from '@/components/ui/page'
import { fetchAll } from '@/lib/setup'
import { formatProgramWindow } from '@/lib/time'
import { normalizeVenue } from '@/lib/venues'

function formatWhen(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

function eventTypeLabel(value) {
  return value === 'regular' ? 'Regular' : 'Periodical'
}

function groupEventsByVenue(events) {
  const groups = new Map()

  events.forEach((event) => {
    const label = normalizeVenue(event.venue)
    if (!label) return

    const key = label.toLowerCase()
    if (!groups.has(key)) {
      groups.set(key, { key, label, events: [], activeCount: 0 })
    }
    const group = groups.get(key)
    group.events.push(event)
    if (event.status === 'active') group.activeCount += 1
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: group.events.sort((a, b) => new Date(b.start_at) - new Date(a.start_at)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function VenueCard({ group, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-full flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View events at ${group.label}`}
    >
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#eaf3ee] text-primary">
        <MapPin className="h-[18px] w-[18px]" />
      </span>
      <h3 className="line-clamp-2 font-display text-base font-extrabold">{group.label}</h3>
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
        </span>
        <span>{group.activeCount} active</span>
      </p>
    </button>
  )
}

function EventCard({ event }) {
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{event.code}</p>
          <h3 className="mt-1 line-clamp-2 font-display text-base font-extrabold">{event.name}</h3>
        </div>
        <StatusBadge status={event.status} />
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Type</dt>
          <dd className="text-right font-medium">{eventTypeLabel(event.event_type)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Starts</dt>
          <dd className="text-right font-medium">{formatWhen(event.start_at)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Ends</dt>
          <dd className="text-right font-medium">{event.end_at ? formatWhen(event.end_at) : 'No end'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Program</dt>
          <dd className="text-right font-medium">
            {formatProgramWindow(event.program_start_time, event.program_end_time) || '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Address</dt>
          <dd className="truncate text-right font-medium">{event.address || '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Created</dt>
          <dd className="text-right font-medium">{formatWhen(event.created_at)}</dd>
        </div>
      </dl>
    </article>
  )
}

export default function EventVenues() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    document.title = 'Tixelise | Event sections'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetchAll('/admin/events/')
      .then((list) => {
        if (!cancelled) setEvents(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const groups = useMemo(() => groupEventsByVenue(events), [events])
  const selectedGroup = selectedKey ? groups.find((group) => group.key === selectedKey) : null
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return groups
    return groups.filter((group) => group.key.includes(term))
  }, [groups, search])

  const totalVenues = groups.length
  const totalEvents = events.filter((event) => normalizeVenue(event.venue)).length

  return (
    <>
      <PageHead
        eyebrow="EVENT MASTER"
        title="Event sections"
        subtitle="Browse events grouped by the venue entered on each event."
      >
        <RefreshButton loading={loading} onClick={() => setReloadToken((token) => token + 1)} />
      </PageHead>

      {error ? (
        <Alert variant="error" className="mb-5">
          {error}
        </Alert>
      ) : null}

      {!selectedGroup ? (
        <section aria-label="Event sections">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold">Choose a venue</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {loading
                  ? 'Loading venues…'
                  : `${totalVenues} ${totalVenues === 1 ? 'venue' : 'venues'} · ${totalEvents} ${
                      totalEvents === 1 ? 'event' : 'events'
                    }`}
              </p>
            </div>
            {groups.length > 0 ? (
              <SearchInput value={search} onChange={setSearch} placeholder="Search venues…" />
            ) : null}
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">Loading venues…</CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No venues have been entered on any event yet.{' '}
                <Link to="/tenant/events" className="font-semibold text-primary underline">
                  Go to Events
                </Link>{' '}
                and add a venue to an event.
              </CardContent>
            </Card>
          ) : visibleGroups.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No venues match “{search}”.
              </CardContent>
            </Card>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleGroups.map((group) => (
                <VenueCard
                  key={group.key}
                  group={group}
                  onSelect={() => setSelectedKey(group.key)}
                />
              ))}
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
                    onClick={() => setSelectedKey(null)}
                    aria-label="All venues"
                    title="All venues"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eaf3ee] text-primary">
                    <MapPin className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-[15px] font-extrabold leading-tight">
                      {selectedGroup.label}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {selectedGroup.events.length}{' '}
                      {selectedGroup.events.length === 1 ? 'event' : 'events'} ·{' '}
                      {selectedGroup.activeCount} active
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-display text-lg font-extrabold">Events at this venue</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Read-only list of every event with this venue.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {selectedGroup.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
