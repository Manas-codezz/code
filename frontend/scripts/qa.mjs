import { chromium } from 'playwright-core'
const EXE = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
const BASE = 'http://localhost:5173'
const OUT = '/tmp/qa'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const errors = []

async function ctx(width, height, mobile = false) {
  const c = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1,
    isMobile: mobile, hasTouch: mobile,
  })
  const p = await c.newPage()
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  return { c, p }
}

async function overflow(p, label) {
  const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (o > 2) errors.push(`overflow ${label}: ${o}px`)
}

// Desktop landing
{
  const { c, p } = await ctx(1440, 900)
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/landing-hero.png` })
  for (const [name, sel] of [['how', '#how'], ['features', '#features'], ['preview', '#preview']]) {
    await p.locator(sel).scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)
    await p.screenshot({ path: `${OUT}/landing-${name}.png` })
  }
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/landing-end.png` })
  await overflow(p, 'landing-desktop')
  await c.close()
}

// Mobile landing
{
  const { c, p } = await ctx(390, 844, true)
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/landing-mobile.png` })
  await p.locator('#how').scrollIntoViewIfNeeded()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/landing-mobile-how.png` })
  await overflow(p, 'landing-mobile')
  await c.close()
}

// Login desktop
{
  const { c, p } = await ctx(1440, 900)
  await p.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/login.png` })
  await c.close()
}

// Manager dashboard desktop + mobile
async function login(p, role = 'Manager') {
  await p.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  await p.locator(`button:has-text("${role}")`).first().click()
  await p.waitForURL(/#\/dashboard/, { timeout: 8000 })
  await p.waitForTimeout(1200)
}
{
  const { c, p } = await ctx(1440, 900)
  await login(p)
  await p.screenshot({ path: `${OUT}/dashboard-manager.png` })
  await overflow(p, 'dashboard-desktop')
  await p.locator('button:has-text("Teams")').click()
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/dashboard-teams.png` })
  await p.locator('button:has-text("Rules")').click()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/dashboard-rules.png` })
  await p.locator('button:has-text("SLA")').click()
  await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/dashboard-sla.png` })
  await p.locator('a:has-text("Review Queue")').first().click()
  await p.waitForSelector('h1:has-text("Review Queue")')
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${OUT}/review.png` })
  await overflow(p, 'review-desktop')
  await p.locator('a:has-text("Knowledge Base")').first().click()
  await p.waitForSelector('h1:has-text("Knowledge Base")')
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/kb.png` })
  await overflow(p, 'kb-desktop')
  await c.close()
}
{
  const { c, p } = await ctx(390, 844, true)
  await login(p)
  await p.screenshot({ path: `${OUT}/dashboard-mobile.png` })
  await overflow(p, 'dashboard-mobile')
  await c.close()
}
{
  const { c, p } = await ctx(390, 844, true)
  await login(p, 'Creator')
  await p.screenshot({ path: `${OUT}/dashboard-creator-mobile.png` })
  await c.close()
}

await browser.close()
console.log(errors.length ? `ISSUES:\n${errors.join('\n')}` : 'QA clean')
