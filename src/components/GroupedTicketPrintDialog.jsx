import { useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import TicketSlip from '@/components/TicketSlip'

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0

  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index])
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, run)
  await Promise.all(workers)
  return results
}

export default function GroupedTicketPrintDialog({ ticketIds = [], open, onOpenChange, label }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const idsKey = ticketIds.map(String).join(',')

  useEffect(() => {
    if (!open || !idsKey) return
    let cancelled = false
    const ids = idsKey.split(',')

    setItems([])
    setLoading(true)
    setError('')
    setProgress({ done: 0, total: ids.length })

    mapWithConcurrency(ids, 6, async (id) => {
      try {
        const data = await api.get(`/admin/tickets/${id}/print/`)
        return { ok: true, data }
      } catch (err) {
        return { ok: false, id, message: err.message }
      } finally {
        if (!cancelled) setProgress((current) => ({ ...current, done: current.done + 1 }))
      }
    })
      .then((results) => {
        if (cancelled) return
        const loaded = results.filter((result) => result.ok).map((result) => result.data)
        const failures = results.filter((result) => !result.ok)
        setItems(loaded)
        if (failures.length) {
          setError(
            `${failures.length} of ${ids.length} ticket print payload${ids.length === 1 ? '' : 's'} could not be loaded.`,
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, idsKey, reloadToken])

  const groups = useMemo(() => {
    const byEvent = new Map()
    for (const data of items) {
      const ticket = data.ticket
      const key = ticket.event.code
      if (!byEvent.has(key)) {
        byEvent.set(key, { key, event: ticket.event, tickets: [] })
      }
      byEvent.get(key).tickets.push(data)
    }
    return Array.from(byEvent.values())
  }, [items])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-2rem,1100px)]">
        <DialogHeader>
          <DialogTitle>Print tickets</DialogTitle>
        </DialogHeader>

        {error ? (
          <Alert variant="error">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading tickets {progress.done} / {progress.total}…
          </p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No tickets to print.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="print-stack space-y-7">
            {groups.map((group) => (
              <section key={group.key} className="space-y-3">
                <div className="print-group-heading flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Event</p>
                    <h3 className="font-display text-[17px] font-extrabold tracking-[-0.01em]">
                      {group.event.code} — {group.event.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {group.tickets.length} ticket{group.tickets.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="print-slip-list flex flex-wrap gap-4">
                  {group.tickets.map((data) => (
                    <TicketSlip
                      key={data.ticket.id}
                      ticket={data.ticket}
                      print={data.print}
                      className="print-slip"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()} disabled={loading || items.length === 0}>
            <Printer className="h-4 w-4" /> Print {label || `${items.length} tickets`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
