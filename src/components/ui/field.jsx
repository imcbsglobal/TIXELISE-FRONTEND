import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export function Field({ label, hint, children, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
