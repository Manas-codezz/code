/* Shared primitives — hairline editorial system, no deps. */
import type { ReactNode } from 'react'

export const SEV_STYLE: Record<string, string> = {
  critical: 'bg-critical text-white border-critical',
  warning: 'bg-amber-50 text-warning border-warning/40',
  suggestion: 'bg-transparent text-suggestion border-hairline',
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'text-ink2 border-hairline bg-transparent',
  review: 'text-warning border-warning/40 bg-amber-50',
  peer_review: 'text-warning border-warning/40 bg-amber-50',
  changes: 'text-accent border-accent/40 bg-orange-50',
  approved: 'text-ok border-ok/40 bg-green-50',
  published: 'text-ok border-ok/40 bg-green-50',
}

export function Badge({ children, className = '' }: {
  children: ReactNode; className?: string
}) {
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5
      text-[10px] font-semibold uppercase tracking-wider rounded-sm
      ${className}`}>{children}</span>
  )
}

export function Btn({ children, onClick, kind = 'ghost', disabled,
                      type = 'button', className = '', title }: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  const base = `px-3 py-1.5 text-[13px] font-medium border rounded-sm
    transition-colors disabled:opacity-40 disabled:cursor-not-allowed`
  const kinds = {
    primary: 'bg-accent text-white border-accent hover:bg-[#c4420f]',
    ghost: 'bg-surface text-ink border-hairline hover:bg-paper',
    danger: 'bg-transparent text-critical border-critical/40 hover:bg-red-50',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
            className={`${base} ${kinds[kind]} ${className}`}>
      {children}
    </button>
  )
}

export function Field({ label, children }: {
  label: string; children: ReactNode
}) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = `w-full border border-hairline bg-surface px-3 py-2
  text-sm rounded-sm placeholder:text-ink2/60 focus:border-ink
  focus:outline-none`

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-hairline rounded-sm
      px-4 py-8 text-center text-sm text-ink2">
      {children}
    </div>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge className={SEV_STYLE[severity] ?? SEV_STYLE.suggestion}>
    {severity}
  </Badge>
}

export function StatusChip({ status }: { status: string }) {
  return <Badge className={STATUS_STYLE[status] ?? STATUS_STYLE.draft}>
    {status.replace('_', ' ')}
  </Badge>
}

/** CSS bar — no chart library. width as % of max. */
export function Bar({ value, max, tone = 'ink' }: {
  value: number; max: number; tone?: 'ink' | 'accent' | 'critical'
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = { ink: 'bg-ink', accent: 'bg-accent',
                  critical: 'bg-critical' }[tone]
  return (
    <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-[width]`}
           style={{ width: `${pct}%` }} />
    </div>
  )
}
