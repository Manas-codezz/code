import { useEffect, useState } from 'react'
import { api, loadAuth, msg, type Analytics, type Content, type User } from '../api'
import { Bar, Badge, Empty, StatusChip } from '../ui'
import { AlertCircle, AlertTriangle, CheckCircle2, Cpu, FileText, TrendingUp } from 'lucide-react'

const CATS = ['tone', 'term', 'claim', 'a11y', 'visual']
const SEVS = ['critical', 'warning', 'suggestion']

function Kpi({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
  icon?: React.ElementType
}) {
  return (
    <div className="relative bg-white/[0.03] border border-white/10 p-5 rounded-2xl backdrop-blur-xl shadow-lg hover:border-white/20 transition-all duration-200 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
      </div>
      <div className={`text-3xl font-black tabular-nums tracking-tight mt-2 text-white ${tone ?? ''}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </div>
  )
}

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-lg">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.01]">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          {title}
        </h2>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

// Sleek dark-mode heat cell styling with glowing transparency
function heatStyle(count: number, max: number, sev: string) {
  if (!count) return { background: 'rgba(255,255,255,0.02)', color: '#71717a' }
  const a = 0.15 + 0.8 * (count / Math.max(max, 1))
  const rgb = sev === 'critical' ? '239,68,68'
            : sev === 'warning' ? '245,158,11'
            : '161,161,170'
  return {
    background: `rgba(${rgb},${a.toFixed(2)})`,
    color: '#ffffff',
    boxShadow: `0 0 12px rgba(${rgb},0.25)`,
  }
}

function PersonalDashboard({ user }: { user: User }) {
  const [rows, setRows] = useState<Content[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Content[]>('/content').then(setRows).catch((e) => setErr(msg(e)))
  }, [])

  if (err) return <div className="text-red-400 text-sm p-4 bg-red-950/30 rounded-xl border border-red-500/20">{err}</div>
  if (!rows) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-400 gap-3">
        <span className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  // Creators see their own submissions; reviewers see the whole queue.
  const mine = user.role === 'creator'
    ? rows.filter((r) => r.created_by === user.email)
    : rows
  const approved = mine.filter((r) => r.status === 'approved' || r.status === 'published').length
  const pending = mine.filter((r) => ['draft', 'review', 'peer_review'].includes(r.status)).length
  const changes = mine.filter((r) => r.status === 'changes').length
  const rate = mine.length ? Math.round((approved / mine.length) * 100) : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Your Workspace</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {user.role === 'creator'
              ? 'Your submissions and their review status.'
              : 'Content awaiting your review and its current status.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-400 capitalize">
          <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
          {user.role}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Submissions" value={String(mine.length)} sub="In your scope" icon={FileText} />
        <Kpi label="Approved" value={String(approved)} sub={`${rate}% approval rate`} tone="text-emerald-400" icon={CheckCircle2} />
        <Kpi label="Awaiting Review" value={String(pending)} sub="Pending a decision" tone={pending ? 'text-amber-400' : 'text-zinc-200'} icon={AlertTriangle} />
        <Kpi label="Changes Requested" value={String(changes)} sub="Needs edits" tone={changes ? 'text-red-400' : 'text-zinc-200'} icon={AlertCircle} />
      </div>

      <Section title="Content">
        {mine.length === 0 ? (
          <Empty>No content in your scope yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase tracking-wider text-[11px] border-b border-white/10">
                  <th className="pb-2.5 text-left font-semibold">Title</th>
                  <th className="pb-2.5 text-left font-semibold">Channel</th>
                  <th className="pb-2.5 text-left font-semibold">Author</th>
                  <th className="pb-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mine.slice(0, 25).map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-semibold text-white max-w-[22rem] truncate">{r.title}</td>
                    <td className="py-3 text-zinc-300 capitalize">{r.channel}</td>
                    <td className="py-3 text-zinc-400">{r.created_by}</td>
                    <td className="py-3 text-right"><StatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

export default function Dashboard() {
  const user = loadAuth()?.user
  if (!user) return null
  if (user.role !== 'manager' && user.role !== 'admin') {
    return <PersonalDashboard user={user} />
  }
  return <ManagerDashboard />
}

function ManagerDashboard() {
  const [d, setD] = useState<Analytics | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Analytics>('/analytics/summary').then(setD)
      .catch((e) => setErr(msg(e)))
  }, [])

  if (err) return <div className="text-red-400 text-sm p-4 bg-red-950/30 rounded-xl border border-red-500/20">{err}</div>
  if (!d) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-400 gap-3">
        <span className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        <span>Loading compliance analytics…</span>
      </div>
    )
  }

  const heatMax = Math.max(...d.heat_map.map((h) => h.count), 1)
  const ruleMax = d.most_violated_rules[0]?.count ?? 1

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Compliance Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Portfolio-wide copy compliance metrics, AI audit logs, and SLA monitors.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Live Governance Active
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Compliance Rate"
          value={`${d.compliance_rate}%`}
          sub={`${d.approved} of ${d.total_content} drafts approved`}
          tone="text-emerald-400"
          icon={TrendingUp}
        />
        <Kpi
          label="Open Criticals"
          value={String(d.findings_by_severity.critical ?? 0)}
          sub="Requires resolution before publishing"
          tone={d.findings_by_severity.critical ? 'text-red-400' : 'text-zinc-200'}
          icon={AlertCircle}
        />
        <Kpi
          label="Awaiting Review"
          value={String(d.pending)}
          sub={`${d.overdue_reviews.length} currently past SLA limit`}
          tone={d.overdue_reviews.length ? 'text-amber-400' : 'text-zinc-200'}
          icon={AlertTriangle}
        />
        <Kpi
          label="LLM Compute Spend"
          value={d.total_tokens.toLocaleString()}
          sub={`${d.llm_calls} automated review passes`}
          tone="text-orange-400"
          icon={Cpu}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Guideline-gap Heat Map */}
        <Section
          title="Guideline-Gap Heat Map"
          right={<span className="text-[11px] text-zinc-400">category × severity</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="pb-3 text-left font-semibold text-zinc-500 uppercase">Category</th>
                  {SEVS.map((s) => (
                    <th key={s} className="pb-3 text-center font-semibold text-zinc-400 uppercase tracking-wider">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {CATS.map((c) => (
                  <tr key={c}>
                    <td className="pr-3 text-left py-2 font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
                      {c}
                    </td>
                    {SEVS.map((s) => {
                      const cell = d.heat_map.find((h) => h.category === c && h.severity === s)
                      const n = cell?.count ?? 0
                      return (
                        <td key={s} className="p-1">
                          <div
                            className="h-10 flex items-center justify-center rounded-lg tabular-nums font-bold border border-white/10 transition-all duration-200"
                            style={heatStyle(n, heatMax, s)}
                          >
                            {n || '·'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Team Compliance */}
        <Section title="Team Compliance Performance">
          {d.by_team.length === 0 ? (
            <Empty>No content submitted by any team yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-400 uppercase tracking-wider text-[11px] border-b border-white/10">
                    <th className="pb-2.5 text-left font-semibold">Team</th>
                    <th className="pb-2.5 text-right font-semibold">Content</th>
                    <th className="pb-2.5 text-right font-semibold">Findings</th>
                    <th className="pb-2.5 text-right font-semibold">Criticals</th>
                    <th className="pb-2.5 text-right font-semibold w-32">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {d.by_team.map((t) => (
                    <tr key={t.team} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-semibold text-white">{t.team}</td>
                      <td className="py-3 text-right tabular-nums text-zinc-300">{t.total}</td>
                      <td className="py-3 text-right tabular-nums text-zinc-300">{t.findings}</td>
                      <td className="py-3 text-right tabular-nums font-semibold text-red-400">
                        {t.criticals || '—'}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <Bar
                            value={t.compliance_rate}
                            max={100}
                            tone={t.compliance_rate >= 70 ? 'accent' : 'critical'}
                          />
                          <span className="tabular-nums text-xs text-right text-zinc-300 w-10 font-medium">
                            {t.compliance_rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Overdue SLA */}
        <Section
          title="Overdue Reviews"
          right={
            <Badge
              className={
                d.overdue_reviews.length
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'text-zinc-400 border-white/10'
              }
            >
              {d.overdue_reviews.length} past due
            </Badge>
          }
        >
          {d.overdue_reviews.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>All draft reviews are within SLA response windows.</span>
            </div>
          ) : (
            <ul className="divide-y divide-white/5 text-xs">
              {d.overdue_reviews.map((o) => (
                <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                  <a
                    href={`#/review/${o.id}`}
                    className="flex-1 truncate font-medium text-zinc-200 hover:text-orange-400 transition-colors"
                  >
                    {o.title}
                  </a>
                  <StatusChip status={o.status} />
                  <span className="tabular-nums text-red-400 font-semibold text-[11px] shrink-0">
                    {o.hours_late}h overdue
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Stale Facts Alert */}
        <Section
          title="Fact Store Verification"
          right={<span className="text-[11px] text-zinc-400">&gt; 90 days since verification</span>}
        >
          {d.stale_facts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>Fact store claims are fresh and verified.</span>
            </div>
          ) : (
            <ul className="divide-y divide-white/5 text-xs">
              {d.stale_facts.map((f) => (
                <li key={f.id} className="py-3 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                  <div className="flex gap-3 items-baseline justify-between">
                    <span className="text-zinc-200 font-medium">{f.claim}</span>
                    <span className="tabular-nums text-xs text-amber-400 font-semibold shrink-0">
                      {f.days_old}d old
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                    <span>Source: {f.source}</span>
                    <span>·</span>
                    <span>Verified: {f.verified_at}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Most Violated Rules */}
      <Section title="Frequently Violated Guidelines">
        {d.most_violated_rules.length === 0 ? (
          <Empty>No guideline violations recorded across content drafts.</Empty>
        ) : (
          <div className="space-y-3">
            {d.most_violated_rules.slice(0, 8).map((r, i) => (
              <div
                key={r.rule}
                className="grid grid-cols-[auto_1fr_120px_45px] gap-4 items-center text-xs p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
              >
                <span className="w-5 text-zinc-500 font-mono text-[11px]">{i + 1}.</span>
                <span className="truncate font-medium text-zinc-200" title={r.rule}>
                  {r.rule}
                </span>
                <Bar value={r.count} max={ruleMax} tone="accent" />
                <span className="tabular-nums text-right font-bold text-orange-400 text-xs">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
