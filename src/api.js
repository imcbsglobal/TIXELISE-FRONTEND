import { clearSession, getSession, saveSession } from './session'

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function authHeaders() {
  const session = getSession()
  return session?.access ? { Authorization: `Bearer ${session.access}` } : {}
}

async function tryRefresh() {
  const session = getSession()
  if (!session?.refresh) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
    })
    if (!res.ok) return false
    const data = await res.json()
    saveSession({ access: data.access, ...(data.refresh ? { refresh: data.refresh } : {}) })
    return true
  } catch {
    return false
  }
}

async function request(path, { method = 'GET', body, retried = false } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the backend running?')
  }

  if (res.status === 401 && !retried && path !== '/auth/login/' && path !== '/auth/refresh/') {
    if (await tryRefresh()) {
      return request(path, { method, body, retried: true })
    }
    clearSession()
    throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired. Please log in again.')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const err = data?.error
    throw new ApiError(
      res.status,
      err?.code || 'ERROR',
      err?.message || `Request failed (${res.status}).`,
    )
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
