import { useCallback, useEffect, useState } from 'react'
import { api, msg, type Content, type Finding, type ReviewResult } from '../api'
import {
  Badge, Btn, Empty, Field, SeverityBadge, StatusChip, inputCls,
} from '../ui'

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

  const cid = Number(selected) || 0

  const loadList = useCallback(() => {
    api<Content[]>('/content').then(setList).catch((e) => setErr(msg(e)))
  }, [])

  const loadDetail = useCallback((id: number) => {
    if (!id) { setDetail(null); setResult(null); return }
    api<Content>(`/content/${id}`).then((d) => {
      setDetail(d)               // findings come stamped from the server
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
    setResult(null)               // new selection: drop last run's meta
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
      loadDetail(cid)              // sync status/SLA side effects
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
    <div className="flex gap-5 items-start">
      {/* ---- list pane ---- */}
      <div className="w-72 shrink-0 space-y-3 sticky top-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
          <Btn kind="primary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? 'Cancel' : '+ New'}
          </Btn>
        </div>

        {showCreate && (
          <div className="border border-hairline bg-surface p-3 rounded-sm
            space-y-2.5">
            <Field label="Title">
              <input className={inputCls} value={draft.title}
                     onChange={(e) =>
                       setDraft({ ...draft, title: e.target.value })}
                     placeholder="Q4 launch email" />
            </Field>
            <Field label="Text">
              <textarea className={`${inputCls} h-24 resize-none`}
                        value={draft.text}
                        onChange={(e) =>
                          setDraft({ ...draft, text: e.target.value })}
                        placeholder="Paste copy to review…" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select className={inputCls} value={draft.type}
                        onChange={(e) =>
                          setDraft({ ...draft, type: e.target.value })}>
                  <option value="text">text</option>
                  <option value="image">image</option>
                  <option value="email">email</option>
                  <option value="social">social</option>
                </select>
              </Field>
              <Field label="Channel">
                <input className={inputCls} value={draft.channel}
                       onChange={(e) =>
                         setDraft({ ...draft, channel: e.target.value })} />
              </Field>
            </div>
            <Btn kind="primary" onClick={create}
                 disabled={busy === 'create' || !draft.title || !draft.text}
                 className="w-full">
              {busy === 'create' ? 'Creating…' : 'Create & open'}
            </Btn>
          </div>
        )}

        <div className="flex gap-1 flex-nowrap overflow-x-auto pb-0.5">
          {['', 'draft', 'review', 'changes', 'approved'].map((s) => (
            <button key={s || 'all'} onClick={() => setFilter(s)}
                    className={`text-[10.5px] px-2 py-1 border rounded-sm
                      uppercase tracking-wider font-semibold transition-colors
                      whitespace-nowrap shrink-0
                      ${filter === s
                        ? 'border-ink bg-ink text-paper'
                        : 'border-hairline text-ink2 hover:border-ink'}`}>
              {s || 'all'}
            </button>
          ))}
        </div>

        <div className="border border-hairline bg-surface rounded-sm
          divide-y divide-hairline max-h-[70vh] overflow-y-auto">
          {visible.length === 0 && (
            <div className="p-4 text-[13px] text-ink2">Nothing here.</div>
          )}
          {visible.map((c) => (
            <a key={c.id} href={`#/review/${c.id}`}
               className={`block px-3 py-2.5 transition-colors
                 ${cid === c.id ? 'bg-orange-50/50 border-l-2 border-accent'
                                : 'hover:bg-paper border-l-2 border-transparent'}`}>
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[13px] font-medium truncate">
                  {c.title}
                </span>
                <StatusChip status={c.status} />
              </div>
              <div className="text-[11px] text-ink2 mt-1 truncate">
                {c.created_by} · {c.channel}
                {c.sla_due_at && c.status === 'review' && (
                  <span className="text-warning"> · SLA</span>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ---- detail pane ---- */}
      <div className="flex-1 min-w-0">
        {!cid && (
          <Empty>Select content on the left, or create something new.</Empty>
        )}

        {cid > 0 && detail && (
          <div className="space-y-4">
            {err && (
              <div className="text-[13px] text-critical border
                border-critical/30 bg-red-50 px-3 py-2 rounded-sm">
                {err}
              </div>
            )}

            <header className="border border-hairline bg-surface rounded-sm
              px-4 py-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-semibold tracking-tight
                      truncate">
                      {detail.title}
                    </h2>
                    <StatusChip status={detail.status} />
                    <Badge className="text-ink2 border-hairline">
                      {detail.type}
                      {detail.channel !== detail.type
                        && ` · ${detail.channel}`}
                    </Badge>
                  </div>
                  <div className="text-[12px] text-ink2 mt-1">
                    by {detail.created_by} · team {detail.team}
                    {detail.sla_due_at && (
                      <> · SLA due <span className="tabular">
                        {new Date(detail.sla_due_at + 'Z')
                          .toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit' })}
                      </span></>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Btn onClick={runReview} disabled={busy === 'review'}>
                    {busy === 'review' ? 'Reviewing…'
                      : result ? 'Re-run review' : 'Run AI review'}
                  </Btn>
                  <Btn kind="primary" onClick={approve}
                       disabled={busy === 'approve'
                                || detail.status === 'approved'
                                || unresolvedCriticals.length > 0}
                       title={unresolvedCriticals.length
                         ? `${unresolvedCriticals.length} critical finding(s)
                            must be accepted or dismissed first`
                         : ''}>
                    {busy === 'approve' ? 'Approving…' : 'Approve'}
                  </Btn>
                  <Btn kind="danger" onClick={requestChanges}
                       disabled={busy === 'rc'
                                || detail.status === 'changes'}>
                    Request changes
                  </Btn>
                </div>
              </div>

              {unresolvedCriticals.length > 0 && (
                <div className="mt-3 text-[12px] text-critical bg-red-50
                  border border-critical/20 px-3 py-1.5 rounded-sm">
                  Approval blocked — {unresolvedCriticals.length} critical
                  finding{unresolvedCriticals.length > 1 ? 's' : ''} still
                  unresolved (accept or dismiss each to proceed).
                </div>
              )}
              {result && (
                <div className="mt-3 text-[12px] text-ink2 flex gap-4
                  flex-wrap">
                  <span>provider <strong className="text-ink">
                    {result.provider}</strong></span>
                  <span>model <strong className="text-ink">{result.model}</strong></span>
                  <span className="tabular">{result.latency_ms}ms</span>
                  <span className="tabular">{result.tokens} tokens</span>
                  <span>{result.findings.length} findings</span>
                </div>
              )}
            </header>

            {/* content text */}
            <section className="border border-hairline bg-surface rounded-sm">
              <header className="px-4 py-2.5 border-b border-hairline
                flex justify-between items-center">
                <h3 className="eyebrow">Content under review</h3>
              </header>
              <pre className="px-4 py-3.5 text-[13px] leading-relaxed
                whitespace-pre-wrap font-sans text-ink">
                {detail.text || <span className="text-ink2">
                  (no text — image asset)</span>}
              </pre>
              {detail.image_path && (
                <div className="px-4 pb-4">
                  <img src={detail.image_path} alt=""
                       className="max-h-56 border border-hairline rounded-sm" />
                </div>
              )}
            </section>

            {/* findings */}
            <section className="border border-hairline bg-surface rounded-sm">
              <header className="px-4 py-2.5 border-b border-hairline
                flex justify-between items-center">
                <h3 className="eyebrow">Findings</h3>
                <span className="text-[11px] text-ink2">
                  {findings.length === 0
                    ? 'run the review to generate'
                    : `${findings.filter((f) => f.accepted === 1).length} accepted ·
                       ${findings.filter((f) => f.accepted === 2).length} dismissed`}
                </span>
              </header>

              {findings.length === 0 && (
                <div className="p-4">
                  <Empty>
                    No findings yet — run the AI review. Deterministic checks
                    (glossary, WCAG, disclaimers) always run alongside the LLM.
                  </Empty>
                </div>
              )}

              <ul className="divide-y divide-hairline">
                {findings.map((f) => (
                  <li key={f.id}
                      className={`px-4 py-3.5 ${
                        f.accepted === 2 ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-3">
                      <SeverityBadge severity={f.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-medium">
                          {f.rule}
                        </div>
                        {f.excerpt && (
                          <code className="font-mono text-[12px] bg-paper
                            border border-hairline px-1.5 py-0.5 rounded-sm
                            mt-1.5 inline-block break-all">
                            {f.excerpt}
                          </code>
                        )}
                        <div className="text-[13px] text-ink mt-1.5">
                          {f.suggestion}
                        </div>
                        <div className="text-[11.5px] text-ink2 mt-1.5
                          flex gap-3 flex-wrap">
                          <span>⚑ {f.category}</span>
                          <span>confidence
                            {' '}{Math.round(f.confidence * 100)}%</span>
                          <span className="truncate max-w-md"
                                title={f.evidence}>
                            evidence: {f.evidence || '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {f.accepted !== 1 && (
                          <Btn onClick={() => setFinding(f, 1)}
                               className="!py-1 !px-2 !text-[12px]">
                            Accept
                          </Btn>
                        )}
                        {f.accepted !== 2 && (
                          <Btn kind="danger"
                               onClick={() => setFinding(f, 2)}
                               className="!py-1 !px-2 !text-[12px]">
                            Dismiss
                          </Btn>
                        )}
                        {f.accepted !== 0 && (
                          <Btn onClick={() => setFinding(f, 0)}
                               className="!py-1 !px-2 !text-[12px]">
                            Undo
                          </Btn>
                        )}
                      </div>
                    </div>
                    {f.accepted === 1 && (
                      <div className="text-[11px] text-ok mt-1.5 pl-1">
                        ✓ accepted — counts toward approval
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* peer review comments */}
            <section className="border border-hairline bg-surface rounded-sm">
              <header className="px-4 py-2.5 border-b border-hairline">
                <h3 className="eyebrow">Peer review thread</h3>
              </header>
              <div className="p-4 space-y-3">
                {comments.length === 0 && (
                  <p className="text-[13px] text-ink2">No comments yet.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id}
                       className={`text-[13px] ${c.resolved
                         ? 'opacity-50' : ''}`}>
                    <div className="flex gap-2 items-baseline">
                      <strong className="text-[12.5px]">{c.author}</strong>
                      <span className="text-[11px] text-ink2">
                        {new Date(c.created_at + 'Z')
                          .toLocaleDateString(undefined,
                            { month: 'short', day: 'numeric' })}
                      </span>
                      {!c.resolved ? (
                        <button className="text-[11px] text-accent
                          hover:underline ml-auto"
                          onClick={async () => {
                            await api(`/comments/${c.id}`, {
                              method: 'PATCH',
                              body: { resolved: true } })
                            setComments(await api<Comment[]>(
                              `/content/${cid}/comments`))
                          }}>
                          resolve
                        </button>
                      ) : (
                        <span className="text-[11px] text-ok ml-auto">
                          resolved
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">{c.body}</div>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input className={inputCls} value={comment}
                         placeholder="Add a review note…"
                         onChange={(e) => setComment(e.target.value)}
                         onKeyDown={(e) =>
                           e.key === 'Enter' && postComment()} />
                  <Btn onClick={postComment}
                       disabled={busy === 'c' || !comment.trim()}>
                    Post
                  </Btn>
                </div>
              </div>
            </section>

            {/* version history + diff */}
            {versions.length > 0 && (
              <section className="border border-hairline bg-surface
                rounded-sm">
                <header className="px-4 py-2.5 border-b border-hairline
                  flex justify-between">
                  <h3 className="eyebrow">Version history</h3>
                  <span className="text-[11px] text-ink2">
                    {versions.length} version{versions.length > 1 ? 's' : ''}
                  </span>
                </header>
                <div className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap text-[12px]">
                    {versions.map((v) => (
                      <Badge key={v.version}
                             className="text-ink2 border-hairline">
                        v{v.version} · {v.status}
                      </Badge>
                    ))}
                  </div>
                  {diff && (
                    <details className="mt-3" open={diff.added + diff.removed > 0}>
                      <summary className="eyebrow cursor-pointer">
                        latest diff (+{diff.added} / −{diff.removed})
                      </summary>
                      <pre className="mt-2 font-mono text-[11.5px]
                        bg-paper border border-hairline rounded-sm p-3
                        overflow-x-auto leading-relaxed">
                        {diff.lines.map((l, i) => (
                          <div key={i} className={
                            l.startsWith('+') ? 'text-ok'
                            : l.startsWith('-') ? 'text-critical'
                            : 'text-ink2'}>
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
        )}
      </div>
    </div>
  )
}
