import { useEffect, useState } from 'react'

/**
 * Hero centerpiece: an ASCII "live session" terminal that flows through the
 * BrandGuard story — creator reads the KB, fixes a draft, manager triages
 * findings, manager signs off — then loops.
 *
 * Motion is pure CSS keyframes with per-character stagger delays (deterministic
 * jitter), cross-dissolving outgoing/incoming scenes. No animation library.
 */

type Scene = { role: string; caption: string; art: string[] }

const SCENES: Scene[] = [
  {
    role: 'AS CREATOR',
    caption: 'Creator consults the brand knowledge base before writing.',
    art: [
      '┌ brandguard ──────────────────┐  ___',
      '│ AS CREATOR                   │ (o o)',
      '│ reading brand guidelines     │  \\|/',
      '│                              │  / \\',
      '│  ✓ no superlatives           │',
      '│  ✓ fees always explicit      │',
      '│  ✓ "BrandGuard" capitalised  │',
      '│                              │',
      '│  kb/guidelines · 128 facts   │',
      '│                              │',
      '│ ▸ open draft #1284 …         │',
      '└──────────────────────────────┘',
    ],
  },
  {
    role: 'AS CREATOR',
    caption: 'Creator fixes the flagged claim and re-runs the evaluation.',
    art: [
      '┌ brandguard ──────────────────┐  ___',
      '│ AS CREATOR                   │ (o o)',
      '│ editing draft #1284          │  \\|_',
      '│                              │  / \\',
      '│  "The cheapest rates, ever!" │',
      '│   ^^^^ unverifiable claim    │',
      '│                              │',
      '│  → "Transparent pricing,     │',
      '│     no hidden fees."         │',
      '│                              │',
      '│ ▸ run AI ✓ 3 fixed 0 left    │',
      '└──────────────────────────────┘',
    ],
  },
  {
    role: 'AS MANAGER',
    caption: 'Manager triages every finding — accept or dismiss, with evidence.',
    art: [
      '┌ brandguard ──────────────────┐  ___',
      '│ AS MANAGER                   │ (o.o)',
      '│ triaging findings            │  \\|/',
      '│                              │  / \\_',
      '│  ✓ accept  fees explicit     │',
      '│  ✓ accept  glossary term     │',
      '│  ✗ dismiss tone: informal    │',
      '│                              │',
      '│  evidence: kb/glossary#7     │',
      '│                              │',
      '│  open criticals → 00         │',
      '└──────────────────────────────┘',
    ],
  },
  {
    role: 'AS MANAGER',
    caption: 'Sign-off with zero open criticals — hash-chained audit entry.',
    art: [
      '┌ brandguard ──────────────────┐  ___',
      '│ AS MANAGER                   │ (^_^)',
      '│ sign-off                     │  \\|/',
      '│                              │  / \\',
      '│  [ Approve Draft ]           │',
      '│  ✓ 0 criticals open          │',
      '│                              │',
      '│  audit #a91f · chained       │',
      '│  compliance 94.2% ▲ 2.1      │',
      '│                              │',
      '│ ▸ shipped ✓                  │',
      '└──────────────────────────────┘',
    ],
  },
]

const HOLD = 4800
const STEP = 1.6 // ms of stagger per character index
const JITTER = 110 // ms of deterministic pseudo-random scatter

function delayFor(n: number, total: number, out: boolean): number {
  const jitter = (((n * 9301 + 49297) % 233280) / 233280) * JITTER
  const base = out ? (total - 1 - n) * STEP : n * STEP
  return Math.round(base + jitter)
}

function Art({ scene, out = false }: { scene: Scene; out?: boolean }) {
  const maxLen = Math.max(...scene.art.map((l) => l.length))
  const total = scene.art.length * maxLen
  let n = 0
  return (
    <pre className="font-mono text-[11px] sm:text-xs leading-[1.45] text-muted m-0">
      {scene.art.map((line, r) => (
        <div key={r}>
          {[...line].map((ch, c) => (
            <span
              key={c}
              className={out ? 'ascii-char ascii-char-out' : 'ascii-char'}
              style={{ animationDelay: `${delayFor(n++, total, out)}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
      ))}
    </pre>
  )
}

export function AsciiWorkflow() {
  const [idx, setIdx] = useState(0)
  const [prev, setPrev] = useState(-1)
  const reduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => {
      setPrev(idx)
      setIdx((i) => (i + 1) % SCENES.length)
    }, HOLD)
    return () => clearInterval(t)
  }, [idx, reduced])

  const scene = SCENES[idx]

  return (
    <div className="panel p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-hairline">
        <span className="flex gap-1.5">
          <i className="w-2 h-2 rounded-full bg-surface-3 block" />
          <i className="w-2 h-2 rounded-full bg-surface-3 block" />
          <i className="w-2 h-2 rounded-full bg-surface-3 block" />
        </span>
        <span className="font-mono text-[11px] text-faint">
          brandguard — live session
        </span>
        <span
          key={idx}
          className="ascii-caption ml-auto font-mono text-[10px] uppercase
                     tracking-wider text-accent border border-accent/25
                     bg-accent/10 px-2 py-0.5 rounded"
        >
          {scene.role}
        </span>
      </div>

      <div className="relative min-h-[13.5rem] sm:min-h-[14.5rem]">
        {prev >= 0 && prev !== idx && (
          <div className="absolute inset-0">
            <Art scene={SCENES[prev]} out />
          </div>
        )}
        <Art scene={scene} />
      </div>

      <div
        key={idx}
        className="ascii-caption mt-3 pt-3 border-t border-hairline
                   text-[11px] text-muted"
      >
        {scene.caption}
      </div>
    </div>
  )
}

export default AsciiWorkflow
