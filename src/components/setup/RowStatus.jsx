import * as React from 'react'
import { AlertCircle, CheckCircle2, CircleDashed, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONE = {
  pending: 'bg-muted text-muted-foreground',
  creating: 'bg-[#fff4e0] text-[#a16207]',
  created: 'bg-[#e3f6ee] text-[#00794e]',
  reused: 'bg-[#e8f0fb] text-[#1d4ed8]',
  failed: 'bg-destructive/10 text-destructive',
}

const ICON = {
  pending: CircleDashed,
  creating: Loader2,
  created: CheckCircle2,
  reused: RefreshCw,
  failed: AlertCircle,
}

const LABEL = {
  pending: 'Not saved yet',
  creating: 'Saving…',
  created: 'Created',
  reused: 'Using existing',
  failed: 'Failed',
}

/** Small status chip that tells the user exactly where a row stands. */
export function RowStatus({ status = 'pending', label }) {
  const Icon = ICON[status] || CircleDashed
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold',
        TONE[status] || TONE.pending,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'creating' && 'animate-spin')} />
      {label || LABEL[status] || status}
    </span>
  )
}
