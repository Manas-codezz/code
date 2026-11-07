import { chromium } from 'playwright-core'
const EXE = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`
const BASE = 'http://localhost:5173'
const issues = []
const note = (s) => console.log('  ' + s)
const browser = await chromium.launch({ executablePath: EXE, headless: true })

const CONTRAST = `(() => {
  const parse = (c) => c.match(/[\\d.]+/g).slice(0,3).map(Number)
  const lum = ([r,g,b]) => { const f=(v)=>{v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b) }
  const ratio = (a,b) => { const l1=lum(a),l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05) }
  const bgOf = (el) => { let n=el; while(n){ const c=getComputedStyle(n).backgroundColor; if(c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return parse(c); n=n.parentElement } return [8,7,8] }
  window.__contrast = (sel) => {
    const el = document.querySelector(sel); if(!el) return null
    const cs = getComputedStyle(el)
    return { sel, fg: cs.color, bg: bgOf(el), ratio: +ratio(parse(cs.color), bgOf(el)).toFixed(2), size: parseFloat(cs.fontSize) }
  }
})()`

async function page(width, height, mobile=false) {
  const c = await browser.newContext({ viewport:{width,height}, isMobile:mobile, hasTouch:mobile })
  const p = await c.newPage()
  p.on('pageerror', e => issues.push('pageerror: '+e.message))
  p.on('console', m => { if(m.type()==='error') issues.push('console: '+m.text().slice(0,160)) })
  return { c, p }
}

// ---------- LANDING desktop ----------
{
  const { c, p } = await page(1440, 900)
  await p.goto(BASE, { waitUntil:'networkidle' })
  await p.waitForTimeout(700)
  await p.addScriptTag({ content: CONTRAST })

  const fonts = await p.evaluate(async () => {
    await document.fonts.ready
    return {
      serif: document.fonts.check('16px "Instrument Serif"'),
      sans: document.fonts.check('16px "IBM Plex Sans"'),
      mono: document.fonts.check('16px "IBM Plex Mono"'),
    }
  })
  note('fonts: ' + JSON.stringify(fonts))
  if (!fonts.serif || !fonts.sans || !fonts.mono) issues.push('fonts missing: '+JSON.stringify(fonts))

  const h1s = await p.locator('h1').count()
  if (h1s !== 1) issues.push(`landing h1 count = ${h1s}`)

  // scroll all the way, then check reveals + sticky CTA
  await p.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)) }
  })
  await p.waitForTimeout(700)
  const reveal = await p.evaluate(() => {
    const all = [...document.querySelectorAll('.reveal')]
    return { total: all.length, shown: all.filter(e => e.classList.contains('is-in')).length }
  })
  note(`reveal: ${reveal.shown}/${reveal.total}`)
  if (reveal.total && reveal.shown < reveal.total) issues.push(`reveals not shown: ${reveal.shown}/${reveal.total}`)

  const cta = await p.evaluate(() => {
    const bar = [...document.querySelectorAll('div')].find(d => d.className.includes('translate-y-full') || (d.className.includes('fixed bottom-0') && d.className.includes('translate-y-0')))
    return bar ? getComputedStyle(bar).transform : null
  })
  note('sticky cta transform after scroll: ' + cta)
  if (!cta || (cta.includes('matrix') && cta.includes('844'))) issues.push('sticky CTA not visible after scroll')

  // old palette bleed
  const bleed = await p.evaluate(() => {
    const bad = []
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      const s = cs.color + ' ' + cs.backgroundColor + ' ' + cs.borderColor
      if (/rgb\(249, 115, 22\)|rgb\(234, 88, 12\)|rgb\(219, 75, 22\)|rgb\(56, 189, 248\)/.test(s)) {
        bad.push(el.tagName + '.' + (el.className?.toString().slice(0,40) || ''))
      }
    }
    return [...new Set(bad)].slice(0,8)
  })
  if (bleed.length) issues.push('old palette colors in DOM: ' + bleed.join(' | '))

  // contrast of key text
  for (const sel of ['h1', 'p.text-muted', '.eyebrow', '.btn-primary', '.btn-ghost']) {
    const r = await p.evaluate((s) => window.__contrast(s), sel)
    if (r) { note(`contrast ${sel}: ${r.ratio} (fg ${r.fg}, ${r.size}px)`); if (r.ratio < 3) issues.push(`contrast ${sel} = ${r.ratio}`) }
  }

  await c.close()
}

// ---------- LANDING mobile: tap targets + drawer ----------
{
  const { c, p } = await page(390, 844, true)
  await p.goto(BASE, { waitUntil:'networkidle' })
  await p.waitForTimeout(600)
  const small = await p.evaluate(() => {
    const bad = []
    for (const el of document.querySelectorAll('a,button')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height < 40 || r.width < 40) bad.push(`${el.tagName} "${(el.textContent||'').trim().slice(0,24)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    return bad.slice(0,10)
  })
  note('small tap targets: ' + (small.length ? small.join(' | ') : 'none'))
  if (small.length) issues.push('tap targets < 40px: ' + small.join(' | '))
  await c.close()
}

// ---------- DASHBOARD manager: chart + tabs ----------
{
  const { c, p } = await page(1440, 900)
  await p.goto(`${BASE}/#/login`, { waitUntil:'networkidle' })
  await p.locator('button:has-text("Manager")').first().click()
  await p.waitForURL(/#\/dashboard/, { timeout: 8000 })
  await p.waitForTimeout(1500)
  const chart = await p.evaluate(() => {
    const cv = document.querySelector('canvas')
    if (!cv) return null
    return { w: cv.width, h: cv.height, visible: cv.getBoundingClientRect().width > 0 }
  })
  note('trend chart: ' + JSON.stringify(chart))
  if (!chart || !chart.visible || chart.w < 100) issues.push('trend chart not rendered')
  const h1 = await p.locator('h1').count()
  if (h1 !== 1) issues.push(`dashboard h1 count = ${h1}`)
  for (const t of ['Teams','Rules','SLA']) {
    await p.locator(`button:has-text("${t}")`).click()
    await p.waitForTimeout(350)
    const txt = await p.locator('main').innerText()
    if (txt.length < 40) issues.push(`tab ${t} empty`)
  }
  // command palette on authenticated shell
  await p.keyboard.press('Control+k')
  await p.waitForTimeout(300)
  const palette = await p.locator('[role="dialog"][aria-label="Command palette"]').isVisible().catch(()=>false)
  note('cmd+k palette visible: ' + palette)
  if (!palette) issues.push('Cmd+K palette did not open')
  await p.keyboard.press('Escape')
  await c.close()
}
{
  const { c, p } = await page(390, 844, true)
  await p.goto(`${BASE}/#/login`, { waitUntil:'networkidle' })
  await p.locator('button:has-text("Manager")').first().click()
  await p.waitForURL(/#\/dashboard/, { timeout: 8000 })
  await p.waitForTimeout(900)
  const menu = p.locator('button[aria-label="Open navigation"]').first()
  if (await menu.count()) {
    await menu.click(); await p.waitForTimeout(400)
    const drawer = await p.locator('nav[aria-label="Primary"]:visible').count()
    note('mobile drawer opens: ' + (drawer > 0))
    if (!drawer) issues.push('mobile drawer did not open')
  } else note('mobile menu button not found (check aria-label)')
  await c.close()
}

await browser.close()
console.log(issues.length ? `\nISSUES (${issues.length}):\n- ` + issues.join('\n- ') : '\nA11y/design QA clean')
