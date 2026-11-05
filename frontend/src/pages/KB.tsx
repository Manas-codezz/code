import { useCallback, useEffect, useState } from 'react'
import { api, msg, type User } from '../api'
import { ROLE_RANK } from '../App'
import { Badge, Btn, Empty, Field, inputCls } from '../ui'

type Kind = 'guidelines' | 'glossary' | 'facts' | 'colors'

interface Row { id: number; [k: string]: unknown }

const KINDS: { id: Kind; label: string; fields: string[];
               required: string[]; extra?: string[] }[] = [
  { id: 'guidelines', label: 'Guidelines', fields: ['title', 'body'],
    required: ['title', 'body'] },
  { id: 'glossary', label: 'Glossary',
    fields: ['term', 'kind', 'note'], required: ['term'] },
  { id: 'facts', label: 'Fact store', fields: ['claim', 'source'],
    required: ['claim'] },
  { id: 'colors', label: 'Colors', fields: ['hex', 'name'],
    required: ['hex'] },
]

export default function KB({ user }: { user: User }) {
  const [kind, setKind] = useState<Kind>('guidelines')
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const canWrite = ROLE_RANK[user.role] >= ROLE_RANK.manager
  const spec = KINDS.find((k) => k.id === kind)!

  const load = useCallback((k: Kind) => {
    api<Row[]>(`/kb/${k}`).then((r) => { setRows(r); setErr('') })
      .catch((e) => setErr(msg(e)))
  }, [])

  useEffect(() => { load(kind); setDraft({}); setAdding(false) },
            [kind, load])

  async function add() {
    setBusy(true); setErr('')
    try {
      await api(`/kb/${kind}`, { body: draft })
      setDraft({}); setAdding(false)
      load(kind)
    } catch (e) { setErr(msg(e)) } finally { setBusy(false) }
  }

  async function remove(id: number) {
    if (!confirm('Delete this entry? The audit log keeps a record.')) return
    setErr('')
    try {
      await api(`/kb/${kind}/${id}`, { method: 'DELETE' })
      load(kind)
    } catch (e) { setErr(msg(e)) }
  }

  async function exportAll() {
    const blob = new Blob([JSON.stringify(
      await api('/kb/export'), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'brandguard-kb-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Knowledge base
          </h1>
          <p className="text-[13px] text-ink2 mt-0.5">
            The rules the engine reviews against — live, editable, audited.
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={exportAll}>Export JSON</Btn>
          {canWrite && (
            <Btn kind="primary" onClick={() => setAdding((a) => !a)}>
              {adding ? 'Cancel' : '+ Add'}
            </Btn>
          )}
        </div>
      </header>

      {/* tabs */}
      <div className="flex border-b border-hairline gap-1">
        {KINDS.map((k) => (
          <button key={k.id} onClick={() => setKind(k.id)}
                  className={`px-3.5 py-2 text-[13px] border-b-2 -mb-px
                    transition-colors
                    ${kind === k.id
                      ? 'border-accent text-ink font-medium'
                      : 'border-transparent text-ink2 hover:text-ink'}`}>
            {k.label}
            <span className="text-ink2/70 ml-1.5 text-[11px]">
              {k.id === kind ? rows.length : ''}
            </span>
          </button>
        ))}
      </div>

      {err && (
        <div className="text-[13px] text-critical border border-critical/30
          bg-red-50 px-3 py-2 rounded-sm">
          {err}
        </div>
      )}

      {adding && canWrite && (
        <div className="border border-hairline bg-surface p-4 rounded-sm
          space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {spec.fields.map((f) => (
              <Field key={f} label={f}>
                {f === 'body' ? (
                  <textarea className={`${inputCls} h-24`}
                            value={draft[f] ?? ''}
                            onChange={(e) =>
                              setDraft({ ...draft, [f]: e.target.value })} />
                ) : f === 'kind' ? (
                  <select className={inputCls} value={draft[f] ?? 'approved'}
                          onChange={(e) =>
                            setDraft({ ...draft, [f]: e.target.value })}>
                    {['approved', 'prohibited', 'preferred',
                      'competitor'].map((o) =>
                      <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={draft[f] ?? ''}
                         placeholder={f === 'hex' ? '#DB4B16' : ''}
                         onChange={(e) =>
                           setDraft({ ...draft, [f]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
          <Btn kind="primary" onClick={add} disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </Btn>
        </div>
      )}

      <div className="border border-hairline bg-surface rounded-sm
        divide-y divide-hairline">
        {rows.length === 0 && (
          <div className="p-4"><Empty>No entries yet.</Empty></div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-start gap-3
            group">
            {kind === 'colors' && (
              <span className="w-6 h-6 rounded-sm border border-hairline
                shrink-0 mt-0.5"
                    style={{ background: String(r.hex) }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] break-words">
                {kind === 'guidelines' ? (
                  <>
                    <strong>{String(r.title)}</strong>
                    <span className="text-ink2"> — {String(r.body)}</span>
                  </>
                ) : kind === 'glossary' ? (
                  <>
                    <code className="font-mono text-[12.5px]">
                      {String(r.term)}
                    </code>
                    <Badge className={`ml-2 ${
                      r.kind === 'prohibited' ? 'bg-red-50 text-critical border-critical/40'
                      : r.kind === 'competitor'
                        ? 'bg-orange-50 text-accent border-accent/40'
                        : 'text-ok border-ok/40 bg-green-50'}`}>
                      {String(r.kind)}
                    </Badge>
                    {r.note && (
                      <span className="text-ink2"> — {String(r.note)}</span>
                    )}
                  </>
                ) : kind === 'facts' ? (
                  <>
                    {String(r.claim)}
                    {r.source && (
                      <span className="text-ink2 text-[12px]">
                        {' '}· {String(r.source)}
                      </span>
                    )}
                    {r.verified_at && (
                      <span className="text-[11px] text-ink2 ml-2">
                        verified {String(r.verified_at)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-mono">{String(r.hex)}
                    <span className="text-ink2 font-sans">
                      {' '}· {String(r.name)}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {canWrite && (
              <button onClick={() => remove(r.id)}
                      className="opacity-0 group-hover:opacity-100
                        focus:opacity-100 text-[12px] text-critical
                        hover:underline transition-opacity shrink-0">
                delete
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-ink2">
        Read access for every role; create/edit/delete requires manager+.
        Every change is written to the tamper-evident audit trail.
      </p>
    </div>
  )
}
