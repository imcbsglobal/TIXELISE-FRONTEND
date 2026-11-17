import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import TicketSlip from '@/components/TicketSlip'

/**
 * Renders one ticket as an 80mm-style receipt using the tenant's print
 * profile (organization name on top, thanks text at the bottom) and hands it
 * to the browser print dialog. Nothing is printed outside `.print-sheet`.
 */
export default function PrintTicketDialog({ ticketId, open, onOpenChange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !ticketId) return
    let cancelled = false
    setData(null)
    setError('')
    setLoading(true)
    api
      .get(`/admin/tickets/${ticketId}/print/`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, ticketId])

  const ticket = data?.ticket
  const print = data?.print

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print ticket</DialogTitle>
        </DialogHeader>

        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading && !data ? <p className="text-sm text-muted-foreground">Loading ticket…</p> : null}

        {ticket && print ? <TicketSlip ticket={ticket} print={print} /> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()} disabled={!ticket}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
