import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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

        {ticket && print ? (
          <div className="print-sheet mx-auto w-[302px] rounded-md border border-dashed p-4 text-center">
            <p className="text-[13px] font-extrabold uppercase leading-snug tracking-wide">{print.header}</p>
            <div className="my-2.5 border-t border-dashed" />

            <p className="text-[15px] font-bold leading-snug">{ticket.event.name}</p>
            {ticket.event.venue ? (
              <p className="text-[11.5px] text-muted-foreground">{ticket.event.venue}</p>
            ) : null}
            {ticket.event.end_at ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Valid {new Date(ticket.event.start_at).toLocaleString()} –{' '}
                {new Date(ticket.event.end_at).toLocaleString()}
              </p>
            ) : null}

            <p className="mt-3 text-[13px] font-semibold">{ticket.category}</p>

            {ticket.unit_price ? (
              <div className="mt-1 space-y-0.5 text-[11.5px]">
                <p>
                  {ticket.currency} {ticket.unit_price} × {ticket.quantity}
                </p>
                {Number(ticket.tax_rate) > 0 ? (
                  <p className="text-muted-foreground">
                    Tax {ticket.tax_code ? `${ticket.tax_code} ` : ''}
                    {ticket.tax_rate}%: {ticket.tax_amount}
                  </p>
                ) : null}
                {ticket.hsn_code ? (
                  <p className="text-muted-foreground">HSN {ticket.hsn_code}</p>
                ) : null}
                <p className="mt-1 text-[13px] font-bold">
                  Total {ticket.currency} {ticket.total}
                </p>
              </div>
            ) : null}

            <p className="mt-2 text-[11px] text-muted-foreground">Issued {ticket.issued_at_local}</p>

            <div className="my-2.5 border-t border-dashed" />
            {print.footer ? <p className="text-[11.5px] font-semibold">{print.footer}</p> : null}
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Ticket no.
            </p>
            <p className="break-all font-mono text-[11px] leading-relaxed">{ticket.ticket_code}</p>
          </div>
        ) : null}

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
