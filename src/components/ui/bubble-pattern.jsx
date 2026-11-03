import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * One gradient bubble in the card's bottom-right corner, with a larger, paler
 * bubble sitting behind it. Only works inside a `relative overflow-hidden`
 * card; give the card content `relative z-10` so the pattern stays behind it.
 */
export function BubblePattern({ className }) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute inset-y-0 right-0 w-24', className)}>
      <span className="absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-tr from-[#b7ead6]/45 to-transparent" />
      <span className="absolute -bottom-4 -right-4 h-14 w-14 rounded-full bg-gradient-to-tr from-[#7fd4b4]/55 via-[#cfeee2]/35 to-transparent" />
    </span>
  )
}
