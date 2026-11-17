import { formatProgramWindow } from '@/lib/time'

export default function TicketSlip({ ticket, print, className = 'print-sheet' }) {
  if (!ticket || !print) return null

  return (
    <div className={`${className} mx-auto w-[302px] rounded-md border border-dashed p-4 text-center`}>
      <p className="text-[13px] font-extrabold uppercase leading-snug tracking-wide">{print.header}</p>
      <div className="my-2.5 border-t border-dashed" />

      <p className="text-[15px] font-bold leading-snug">{ticket.event.name}</p>
      {ticket.event.venue ? (
        <p className="text-[11.5px] text-muted-foreground">{ticket.event.venue}</p>
      ) : null}
      {ticket.event.program_start_time && ticket.event.program_end_time ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Valid {formatProgramWindow(ticket.event.program_start_time, ticket.event.program_end_time)}
        </p>
      ) : ticket.event.end_at ? (
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
          {ticket.hsn_code ? <p className="text-muted-foreground">HSN {ticket.hsn_code}</p> : null}
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
  )
}
