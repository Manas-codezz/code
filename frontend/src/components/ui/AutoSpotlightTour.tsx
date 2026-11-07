import { useState, useEffect } from 'react'
import {
  Sparkles, ArrowRight, ArrowLeft, X,
  CheckCircle2, Compass
} from 'lucide-react'
import { type User } from '@/api'

export interface TourStep {
  id: string
  title: string
  subtitle: string
  description: string
  role: 'guest' | 'creator' | 'reviewer' | 'manager' | 'admin'
  route: string
  targetSelector?: string
  instruction: string
  badge: string
}

export const AUTO_TOUR_STEPS: TourStep[] = [
  {
    id: 'hero-welcome',
    title: 'Welcome to BrandGuard AI',
    subtitle: 'The Governed Compliance Platform',
    description:
      'Autonomous brand compliance starts right here. Notice how you are invited to explore the full lifecycle using instant demo credentials without setup.',
    role: 'guest',
    route: '#/hero',
    targetSelector: '[data-tour="hero-demo-btn"]',
    instruction: 'Click "Try a demo role" to enter the login center.',
    badge: 'Step 1: Hero Landing',
  },
  {
    id: 'login-creator',
    title: 'Select Role: Creator',
    subtitle: 'Step 1 of the Lifecycle',
    description:
      'BrandGuard provides one-click demo access for each actor in the brand chain. Creators draft marketing copy and submit it for autonomous AI analysis.',
    role: 'guest',
    route: '#/login',
    targetSelector: '[data-tour="demo-creator-btn"]',
    instruction: 'Select Creator to begin drafting and evaluating brand copy.',
    badge: 'Step 2: Creator Authentication',
  },
  {
    id: 'creator-eval',
    title: 'Creator: AI Review Submission',
    subtitle: 'Run Autonomous Compliance Review',
    description:
      'As a Creator, you submit content and trigger governed LLM evaluations. Notice the strict boundary: Creators cannot accept or dismiss findings, nor can they self-approve drafts.',
    role: 'creator',
    route: '#/review/1',
    targetSelector: '[data-tour="run-eval-btn"]',
    instruction: 'Creators can run or re-run evaluations, but finding triage is locked.',
    badge: 'Step 3: Creator Workflow',
  },
  {
    id: 'reviewer-triage',
    title: 'Role 2: Reviewer Finding Triage',
    subtitle: 'Evidence Inspection & Resolution',
    description:
      'Reviewers inspect AI-flagged violations citing exact brand rules. Reviewers can Accept or Dismiss findings, but cannot Approve the overall draft.',
    role: 'reviewer',
    route: '#/review/1',
    targetSelector: '[data-tour="findings-list"]',
    instruction: 'Reviewers resolve citations. Notice that "Approve Draft" remains hidden.',
    badge: 'Step 4: Reviewer Workflow',
  },
  {
    id: 'manager-approve',
    title: 'Role 3: Manager Gated Approval',
    subtitle: 'Zero Critical Blockers Gate',
    description:
      'Managers hold ultimate shipping authority. Approval is strictly blocked until all critical findings are resolved. Managers also manage the living brand Knowledge Base.',
    role: 'manager',
    route: '#/review/1',
    targetSelector: '[data-tour="approve-draft-btn"]',
    instruction: 'The "Approve Draft" button activates only after all blockers are cleared.',
    badge: 'Step 5: Manager Approval Gate',
  },
  {
    id: 'admin-governance',
    title: 'Role 4: Admin Governance & Audit',
    subtitle: 'Full System Oversight & SHA-256 Audit',
    description:
      'Admins supervise team access and verify the cryptographic SHA-256 hash-chained audit trail where zero actions go unlogged.',
    role: 'admin',
    route: '#/dashboard',
    targetSelector: '[data-tour="audit-panel"]',
    instruction: 'You have completed the full 4-role guided walkthrough!',
    badge: 'Step 6: Admin Audit Trail',
  },
]

interface AutoSpotlightTourProps {
  currentUser: User | null
  isActive: boolean
  onClose: () => void
  onSwitchRole: (role: 'creator' | 'reviewer' | 'manager' | 'admin') => Promise<void>
}

