import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/api'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHead, RefreshButton } from '@/components/ui/page'

const ENDPOINT = '/admin/ticket-print/'
const HEADER_MAX = 80
const FOOTER_MAX = 200
const EMPTY_FORM = { header: '', footer: '' }

export default function TicketPrint() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [customized, setCustomized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    document.title = 'Tixelise | Ticket print'
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get(ENDPOINT)
      .then((res) => {
        if (cancelled) return
        setForm({ header: res.header || '', footer: res.footer || '' })
        setCustomized(!!res.customized)
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setNotice('')
  }

  function apply(res) {
    setForm({ header: res.header || '', footer: res.footer || '' })
    setCustomized(!!res.customized)
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.patch(ENDPOINT, {
        header: form.header.trim(),
        footer: form.footer.trim(),
      })
      apply(res)
      setNotice('Saved — new prints use this header and footer.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function clearCustomization() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await api.patch(ENDPOINT, { header: '', footer: '' })
      apply(res)
      setNotice('Custom header and footer cleared — tickets fall back to your organization name.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const busy = loading || saving
  const previewHeader = form.header.trim()
  const previewFooter = form.footer.trim()

  return (
    <>
      <PageHead
        eyebrow="MASTER"
        title="Ticket print"
        subtitle="The organization name on top of every printed ticket and the thanks text at the bottom."
      >
        <RefreshButton loading={loading} onClick={() => setReloadToken((token) => token + 1)} />
      </PageHead>

      <div className="mx-auto w-full max-w-[1040px]">
        {error && <Alert variant="error" className="mb-5">{error}</Alert>}
        {notice && !error && <Alert variant="success" className="mb-5">{notice}</Alert>}

        <Card>
          <CardContent className="p-6 md:p-8">
            {loading ? (
              <p className="py-16 text-center text-muted-foreground">Loading…</p>
            ) : (
              <form onSubmit={save}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
                  <div className="space-y-5">
                    <Field
                      label="Organization name (top of ticket)"
                      hint={`${form.header.length}/${HEADER_MAX} characters. Leave blank to fall back to your organization name.`}
                    >
                      <Input
                        value={form.header}
                        maxLength={HEADER_MAX}
                        disabled={busy}
                        placeholder="Your organization name"
                        onChange={(event) => set('header', event.target.value)}
                      />
                    </Field>

                    <Field
                      label="Thanks text (bottom of ticket)"
                      hint={`${form.footer.length}/${FOOTER_MAX} characters. Optional — for example “Thank you — please visit again!”.`}
                    >
                      <Input
                        value={form.footer}
                        maxLength={FOOTER_MAX}
                        disabled={busy}
                        placeholder="Thank you!"
                        onChange={(event) => set('footer', event.target.value)}
                      />
                    </Field>
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Preview
                    </p>
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
                      <p className="break-words font-display text-[15px] font-extrabold">
                        {previewHeader || 'Organization name'}
                      </p>
                      <div className="my-4 border-t border-dashed border-border" />
                      <p className="text-[12px] text-muted-foreground">Event · Category · Ticket no.</p>
                      <div className="my-4 border-t border-dashed border-border" />
                      <p className="break-words text-[12.5px] text-muted-foreground">
                        {previewFooter || 'Thanks text appears here'}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {customized
                        ? 'Custom header/footer is active for this tenant.'
                        : 'Using defaults — the organization name is printed at the top.'}
                    </p>
                  </div>
                </div>

                <p className="mt-6 text-xs text-muted-foreground">
                  Applies to every ticket printed by this tenant's staff. Changes are recorded in the
                  audit log.
                </p>

                <div className="mt-7 flex items-center justify-end gap-2.5 border-t border-border pt-5">
                  <Button type="button" variant="outline" onClick={clearCustomization} disabled={busy}>
                    <RotateCcw className="h-4 w-4" /> Clear customization
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
