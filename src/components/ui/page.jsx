import * as React from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2.5 self-center">{children}</div> : null}
    </div>
  )
}

export function RefreshButton({ loading, onClick }) {
  return (
    <Button variant="outline" size="icon" onClick={onClick} aria-label="Refresh" title="Refresh">
      <RefreshCw className={cn('h-[17px] w-[17px]', loading && 'animate-spin')} />
    </Button>
  )
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="flex h-11 w-full max-w-[340px] items-center gap-2.5 rounded-md bg-muted px-4 text-muted-foreground transition-[border-color,box-shadow] focus-within:border focus-within:border-[#72c9ad] focus-within:ring-4 focus-within:ring-ring/25">
      <Search className="h-[17px] w-[17px] shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/80"
      />
    </label>
  )
}

export function StatCard({ label, value, icon: Icon, tone = 'green' }) {
  const tones = {
    green: 'bg-[#eaf3ee] text-black',
    amber: 'bg-[#f5f0e6] text-black',
    gray: 'bg-[#f0f0ec] text-black',
  }
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border bg-card px-5 py-5 shadow-sm">
      {Icon ? (
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-white', tones[tone])}>
          <Icon className="h-[19px] w-[19px]" />
        </span>
      ) : null}
      <div>
        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
        <p className="font-display text-[30px] font-extrabold tracking-[-0.03em]">{value}</p>
      </div>
    </div>
  )
}

export function EmptyRow({ colSpan, message = 'No records found.', icon: Icon }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        {Icon ? (
          <span className="mb-2 flex justify-center">
            <Icon className="h-7 w-7 opacity-40" />
          </span>
        ) : null}
        {message}
      </td>
    </tr>
  )
}

export function LoadingRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        Loading…
      </td>
    </tr>
  )
}

export function Pager({ page, totalPages, onPrev, onNext }) {
  return (
    <div className="mt-5 flex items-center justify-end gap-3.5 text-sm text-muted-foreground">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}
