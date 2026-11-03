import { ArrowLeft, Users as UsersIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyRow, LoadingRow, PageHead } from '@/components/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/badge'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Tixelise | Users'
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .get('/admin/staff/users/')
      .then((res) => {
        if (cancelled) return
        setUsers(Array.isArray(res) ? res : res.results || [])
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageHead
        eyebrow="TENANT"
        title="Users"
        subtitle="All users linked to this tenant via memberships (from tixelise_accounts_user and tixelise_tenancy_tenantmembership)."
      >
        <Button variant="outline" asChild>
          <Link to="/tenant">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </PageHead>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" /> User list
          </CardTitle>
          <span className="text-sm text-muted-foreground">{users.length} user{users.length === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Membership</TableHead>
                <TableHead>User status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LoadingRow colSpan={7} />
              ) : users.length === 0 ? (
                <EmptyRow colSpan={7} icon={UsersIcon} message="No users found for this tenant." />
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-[13.5px]">{u.username}</TableCell>
                    <TableCell>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email || '—'}</TableCell>
                    <TableCell className="capitalize">{u.role?.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.user_is_active ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
