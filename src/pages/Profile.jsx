import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { getSession } from '@/session'
import { Alert } from '@/components/ui/alert'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHead } from '@/components/ui/page'

function Detail({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="text-[15px] text-foreground">{value || '—'}</span>
    </div>
  )
}

export default function Profile() {
  const session = getSession()
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Tixelise | Profile'
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .get('/auth/me/')
      .then((data) => !cancelled && setMe(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const username = me?.username || session?.username || '—'
  const displayName =
    [me?.first_name, me?.last_name].filter(Boolean).join(' ') || username
  const initial = String(displayName).charAt(0).toUpperCase()
  const memberships = me?.memberships || []

  return (
    <>
      <PageHead eyebrow="ACCOUNT" title="Profile" subtitle="Your account details and organization memberships." />

      {error ? (
        <Alert variant="error" className="mb-5">
          <p className="font-bold">We could not load your profile</p>
          <p className="mt-1">{error}</p>
        </Alert>
      ) : null}

      <div className="grid gap-5">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#00895a] to-[#05a26c] text-xl font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[19px] font-extrabold leading-tight">{displayName}</p>
              <p className="text-sm text-muted-foreground">@{username}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline">{session?.role || '—'}</Badge>
              {me?.is_platform_admin ? <Badge variant="success">Platform admin</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Detail label="Username" value={username} />
            <Detail label="Email" value={me?.email} />
            <Detail label="First name" value={me?.first_name} />
            <Detail label="Last name" value={me?.last_name} />
            <Detail label="Organization" value={session?.tenant?.name} />
            <Detail label="Tenant code" value={session?.tenant?.code} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memberships</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organization memberships.</p>
            ) : (
              <div className="grid gap-3">
                {memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{membership.tenant_name}</p>
                      <p className="text-xs text-muted-foreground">{membership.tenant_code}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="outline">{membership.role}</Badge>
                      <StatusBadge status={membership.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
