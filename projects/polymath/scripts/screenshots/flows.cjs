/** Click-through checks with console/page errors as failures.  SHOTS_PORT=5203 node scripts/screenshots/flows.cjs */
const { spawn } = require('child_process')
const path = require('path')
const { chromium } = require('playwright')
const { routes, tables } = require('./fixtures.cjs')
const PORT = Number(process.env.SHOTS_PORT) || 5203
const BASE = `http://localhost:${PORT}`
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 31536000
const session = JSON.stringify({ access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', aud: 'authenticated', role: 'authenticated', exp, email: 't@e.com' })}.sig`, refresh_token: 'r', expires_in: 31536000, expires_at: exp, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 't@e.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } })
const fails = []
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails.push(m) }
;(async () => {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'anon' } })
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE)).ok) break } catch { /* wait */ } await new Promise(r => setTimeout(r, 500)) }
  const browser = await chromium.launch()
  let updateMode = 'ok'; let posts = 0
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
  await ctx.addInitScript(s => localStorage.setItem('sb-localhost-auth-token', s), session)
  await ctx.route('**/localhost:54321/**', r => { const m = new URL(r.request().url()).pathname.match(/\/rest\/v1\/(\w+)/); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((m && tables[m[1]]) || []) }) })
  await ctx.route('**/api/**', route => {
    const u = new URL(route.request().url()); const key = u.pathname.replace(/^\/api\//, '') + u.search
    if (key.includes('resource=project-update') && route.request().method() === 'POST') {
      posts++
      if (updateMode === 'fail') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: "Couldn't save that." }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, themes: [], changed: false, ticked: ['Chapter 4'] }) })
    }
    const hit = routes[key] ?? routes[u.pathname.replace(/^\/api\//, '')]
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hit ?? {}) })
  })
  const errs = []
  const open = async url => {
    const p = await ctx.newPage()
    p.on('pageerror', e => errs.push(`${url}: ${e.message}`))
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(`${url} console: ${m.text().slice(0, 200)}`) })
    await p.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {})
    await p.waitForTimeout(800)
    return p
  }
  for (const url of ['/', '/projects', '/projects/p-book', '/projects/p-toy', '/projects/p-mixes', '/memories', '/reading', '/lists', '/settings', '/search', '/you', '/made']) { const p = await open(url); await p.close() }
  ok(errs.length === 0, 'no page/console errors across pages ' + errs.join(' | '))
  for (const mode of ['fail', 'ok']) {
    updateMode = mode; posts = 0
    const p = await open('/projects/p-book')
    const btn = p.getByRole('button', { name: /^update$/i }).first()
    if (!(await btn.count())) { ok(false, 'Update button on p-book'); await p.close(); continue }
    await btn.click(); await p.waitForTimeout(400)
    await p.locator('textarea').fill('Finished chapter 4')
    await p.getByRole('button', { name: /save update/i }).dblclick(); await p.waitForTimeout(1200)
    ok(posts === 1, `${mode}: double click posts once (got ${posts})`)
    const body = await p.locator('[role=dialog]').innerText()
    if (mode === 'fail') ok(/Couldn't save that/.test(body) && await p.locator('textarea').inputValue() === 'Finished chapter 4', 'fail: error shown and text kept')
    else ok(/Saved/.test(body) && /Chapter 4/.test(body), 'ok: saved + ticked shown')
    await p.close()
  }
  ok(errs.length === 0, 'no errors after flows ' + errs.join(' | '))
  await browser.close(); server.kill()
  process.exit(fails.length ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
