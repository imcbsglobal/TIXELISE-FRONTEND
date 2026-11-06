import { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** The two printable strings, stored in the tenant's "POS Print" template. */
export default function PrintSettingsDialog({ open, onOpenChange }) {
  const [form, setForm] = useState({ header: '', footer: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    setSaved(false)
    setLoading(true)
    api
      .get('/admin/ticket-print/')
      .then(
        (res) =>
          !cancelled &&
          setForm({ header: res.header || '', footer: res.footer || '' }),
      )
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open])

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await api.patch('/admin/ticket-print/', {
        header: form.header.trim(),
        footer: form.footer.trim(),
      })
      setForm({ header: res.header || '', footer: res.footer || '' })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ticket print settings</DialogTitle>
        </DialogHeader>

        {error ? <Alert variant="error">{error}</Alert> : null}
        {saved ? <Alert variant="success">Saved — new prints use this header and footer.</Alert> : null}

        <div className="space-y-4">
          <Field
            label="Organization name (top of ticket)"
            hint="Printed at the very top of every ticket. Leave blank to fall back to your organization name."
          >
            <Input
              value={form.header}
              maxLength={80}
              disabled={busy}
              placeholder="Your organization name"
              onChange={(event) => set('header', event.target.value)}
            />
          </Field>

          <Field
            label="Thanks text (bottom of ticket)"
            hint="Optional, printed under the last divider — for example “Thank you — please visit again!”."
          >
            <Input
              value={form.footer}
              maxLength={200}
              disabled={busy}
              placeholder="Thank you!"
              onChange={(event) => set('footer', event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={busy}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
