/* UI smoke: hero landing → login → dashboard → review flow → KB, against dev server.
   Run: node scripts/smoke.mjs   (vite dev on :5173, API on :8001) */
import { chromium } from 'playwright-core'

const EXE = process.env.CHROME
  ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
const BASE = 'http://localhost:5173'
const fails = []
const ok = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) fails.push(name)
}

const browser = await chromium.launch({ executablePath: EXE,
                                        headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => fails.push(`pageerror: ${e.message}`))

try {
  // 1. hero landing & login
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const hasHero = await page.locator('text=BrandGuard').first().isVisible()
  ok('hero landing page renders first', hasHero)
  if (await page.locator('button:has-text("Log in")').isVisible()) {
    await page.locator('button:has-text("Log in")').click()
  } else if (!page.url().includes('#/login')) {
    await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' })
  }
  await page.waitForSelector('text=Demo accounts', { timeout: 8000 })
  ok('login page renders', true)
  await page.locator('button:has-text("Manager")').click()
  await page.waitForURL(/#\/dashboard/, { timeout: 8000 })
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 8000 })
  ok('demo login lands on dashboard', true)

  // 2. dashboard data
  await page.waitForSelector('text=Compliance rate', { timeout: 8000 })
  ok('KPI row present', true)
  ok('heat map rendered', await page.locator(
     'text=Guideline-gap heat map').isVisible())
  ok('AI advisory strip visible',
     await page.locator('text=AI advisory').first().isVisible())

  // 3. review queue + create content
  await page.locator('a:has-text("Review queue")').click()
  await page.waitForSelector('h1:has-text("Review queue")')
  await page.locator('button:has-text("+ New")').click()
  await page.locator('input').first().fill('Smoke test copy')
  await page.locator('textarea').first().fill(
    'Act NOW! Guaranteed returns with Nova. Send $9.99 today for insights.')
  await page.locator('button:has-text("Create & open")').click()
  await page.waitForURL(/#\/review\/\d+/, { timeout: 8000 })
  ok('content created & opened', true)

  // 4. run AI review (live Groq)
  await page.locator('button:has-text("Run AI review")').click()
  await page.waitForSelector('text=Findings', { timeout: 30000 })
  await page.waitForSelector('li:has-text("critical"), li:has-text("warning")',
                             { timeout: 30000 })
  const findingCount = await page.locator('section:has-text("Findings") li')
    .count()
  ok(`findings rendered (${findingCount})`, findingCount > 0)
  ok('evidence line rendered',
     await page.locator('text=evidence:').first().isVisible())
  ok('provider chip rendered',
     await page.locator('text=provider').first().isVisible())

  // 5. approve blocked by unresolved criticals?
  const blocked = await page.locator('text=Approval blocked').count()
  const approveBtn = page.getByRole('button',
    { name: 'Approve', exact: true })
  const disabled = await approveBtn.isDisabled()
  ok('approve gated while criticals unresolved', blocked > 0 ? disabled : true)

  // 6. accept all criticals → approve works
  const criticals = page.locator(
    'li:has-text("critical") button:has-text("Accept")')
  const n = await criticals.count()
  for (let i = 0; i < n; i++) {
    await criticals.first().click()
    await page.waitForTimeout(250)
  }
  if (n > 0) {
    await approveBtn.click()
    await page.waitForSelector('text=approved', { timeout: 8000 })
    ok('approve after resolving criticals', true)
  } else {
    ok('approve after resolving criticals (no criticals)', true)
  }

  // 7. peer comment
  await page.locator('input[placeholder="Add a review note…"]')
    .fill('Looks good from brand side.')
  await page.locator('button:has-text("Post")').click()
  await page.waitForSelector('text=Looks good from brand side.',
                             { timeout: 5000 })
  ok('comment posted', true)

  // 8. KB page
  await page.locator('a:has-text("Knowledge base")').click()
  await page.waitForSelector('h1:has-text("Knowledge base")')
  await page.waitForSelector('text=Guidelines', { timeout: 5000 })
  const kbRows = await page.locator('code, strong').count()
  ok(`KB rows visible (${kbRows})`, kbRows > 0)

  // 9. logout → back to landing
  await page.locator('button:has-text("Sign out")').click()
  await page.waitForSelector('text=BrandGuard', { timeout: 5000 })
} finally {
  await browser.close()
}

if (fails.length) {
  console.error(`\n${fails.length} failures:`, fails)
  process.exit(1)
} else {
  console.log('\nAll smoke checks passed.')
}
