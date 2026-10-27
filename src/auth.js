import { api } from './api'
import { clearSession, saveSession } from './session'

export const HOME_BY_ROLE = {
  platform_admin: '/platform',
  tenant_admin: '/tenant',
  pos_staff: '/pos',
}

export const LOGIN_BY_ROLE = {
  platform_admin: '/login/suser',
  tenant_admin: '/login',
  pos_staff: '/login',
}

export function homeFor(role) {
  return HOME_BY_ROLE[role] || '/login'
}

export function loginRouteForRole(role) {
  return LOGIN_BY_ROLE[role] || '/login'
}

export async function login({ username, password, tenantCode }) {
  const payload = { username, password }
  const code = (tenantCode || '').trim()
  if (code) payload.tenant_code = code

  const data = await api.post('/auth/login/', payload)
  saveSession({
    access: data.access,
    refresh: data.refresh,
    role: data.role,
    tenant: data.tenant,
    username,
  })
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout/', {})
  } catch {
    // token may already be invalid — local logout still proceeds
  }
  clearSession()
}
