import { useCallback, useEffect, useRef, useState } from 'react'
import { api, msg, type Content, type Finding, type ReviewResult } from '../api'
import {
  Badge, Btn, Empty, Field, SeverityBadge, StatusChip, inputCls,
} from '../ui'
import {
  AlertCircle,
  ArrowDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileText,
  History,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

interface Comment {
  id: number; content_id: number; author: string; body: string
  resolved: number; parent_id: number | null; created_at: string
}
interface Version {
  version: number; status: string; created_at: string; author: string
}
interface Diff {
  from: number; to: number; lines: string[]; added: number; removed: number
}

const SEV_ORDER = { critical: 0, warning: 1, suggestion: 2 }

export default function Review({ selected }: { selected: string }) {
  const [list, setList] = useState<Content[]>([])
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState<Content | null>(null)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [diff, setDiff] = useState<Diff | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [draft, setDraft] = useState(
    { title: '', text: '', channel: 'web', type: 'text' })
  const [comment, setComment] = useState('')

  const workspaceRef = useRef<HTMLDivElement>(null)
  const cid = Number(selected) || 0

  const loadList = useCallback(() => {
    api<Content[]>('/content').then(setList).catch((e) => setErr(msg(e)))
  }, [])

  const loadDetail = useCallback((id: number) => {
    if (!id) { setDetail(null); setResult(null); return }
    api<Content>(`/content/${id}`).then((d) => {
      setDetail(d)
    }).catch((e) => setErr(msg(e)))
    api<Comment[]>(`/content/${id}/comments`).then(setComments)
      .catch(() => setComments([]))
    api<Version[]>(`/content/${id}/versions`).then((v) => {
      setVersions(v)
      if (v.length >= 2) {
        const a = v[v.length - 2].version, b = v[v.length - 1].version
        api<Diff>(`/content/${id}/diff?frm=${a}&to=${b}`).then(setDiff)
          .catch(() => setDiff(null))
      } else setDiff(null)
    }).catch(() => { setVersions([]); setDiff(null) })
  }, [])

  useEffect(loadList, [loadList])
  useEffect(() => {
    setResult(null)
    loadDetail(cid)
  }, [cid, loadDetail])

  const findings: Finding[] =
    (result?.findings ?? detail?.findings ?? [])
      .slice()
      .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])

  const unresolvedCriticals =
    findings.filter((f) => f.severity === 'critical' && f.accepted === 0)

  async function create() {
    setBusy('create')
    setErr('')
    try {
      const c = await api<Content>('/content', { body: draft })
      setDraft({ title: '', text: '', channel: 'web', type: 'text' })
      setShowCreate(false)
      loadList()
      location.hash = `#/review/${c.id}`
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  async function runReview() {
    setBusy('review'); setErr('')
    try {
      const r = await api<ReviewResult>(
        `/content/${cid}/review?force_mock=false`, { method: 'POST' })
      setResult(r)
      loadDetail(cid)
      loadList()
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  async function setFinding(f: Finding, accepted: 0 | 1 | 2) {
    const updated = await api<Finding>(`/findings/${f.id}`, {
      method: 'PATCH', body: { accepted } })
    const base = result?.findings ?? detail?.findings ?? []
    const next = base.map((x) => (x.id === updated.id ? updated : x))
    if (result) setResult({ ...result, findings: next })
    else setDetail(detail ? { ...detail, findings: next } : detail)
  }

  async function approve() {
    setBusy('approve'); setErr('')
    try {
      await api(`/content/${cid}/approve`, { method: 'POST' })
      await Promise.all([loadDetail(cid), loadList()])
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  async function requestChanges() {
    setBusy('rc'); setErr('')
    try {
      await api(`/content/${cid}/request-changes`, { method: 'POST' })
      await Promise.all([loadDetail(cid), loadList()])
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  async function postComment() {
    if (!comment.trim()) return
    setBusy('c')
    try {
      await api(`/content/${cid}/comments`, {
        method: 'POST', body: { body: comment.trim() } })
      setComment('')
      setComments(await api<Comment[]>(`/content/${cid}/comments`))
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  const visible = filter
    ? list.filter((c) => c.status === filter) : list

  return (
    <div className="space-y-8 w-full">
      {/* =========================================================================
          SECTION 1: FULL-PAGE REVIEW QUEUE (Top Table View)
      ========================================================================= */}
      <section className="bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden">
        {/* Queue Header & Filters */}
        <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">Review Queue</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-mono">
                {list.length} Total Drafts
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Select any copy draft from the queue to inspect compliance findings and run AI evaluations below.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Pills */}
            <div className="flex gap-1 bg-white/[0.02] border border-white/10 p-1 rounded-xl">
              {['', 'draft', 'review', 'changes', 'approved'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setFilter(s)}
                  className={`text-[11px] px-3 py-1 rounded-lg uppercase tracking-wider font-semibold transition-all duration-200 cursor-pointer ${
                    filter === s
                      ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {s || 'all'}
                </button>
              ))}
            </div>

            <Btn kind="primary" onClick={() => setShowCreate((s) => !s)}>
              <span className="flex items-center gap-1.5">
                {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{showCreate ? 'Close Form' : 'New Draft'}</span>
              </span>
            </Btn>
          </div>
        </div>

        {/* Expandable New Draft Form */}
        {showCreate && (
          <div className="p-6 border-b border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                Submit New Copy for Compliance Evaluation
              </h3>
              <span className="text-xs text-zinc-500">Auto-routes to reviewer queue</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Draft Title">
                <input
                  className={inputCls}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Q4 Global Brand Campaign Headline"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Channel">
                  <input
                    className={inputCls}
                    value={draft.channel}
                    onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
                    placeholder="e.g. web, email, social"
                  />
                </Field>
                <Field label="Type">
                  <div className="relative">
                    <select
                      className="w-full border border-white/10 bg-[#0f1117] text-zinc-100 px-3.5 py-2 text-sm rounded-lg focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 focus:outline-none transition-all cursor-pointer appearance-none pr-9"
                      style={{ backgroundColor: '#0f1117', color: '#f4f4f5' }}
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                    >
                      <option value="text" className="bg-[#0f1117] text-white" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>text</option>
                      <option value="image" className="bg-[#0f1117] text-white" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>image</option>
                      <option value="email" className="bg-[#0f1117] text-white" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>email</option>
                      <option value="social" className="bg-[#0f1117] text-white" style={{ backgroundColor: '#0f1117', color: '#ffffff' }}>social</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Copy Content Body">
                  <textarea
                    className={`${inputCls} h-24 resize-none`}
                    value={draft.text}
                    onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                    placeholder="Paste the marketing copy, claims, or disclaimers to evaluate…"
                  />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Btn onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn
                kind="primary"
                onClick={create}
                disabled={busy === 'create' || !draft.title || !draft.text}
              >
                {busy === 'create' ? 'Creating…' : 'Create & Open Review Below'}
              </Btn>
            </div>
          </div>
        )}

        {/* Full-Width Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-white/10 text-zinc-400 uppercase tracking-wider text-[11px] bg-white/[0.01]">
                <th className="py-3 px-6 font-semibold">Title & Excerpt</th>
                <th className="py-3 px-4 font-semibold">Channel / Type</th>
                <th className="py-3 px-4 font-semibold">Author & Team</th>
                <th className="py-3 px-4 font-semibold">SLA Deadline</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-6 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No drafts currently match the filter criteria.
                  </td>
                </tr>
              )}
              {visible.map((c) => {
                const isSelected = cid === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => {
                      location.hash = `#/review/${c.id}`
                      setTimeout(() => {
                        workspaceRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }}
                    className={`transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/[0.08] shadow-[inset_0_0_0_1px_rgba(249,115,22,0.35)]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-4 px-6 max-w-xs sm:max-w-md">
                      <div className="font-semibold text-white text-sm truncate flex items-center gap-2">
                        <span>{c.title}</span>
                        {isSelected && (
                          <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 font-mono">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 text-xs truncate mt-0.5 font-sans">
                        {c.text || '(No text body — image asset)'}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <Badge className="bg-white/[0.04] text-zinc-300 border-white/10">
                        {c.channel} · {c.type}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-zinc-300">
                      <div>{c.created_by}</div>
                      <div className="text-[11px] text-zinc-500">team {c.team}</div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      {c.sla_due_at ? (
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <Clock className={`w-3.5 h-3.5 ${c.status === 'review' ? 'text-amber-400' : 'text-zinc-500'}`} />
                          <span>
                            {new Date(c.sla_due_at + 'Z').toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <StatusChip status={c.status} />
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs text-orange-400 group-hover:text-orange-300 font-medium">
                        <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: FULL-PAGE EVALUATION WORKSPACE (Bottom Detailed View)
      ========================================================================= */}
      <div ref={workspaceRef} className="space-y-6">
        {!cid ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-12 text-center backdrop-blur-xl">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No Draft Selected</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              Click any draft row in the queue above to open the full compliance evaluation workspace, run AI audits, and view generated findings.
            </p>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Active Draft Action Bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-mono text-orange-400 uppercase tracking-wider bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      ACTIVE WORKSPACE
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      {detail.title}
                    </h2>
                    <StatusChip status={detail.status} />
                    <Badge className="bg-white/[0.04] text-zinc-300 border-white/10">
                      {detail.channel} · {detail.type}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-3">
                    <span>Author: <strong className="text-zinc-200">{detail.created_by}</strong></span>
                    <span>·</span>
                    <span>Team: <strong className="text-zinc-200">{detail.team}</strong></span>
                    {detail.sla_due_at && (
                      <>
                        <span>·</span>
                        <span className="text-amber-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5" /> SLA Due: {new Date(detail.sla_due_at + 'Z').toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <Btn onClick={runReview} disabled={busy === 'review'}>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                      <span>{busy === 'review' ? 'Evaluating…' : result ? 'Re-run Evaluation' : 'Run AI Evaluation'}</span>
                    </span>
                  </Btn>
                  <Btn
                    kind="primary"
                    onClick={approve}
                    disabled={
                      busy === 'approve' ||
                      detail.status === 'approved' ||
                      unresolvedCriticals.length > 0
                    }
                    title={
                      unresolvedCriticals.length
                        ? `${unresolvedCriticals.length} critical finding(s) must be accepted or dismissed first`
                        : ''
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>{busy === 'approve' ? 'Approving…' : 'Approve Draft'}</span>
                    </span>
                  </Btn>
                  <Btn
                    kind="danger"
                    onClick={requestChanges}
                    disabled={busy === 'rc' || detail.status === 'changes'}
                  >
                    Request Changes
                  </Btn>
                </div>
              </div>

              {/* Approval Gating Banner */}
              {unresolvedCriticals.length > 0 && (
                <div className="mt-4 text-xs text-red-300 bg-red-950/40 border border-red-500/30 px-4 py-3 rounded-xl flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>
                    <strong>Approval Blocked</strong> — {unresolvedCriticals.length} critical finding{unresolvedCriticals.length > 1 ? 's' : ''} require action (accept or dismiss each in the findings deck below) before this draft can ship.
                  </span>
                </div>
              )}

              {/* AI Diagnostic Metrics */}
              {result && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-6 text-xs text-zinc-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-orange-400" />
                    Provider: <strong className="text-white">{result.provider}</strong>
                  </span>
                  <span>Model: <strong className="text-white">{result.model}</strong></span>
                  <span className="tabular-nums">Latency: <strong className="text-white">{result.latency_ms}ms</strong></span>
                  <span className="tabular-nums">Tokens: <strong className="text-white">{result.tokens}</strong></span>
                  <span>Findings Identified: <strong className="text-white">{result.findings.length}</strong></span>
                </div>
              )}
            </div>

            {/* Error Toast */}
            {err && (
              <div className="text-xs text-red-300 border border-red-500/30 bg-red-950/40 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            {/* Workspace Grid: Draft Content (Left) & Generated Summary / Findings (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Draft Content & Revisions Diff */}
              <div className="lg:col-span-5 space-y-6">
                {/* Content Under Review */}
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg">
                  <header className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Content Under Review
                    </h3>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {detail.text.length} chars
                    </span>
                  </header>
                  <pre className="p-5 text-sm leading-relaxed whitespace-pre-wrap font-sans text-zinc-100 bg-[#06070a]/70">
                    {detail.text || <span className="text-zinc-500 italic">(Empty text content — visual asset draft)</span>}
                  </pre>
                  {detail.image_path && (
                    <div className="p-5 border-t border-white/5">
                      <img
                        src={detail.image_path}
                        alt=""
                        className="max-h-60 rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                </section>

                {/* Revision Timeline & Diff */}
                {versions.length > 0 && (
                  <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg">
                    <header className="px-5 py-3.5 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-zinc-400" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                          Revisions Timeline
                        </h3>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {versions.length} version{versions.length > 1 ? 's' : ''}
                      </span>
                    </header>
                    <div className="p-5 space-y-3">
                      <div className="flex gap-2 flex-wrap text-xs">
                        {versions.map((v) => (
                          <Badge
                            key={v.version}
                            className="bg-white/[0.04] text-zinc-300 border-white/10"
                          >
                            v{v.version} · {v.status}
                          </Badge>
                        ))}
                      </div>

                      {diff && (
                        <details className="mt-3 group" open={diff.added + diff.removed > 0}>
                          <summary className="text-xs font-semibold uppercase tracking-wider text-orange-400 cursor-pointer hover:text-orange-300 flex items-center gap-2 select-none">
                            <span>Revisions Diff (+{diff.added} / −{diff.removed})</span>
                          </summary>
                          <pre className="mt-2.5 font-mono text-xs bg-[#06070a]/90 border border-white/10 rounded-xl p-4 overflow-x-auto leading-relaxed">
                            {diff.lines.map((l, i) => (
                              <div
                                key={i}
                                className={
                                  l.startsWith('+')
                                    ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded'
                                    : l.startsWith('-')
                                    ? 'text-red-400 bg-red-500/10 px-1 rounded'
                                    : 'text-zinc-500'
                                }
                              >
                                {l}
                              </div>
                            ))}
                          </pre>
                        </details>
                      )}
                    </div>
                  </section>
                )}
              </div>

              {/* Right Column: Generated Findings Deck & Reviewer Thread */}
              <div className="lg:col-span-7 space-y-6">
                {/* Findings Deck (Generated Evaluation Summary) */}
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg">
                  <header className="px-5 py-3.5 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                        Generated Evaluation Summary & Findings
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 font-mono">
                        {findings.length}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {findings.filter((f) => f.accepted === 1).length} accepted · {findings.filter((f) => f.accepted === 2).length} dismissed
                    </span>
                  </header>

                  {findings.length === 0 && (
                    <div className="p-8">
                      <Empty>
                        <p className="text-zinc-300 font-medium">No findings recorded yet.</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Click "Run AI Evaluation" above to audit copy against brand guidelines, prohibited terminology, and facts.
                        </p>
                      </Empty>
                    </div>
                  )}

                  <ul className="divide-y divide-white/5">
                    {findings.map((f) => (
                      <li
                        key={f.id}
                        className={`p-5 transition-opacity ${f.accepted === 2 ? 'opacity-40' : ''}`}
                      >
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          <SeverityBadge severity={f.severity} />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="text-sm font-semibold text-white">
                              {f.rule}
                            </div>
                            {f.excerpt && (
                              <code className="font-mono text-xs bg-white/[0.05] border border-white/10 text-orange-300 px-2.5 py-1 rounded-md inline-block break-all">
                                "{f.excerpt}"
                              </code>
                            )}
                            <div className="text-xs text-zinc-300 leading-relaxed">
                              {f.suggestion}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex gap-3 flex-wrap pt-1">
                              <span className="capitalize">Category: {f.category}</span>
                              <span>·</span>
                              <span>Confidence: {Math.round(f.confidence * 100)}%</span>
                              <span>·</span>
                              <span className="truncate max-w-md" title={f.evidence}>
                                Evidence: {f.evidence || '—'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 shrink-0 self-end sm:self-start">
                            {f.accepted !== 1 && (
                              <Btn
                                kind="ghost"
                                onClick={() => setFinding(f, 1)}
                                className="!py-1 !px-2.5 !text-xs !border-emerald-500/30 hover:!bg-emerald-500/10 text-emerald-400"
                              >
                                <Check className="w-3.5 h-3.5 inline mr-1" />
                                Accept
                              </Btn>
                            )}
                            {f.accepted !== 2 && (
                              <Btn
                                kind="danger"
                                onClick={() => setFinding(f, 2)}
                                className="!py-1 !px-2.5 !text-xs"
                              >
                                <X className="w-3.5 h-3.5 inline mr-1" />
                                Dismiss
                              </Btn>
                            )}
                            {f.accepted !== 0 && (
                              <Btn
                                onClick={() => setFinding(f, 0)}
                                className="!py-1 !px-2.5 !text-xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                                Undo
                              </Btn>
                            )}
                          </div>
                        </div>
                        {f.accepted === 1 && (
                          <div className="text-xs text-emerald-400 mt-2.5 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accepted — counts towards compliance threshold.</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Peer Review Notes & Comment Thread */}
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg">
                  <header className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                        Peer Reviewer Thread
                      </h3>
                    </div>
                    <span className="text-xs text-zinc-500">{comments.length} notes</span>
                  </header>
                  <div className="p-5 space-y-4">
                    {comments.length === 0 && (
                      <p className="text-xs text-zinc-500">No reviewer notes posted yet on this draft.</p>
                    )}
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs ${
                          c.resolved ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex gap-2 items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-zinc-200">{c.author}</strong>
                            <span className="text-[11px] text-zinc-500">
                              {new Date(c.created_at + 'Z').toLocaleDateString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {!c.resolved ? (
                            <button
                              className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
                              onClick={async () => {
                                await api(`/comments/${c.id}`, {
                                  method: 'PATCH', body: { resolved: true },
                                })
                                setComments(await api<Comment[]>(`/content/${cid}/comments`))
                              }}
                            >
                              Mark resolved
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Resolved
                            </span>
                          )}
                        </div>
                        <div className="text-zinc-300 leading-relaxed">{c.body}</div>
                      </div>
                    ))}

                    {/* New Note Form */}
                    <div className="flex gap-2.5 pt-2">
                      <input
                        className={inputCls}
                        value={comment}
                        placeholder="Add a review note or compliance feedback…"
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && postComment()}
                      />
                      <Btn onClick={postComment} disabled={busy === 'c' || !comment.trim()}>
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" />
                          <span>Post</span>
                        </span>
                      </Btn>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
