import { api, API_BASE_URL } from '@/api'

export const SETUP_STEPS = [
  { id: 1, key: 'event', title: 'Event', blurb: 'Name your event and set the schedule' },
  { id: 2, key: 'ticketTypes', title: 'Ticket types', blurb: 'Create the kinds of tickets you sell' },
  { id: 3, key: 'activate', title: 'Make live', blurb: 'Review everything and open for sales' },
]

export const DRAFT_PREFIX = 'tixelise.setup.draft.v1'

/* ------------------------------------------------------------------ *
 * Draft persistence (localStorage, scoped per tenant + browser)
 * ------------------------------------------------------------------ */

export function draftKey(tenantCode) {
  return `${DRAFT_PREFIX}.${tenantCode || 'default'}`
}

export function loadDraft(tenantCode) {
  try {
    const raw = localStorage.getItem(draftKey(tenantCode))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function saveDraft(tenantCode, data) {
  try {
    localStorage.setItem(draftKey(tenantCode), JSON.stringify(data))
  } catch {
    // storage full or unavailable — the wizard still works, it just cannot resume
  }
}

export function clearDraft(tenantCode) {
  try {
    localStorage.removeItem(draftKey(tenantCode))
  } catch {
    // ignore
  }
}

export function isDraftEmpty(draft) {
  if (!draft) return true
  if (draft.event) return false
  if ((draft.ticketTypes || []).some((r) => r.name || r.code || r.price)) return false
  return !draft.step || draft.step <= 1
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let uidCounter = 0
export function uid() {
  uidCounter += 1
  return `row_${uidCounter}`
}

/** Local `datetime-local` value -> UTC ISO string the API understands. */
export function toUtcIso(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time'
  } catch {
    return 'your local time'
  }
}

/** Suggests the next free code, e.g. nextCode('EV', ['EV001']) -> 'EV002'. */
export function nextCode(prefix, existing, width = 3) {
  const pattern = new RegExp(`^${prefix}(\\d+)$`, 'i')
  let highest = 0
  ;(existing || []).forEach((value) => {
    const match = String(value).match(pattern)
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  })
  return `${prefix}${String(highest + 1).padStart(width, '0')}`
}

export function codeFromName(name, max = 12) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, max)
}

