const KEY = 'tixelise.session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function saveSession(data) {
  const next = { ...(getSession() || {}), ...data }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
