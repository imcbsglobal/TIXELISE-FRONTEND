import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-input text-muted-foreground',
        success: 'bg-[#e3f6ee] text-[#00794e]',
        warning: 'bg-[#fff4e0] text-[#a16207]',
        muted: 'bg-muted text-muted-foreground',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_VARIANT = {
  active: 'success',
  issued: 'success',
  completed: 'success',
  draft: 'muted',
  inactive: 'muted',
  expired: 'muted',
  suspended: 'warning',
  refunded: 'warning',
  revoked: 'destructive',
  voided: 'destructive',
  cancelled: 'destructive',
}

function StatusBadge({ status, className }) {
  return (
    <Badge variant={STATUS_VARIANT[status] || 'muted'} className={className}>
      {status}
    </Badge>
  )
}

export { Badge, StatusBadge, badgeVariants }
