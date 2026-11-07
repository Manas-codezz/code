/* Shared primitives — modern dark glassmorphic system. */
import type { ReactNode } from 'react'

export const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
  suggestion: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
}

export const STATUS_STYLE: Record<string, string> = {
  draft: 'text-zinc-400 border-white/10 bg-white/[0.03]',
  review: 'text-amber-300 border-amber-500/30 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
  peer_review: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  changes: 'text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-[0_0_8px_rgba(249,115,22,0.15)]',
  approved: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]',
  published: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
}

export function Badge({ children, className = '' }: {
  children: ReactNode; className?: string
}) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5
      text-[10px] font-semibold uppercase tracking-wider rounded-md backdrop-blur-md
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
  const base = `px-3.5 py-1.5 text-[13px] font-medium border rounded-lg
    transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer`
  const kinds = {
    primary: 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white border-orange-500/40 shadow-[0_0_20px_rgba(219,75,22,0.3)]',
    ghost: 'bg-white/[0.04] text-zinc-200 border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:text-white',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50',
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
      <span className="eyebrow block mb-1.5 text-zinc-300">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = `w-full border border-white/10 bg-white/[0.04] text-white px-3.5 py-2
  text-sm rounded-lg placeholder:text-zinc-500 focus:border-orange-500/80
  focus:ring-1 focus:ring-orange-500/40 focus:outline-none transition-all`

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-white/10 bg-white/[0.01] rounded-xl
      px-4 py-8 text-center text-sm text-zinc-400">
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

/** CSS bar — width as % of max. */
export function Bar({ value, max, tone = 'ink' }: {
  value: number; max: number; tone?: 'ink' | 'accent' | 'critical'
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = {
    ink: 'bg-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.3)]',
    accent: 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
    critical: 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  }[tone]
  return (
    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-[width]`}
           style={{ width: `${pct}%` }} />
    </div>
  )
}
