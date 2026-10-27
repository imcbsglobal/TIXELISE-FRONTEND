import * as React from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'

/**
 * Shared frame for every wizard step: numbered title, plain-language hint,
 * the step body and a footer for the navigation buttons.
 */
export function StepShell({ step, title, hint, children, footer }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-[#00794e]">
            {step}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-extrabold leading-tight tracking-[-0.02em]">
              {title}
            </h3>
            {hint ? <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
      {footer ? <CardFooter className="flex-wrap justify-between gap-3 border-t border-border pt-5">{footer}</CardFooter> : null}
    </Card>
  )
}