export default function AutoSpotlightTour({
  currentUser,
  isActive,
  onClose,
  onSwitchRole,
}: AutoSpotlightTourProps) {
  const [stepIndex, setStepIndex] = useState(() => {
    const isHero = typeof window !== 'undefined' && (
      window.location.hash.replace(/^#\/?/, '').split('/')[0] === 'hero' || window.location.hash === ''
    )
    if (isHero) return 0
    const saved = sessionStorage.getItem('brandguard_tour_step')
    return saved ? parseInt(saved, 10) || 0 : 0
  })
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)

  const currentStep = AUTO_TOUR_STEPS[stepIndex]

  const updateStep = (idx: number) => {
    setStepIndex(idx)
    sessionStorage.setItem('brandguard_tour_step', String(idx))
  }

  // When tour becomes active on the hero page, always restart at step 0
  useEffect(() => {
    const isHero = typeof window !== 'undefined' && (
      window.location.hash.replace(/^#\/?/, '').split('/')[0] === 'hero' || window.location.hash === ''
    )
    if (isActive && isHero) {
      setStepIndex(0)
      sessionStorage.setItem('brandguard_tour_step', '0')
    }
  }, [isActive])

  // Scroll target into view once when step changes
  useEffect(() => {
    if (!isActive || !currentStep.targetSelector) return
    const el = document.querySelector(currentStep.targetSelector)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isActive, stepIndex, currentStep])

  // Track target selector position on resize, scroll, and interval
  useEffect(() => {
    if (!isActive) {
      setHighlightRect(null)
      return
    }

    const updateRect = () => {
      if (!currentStep.targetSelector) {
        setHighlightRect(null)
        return
      }
      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        setHighlightRect(el.getBoundingClientRect())
      } else {
        setHighlightRect(null)
      }
    }

    updateRect()
    const interval = setInterval(updateRect, 200)
    window.addEventListener('resize', updateRect, { passive: true })
    window.addEventListener('scroll', updateRect, { passive: true })

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [isActive, currentStep, stepIndex])

  // Advance step automatically if user directly navigates to the next step's route
  useEffect(() => {
    if (!isActive) return
    const handleHash = () => {
      const h = window.location.hash
      if (h.includes('login') && stepIndex === 0) {
        updateStep(1)
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [isActive, stepIndex])

  if (!isActive) return null

  const handleNext = async () => {
    if (stepIndex < AUTO_TOUR_STEPS.length - 1) {
      const nextStep = AUTO_TOUR_STEPS[stepIndex + 1]
      if (nextStep.role !== 'guest' && currentUser?.role !== nextStep.role) {
        await onSwitchRole(nextStep.role)
      }
      updateStep(stepIndex + 1)
      if (nextStep.route) {
        window.location.hash = nextStep.route
      }
    } else {
      sessionStorage.removeItem('brandguard_tour_step')
      onClose()
    }
  }

  const handlePrev = async () => {
    if (stepIndex > 0) {
      const prevStep = AUTO_TOUR_STEPS[stepIndex - 1]
      if (prevStep.role !== 'guest' && currentUser?.role !== prevStep.role) {
        await onSwitchRole(prevStep.role)
      }
      updateStep(stepIndex - 1)
      if (prevStep.route) {
        window.location.hash = prevStep.route
      }
    }
  }

  // Calculate cutout hole dimensions with padding around highlighted element
  const pad = 8
  const x1 = highlightRect ? Math.max(0, Math.floor(highlightRect.left - pad)) : 0
  const y1 = highlightRect ? Math.max(0, Math.floor(highlightRect.top - pad)) : 0
  const x2 = highlightRect ? Math.min(window.innerWidth, Math.ceil(highlightRect.right + pad)) : 0
  const y2 = highlightRect ? Math.min(window.innerHeight, Math.ceil(highlightRect.bottom + pad)) : 0
  const w = Math.max(0, x2 - x1)
  const h = Math.max(0, y2 - y1)
  const r = Math.min(10, Math.max(0, w / 4), Math.max(0, h / 4))

  // Inverted polygon cutout via evenodd fill rule:
  // Outer viewport rectangle + inner highlighted element hole.
  // The backdrop blur and tint render strictly OUTSIDE this hole,
  // leaving the highlighted content 100% crisp, clear, and unblurred.
  const clipPathStyle = highlightRect
    ? `polygon(evenodd, 0px 0px, 100vw 0px, 100vw 100vh, 0px 100vh, 0px 0px, ${x1 + r}px ${y1}px, ${x2 - r}px ${y1}px, ${x2}px ${y1 + r}px, ${x2}px ${y2 - r}px, ${x2 - r}px ${y2}px, ${x1 + r}px ${y2}px, ${x1}px ${y2 - r}px, ${x1}px ${y1 + r}px, ${x1 + r}px ${y1}px)`
    : undefined

  // Position tour card so it never overlaps the highlighted target
  const cardInBottomRight = Boolean(highlightRect && y2 > window.innerHeight - 360 && x2 > window.innerWidth - 480)
  const cardPlacementStyle: React.CSSProperties = cardInBottomRight
    ? { top: '24px', right: '24px' }
    : { bottom: '24px', right: '24px' }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* 
        Full-Screen Backdrop Shield with Cutout Hole:
        The cutout hole leaves the targeted element 100% sharp and crystal clear
        while the entire surrounding page is dimmed and blurred.
        Pointer-events-auto ensures clicks outside the cutout are caught by the backdrop,
        while clicks inside the cutout pass directly through to the highlighted element.
      */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-[4px] pointer-events-auto transition-[clip-path] duration-200"
        style={{
          clipPath: clipPathStyle,
          WebkitClipPath: clipPathStyle,
        }}
      />

      {/* Spotlight Border and Ping Pill over Target Element */}
      {highlightRect && (
        <div
          className="fixed pointer-events-none rounded-xl border-2 border-accent shadow-[0_0_0_1px_rgba(163,147,191,0.3),0_0_30px_rgba(163,147,191,0.45)] z-[10000] transition-all duration-150"
          style={{
            top: `${y1}px`,
            left: `${x1}px`,
            width: `${w}px`,
            height: `${h}px`,
          }}
        >
          {/* Step badge on top-right of highlighted box */}
          <div className="absolute -top-3.5 -right-3.5 flex h-7 w-7 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-7 w-7 bg-accent text-canvas font-bold text-xs items-center justify-center shadow-lg border border-white/20">
              {stepIndex + 1}
            </span>
          </div>
        </div>
      )}

      {/* Floating Guided Tour Card */}
      <div
        className="fixed z-[10001] pointer-events-auto max-w-md w-full bg-surface border border-hairline-strong rounded-xl shadow-2xl p-5 text-ink transition-all duration-300"
        style={cardPlacementStyle}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent/20 border border-accent/40 grid place-items-center text-accent">
              <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <span className="text-xs font-bold tracking-wider uppercase font-mono text-accent">
              Guided Interactive Tour
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-ink px-2.5 py-1 rounded bg-surface-2 border border-hairline hover:border-accent/40 transition-colors flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>Skip Tour</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Badge & Progress */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-accent font-semibold font-mono text-[11px]">
            {currentStep.badge}
          </span>
          <span className="text-muted font-mono text-[11px]">
            {stepIndex + 1} of {AUTO_TOUR_STEPS.length}
          </span>
        </div>

        {/* Title & Body */}
        <div className="mt-3">
          <h3 className="text-base font-bold text-ink tracking-tight flex items-center gap-2">
            {currentStep.title}
          </h3>
          <p className="text-xs text-accent/80 font-medium mt-0.5">
            {currentStep.subtitle}
          </p>
          <p className="text-xs text-muted leading-relaxed mt-2.5 bg-surface-2/60 p-3 rounded-lg border border-hairline">
            {currentStep.description}
          </p>
        </div>

        {/* Action Prompt */}
        <div className="mt-3 p-2.5 rounded-md bg-accent/10 border border-accent/25 flex items-center gap-2 text-xs text-accent">
          <Sparkles className="w-4 h-4 shrink-0 text-accent" />
          <span className="font-medium">{currentStep.instruction}</span>
        </div>

        {/* Control Footer */}
        <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex gap-1">
            {AUTO_TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? 'w-5 bg-accent' : 'w-1.5 bg-surface-3'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="btn btn-primary px-4 py-2 text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <span>{stepIndex === AUTO_TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
            {stepIndex === AUTO_TOUR_STEPS.length - 1 ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
