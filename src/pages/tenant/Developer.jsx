import { AlertTriangle, Lock, Trash2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead, RefreshButton, StatCard } from '@/components/ui/page'

// A developer tool, not a product feature: it exists so a test organization can
// be emptied without SQL. Everything here is a hard delete - there is no undo -
// so the caller must tick what to remove and type the tenant code to prove they
// know which organization they are wiping.
//
// Ticket numbering is always reset along with the history: that is the only
// setting here that cannot be switched off, because a kept counter would carry
// on numbering from tickets that no longer exist.
// Deliberately out of reach: staff profiles, the tax setting, users, the tenant
// itself and the audit log.
const SUMMARY_URL = '/admin/developer/data-summary/'
const DELETE_URL = '/admin/developer/delete-data/'

function countList(summary) {
  if (!summary) return ''
  return [
    `${summary.events} event(s)`,
    `${summary.categories} ticket type(s)`,
    `${summary.prices} price(s)`,
    `${summary.assignments} assignment(s)`,
  ].join(' · ')
}

export default function Developer() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  // History starts ticked because that is the usual reset; master data is a
  // bigger decision and starts off. Numbering is not a choice - see the Lock row.
  const [checked, setChecked] = useState({ history: true, masters: false })
  const [confirmText, setConfirmText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    document.title = 'Tixelise | Developer'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(SUMMARY_URL)
      .then((res) => !cancelled && setSummary(res))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const code = summary?.tenant_code || ''
  // Events and ticket types are referenced by sales and tickets, so the history
  // has to go with them. Ticking master data therefore forces the history on.
  const history = checked.history || checked.masters
  const scopes = [
    ...(history ? ['tickets', 'sales'] : []),
    'numbering',
    ...(checked.masters ? ['masters'] : []),
  ]

  const nothingToDelete =
    !!summary &&
    summary.tickets === 0 &&
    summary.sales === 0 &&
    summary.sequences === 0 &&
    summary.sale_items === 0 &&
    summary.events === 0 &&
    summary.categories === 0 &&
    summary.prices === 0 &&
    summary.assignments === 0

  const typedOk = !!code && confirmText.trim().toLowerCase() === code.toLowerCase()
  const canDelete = !deleting && !nothingToDelete && typedOk

  async function confirmDelete() {
    setDeleting(true)
    setError('')
    setNotice('')
    try {
      const result = await api.post(DELETE_URL, { scopes, confirm: confirmText.trim() })
      const removed = result.deleted || {}
      const parts = []
      if (removed.tickets) parts.push(`${removed.tickets} ticket(s)`)
      if (removed.sales) parts.push(`${removed.sales} sale(s)`)
      if (removed.events) parts.push(`${removed.events} event(s)`)
      if (removed.categories) parts.push(`${removed.categories} ticket type(s)`)
      if (removed.prices) parts.push(`${removed.prices} price(s)`)
      if (removed.assignments) parts.push(`${removed.assignments} assignment(s)`)
      if (removed.sequences) parts.push('ticket numbering reset')
      setNotice(
        parts.length
          ? `Deleted ${parts.join(', ')} for ${code}. This cannot be undone.`
          : `Nothing matched for ${code}; no rows were deleted.`,
      )
      setSummary(result.summary || summary)
      setConfirmText('')
      setChecked({ history: true, masters: false })
      setConfirming(false)
    } catch (err) {
      setError(err.message)
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow="DEVELOPER"
        title="Delete data"
        subtitle={
          code
            ? `Permanently removes data for ${code}. Staff, tax settings, users and the audit log are never touched.`
            : 'Permanently removes data for your organization.'
        }
      >
        <RefreshButton loading={loading} onClick={() => setReloadToken((token) => token + 1)} />
      </PageHead>

      <div className="mx-auto w-full max-w-[1040px] space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {notice && !error && <Alert variant="success">{notice}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tickets" value={loading || !summary ? '—' : summary.tickets} surface="blue" />
          <StatCard label="Sales" value={loading || !summary ? '—' : summary.sales} surface="gray" />
          <StatCard label="Events" value={loading || !summary ? '—' : summary.events} surface="green" />
          <StatCard
            label="Ticket types"
            value={loading || !summary ? '—' : summary.categories}
            surface="amber"
          />
        </div>

        <Card className="border-destructive/30">
          <CardContent className="p-6 md:p-8">
            <div className="mb-5 flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-destructive/10 text-destructive">
                <AlertTriangle className="h-[19px] w-[19px]" />
              </span>
              <div>
                <p className="font-display text-[19px] font-extrabold">Delete data</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Rows are removed from the database for good. There is no undo and no backup
                  taken here, so only run this on an organization you are happy to lose.
                </p>
              </div>
            </div>

            {nothingToDelete ? (
              <Alert variant="warning">
                There is nothing to delete for {code} — no tickets, sales, events or ticket types.
                Staff, the tax setting, users and the audit log are never touched by this tool.
              </Alert>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="scope-history"
                      className="mt-0.5"
                      checked={history}
                      disabled={deleting || checked.masters}
                      onCheckedChange={(value) =>
                        setChecked((current) => ({ ...current, history: value === true }))
                      }
                    />
                    <label
                      htmlFor="scope-history"
                      className={checked.masters ? 'select-none' : 'cursor-pointer select-none'}
                    >
                      <span className="text-sm font-semibold">
                        Tickets &amp; sales
                        {summary ? (
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({summary.tickets} ticket(s), {summary.sales} sale(s))
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        Every issued ticket, every sale and their line items.
                        {checked.masters ? ' Always included with master data below.' : ''}
                      </span>
                    </label>
                  </div>

                  {/* Locked on: a counter left behind would keep numbering from
                      tickets that no longer exist. */}
                  <div className="flex items-start gap-3">
                    <Checkbox id="scope-numbering" className="mt-0.5" checked disabled />
                    <label htmlFor="scope-numbering" className="select-none">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        Reset ticket numbering
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        {summary ? (
                          <span className="font-normal text-muted-foreground">
                            ({summary.sequences} counter(s))
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        Always on. The next ticket starts at #1 instead of carrying on from the
                        last one.
                      </span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="scope-masters"
                      className="mt-0.5"
                      checked={checked.masters}
                      disabled={deleting}
                      onCheckedChange={(value) =>
                        setChecked((current) => ({ ...current, masters: value === true }))
                      }
                    />
                    <label htmlFor="scope-masters" className="cursor-pointer select-none">
                      <span className="text-sm font-semibold">
                        Master data
                        <span className="ml-2 font-normal text-muted-foreground">
                          ({countList(summary)})
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        Events, ticket types, prices and staff assignments. Staff profiles,
                        users and the tax setting are kept.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-6 max-w-[420px]">
                  <Field label={`Type ${code} to confirm`} hint="Case does not matter.">
                    <Input
                      value={confirmText}
                      autoComplete="off"
                      placeholder={code}
                      disabled={deleting}
                      onChange={(event) => setConfirmText(event.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-border pt-5">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirmText('')
                      setChecked({ history: true, masters: false })
                      setNotice('')
                      setError('')
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!canDelete}
                    onClick={() => {
                      setNotice('')
                      setConfirming(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete permanently
                  </Button>
                </div>
                {!typedOk && confirmText ? (
                  <p className="mt-2 text-right text-xs font-semibold text-destructive">
                    That does not match {code}.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirming} onOpenChange={(open) => (open || deleting ? null : setConfirming(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete for {code}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This permanently removes, for{' '}
              <span className="font-mono font-medium text-foreground">{code}</span>:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {history ? (
                <>
                  <li>{summary?.tickets ?? 0} tickets</li>
                  <li>{summary?.sales ?? 0} sales and their line items</li>
                </>
              ) : null}
              <li>ticket numbering, restarted at #1</li>
              {checked.masters ? (
                <li>
                  {countList(summary)} — events, ticket types, prices and assignments
                </li>
              ) : null}
            </ul>
            <p>
              Staff profiles, users, the tax setting and the audit log stay as they are. This
              cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
