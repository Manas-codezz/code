import { useState, useEffect } from 'react'
import {
  Compass, CheckCircle2, ArrowRight, ArrowLeft, X, Minimize2,
  Maximize2, RefreshCw
} from 'lucide-react'
import { type User } from '@/api'

export interface RoleTourGuideProps {
  currentUser: User | null
  isOpen: boolean
  onClose: () => void
  onSwitchRole: (role: 'creator' | 'reviewer' | 'manager' | 'admin') => Promise<void>
}

type Stage = 'overview' | 'creator' | 'reviewer' | 'manager' | 'admin' | 'completed'

interface StepInfo {
  role: 'creator' | 'reviewer' | 'manager' | 'admin' | null
  title: string
  subtitle: string
  badge: string
  description: string
  highlights: string[]
  actionHint: string
  targetRoute?: string
}

const STAGES: Record<Stage, StepInfo> = {
  overview: {
    role: null,
    title: 'BrandGuard AI Compliance Tour',
    subtitle: 'The 4-Role Governed Lifecycle',
    badge: 'Introduction',
    description:
      'BrandGuard enforces strict role-based governance to ensure marketing copy is advisory-screened by AI, triaged by reviewers, approved only by managers, and audited by admins.',
    highlights: [
      'Step 1: Creator drafts copy & triggers AI review',
      'Step 2: Reviewer inspects citations & triages findings',
      'Step 3: Manager unblocks gated approval & updates KB',
      'Step 4: Admin verifies hash-chained audit trails',
    ],
    actionHint: 'Start with the Creator role to submit a brand draft.',
  },
  creator: {
    role: 'creator',
    title: 'Role 1: Creator',
    subtitle: 'Draft Authoring & AI Submission',
    badge: 'Step 1 of 4',
    description:
      'Creators write and submit campaign copy across Web, Email, and Social. When ready, they trigger the autonomous AI evaluation.',
    highlights: [
      'Submit new draft via Review Queue',
      'Trigger AI Evaluation with governed LLM & rule engine',
      'Under-guard check: Creators cannot Accept/Dismiss or Self-Approve!',
    ],
    actionHint: 'Switch to Creator and see the submission workflow.',
    targetRoute: '#/review',
  },
  reviewer: {
    role: 'reviewer',
    title: 'Role 2: Reviewer',
    subtitle: 'Evidence Inspection & Finding Triage',
    badge: 'Step 2 of 4',
    description:
      'Reviewers inspect AI-flagged findings, verify citations against the Knowledge Base, and mark findings as Accepted or Dismissed.',
    highlights: [
      'Inspect findings with category, confidence, and exact evidence',
      'Accept or Dismiss findings to resolve compliance items',
      'Cannot approve drafts yet (Approve button stays hidden/gated)',
    ],
    actionHint: 'Switch to Reviewer to triage flagged compliance findings.',
    targetRoute: '#/review',
  },
  manager: {
    role: 'manager',
    title: 'Role 3: Manager',
    subtitle: 'Approval Gate & Living Brand Book',
    badge: 'Step 3 of 4',
    description:
      'Managers hold the ultimate shipping authority. Approval is strictly locked until all critical findings are triaged. Managers also manage the brand Knowledge Base.',
    highlights: [
      'Gated Approval: "Approve Draft" button activates only with 0 critical blockers',
      'Add & delete rules, facts, glossary terms in Knowledge Base',
      'Request changes and collaborate via threaded review comments',
    ],
    actionHint: 'Switch to Manager to experience approval gating & KB editing.',
    targetRoute: '#/review',
  },
  admin: {
    role: 'admin',
    title: 'Role 4: Admin',
    subtitle: 'Governance & Cryptographic Audit',
    badge: 'Step 4 of 4',
    description:
      'Admins supervise team access, provision accounts, and verify the immutable SHA-256 hash-chained audit log of all system actions.',
    highlights: [
      'Full visibility into all content, teams, and SLAs',
      'Cryptographic audit verification (zero unlogged actions)',
      'Provision and manage organizational roles',
    ],
    actionHint: 'Switch to Admin to inspect full platform governance.',
    targetRoute: '#/dashboard',
  },
  completed: {
    role: null,
    title: 'Workflow Tour Complete!',
    subtitle: 'You have mastered the governed lifecycle',
    badge: 'Complete',
    description:
      'You have explored all 4 roles: Creator → Reviewer → Manager → Admin. Feel free to continue testing drafts, editing guidelines, or re-running evaluations.',
    highlights: [
      'Tested: Autonomous AI review against living guidelines',
      'Tested: Strict 2-tier RBAC (UI + API enforcement)',
      'Tested: Zero-bypass compliance gates before publishing',
    ],
    actionHint: 'You can re-launch this tour anytime from the top bar.',
  },
}

