export const EVENT_TAX_MODES = [
  { value: 'inherit', label: 'Use company tax setting' },
  { value: 'event', label: 'Charge tax for this event' },
  { value: 'disabled', label: 'No tax for this event' },
]

export function validateEventTax({ taxMode, taxRate, hsnCode } = {}) {
  const errors = {}
  if ((taxMode || 'inherit') !== 'event') return errors

  const rateText = String(taxRate ?? '').trim()
  const rate = Number(rateText)
  if (!rateText || !Number.isFinite(rate)) {
    errors.tax_rate = 'Enter a tax percentage.'
  } else if (rate <= 0 || rate > 100) {
    errors.tax_rate = 'Tax percentage must be greater than 0 and at most 100.'
  }

  const hsn = String(hsnCode ?? '').trim()
  if (!hsn) {
    errors.hsn_code = 'HSN number is required when event tax is on.'
  } else if (!/^\d{4,8}$/.test(hsn)) {
    errors.hsn_code = 'HSN number must be 4 to 8 digits.'
  }
  return errors
}

export function eventTaxSummary(event) {
  const mode = event?.tax_mode || 'inherit'
  if (mode === 'disabled') return 'No tax'
  if (mode === 'event') {
    const rate = Number(event?.tax_rate || 0)
    const bits = [`${rate}%`]
    if (event?.hsn_code) bits.push(`HSN ${event.hsn_code}`)
    if (event?.prices_include_tax) bits.push('incl.')
    return bits.join(' · ')
  }
  return 'Company tax'
}

export function companyTaxText(setting) {
  if (!setting) return 'Uses the company-wide tax setting from Tax master.'
  if (!setting.configured) return 'No company tax record is configured yet.'
  if (!setting.enabled) return `Company tax is off (${setting.code} ${setting.rate}%).`
  return `Company default: ${setting.code} ${setting.rate}%${
    setting.prices_include_tax ? ', prices include tax' : ', added on top'
  }.`
}
