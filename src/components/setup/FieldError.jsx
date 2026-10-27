import * as React from 'react'
import { AlertCircle } from 'lucide-react'

/** Inline, field-level error message. */
export function FieldError({ children }) {
  if (!children) return null
  return (
    <p className="flex items-start gap-1.5 text-xs font-semibold text-destructive">
      <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
