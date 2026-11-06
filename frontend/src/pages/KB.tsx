import { useCallback, useEffect, useState } from 'react'
import { api, msg, type User } from '../api'
import { ROLE_RANK } from '../App'
import { Badge, Btn, Empty, Field, inputCls } from '../ui'
import { ChevronDown, Download, Plus, Trash2, X } from 'lucide-react'

type Kind = 'guidelines' | 'glossary' | 'facts' | 'colors'

interface Row { id: number; [k: string]: unknown }

const KINDS: { id: Kind; label: string; fields: string[];
               required: string[]; extra?: string[] }[] = [
  { id: 'guidelines', label: 'Guidelines', fields: ['title', 'body'],
    required: ['title', 'body'] },
  { id: 'glossary', label: 'Glossary & Terms',
    fields: ['term', 'kind', 'note'], required: ['term'] },
  { id: 'facts', label: 'Fact Store', fields: ['claim', 'source'],
    required: ['claim'] },
  { id: 'colors', label: 'Brand Palette', fields: ['hex', 'name'],
    required: ['hex'] },
]

const GLOSSARY_BADGE_STYLE: Record<string, string> = {
  prohibited: 'bg-red-500/10 text-red-400 border-red-500/25',
  preferred: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  competitor: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
}

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
    if (!confirm('Delete this entry? The cryptographic audit log keeps an immutable record.')) return
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
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Knowledge Base
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Governing rules, prohibited terminology, verified factual claims, and color tokens.
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <Btn onClick={exportAll}>
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </span>
          </Btn>
          {canWrite && (
            <Btn kind="primary" onClick={() => setAdding((a) => !a)}>
              <span className="flex items-center gap-1.5">
                {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{adding ? 'Cancel' : 'Add Entry'}</span>
              </span>
            </Btn>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-0.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`px-4 py-2.5 text-xs uppercase tracking-wider font-semibold border-b-2 -mb-px transition-all duration-200 cursor-pointer flex items-center gap-2 shrink-0 ${
              kind === k.id
                ? 'border-orange-500 text-orange-400 font-bold bg-orange-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <span>{k.label}</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10">
              {k.id === kind ? rows.length : '·'}
            </span>
          </button>
        ))}
      </div>

      {err && (
        <div className="text-xs text-red-300 border border-red-500/30 bg-red-950/40 px-4 py-3 rounded-xl">
          {err}
        </div>
      )}

      {/* Add New Entry Drawer */}
      {adding && canWrite && (
        <div className="bg-white/[0.04] border border-white/10 p-5 rounded-2xl backdrop-blur-xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
              Create New {spec.label} Entry
            </h3>
            <span className="text-[11px] text-zinc-400">Audited change</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {spec.fields.map((f) => (
              <Field key={f} label={f}>
                {f === 'body' ? (
                  <textarea
                    className={`${inputCls} h-24 resize-none`}
                    value={draft[f] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                    placeholder="Enter detailed rule requirements or explanation…"
                  />
                ) : f === 'kind' ? (
                  <div className="relative">
                    <select
                      className="w-full border border-white/10 bg-[#0f1117] text-zinc-100 px-3.5 py-2 text-sm rounded-lg focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 focus:outline-none transition-all cursor-pointer appearance-none pr-9"
                      style={{ backgroundColor: '#0f1117', color: '#f4f4f5' }}
                      value={draft[f] ?? 'approved'}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                    >
                      {['approved', 'prohibited', 'preferred', 'competitor'].map((o) => (
                        <option
                          key={o}
                          value={o}
                          className="bg-[#0f1117] text-white"
                          style={{ backgroundColor: '#0f1117', color: '#ffffff' }}
                        >
                          {o}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    className={inputCls}
                    value={draft[f] ?? ''}
                    placeholder={f === 'hex' ? '#DB4B16' : `Enter ${f}…`}
                    onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                  />
                )}
              </Field>
            ))}
          </div>
          <Btn kind="primary" onClick={add} disabled={busy}>
            {busy ? 'Saving to Ledger…' : 'Save Entry'}
          </Btn>
        </div>
      )}

      {/* Entries List */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5 backdrop-blur-xl shadow-lg overflow-hidden">
        {rows.length === 0 && (
          <div className="p-8"><Empty>No entries found in this category.</Empty></div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="px-5 py-4 flex items-start justify-between gap-4 group hover:bg-white/[0.02] transition-colors"
          >
            {kind === 'colors' && (
              <span
                className="w-7 h-7 rounded-lg border border-white/20 shrink-0 mt-0.5 shadow-md"
                style={{ background: String(r.hex) }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm break-words leading-relaxed">
                {kind === 'guidelines' ? (
                  <>
                    <strong className="text-white font-semibold">{String(r.title)}</strong>
                    <span className="text-zinc-300"> — {String(r.body)}</span>
                  </>
                ) : kind === 'glossary' ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-zinc-100 bg-white/[0.06] border border-white/15 px-2.5 py-1 rounded-md shadow-sm">
                      {String(r.term)}
                    </span>
                    <Badge
                      className={GLOSSARY_BADGE_STYLE[String(r.kind)] ?? 'bg-white/5 text-zinc-400 border-white/10'}
                    >
                      {String(r.kind)}
                    </Badge>
                    {r.note ? (
                      <span className="text-zinc-300 text-xs"> — {String(r.note)}</span>
                    ) : null}
                  </div>
                ) : kind === 'facts' ? (
                  <div>
                    <span className="text-zinc-100 font-medium">{String(r.claim)}</span>
                    {r.source ? (
                      <span className="text-zinc-400 text-xs ml-2">
                        · Source: {String(r.source)}
                      </span>
                    ) : null}
                    {r.verified_at ? (
                      <span className="text-[11px] text-zinc-500 ml-2">
                        · Verified: {String(r.verified_at)}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white text-xs font-semibold">{String(r.hex)}</span>
                    <span className="text-zinc-400 text-xs">· {String(r.name)}</span>
                  </div>
                )}
              </div>
            </div>
            {canWrite && (
              <button
                onClick={() => remove(r.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer shrink-0"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <footer className="text-xs text-zinc-500 flex items-center justify-between pt-2">
        <span>Read access granted to all roles; modifications restricted to Manager / Admin roles.</span>
        <span>Cryptographic Audit Trail Active</span>
      </footer>
    </div>
  )
}
