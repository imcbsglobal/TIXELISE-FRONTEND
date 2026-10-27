import React, { useEffect, useRef, useState } from 'react'
import { Copy, KeyRound, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/setup/FieldError'
import { RowStatus } from '@/components/setup/RowStatus'
import { StepShell } from '@/components/setup/StepShell'
import { friendlyError, isDuplicateMessage, nextCode, suggestPassword, uid, usernameFromName } from '@/lib/setup'

function blankRow(staffCode) {
  return {
    uid: uid(),
    staff_code: staffCode,
    display_name: '',
    username: '',
    usernameTouched: false,
    password: '',
    email: '',
    phone: '',
    status: 'pending',
    message: '',
    staffId: null,
    reuseCandidate: null,
  }
}

function existingRow(member) {
  return {
    ...blankRow(member.staff_code),
    display_name: member.display_name,
    username: '',
    usernameTouched: true,
    status: 'reused',
    staffId: member.id,
    message: 'Using an existing staff member — no new login was created.',
    reuseCandidate: null,
  }
}

/** A row the user has not touched yet — safe to drop when another row is added. */
function isUntouched(row) {
  return (
    row.status !== 'created' &&
    row.status !== 'reused' &&
    !row.display_name.trim() &&
    !row.username.trim() &&
    !row.password
  )
}

export default function StaffStep({ rows, setRows, staff, onStaffCreated, onNext, onBack }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [summary, setSummary] = useState(null)
  const [copied, setCopied] = useState('')

  const activeStaff = staff.filter((member) => member.status === 'active')
  const inactiveStaff = staff.filter((member) => member.status !== 'active')

  // Start with one empty row so the first-time admin sees the fields straight away.
  // If the organization already has staff, they are shown first and no blank row is needed.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    if (rows.length === 0 && staff.filter((member) => member.status === 'active').length === 0) {
      setRows([blankRow(nextCode('ST', staff.map((member) => member.staff_code)))])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateRow = (rowUid, patch) =>
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, ...patch } : row)))

  function addRow() {
    setRows((current) => {
      // Drop the untouched starting row so the user is not left with a blank to fill in.
      const kept = current.filter((row) => !isUntouched(row))
      return [...kept, blankRow(nextCode('ST', staff.map((member) => member.staff_code)))]
    })
    setSummary(null)
  }

  function removeRow(rowUid) {
    setRows((current) => current.filter((row) => row.uid !== rowUid))
    setSummary(null)
  }

  function isPicked(memberId) {
    return rows.some((row) => row.staffId === memberId && row.status === 'reused')
  }

  function useExistingStaff(member) {
    setRows((current) => {
      if (current.some((row) => row.staffId === member.id && row.status === 'reused')) return current
      const kept = current.filter((row) => !isUntouched(row))
      return [...kept, existingRow(member)]
    })
    setSummary(null)
  }

  function unpickExistingStaff(memberId) {
    setRows((current) => current.filter((row) => !(row.staffId === memberId && row.status === 'reused')))
    setSummary(null)
  }

  function updateField(rowUid, key, value) {
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, [key]: value } : row)))
  }

  function updateName(rowUid, name) {
    setRows((current) =>
      current.map((row) =>
        row.uid === rowUid
          ? { ...row, display_name: name, username: row.usernameTouched ? row.username : usernameFromName(name) }
          : row,
      ),
    )
  }

  function updateUsername(rowUid, username) {
    setRows((current) =>
      current.map((row) =>
        row.uid === rowUid ? { ...row, username: username.toLowerCase().replace(/[^a-z0-9]/g, ''), usernameTouched: true } : row,
      ),
    )
  }

  function validate() {
    const problems = {}
    if (!rows.length) {
      problems.general = 'Add at least one staff member — somebody has to sell the tickets.'
      return problems
    }
    rows.forEach((row) => {
      // Rows that already exist on the server are locked — nothing to validate.
      if (row.status === 'created' || row.status === 'reused') return
      if (!row.staff_code.trim()) problems[`${row.uid}.staff_code`] = 'A staff code is required.'
      if (!row.display_name.trim()) problems[`${row.uid}.display_name`] = 'Enter the staff member’s name.'
      if (!row.username.trim()) problems[`${row.uid}.username`] = 'A username is required.'
      if (!row.password) problems[`${row.uid}.password`] = 'Set a password for this staff member.'
      else if (row.password.length < 8) problems[`${row.uid}.password`] = 'Use at least 8 characters.'
    })
    return problems
  }

  async function processRow(row) {
    updateRow(row.uid, { status: 'creating', message: '', reuseCandidate: null })
    try {
      const created = await api.post('/admin/staff/', {
        staff_code: row.staff_code.trim().toUpperCase(),
        display_name: row.display_name.trim(),
        username: row.username.trim(),
        email: row.email.trim(),
        phone: row.phone.trim(),
        password: row.password,
      })
      updateRow(row.uid, { status: 'created', staffId: created.id, message: '' })
      onStaffCreated(created)
      return true
    } catch (err) {
      if (isDuplicateMessage(err.message)) {
        const existing = staff.find((member) => member.staff_code === row.staff_code.trim().toUpperCase())
        if (existing) {
          updateRow(row.uid, {
            status: 'failed',
            message: `${existing.staff_code} (${existing.display_name}) already exists in your organization.`,
            reuseCandidate: { id: existing.id, staff_code: existing.staff_code, display_name: existing.display_name },
          })
          return false
        }
      }
      updateRow(row.uid, { status: 'failed', message: friendlyError(err).message })
      return false
    }
  }

  async function handleSave() {
    const problems = validate()
    setFieldErrors(problems)
    if (Object.keys(problems).length) {
      setError(null)
      return
    }

    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      const pending = rows.filter((row) => row.status !== 'created' && row.status !== 'reused')
      const outcomes = []

      for (const row of pending) {
        // eslint-disable-next-line no-await-in-loop
        outcomes.push(await processRow(row))
      }

      const failed = outcomes.filter((ok) => !ok).length
      const created = outcomes.filter((ok) => ok).length
      const reused = rows.filter((row) => row.status === 'reused').length

      setSummary({
        created,
        reused,
        failed,
        total: rows.length,
        credentials: rows
          .filter((row) => row.status === 'created')
          .map((row) => ({
            uid: row.uid,
            staff_code: row.staff_code,
            username: row.username,
            password: row.password,
          })),
      })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  function reuseExisting(row) {
    if (!row.reuseCandidate) return
    updateRow(row.uid, {
      staffId: row.reuseCandidate.id,
      status: 'reused',
      message: 'Using the existing staff member — no new login was created.',
      reuseCandidate: null,
      password: '',
    })
  }

  async function copy(value, token) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(token)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setCopied('')
    }
  }

  const allSettled = rows.every((row) => row.status === 'created' || row.status === 'reused')
  const newRows = rows.filter((row) => row.status !== 'reused')

  return (
    <StepShell
      step={3}
      title="Who will sell tickets at the counter?"
      hint="Each person needs their own login for the POS app. Start with the people you already have, then add anyone new below."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          {!allSettled ? (
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? 'Creating…' : 'Create staff accounts'}
            </Button>
          ) : (
            <Button type="button" onClick={onNext}>
              Continue
            </Button>
          )}
        </>
      }
    >
      {error ? (
        <Alert variant="error">
          <p className="font-bold">{error.title}</p>
          <p className="mt-1">{error.message}</p>
        </Alert>
      ) : null}

      {fieldErrors.general ? <Alert variant="error">{fieldErrors.general}</Alert> : null}

      {summary && summary.failed === 0 ? (
        <Alert variant="success">
          {summary.created > 0
            ? `${summary.created} staff ${summary.created === 1 ? 'account' : 'accounts'} ready. Share the logins below — the password is shown only once.`
            : 'Everyone you picked already has a login — no new accounts were needed.'}
          {summary.reused > 0 ? ` ${summary.reused} existing ${summary.reused === 1 ? 'person is' : 'people are'} included as they are.` : ''}
        </Alert>
      ) : null}

      {summary && summary.failed > 0 ? (
        <Alert variant="error">
          {summary.created} of {summary.total} created. Fix the highlighted {summary.failed === 1 ? 'row' : 'rows'} and
          try again.
        </Alert>
      ) : null}

      {summary && summary.credentials.length ? (
        <div className="rounded-xl border border-[#b9cdc7] bg-[#f4f8f7] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Logins to share</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Passwords are never stored in this browser. If a password is not shown, reset it from the Staff page.
          </p>
          <div className="space-y-2">
            {summary.credentials.map((credential) => (
              <div
                key={credential.uid}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-white px-3.5 py-2.5 text-[13.5px]"
              >
                <span className="font-mono text-[13px] font-semibold">{credential.staff_code}</span>
                <span className="text-muted-foreground">username</span>
                <span className="font-mono font-semibold">{credential.username}</span>
                <span className="text-muted-foreground">password</span>
                <span className="font-mono font-semibold">{credential.password || 'not shown'}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    copy(
                      [credential.staff_code, credential.username, credential.password].filter(Boolean).join(' / '),
                      credential.uid,
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === credential.uid ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Already in your organization
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          These people already have a login. Pick the ones who should work at this event — no new account is created.
        </p>

        {staff.length === 0 ? (
          <p className="mt-3 rounded-lg bg-muted px-3.5 py-2.5 text-[13.5px] text-muted-foreground">
            You have not added any staff yet. Create the first person below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {[...activeStaff, ...inactiveStaff].map((member) => {
              const picked = isPicked(member.id)
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold">{member.display_name}</p>
                    <p className="font-mono text-[12.5px] text-muted-foreground">{member.staff_code}</p>
                  </div>
                  <StatusBadge status={member.status} />
                  {picked ? (
                    <>
                      <Badge variant="success" className="ml-auto">
                        Included
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => unpickExistingStaff(member.id)}
                        disabled={busy}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => useExistingStaff(member)}
                      disabled={busy || member.status !== 'active'}
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Use for this event
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">New staff accounts</p>

      <div className="space-y-3">
        {newRows.map((row) => (
          <div key={row.uid} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <RowStatus status={row.status} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(row.uid)}
                disabled={busy || row.status === 'created' || row.status === 'reused'}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <Field label="Staff code" hint="Short unique code, e.g. ST012.">
                  <Input
                    value={row.staff_code}
                    onChange={(e) =>
                      updateField(
                        row.uid,
                        'staff_code',
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      )
                    }
                    placeholder="ST012"
                    disabled={busy}
                    className={fieldErrors[`${row.uid}.staff_code`] ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.staff_code`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-4">
                <Field label="Full name">
                  <Input
                    value={row.display_name}
                    onChange={(e) => updateName(row.uid, e.target.value)}
                    placeholder="Ravi Kumar"
                    disabled={busy}
                    className={fieldErrors[`${row.uid}.display_name`] ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.display_name`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Username" hint="Used to log in.">
                  <Input
                    value={row.username}
                    onChange={(e) => updateUsername(row.uid, e.target.value)}
                    placeholder="ravi"
                    disabled={busy}
                    className={fieldErrors[`${row.uid}.username`] ? 'border-destructive/40' : undefined}
                  />
                  <FieldError>{fieldErrors[`${row.uid}.username`]}</FieldError>
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Password" hint="At least 8 characters, with letters and numbers.">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={row.password}
                      onChange={(e) => updateField(row.uid, 'password', e.target.value)}
                      placeholder="Set a password"
                      disabled={busy}
                      className={fieldErrors[`${row.uid}.password`] ? 'border-destructive/40' : undefined}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Suggest a strong password"
                      aria-label="Suggest a strong password"
                      onClick={() => updateField(row.uid, 'password', suggestPassword())}
                      disabled={busy}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                  <FieldError>{fieldErrors[`${row.uid}.password`]}</FieldError>
                </Field>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <Field label="Email" hint="Optional.">
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateField(row.uid, 'email', e.target.value)}
                    placeholder="ravi@example.com"
                    disabled={busy}
                  />
                </Field>
              </div>
              <div className="md:col-span-6">
                <Field label="Phone" hint="Optional.">
                  <Input
                    value={row.phone}
                    onChange={(e) => updateField(row.uid, 'phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>

            {row.message ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{row.message}</p>
            ) : null}

            {row.reuseCandidate ? (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <Button type="button" variant="outline" size="sm" onClick={() => reuseExisting(row)} disabled={busy}>
                  <UserPlus className="h-3.5 w-3.5" /> Use {row.reuseCandidate.staff_code}
                </Button>
                <span className="text-xs text-muted-foreground">
                  This reuses the existing staff member — no new login will be created.
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <Button type="button" variant="outline" onClick={addRow} disabled={busy}>
          <Plus className="h-4 w-4" /> Add staff member
        </Button>
      </div>
    </StepShell>
  )
}
