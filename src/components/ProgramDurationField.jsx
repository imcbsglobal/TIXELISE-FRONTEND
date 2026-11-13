import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { programDurationText } from '@/lib/time'

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const MERIDIEMS = ['AM', 'PM']

function splitTime(value) {
  if (!value) {
    return { hour: '', minute: '', meridiem: '' }
  }
  const [rawHour, rawMinute] = String(value).split(':')
  const hours24 = Number(rawHour)
  if (Number.isNaN(hours24)) {
    return { hour: '', minute: '', meridiem: '' }
  }
  const minutes = Number(rawMinute)
  return {
    hour: String(hours24 % 12 === 0 ? 12 : hours24 % 12).padStart(2, '0'),
    minute: String(Number.isNaN(minutes) ? 0 : minutes).padStart(2, '0'),
    meridiem: hours24 >= 12 ? 'PM' : 'AM',
  }
}

function joinTime({ hour, minute, meridiem }) {
  if (!hour || !minute || !meridiem) return ''
  let hours24 = Number(hour) % 12
  if (meridiem === 'PM') hours24 += 12
  return `${String(hours24).padStart(2, '0')}:${minute}`
}

function TimeRow({ label, value, onChange, invalid }) {
  const parts = splitTime(value)

  function update(patch) {
    const base = {
      hour: parts.hour || '09',
      minute: parts.minute || '00',
      meridiem: parts.meridiem || 'AM',
    }
    onChange(joinTime({ ...base, ...patch }))
  }

  const triggerClass = invalid ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : undefined

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
        <Select value={parts.hour || undefined} onValueChange={(next) => update({ hour: next })}>
          <SelectTrigger aria-label={`${label} hour`} aria-invalid={invalid || undefined} className={triggerClass}>
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parts.minute || undefined} onValueChange={(next) => update({ minute: next })}>
          <SelectTrigger aria-label={`${label} minute`} aria-invalid={invalid || undefined} className={triggerClass}>
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parts.meridiem || undefined} onValueChange={(next) => update({ meridiem: next })}>
          <SelectTrigger aria-label={`${label} period`} aria-invalid={invalid || undefined} className={triggerClass}>
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {MERIDIEMS.map((meridiem) => (
              <SelectItem key={meridiem} value={meridiem}>
                {meridiem}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function ProgramDurationField({ start, end, onChange, error, hint, disabled }) {
  const duration = programDurationText(start, end)
  const hasValue = Boolean(start || end)

  return (
    <div className={cn('space-y-2', disabled && 'pointer-events-none opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label>Program duration</Label>
          <p className="text-xs text-muted-foreground">
            Optional daily start and end time for the programme. It does not change when tickets can be sold.
          </p>
        </div>
        {hasValue ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('', '')}>
            Clear
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TimeRow
          label="Starts"
          value={start}
          invalid={Boolean(error) && !start}
          onChange={(next) => onChange(next, end)}
        />
        <TimeRow
          label="Ends"
          value={end}
          invalid={Boolean(error)}
          onChange={(next) => onChange(start, next)}
        />
      </div>
      <div className="min-h-4 text-xs">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : duration ? (
          <p className="text-muted-foreground">Lasts {duration}</p>
        ) : hint ? (
          <p className="text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
