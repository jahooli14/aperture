/**
 * Screenshots of the key pages at phone width, with no login and no database.
 *   node scripts/screenshots/shoot.cjs [outDir] [page ...]
 * Starts the dev server itself, fakes the Supabase session in localStorage,
 * and answers every /api and Supabase call from fixtures.cjs. Output: one PNG
 * per page in outDir (default /tmp/aperture-shots).
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')
const { routes, tables } = require('./fixtures.cjs')

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const PAGES = {
  home: '/', projects: '/projects', 'project-big': '/projects/p-book', 'project-quick': '/projects/p-toy',
  'project-keep': '/projects/p-mixes', thoughts: '/memories', reading: '/reading', lists: '/lists',
  settings: '/settings', search: '/search', you: '/you', made: '/made',
}

function fakeSession() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', aud: 'authenticated', role: 'authenticated', exp, email: 'test@example.com' })}.sig`
  return { access_token: jwt, refresh_token: 'r', expires_in: 31536000, expires_at: exp, token_type: 'bearer',
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE); if (r.ok) return } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('dev server did not start')
}

async function main() {
  const out = process.argv[2] || '/tmp/aperture-shots'
  const only = process.argv.slice(3)
  fs.mkdirSync(out, { recursive: true })
  const root = path.resolve(__dirname, '../..')
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: root, stdio: 'ignore',
    env: { ...process.env, VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'anon' },
  })
  try {
    await waitForServer()
    const browser = await chromium.launch()
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' })
    await ctx.addInitScript(s => { localStorage.setItem('sb-localhost-auth-token', s) }, JSON.stringify(fakeSession()))
    await ctx.route('**/localhost:54321/**', r => {
      const m = new URL(r.request().url()).pathname.match(/\/rest\/v1\/(\w+)/)
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify((m && tables[m[1]]) || []) })
    })
    await ctx.route('**/api/**', route => {
      const u = new URL(route.request().url())
      const key = u.pathname.replace(/^\/api\//, '') + u.search
      const hit = routes[key] ?? routes[u.pathname.replace(/^\/api\//, '')]
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hit ?? {}) })
    })
    const failed = []
    for (const [name, url] of Object.entries(PAGES)) {
      if (only.length && !only.includes(name)) continue
      const page = await ctx.newPage()
      page.on('pageerror', e => failed.push(`${name}: ${e.message}`))
      await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(1200)
      // Size the window to the page instead of using fullPage, so the floating
      // nav sits at the bottom like it does in the app, not in the middle.
      const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
      await page.setViewportSize({ width: 390, height: Math.min(Math.max(h, 844), 5000) })
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(out, `${name}.png`) })
      console.log('shot', name)
      await page.close()
    }
    if (failed.length) console.log('\npage errors:\n' + failed.join('\n'))
    await browser.close()
  } finally { server.kill() }
}
main().catch(e => { console.error(e); process.exit(1) })
