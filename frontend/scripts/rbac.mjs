/* RBAC UI check: privileged actions hidden by role. */
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:5173'
const EXE = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
const b = await chromium.launch({ executablePath: EXE, headless: true })
const fails = []
const ok = (n, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fails.push(n) }

async function loginAs(role) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  await p.locator(`button:has-text("${role}")`).click()
  await p.waitForURL(/#\/dashboard/, { timeout: 8000 })
  return p
}

async function openFirstReview(p) {
  await p.locator('a:has-text("Review queue")').click()
  await p.waitForSelector('h1:has-text("Review")', { timeout: 8000 })
  await p.locator('tbody tr').first().click()
  await p.waitForTimeout(1000)
}

const creator = await loginAs('Creator')
await openFirstReview(creator)
ok('creator: no Approve Draft', !(await creator.locator('button:has-text("Approve Draft")').isVisible().catch(() => false)))
ok('creator: no Request Changes', !(await creator.locator('button:has-text("Request Changes")').isVisible().catch(() => false)))
ok('creator: no Accept', !(await creator.locator('button:has-text("Accept")').first().isVisible().catch(() => false)))
ok('creator: Run AI Evaluation present', await creator.locator('button:has-text("Evaluation")').isVisible().catch(() => false))
await creator.close()

const manager = await loginAs('Manager')
await openFirstReview(manager)
ok('manager: Approve Draft present', await manager.locator('button:has-text("Approve Draft")').isVisible().catch(() => false))
ok('manager: Request Changes present', await manager.locator('button:has-text("Request Changes")').isVisible().catch(() => false))
await manager.close()

const reviewer = await loginAs('Reviewer')
await openFirstReview(reviewer)
ok('reviewer: no Approve Draft', !(await reviewer.locator('button:has-text("Approve Draft")').isVisible().catch(() => false)))
ok('reviewer: Accept present', await reviewer.locator('button:has-text("Accept")').first().isVisible().catch(() => false))
await reviewer.close()

const kbCreator = await loginAs('Creator')
await kbCreator.locator('a:has-text("Knowledge Base")').click()
await kbCreator.waitForSelector('h1:has-text("Knowledge Base")', { timeout: 8000 })
ok('creator: KB no Add Entry', !(await kbCreator.locator('button:has-text("Add Entry")').isVisible().catch(() => false)))
ok('creator: KB no delete buttons', (await kbCreator.locator('button[title="Delete entry"]').count()) === 0)
ok('creator: KB export visible', await kbCreator.locator('button:has-text("Export")').isVisible().catch(() => false))
await kbCreator.close()

const kbManager = await loginAs('Manager')
await kbManager.locator('a:has-text("Knowledge Base")').click()
await kbManager.waitForSelector('h1:has-text("Knowledge Base")', { timeout: 8000 })
ok('manager: KB Add Entry present', await kbManager.locator('button:has-text("Add Entry")').isVisible().catch(() => false))
await kbManager.close()

await b.close()
console.log(fails.length ? `\n${fails.length} FAILED` : '\nRBAC clean')
process.exit(fails.length ? 1 : 0)
