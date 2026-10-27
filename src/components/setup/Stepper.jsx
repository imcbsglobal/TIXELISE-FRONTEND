import * as React from 'react'
import { AlertCircle, Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal progress indicator for the setup wizard.
 * Each node shows: done (tick), current (filled), error (alert) or locked (grey).
 */
export function Stepper({ steps, current, statuses = {}, onSelect }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => {
        const status = statuses[step.id] || (step.id === current ? 'current' : 'pending')
        const isDone = status === 'done'
        const isError = status === 'error'
        const isCurrent = step.id === current
        const isLast = index === steps.length - 1
        const clickable = (isDone || isCurrent) && typeof onSelect === 'function'

        return (
          <li key={step.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={clickable ? () => onSelect(step.id) : undefined}
              disabled={!clickable}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
                clickable ? 'cursor-pointer' : 'cursor-default',
                isCurrent && 'border-[#72c9ad] bg-accent',
                isDone && !isCurrent && 'border-border bg-card',
                isError && 'border-destructive/30 bg-destructive/5',
                !isCurrent && !isDone && !isError && 'border-transparent bg-transparent',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold',
                  isDone && 'bg-[#00895a] text-white',
                  isError && 'bg-destructive/10 text-destructive',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCurrent && !isDone && !isError && 'bg-muted text-muted-foreground',
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : null}
                {isError ? <AlertCircle className="h-3.5 w-3.5" /> : null}
                {!isDone && !isError ? step.id : null}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[13px] font-bold text-foreground">{step.title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {isDone ? 'Done' : null}
                  {isError ? 'Needs attention' : null}
                  {!isDone && !isError ? step.blurb : null}
                </span>
              </span>
            </button>
            {!isLast ? (
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0',
                  isDone ? 'text-[#00895a]' : 'text-border',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