const STAGE_ORDER: Stage[] = ['overview', 'creator', 'reviewer', 'manager', 'admin', 'completed']

export default function RoleTourGuide({
  currentUser,
  isOpen,
  onClose,
  onSwitchRole,
}: RoleTourGuideProps) {
  const [currentStage, setCurrentStage] = useState<Stage>('overview')
  const [isMinimized, setIsMinimized] = useState(false)
  const [switching, setSwitching] = useState(false)

  // Sync stage to user role if user switches manually outside
  useEffect(() => {
    if (!currentUser) return
    if (['creator', 'reviewer', 'manager', 'admin'].includes(currentUser.role)) {
      // Keep current stage if it matches, otherwise allow user to jump
    }
  }, [currentUser])

  if (!isOpen) return null

  const stageIdx = STAGE_ORDER.indexOf(currentStage)
  const stageData = STAGES[currentStage]
  const progressPercent = Math.round((stageIdx / (STAGE_ORDER.length - 1)) * 100)

  const handleNext = () => {
    if (stageIdx < STAGE_ORDER.length - 1) {
      setCurrentStage(STAGE_ORDER[stageIdx + 1])
    }
  }

  const handlePrev = () => {
    if (stageIdx > 0) {
      setCurrentStage(STAGE_ORDER[stageIdx - 1])
    }
  }

  const handleRoleSwitch = async (role: 'creator' | 'reviewer' | 'manager' | 'admin') => {
    setSwitching(true)
    try {
      await onSwitchRole(role)
      if (stageData.targetRoute) {
        window.location.hash = stageData.targetRoute
      }
    } finally {
      setSwitching(false)
    }
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-surface-2 border border-hairline-strong text-ink shadow-2xl hover:border-accent transition-all cursor-pointer backdrop-blur-md"
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-semibold">
            Tour: {stageData.badge}
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-muted ml-1" />
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="Workflow Guide Tour"
      className="fixed bottom-5 right-5 z-50 w-full max-w-md bg-surface border border-hairline-strong rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Top Header */}
      <div className="px-4 py-3 bg-surface-2/80 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent/15 border border-accent/30 grid place-items-center text-accent">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-accent font-mono">
            Guided Role Walkthrough
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize tour"
            className="p-1.5 text-muted hover:text-ink rounded hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="Close tour"
            className="p-1.5 text-muted hover:text-danger rounded hover:bg-danger/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-surface-3 w-full">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content */}
      <div className="p-5 space-y-4">
        {/* Stage Badge & Current Session */}
        <div className="flex items-center justify-between text-xs">
          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-accent font-semibold font-mono text-[11px]">
            {stageData.badge}
          </span>
          {currentUser && (
            <span className="text-muted flex items-center gap-1.5">
              Active: <strong className="text-ink capitalize">{currentUser.role}</strong>
              <span className="w-1.5 h-1.5 rounded-full bg-sage inline-block" />
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="text-base font-bold text-ink tracking-tight">
            {stageData.title}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {stageData.subtitle}
          </p>
        </div>

        {/* Description */}
        <p className="text-xs text-ink/90 leading-relaxed bg-surface-2/60 p-3 rounded-lg border border-hairline">
          {stageData.description}
        </p>

        {/* Highlights Checklist */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Role Workflow Highlights:
          </div>
          {stageData.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" />
              <span>{h}</span>
            </div>
          ))}
        </div>

        {/* Interactive Action Prompt */}
        {stageData.role && (
          <div className="pt-2">
            <button
              onClick={() => stageData.role && handleRoleSwitch(stageData.role)}
              disabled={switching || currentUser?.role === stageData.role}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                currentUser?.role === stageData.role
                  ? 'bg-sage/10 text-sage border-sage/30 cursor-default'
                  : 'bg-accent/15 text-accent border-accent/40 hover:bg-accent/25 shadow-sm'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${switching ? 'animate-spin' : ''}`} />
              <span>
                {currentUser?.role === stageData.role
                  ? `✓ You are currently viewing as ${stageData.role}`
                  : `Switch to ${stageData.role} & open workspace`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-5 py-3.5 bg-surface-2/60 border-t border-hairline flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={stageIdx === 0}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Previous
        </button>

        <div className="flex gap-1.5">
          {STAGE_ORDER.map((s, idx) => (
            <button
              key={s}
              onClick={() => setCurrentStage(s)}
              aria-label={`Jump to ${s}`}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                idx === stageIdx ? 'w-5 bg-accent' : 'bg-surface-3 hover:bg-muted'
              }`}
            />
          ))}
        </div>

        {stageIdx < STAGE_ORDER.length - 1 ? (
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors cursor-pointer"
          >
            Next
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage hover:text-sage/80 transition-colors cursor-pointer"
          >
            Finish
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
