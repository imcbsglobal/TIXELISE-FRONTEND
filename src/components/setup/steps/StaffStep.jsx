import React from 'react'
import { Link } from 'react-router-dom'
import { UserCheck } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StepShell } from '@/components/setup/StepShell'
import { uid } from '@/lib/setup'

/** A row that reuses a staff member who already exists — no login is created here. */
function pickedRow(member) {
  return {
    uid: uid(),
    staffId: member.id,
    staff_code: member.staff_code,
    display_name: member.display_name,
    status: 'reused',
    message: 'Using an existing staff member — no new login was created.',
  }
}

export default function StaffStep({ rows, setRows, staff, onNext, onBack }) {
  const activeStaff = staff.filter((member) => member.status === 'active')
  const inactiveStaff = staff.filter((member) => member.status !== 'active')
  const picked = rows.filter((row) => row.staffId).length

  function isPicked(memberId) {
    return rows.some((row) => row.staffId === memberId)
  }

  function pick(member) {
    setRows((current) => (current.some((row) => row.staffId === member.id) ? current : [...current, pickedRow(member)]))
  }

  function unpick(memberId) {
    setRows((current) => current.filter((row) => row.staffId !== memberId))
  }

  return (
    <StepShell
      step={3}
      title="Who will sell tickets at the counter?"
      hint="Everyone you pick already has a staff login. Pick the people who work the counter — you set their event access in the next step."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="button" onClick={onNext}>
            Continue
          </Button>
        </>
      }
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            Already in your organization
          </p>
          {picked ? (
            <Badge variant="success">
              {picked} selected
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          These people already have a login. Pick the ones who should work at this event — no new account is created.
        </p>

        {staff.length === 0 ? (
          <div className="mt-3 rounded-lg bg-muted px-3.5 py-3 text-[13.5px] text-muted-foreground">
            <p>Your organization has no staff yet. Create the people who will sell tickets on the Staff page first.</p>
            <Link to="/tenant/staff" className="mt-2 inline-block font-semibold text-primary underline">
              Go to the Staff page
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {[...activeStaff, ...inactiveStaff].map((member) => {
              const selected = isPicked(member.id)
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold">{member.display_name}</p>
                    <p className="font-mono text-[12.5px] text-muted-foreground">{member.staff_code}</p>
                  </div>
                  <StatusBadge status={member.status} />
                  {selected ? (
                    <>
                      <Badge variant="success" className="ml-auto">
                        Included
                      </Badge>
                      <Button type="button" variant="ghost" size="sm" onClick={() => unpick(member.id)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => pick(member)}
                      disabled={member.status !== 'active'}
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

      {picked ? (
        <p className="text-[13px] text-muted-foreground">
          {picked} {picked === 1 ? 'person is' : 'people are'} pre-ticked in the next step, where you confirm their event
          access.
        </p>
      ) : null}
    </StepShell>
  )
}
