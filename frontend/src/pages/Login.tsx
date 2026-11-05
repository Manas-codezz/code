import { useState } from 'react'
import { login, type User } from '../api'
import { Btn, Field, inputCls } from '../ui'

const DEMOS = [
  { label: 'Creator', email: 'creator@brandguard.demo', pw: 'creator123' },
  { label: 'Reviewer', email: 'reviewer@brandguard.demo', pw: 'reviewer123' },
  { label: 'Manager', email: 'manager@brandguard.demo', pw: 'manager123' },
  { label: 'Admin', email: 'admin@brandguard.demo', pw: 'admin12345' },
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
      onLogin(await login(em, password))
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center
      px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex items-baseline gap-2.5 mb-8">
          <span className="w-3.5 h-3.5 bg-accent rounded-sm inline-block" />
          <span className="text-lg font-semibold tracking-tight">BrandGuard</span>
          <span className="eyebrow ml-auto">brand compliance</span>
        </div>

        <div className="bg-surface border border-hairline rounded-sm p-6">
          <h1 className="text-[15px] font-semibold mb-1">Sign in</h1>
          <p className="text-[13px] text-ink2 mb-5">
            Review copy against brand guidelines before it ships.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); submit() }}
                className="space-y-3.5">
            <Field label="Email">
              <input className={inputCls} type="email" required
                     autoComplete="email"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="you@company.com" />
            </Field>
            <Field label="Password">
              <input className={inputCls} type="password" required
                     autoComplete="current-password"
                     value={pw}
                     onChange={(e) => setPw(e.target.value)}
                     placeholder="••••••••" />
            </Field>
            {err && (
              <div className="text-[13px] text-critical border
                border-critical/30 bg-red-50 px-3 py-2 rounded-sm">
                {err}
              </div>
            )}
            <Btn type="submit" kind="primary" disabled={busy}
                 className="w-full justify-center py-2">
              {busy ? 'Signing in…' : 'Sign in'}
            </Btn>
          </form>

          <div className="mt-5 pt-4 border-t border-hairline">
            <div className="eyebrow mb-2">Demo accounts — one click</div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMOS.map((d) => (
                <button key={d.email} onClick={() => submit(d)}
                        className="text-[12px] border border-hairline
                          bg-paper hover:border-ink px-2 py-1.5 rounded-sm
                          text-left transition-colors">
                  <span className="font-medium block">{d.label}</span>
                  <span className="text-ink2 text-[11px]">{d.email.split('@')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-ink2 mt-4 text-center leading-relaxed">
          AI findings are advisory — final approval is always human.
        </p>
      </div>
    </div>
  )
}
