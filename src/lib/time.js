export function toTimeInput(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

export function timeToMinutes(value) {
  if (!value) return null
  const [hours, minutes] = String(value).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export function formatTime(value) {
  const total = timeToMinutes(value)
  if (total === null) return ''
  const hours24 = Math.floor(total / 60) % 24
  const minutes = total % 60
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function programDurationMinutes(start, end) {
  const from = timeToMinutes(start)
  const to = timeToMinutes(end)
  if (from === null || to === null || to <= from) return null
  return to - from
}

export function programDurationText(start, end) {
  const total = programDurationMinutes(start, end)
  if (total === null) return ''
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const parts = []
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  return parts.join(' ')
}

export function formatProgramWindow(start, end) {
  if (!start || !end) return '—'
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function validateProgramWindow(start, end) {
  if (!start && !end) return ''
  if (!start) return 'Choose a program start time.'
  if (!end) return 'Choose a program end time.'
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    return 'Program end time must be after the start time.'
  }
  return ''
}

export function toApiTime(value) {
  return value ? value : null
}
