import { useState } from 'react'
import { login, type User } from '../api'
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { BrandLogo } from '../components/ui/BrandLogo'

const DEMOS = [
  { label: 'Creator', email: 'creator@brandguard.demo', pw: 'creator123', desc: 'Author copy' },
  { label: 'Reviewer', email: 'reviewer@brandguard.demo', pw: 'reviewer123', desc: 'Approve & comment' },
  { label: 'Manager', email: 'manager@brandguard.demo', pw: 'manager123', desc: 'Manage rules & KB' },
  { label: 'Admin', email: 'admin@brandguard.demo', pw: 'admin12345', desc: 'Full system control' },
]

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e?: { email: string; pw: string }) {
    const em = e?.email ?? email
    const password = e?.pw ?? pw
    setBusy(true)
    setErr('')
    try {
      const user = await login(em, password)
      onLogin(user)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#09090b] to-[#050508] flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden text-zinc-100 selection:bg-orange-500/30 selection:text-white">
      {/* Background radial glows matching hero page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(219,75,22,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 pt-2 pb-6">
        <a
          href="#/hero"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all duration-200 backdrop-blur-md"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </a>

        <div className="flex items-center gap-2.5">
          <BrandLogo className="w-7 h-7" />
          <span className="text-base font-bold tracking-tight text-white">BrandGuard</span>
        </div>
      </header>

      {/* Main Login Card */}
      <div className="w-full max-w-[420px] z-10 my-auto">
        <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 sm:p-8 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-orange-500/50 before:to-transparent">
          {/* Card Header Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3 h-3" />
            <span>Secure Access</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            Sign in to BrandGuard
          </h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Review copy against brand guidelines with real-time AI governance before it ships.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 transition-all"
                />
              </div>
            </div>

            {err && (
              <div className="text-xs text-red-300 border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold text-sm rounded-xl shadow-[0_0_25px_rgba(219,75,22,0.35)] border border-orange-400/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {busy ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Accounts Section */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Instant Demo Access
              </span>
              <span className="text-[10px] text-orange-400/80 font-medium">One-click roles</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMOS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => submit(d)}
                  disabled={busy}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-orange-500/40 text-left transition-all duration-200 group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white group-hover:text-orange-400 transition-colors">
                      {d.label}
                    </span>
                    <UserCheck className="w-3.5 h-3.5 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                    {d.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Security Strip */}
      <footer className="w-full max-w-5xl z-10 pt-6 pb-2 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-400/80" />
          <span>Advisory findings with human signoff</span>
        </div>
        <div className="flex gap-4 text-zinc-400">
          <a href="#/hero" className="hover:text-white transition-colors">Overview</a>
          <span>·</span>
          <span>Version 1.0 Enterprise</span>
        </div>
      </footer>
    </div>
  )
}
