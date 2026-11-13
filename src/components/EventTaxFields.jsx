import * as React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { companyTaxText, EVENT_TAX_MODES } from '@/lib/tax'

const invalidClass = 'border-destructive/50 focus-visible:border-destructive'

export function EventTaxFields({
  taxMode = 'inherit',
  taxRate = '',
  hsnCode = '',
  pricesIncludeTax = false,
  companySetting,
  errors = {},
  onChange,
}) {
  const mode = taxMode || 'inherit'

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Tax</p>
        <p className="text-xs text-muted-foreground">
          Choose whether ticket prices for this event use the company tax setting, a rate set just
          for this event, or no tax at all.
        </p>
      </div>

      <Field label="Ticket tax">
        <Select value={mode} onValueChange={(value) => onChange({ tax_mode: value })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TAX_MODES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {mode === 'event' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="HSN number" hint="4 to 8 digits. Stored on every sale line and printed ticket.">
              <Input
                value={hsnCode}
                onChange={(event) => onChange({ hsn_code: event.target.value })}
                inputMode="numeric"
                placeholder="9996"
                className={errors.hsn_code ? invalidClass : undefined}
              />
              {errors.hsn_code ? (
                <p className="text-xs font-semibold text-destructive">{errors.hsn_code}</p>
              ) : null}
            </Field>
            <Field label="Tax percentage" hint="Applies only to this event.">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(event) => onChange({ tax_rate: event.target.value })}
                placeholder="18"
                className={errors.tax_rate ? invalidClass : undefined}
              />
              {errors.tax_rate ? (
                <p className="text-xs font-semibold text-destructive">{errors.tax_rate}</p>
              ) : null}
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md bg-muted px-3.5 py-3">
            <Checkbox
              checked={Boolean(pricesIncludeTax)}
              onCheckedChange={(checked) => onChange({ prices_include_tax: checked === true })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13px] font-semibold">Prices include tax</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Leave unticked to add tax on top of the price set in Prices. Tick it when the ticket
                price already contains the tax.
              </span>
            </span>
          </label>
        </div>
      ) : mode === 'inherit' ? (
        <p className="rounded-md bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
          {companyTaxText(companySetting)}
        </p>
      ) : (
        <p className="rounded-md bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
          Ticket prices for this event will not be taxed, even if company tax is on.
        </p>
      )}
    </div>
  )
}
