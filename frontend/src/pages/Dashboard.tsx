import { useEffect, useState } from 'react'
import { api, msg, type Analytics } from '../api'
import { Bar, Badge, Empty, StatusChip } from '../ui'

const CATS = ['tone', 'term', 'claim', 'a11y', 'visual']
const SEVS = ['critical', 'warning', 'suggestion']

function Kpi({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: string
}) {
  return (
    <div className="border border-hairline bg-surface px-4 py-3.5 rounded-sm">
      <div className="eyebrow">{label}</div>
      <div className={`text-[26px] font-semibold tabular leading-tight mt-1
        ${tone ?? ''}`}>{value}</div>
      {sub && <div className="text-[12px] text-ink2 mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, right, children }: {
  title: string; right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="border border-hairline bg-surface rounded-sm">
      <header className="flex items-center justify-between px-4 py-2.5
        border-b border-hairline">
        <h2 className="eyebrow">{title}</h2>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

// heat cell intensity — one hue, opacity by count (editorial, not rainbow)
function heatStyle(count: number, max: number, sev: string) {
  if (!count) return { background: 'transparent' }
  const a = 0.12 + 0.75 * (count / Math.max(max, 1))
  const rgb = sev === 'critical' ? '190,58,30'
            : sev === 'warning' ? '161,98,7'
            : '87,83,78'
  const light = sev !== 'critical' && a < 0.45
  return {
    background: `rgba(${rgb},${a.toFixed(2)})`,
    color: light || a > 0.55 ? '#fff' : '#16130f',
  }
}

export default function Dashboard() {
  const [d, setD] = useState<Analytics | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Analytics>('/analytics/summary').then(setD)
      .catch((e) => setErr(msg(e)))
  }, [])

  if (err) return <div className="text-critical text-sm">{err}</div>
  if (!d) return <div className="text-sm text-ink2">Loading…</div>

  const heatMax = Math.max(...d.heat_map.map((h) => h.count), 1)
  const ruleMax = d.most_violated_rules[0]?.count ?? 1

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-ink2 mt-0.5">
          Portfolio-wide compliance, at a glance.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Compliance rate" value={`${d.compliance_rate}%`}
             sub={`${d.approved} of ${d.total_content} approved`} />
        <Kpi label="Open criticals"
             value={String(d.findings_by_severity.critical ?? 0)}
             sub="unresolved across all content"
             tone={d.findings_by_severity.critical ? 'text-critical' : ''} />
        <Kpi label="Awaiting review" value={String(d.pending)}
             sub={`${d.overdue_reviews.length} past SLA`}
             tone={d.overdue_reviews.length ? 'text-warning' : ''} />
        <Kpi label="LLM spend" value={d.total_tokens.toLocaleString()}
             sub={`${d.llm_calls} review calls`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* heat map */}
        <Section title="Guideline-gap heat map"
                 right={<span className="text-[11px] text-ink2">
                   category × severity
                 </span>}>
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                <th />
                {SEVS.map((s) => (
                  <th key={s} className="eyebrow pb-2 text-center font-semibold">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATS.map((c) => (
                <tr key={c}>
                  <td className="eyebrow pr-3 text-left py-1">{c}</td>
                  {SEVS.map((s) => {
                    const cell = d.heat_map.find(
                      (h) => h.category === c && h.severity === s)
                    const n = cell?.count ?? 0
                    return (
                      <td key={s} className="p-0.5">
                        <div className="h-9 flex items-center justify-center
                          rounded-sm tabular font-semibold border
                          border-hairline/60"
                             style={heatStyle(n, heatMax, s)}>
                          {n || ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* by team */}
        <Section title="Team compliance">
          {d.by_team.length === 0 ? <Empty>No content yet</Empty> : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-right">Content</th>
                  <th className="pb-2 text-right">Findings</th>
                  <th className="pb-2 text-right">Criticals</th>
                  <th className="pb-2 text-right w-28">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {d.by_team.map((t) => (
                  <tr key={t.team} className="border-t border-hairline">
                    <td className="py-2 font-medium">{t.team}</td>
                    <td className="py-2 text-right tabular">{t.total}</td>
                    <td className="py-2 text-right tabular">{t.findings}</td>
                    <td className="py-2 text-right tabular
                      text-critical font-medium">
                      {t.criticals || '—'}
                    </td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <Bar value={t.compliance_rate} max={100}
                             tone={t.compliance_rate >= 70 ? 'ink'
                                   : 'critical'} />
                        <span className="tabular text-[12px] w-10 text-right">
                          {t.compliance_rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* overdue SLA */}
        <Section title="Overdue reviews"
                 right={<Badge className={d.overdue_reviews.length
                   ? 'bg-orange-50 text-accent border-accent/40'
                   : 'text-ink2 border-hairline'}>
                   {d.overdue_reviews.length}
                 </Badge>}>
          {d.overdue_reviews.length === 0
            ? <Empty>Nothing past SLA — all reviews on time</Empty>
            : (
              <ul className="divide-y divide-hairline text-[13px]">
                {d.overdue_reviews.map((o) => (
                  <li key={o.id} className="py-2 flex items-center gap-3">
                    <a href={`#/review/${o.id}`}
                       className="flex-1 truncate hover:text-accent
                         hover:underline">
                      {o.title}
                    </a>
                    <StatusChip status={o.status} />
                    <span className="tabular text-critical text-[12px]
                      font-medium w-24 text-right">
                      {o.hours_late}h late
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        {/* stale facts */}
        <Section title="Stale facts — re-verify before claiming"
                 right={<span className="text-[11px] text-ink2">
                   &gt; 90 days
                 </span>}>
          {d.stale_facts.length === 0
            ? <Empty>Fact store is fresh</Empty>
            : (
              <ul className="divide-y divide-hairline text-[13px]">
                {d.stale_facts.map((f) => (
                  <li key={f.id} className="py-2.5">
                    <div className="flex gap-3 items-baseline">
                      <span className="flex-1">{f.claim}</span>
                      <span className="tabular text-[12px] text-warning
                        font-medium shrink-0">
                        {f.days_old}d
                      </span>
                    </div>
                    <div className="text-[11px] text-ink2 mt-0.5">
                      {f.source} · verified {f.verified_at}
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Section>
      </div>

      {/* most violated rules */}
      <Section title="Most violated rules">
        {d.most_violated_rules.length === 0
          ? <Empty>No findings recorded yet</Empty>
          : (
            <ul className="space-y-2.5">
              {d.most_violated_rules.slice(0, 8).map((r) => (
                <li key={r.rule} className="grid grid-cols-[1fr_120px_40px]
                  gap-3 items-center text-[13px]">
                  <span className="truncate" title={r.rule}>{r.rule}</span>
                  <Bar value={r.count} max={ruleMax} tone="accent" />
                  <span className="tabular text-right text-ink2 text-[12px]">
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Section>
    </div>
  )
}