/** Code derived from a name, suffixed with a number when that code is already taken. */
export function uniqueCodeFromName(name, existing, max = 16) {
  const base = codeFromName(name, max)
  if (!base) return ''
  const taken = new Set((existing || []).filter(Boolean).map((value) => String(value).toUpperCase()))
  if (!taken.has(base)) return base
  const stem = base.slice(0, Math.max(1, max - 2))
  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${stem}${suffix}`
    if (!taken.has(candidate)) return candidate
  }
  return base
}

export function usernameFromName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
}

const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz'
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_DIGITS = '23456789'
const PASSWORD_SYMBOLS = '!@#$%&*?'

/** Generates a password that clears every Django validator enabled on the backend. */
export function suggestPassword(length = 12) {
  const all = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS + PASSWORD_SYMBOLS
  const pick = (set) => set[Math.floor(Math.random() * set.length)]
  const chars = [pick(PASSWORD_LOWER), pick(PASSWORD_UPPER), pick(PASSWORD_DIGITS), pick(PASSWORD_SYMBOLS)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = chars[i]
    chars[i] = chars[j]
    chars[j] = swap
  }
  return chars.join('')
}

/** Fetches every page of a paginated admin list endpoint. */
export async function fetchAll(path) {
  const results = []
  let page = 1
  while (page <= 50) {
    const separator = path.includes('?') ? '&' : '?'
    const data = await api.get(`${path}${separator}page=${page}&page_size=100`)
    if (Array.isArray(data)) {
      results.push(...data)
      break
    }
    results.push(...(data.results || []))
    if (!data.next) break
    page += 1
  }
  return results
}

/* ------------------------------------------------------------------ *
 * Friendly error handling
 * ------------------------------------------------------------------ */

const FIELD_KEYS = [
  'code',
  'name',
  'description',
  'venue',
  'address',
  'start_at',
  'end_at',
  'sales_start_at',
  'sales_end_at',
  'staff_code',
  'display_name',
  'username',
  'email',
  'phone',
  'password',
  'event',
  'category',
  'amount',
  'currency',
  'valid_from',
  'valid_until',
  'allowed_category_ids',
  'restrict_categories',
]

/**
 * The backend flattens serializer errors into one string, e.g.
 * "end_at: End time must be after start time.; code: Event code must be alphanumeric."
 * This puts them back on the right field.
 */
export function parseFieldErrors(message) {
  const result = {}
  if (!message) return result
  String(message)
    .split(';')
    .forEach((chunk) => {
      const separator = chunk.indexOf(':')
      if (separator === -1) return
      const key = chunk.slice(0, separator).trim()
      const value = chunk.slice(separator + 1).trim()
      if (!FIELD_KEYS.includes(key) || !value) return
      result[key] = result[key] ? `${result[key]} ${value}` : value
    })
  return result
}

const CODE_MESSAGES = {
  NETWORK_ERROR: {
    title: 'Cannot reach the server',
    message: `We could not reach the backend at ${API_BASE_URL}. Check that it is running and try again.`,
  },
  SESSION_EXPIRED: {
    title: 'Session expired',
    message: 'Your session has expired. Please log in again — your progress in this wizard is saved.',
  },
  TENANT_SUSPENDED: {
    title: 'Organization suspended',
    message: 'Your organization is suspended right now. Please contact the platform administrator.',
  },
  TENANT_INACTIVE: {
    title: 'Organization inactive',
    message: 'Your organization is inactive. Please contact the platform administrator.',
  },
  MEMBERSHIP_INACTIVE: {
    title: 'Account deactivated',
    message: 'Your account has been deactivated. Please contact your administrator.',
  },
  NOT_TENANT_ADMIN: {
    title: 'Not allowed',
    message: 'Only tenant administrators can run event setup.',
  },
  CONFIGURATION_INCOMPLETE: {
    title: 'Almost there',
    message: 'Add at least one price for this event before making it live.',
  },
  INVALID_TRANSITION: {
    title: 'Cannot change status now',
    message: 'This event cannot move to that state right now.',
  },
  ALREADY_IN_STATE: {
    title: 'Already done',
    message: 'That action was already applied — there is nothing left to change.',
  },
  INTERNAL_ERROR: {
    title: 'Server error',
    message: 'Something went wrong on the server. Please try again in a moment.',
  },
  FORBIDDEN: {
    title: 'Not allowed',
    message: 'You do not have permission to do this.',
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'That record no longer exists. Refresh the page and try again.',
  },
}

const MESSAGE_RULES = [
  [
    /event code already exists/i,
    'That event code is already used in your organization. Pick a different code, or reuse the existing event.',
  ],
  [
    /category code already exists/i,
    'A ticket type with this code already exists. Pick another code, or reuse the existing ticket type.',
  ],
  [
    /staff code already exists/i,
    'That staff code is already used in your organization. Pick a different code, or reuse the existing staff member.',
  ],
  [/username already taken/i, 'That username is already taken. Please choose a different one.'],
  [
    /already exists for this event and category/i,
    'This ticket type already has a price for this event — nothing more to do here.',
  ],
  [/must be alphanumeric/i, 'Use only letters and numbers — no spaces, dashes or symbols.'],
  [/end time must be after start time/i, 'The end time must be later than the start time.'],
  [/sales end must be after sales start/i, 'The sales close time must be later than the sales open time.'],
  [/valid_until/i, 'The end of an assignment must be later than its start.'],
  [/too similar to the username/i, 'That password is too similar to the username. Choose something less obvious.'],
  [/too short/i, 'Passwords need at least 8 characters.'],
  [/entirely numeric/i, 'Passwords cannot be made of numbers only.'],
  [/commonly used password/i, 'That password is too common. Please choose a less predictable one.'],
  [/category is inactive/i, 'That ticket type is inactive. Reactivate it before adding a price.'],
  [/belongs to another tenant/i, 'That record belongs to a different organization.'],
  [/already exists|already in use/i, 'That value is already in use. Please choose another one.'],
]

export function isDuplicateMessage(message) {
  return /already exists|already taken|already in use/i.test(String(message || ''))
}

/**
 * Turns an ApiError into something a first-time administrator can act on.
 */
export function friendlyError(err) {
  const code = (err && err.code) || 'ERROR'
  const raw = (err && err.message) || 'Something went wrong.'
  const fieldErrors = parseFieldErrors(raw)

  if (code === 'VALIDATION_ERROR') {
    const rule = MESSAGE_RULES.find(([pattern]) => pattern.test(raw))
    return {
      title: 'Please check this step',
      message: rule ? rule[1] : `The server rejected this: ${raw}`,
      fieldErrors,
      code,
      retryable: true,
    }
  }

  const mapped = CODE_MESSAGES[code]
  if (mapped) {
    return { ...mapped, fieldErrors, code, retryable: true }
  }

  const rule = MESSAGE_RULES.find(([pattern]) => pattern.test(raw))
  return {
    title: 'Something went wrong',
    message: rule ? rule[1] : raw,
    fieldErrors,
    code,
    retryable: true,
  }
}
