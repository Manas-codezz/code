import { useEffect, useState } from 'react'
import { loadAuth, logout, type User } from './api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Review from './pages/Review'
import KB from './pages/KB'
import DotGlobeHeroDemo from './components/ui/demo'
import { BrandLogo } from './components/ui/BrandLogo'
import { BookOpen, FileCheck2, LayoutDashboard, LogOut } from 'lucide-react'

type Route = 'hero' | 'login' | 'dashboard' | 'review' | 'kb'

function parseHash(isLoggedIn: boolean): { route: Route; arg: string } {
  const h = location.hash.replace(/^#\/?/, '')
  const [head, arg = ''] = h.split('/')
  if (head === 'login') return { route: 'login', arg }
  if (head === 'review') return { route: 'review', arg }
  if (head === 'kb') return { route: 'kb', arg }
  if (head === 'dashboard') return { route: 'dashboard', arg }
  if (head === 'hero') return { route: 'hero', arg }
  return { route: isLoggedIn ? 'dashboard' : 'hero', arg }
}

const NAV: { id: Route; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'review', label: 'Review Queue', icon: FileCheck2 },
  { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
]

// role rank for nav gating hints (KB edit UI hides below manager)
export const ROLE_RANK: Record<User['role'], number> = {
  creator: 0, reviewer: 1, manager: 2, admin: 3,
}

export default function App() {
  const [user, setUser] = useState<User | null>(() => loadAuth()?.user ?? null)
  const [path, setPath] = useState(() => parseHash(Boolean(user)))

  useEffect(() => {
    const on = () => setPath(parseHash(Boolean(user)))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [user])

  // Route protection: if guest tries to visit internal routes, route them to login
  useEffect(() => {
    if (!user && path.route !== 'login' && path.route !== 'hero') {
      location.hash = '#/login'
    }
  }, [user, path.route])

  // Public Hero Landing page
  if (path.route === 'hero') {
    return (
      <DotGlobeHeroDemo
        onLogin={() => {
          location.hash = '#/login'
          setPath({ route: 'login', arg: '' })
        }}
        onSignUp={() => {
          location.hash = '#/login'
          setPath({ route: 'login', arg: '' })
        }}
      />
    )
  }

  // Login page
  if (path.route === 'login' || !user) {
    return (
      <Login
        onLogin={(u) => {
          setUser(u)
          location.hash = '#/dashboard'
          setPath({ route: 'dashboard', arg: '' })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen flex bg-[#09090b] text-zinc-100 selection:bg-orange-500/30 selection:text-white">
      {/* Left Rail Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/10 bg-[#0c0d12]/95 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo className="w-7 h-7" />
            <div>
              <span className="font-bold tracking-tight text-white text-sm block leading-none">
                BrandGuard
              </span>
              <span className="text-[10px] text-zinc-500 font-mono tracking-wider">
                COMPLIANCE AI
              </span>
            </div>
          </div>
          <span className="text-[10px] font-medium text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
            PRO
          </span>
        </div>

        {/* Navigation Items with Subtle Modern Icons */}
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map((n) => {
            const active = path.route === n.id
            const Icon = n.icon
            return (
              <a
                key={n.id}
                href={`#/${n.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all duration-200 group ${
                  active
                    ? 'bg-orange-500/15 text-white font-semibold border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.12)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    active ? 'text-orange-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                  strokeWidth={1.75}
                />
                <span>{n.label}</span>
              </a>
            )
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-white/10 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-xs text-orange-400">
              {user.email.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs truncate font-medium text-white">{user.email}</div>
              <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 capitalize mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {user.role} · {user.team}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              logout()
              setUser(null)
              location.hash = '#/hero'
              setPath({ route: 'hero', arg: '' })
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-1.5 text-xs text-zinc-400 hover:text-orange-400 hover:bg-white/[0.04] rounded-lg border border-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-60 min-w-0 bg-gradient-to-b from-[#030712] via-[#09090b] to-[#050508] min-h-screen">
        {/* Top AI Advisory Strip */}
        <div className="border-b border-white/10 bg-[#0c0d12]/80 backdrop-blur-md px-6 py-2.5 flex items-center justify-between text-xs text-zinc-400 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] inline-block" />
            <span>
              <strong className="text-zinc-200 font-semibold">AI Advisory Active</strong>
              {' — Automated rule evaluation active; final approval requires human signoff.'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono hidden sm:block">
            ENGINE V1.0 · GROQ LLM
          </div>
        </div>

        <main className="px-6 py-8 max-w-7xl mx-auto">
          {path.route === 'dashboard' && <Dashboard />}
          {path.route === 'review' && <Review key={path.arg || 'list'} selected={path.arg} />}
          {path.route === 'kb' && <KB user={user} />}
        </main>
      </div>
    </div>
  )
}
