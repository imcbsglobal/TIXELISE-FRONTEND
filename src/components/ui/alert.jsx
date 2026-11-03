import * as React from 'react'
import { cva } from 'class-variance-authority'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex w-full items-start gap-3 rounded-md border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'border-border bg-muted/50 text-foreground',
      error: 'border-destructive/25 bg-destructive/5 text-destructive',
      warning: 'border-amber-200 bg-amber-50 text-amber-700',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({ className, variant, children, icon = true, ...props }) {
  const Icon =
    variant === 'success'
      ? CheckCircle2
      : variant === 'error'
        ? AlertCircle
        : variant === 'warning'
          ? AlertTriangle
          : null
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div className="flex-1">{children}</div>
    </div>
  )
}

export { Alert }
