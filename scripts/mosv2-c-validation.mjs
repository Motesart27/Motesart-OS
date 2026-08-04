#!/usr/bin/env node
// scripts/mosv2-c-validation.mjs — MOSV2-C complete-validation runtime harness.
// Drives the production build (dist/, flag OFF at build time — VITE_MOS_V2
// unset, exactly as production) through headless Chrome over the DevTools
// Protocol with zero installed dependencies (Node built-in WebSocket/fetch).
// The v2 flag is exercised through the designed runtime override
// `window.MOS_V2 = true` (src/App.jsx:14) injected before page scripts.
//
// Every backend response is served by LOCAL request interception from the
// repo's own fixture module (src/v2/data/fixtures.js, imported verbatim) —
// zero live network, zero production calls, zero real Z5 submission (the Z5
// dispatcher is the fixture-backed zero-network path by construction).
//
// Usage: node scripts/mosv2-c-validation.mjs
// Output: docs/vault/evidence/mosv2-c-validation/ (report.json + PNGs)

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'vault', 'evidence', 'mosv2-c-validation')
const PREVIEW_PORT = 4619
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const VIEWPORT = { width: 1440, height: 900 }

const fixtures = await import(path.join(ROOT, 'src', 'v2', 'data', 'fixtures.js'))
const {
  fixtureProjectTasks, fixtureBookTasks, fixturePersonalTasks, fixturePulse,
  fixtureAgenda, fixturePersonalCalendar, fixtureHandledLog, fixtureFmMockPayload,
} = fixtures

mkdirSync(EVIDENCE_DIR, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Strip fixture-only annotation keys so intercepted payloads are wire-shaped.
function wire(obj, drop = []) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => key !== 'classification' && !drop.includes(key)),
  )
}

// ─── Local interception rule sets (fulfilled from fixtures; zero network) ────

const VERIFY_USER = { email: 'validation@local', name: 'Denarius', role: 'executive' }

function populatedRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/tasks') && url.includes('business=Book'), body: wire(fixtureBookTasks) },
    { match: (url) => url.includes('/api/tasks') && url.includes('business=Personal'), body: wire(fixturePersonalTasks) },
    { match: (url) => url.includes('/api/tasks'), body: wire(fixtureProjectTasks) },
    { match: (url) => url.includes('/api/pulse'), body: wire(fixturePulse, ['expectedCounts']) },
    {
      match: (url) => url.includes('/api/mya/calendar/events'),
      body: { events: [...fixtureAgenda.events, ...fixturePersonalCalendar.events], fetched_at: fixtures.FIXTURE_NOW_ISO },
    },
    { match: (url) => url.includes('/api/mya/audit/handled'), body: { items: fixtureHandledLog.items } },
  ]
}

function errorRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/'), status: 502, body: { detail: 'Upstream unavailable' } },
  ]
}

function emptyRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/pulse'), body: { ok: true, pulse: { urgent: [], overdue: [], blocked: [], approval: [], done_today: [], stale: [] } } },
    { match: (url) => url.includes('/api/mya/calendar/events'), body: { events: [], fetched_at: fixtures.FIXTURE_NOW_ISO } },
    { match: (url) => url.includes('/api/mya/audit/handled'), body: { items: [] } },
    { match: (url) => url.includes('/api/tasks'), body: { ok: true, count: 0, tasks: [] } },
  ]
}

function permissionRules() {
  return [
    ...populatedRules().filter((rule) => !rule.match.toString().includes('audit')),
    { match: (url) => url.includes('/api/mya/audit/handled'), status: 401, body: { detail: 'Unauthorized' } },
  ]
}

function mockRules() {
  return [
    ...populatedRules().filter((rule) => !rule.match.toString().includes('pulse')),
    { match: (url) => url.includes('/api/pulse'), body: wire(fixtureFmMockPayload) },
  ]
}

function delayedPopulatedRules(delayMs) {
  return populatedRules().map((rule) => (
    rule.match.toString().includes('auth') ? rule : { ...rule, delayMs }
  ))
}

// ─── Minimal CDP client over Node's built-in WebSocket ───────────────────────

class CDP {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    const cdp = new CDP()
    cdp.ws = ws
    cdp.nextId = 1
    cdp.pending = new Map()
    cdp.eventHandlers = []
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const { resolve, reject } = cdp.pending.get(msg.id)
        cdp.pending.delete(msg.id)
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`))
        else resolve(msg.result)
      } else if (msg.method) {
        for (const handler of cdp.eventHandlers) handler(msg)
      }
    })
    return cdp
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify(payload))
    })
  }

  onEvent(handler) {
    this.eventHandlers.push(handler)
  }
}

// ─── Process management ──────────────────────────────────────────────────────

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' })
  let exited = false
  proc.on('exit', () => { exited = true })
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (exited) throw new Error(`vite preview exited early (port ${PREVIEW_PORT} occupied?)`)
    try {
      const res = await fetch(PREVIEW_URL)
      if (res.ok) return proc
    } catch { /* not up yet */ }
    await sleep(300)
  }
  proc.kill('SIGKILL')
  throw new Error(`vite preview did not come up on :${PREVIEW_PORT}`)
}

async function startChrome() {
  const profile = mkdtempSync(path.join(tmpdir(), 'mosv2c-chrome-'))
  const proc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('Chrome DevTools endpoint timeout')), 20000)
    proc.stderr.on('data', (chunk) => {
      buffer += chunk
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    proc.on('exit', () => reject(new Error('Chrome exited before DevTools endpoint')))
  })
  return { proc, wsUrl }
}

// ─── Page harness ────────────────────────────────────────────────────────────

const AUTH_INJECT = `
  window.MOS_V2 = true;
  try {
    localStorage.setItem('som_user', ${JSON.stringify(JSON.stringify(VERIFY_USER))});
    localStorage.setItem('som_token', 'validation-probe-token');
  } catch (error) { /* storage unavailable */ }
`

class Page {
  static async open(cdp, { inject = null, rules = null, reducedMotion = false } = {}) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    const page = new Page()
    page.cdp = cdp
    page.sessionId = sessionId
    page.targetId = targetId
    page.requests = []
    page.consoleEntries = []
    page.exceptions = []

    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Network.enable')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false,
    })
    if (reducedMotion) {
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
    }
    if (inject) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: inject })

    cdp.onEvent((msg) => {
      if (msg.sessionId !== sessionId) return
      if (msg.method === 'Network.requestWillBeSent') {
        page.requests.push({
          url: msg.params.request.url,
          method: msg.params.request.method,
          type: msg.params.type,
          status: null,
        })
      } else if (msg.method === 'Network.responseReceived') {
        const entry = page.requests.find((r) => r.url === msg.params.response.url && r.status === null)
        if (entry) entry.status = msg.params.response.status
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        page.consoleEntries.push({
          type: msg.params.type,
          text: msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
        })
      } else if (msg.method === 'Runtime.exceptionThrown') {
        page.exceptions.push(msg.params.exceptionDetails.text + ' ' +
          (msg.params.exceptionDetails.exception?.description ?? ''))
      }
    })

    if (rules) {
      const rulesRef = { current: rules }
      page.rulesRef = rulesRef
      await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
      cdp.onEvent((msg) => {
        if (msg.sessionId !== sessionId || msg.method !== 'Fetch.requestPaused') return
        const { requestId, request } = msg.params
        const rule = rulesRef.current.find((candidate) => {
          try { return candidate.match(request.url, request.method) } catch { return false }
        })
        const respond = async () => {
          try {
            if (!rule) {
              await page.send('Fetch.continueRequest', { requestId })
            } else {
              if (rule.delayMs) await sleep(rule.delayMs)
              await page.send('Fetch.fulfillRequest', {
                requestId,
                responseCode: rule.status ?? 200,
                responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
                body: Buffer.from(JSON.stringify(rule.body ?? {})).toString('base64'),
              })
            }
          } catch { /* target gone */ }
        }
        respond()
      })
    }
    return page
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId)
  }

  async navigate(url, settleMs = 0) {
    this.requests = []
    this.consoleEntries = []
    this.exceptions = []
    await this.send('Page.navigate', { url })
    if (settleMs) await sleep(settleMs)
  }

  async evalJs(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) {
      throw new Error(`eval failed: ${result.exceptionDetails.text} — ${expression.slice(0, 80)}`)
    }
    return result.result.value
  }

  async waitFor(expression, { timeoutMs = 15000, label = expression } = {}) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      try {
        const value = await this.evalJs(expression)
        if (value) return value
      } catch { /* page mid-navigation */ }
      if (Date.now() > deadline) throw new Error(`waitFor timeout: ${label}`)
      await sleep(250)
    }
  }

  async shot(name, { fullPage = false, settleMs = 2000 } = {}) {
    // Let the compositor catch up with the DOM before capturing: headless
    // fromSurface captures lag DOM state by well over a second early in a
    // session (observed: boot screen captured ~1s after its removal).
    await this.send('Runtime.evaluate', {
      expression: 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))))',
      awaitPromise: true,
    })
    await sleep(settleMs)
    const params = { format: 'png' }
    if (fullPage) {
      const metrics = await this.send('Page.getLayoutMetrics')
      const height = Math.min(Math.ceil(metrics.cssContentSize.height), 16000)
      params.clip = { x: 0, y: 0, width: VIEWPORT.width, height, scale: 1 }
      params.captureBeyondViewport = true
    }
    const { data } = await this.send('Page.captureScreenshot', params)
    const file = path.join(EVIDENCE_DIR, name)
    writeFileSync(file, Buffer.from(data, 'base64'))
    return name
  }

  async key({ key, code, vk, modifiers = 0, text = undefined }) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, code, windowsVirtualKeyCode: vk, modifiers, ...(text ? { text } : {}),
    })
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers,
    })
  }

  async clickExpression(selectExpr, label) {
    const rect = await this.evalJs(`(() => {
      const el = ${selectExpr};
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`)
    if (!rect) throw new Error(`click target missing: ${label}`)
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', {
        type, x: rect.x, y: rect.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1,
      })
    }
  }

  async close() {
    await this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {})
  }
}

// ─── Report helpers ──────────────────────────────────────────────────────────

const report = { startedAt: new Date().toISOString(), scenarios: {} }

function record(name, data) {
  report.scenarios[name] = data
  console.log(`✓ ${name}`)
}

function badConsole(page) {
  return {
    errors: page.consoleEntries.filter((e) => e.type === 'error'),
    warnings: page.consoleEntries.filter((e) => e.type === 'warning'),
    exceptions: page.exceptions,
  }
}

function apiInventory(page) {
  return page.requests
    .filter((r) => new URL(r.url).pathname.startsWith('/api/') || r.url.includes('/auth/'))
    .map((r) => `${r.method} ${new URL(r.url).pathname}${new URL(r.url).search} → ${r.status}`)
}

function thirdPartyRequests(page) {
  return page.requests.filter((r) => !r.url.startsWith(PREVIEW_URL) && !r.url.startsWith('data:'))
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

async function scenarioFlagOff(cdp) {
  const page = await Page.open(cdp)
  await page.navigate(`${PREVIEW_URL}/`, 3000)
  const rootUrl = await page.evalJs('location.pathname')
  const rootRequests = page.requests.map((r) => `${new URL(r.url).pathname}`)
  await page.navigate(`${PREVIEW_URL}/v2/home`, 2500)
  const v2Url = await page.evalJs('location.pathname')
  const allPaths = page.requests.concat().map((r) => new URL(r.url).pathname)
  const shot = await page.shot('01-flagoff-login.png')
  record('flag-off', {
    note: 'Production build, VITE_MOS_V2 unset at build time, no runtime override.',
    rootResolvesTo: rootUrl,
    v2homeResolvesTo: v2Url,
    v2ChunkRequests: allPaths.filter((p) => p.includes('V2App')),
    apiRequests: apiInventory(page),
    thirdParty: thirdPartyRequests(page).map((r) => r.url),
    requestPaths: [...new Set(rootRequests.concat(allPaths))],
    screenshot: shot,
  })
  await page.close()
}

async function scenarioHomePopulated(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules() })
  await page.navigate(`${PREVIEW_URL}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot sequence auto-dismissed' })
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 7`,
    { label: 'populated tiles' },
  )
  await sleep(600)
  const statuses = await page.evalJs(`(() => {
    const out = {};
    document.querySelectorAll('.v2-tile').forEach((t) => {
      const key = t.className.match(/v2-tile\\b/) ? (t.className.match(/v2-z[0-9]__\\w+/) || ['tile'])[0] : 'tile';
      out[key] = t.getAttribute('data-status');
    });
    return out;
  })()`)
  const ruledCopies = await page.evalJs(`(() => {
    const text = document.body.innerText;
    return {
      fm: text.includes('Financial data unavailable — verification pending.'),
      som: text.includes('SOM data connection pending.'),
      revenue: text.includes('Revenue trend unavailable — daily source not connected.'),
    };
  })()`)
  const storageKeys = await page.evalJs('Object.keys(localStorage).sort()')
  const shot = await page.shot('02-home-populated.png')
  const cls = await page.evalJs('JSON.stringify(window.__MOSV2_PHASE_B_PERF__)')
  const fmRequests = page.requests.filter((r) => new URL(r.url).pathname.startsWith('/api/fm/'))
  record('home-populated', {
    tileStatuses: statuses,
    ruledCopiesRendered: ruledCopies,
    localStorageKeys: storageKeys,
    apiInventory: apiInventory(page),
    fmApiRequests: fmRequests.map((r) => r.url),
    thirdParty: thirdPartyRequests(page).map((r) => r.url),
    console: badConsole(page),
    clsAfterPopulated: JSON.parse(cls),
    screenshot: shot,
  })
  return page
}

async function scenarioKeyboard(page) {
  const results = {}
  await page.evalJs('document.body.focus?.(); void 0')
  await page.key({ key: ' ', code: 'Space', vk: 32 })
  await sleep(400)
  results.spaceOpensPalette = await page.evalJs(`Boolean(document.querySelector('.v2-palette-layer'))`)
  results.paletteInputFocused = await page.evalJs(`document.activeElement && document.activeElement.id === 'v2-palette-input'`)
  const paletteShot = await page.shot('03-palette-open.png')
  await page.key({ key: 'Escape', code: 'Escape', vk: 27 })
  await sleep(400)
  results.escClosesPalette = await page.evalJs(`!document.querySelector('.v2-palette-layer')`)
  await page.key({ key: 'e', code: 'KeyE', vk: 69, text: 'e' })
  await sleep(300)
  results.eTogglesExecOn = await page.evalJs(`Boolean(document.querySelector('.v2-shell--exec'))`)
  const execShot = await page.shot('04-exec-on.png')
  await page.key({ key: 'e', code: 'KeyE', vk: 69, text: 'e' })
  await sleep(300)
  results.eTogglesExecOff = await page.evalJs(`!document.querySelector('.v2-shell--exec')`)
  // Z5 dispatch via keyboard: focus the third quick action (Brain dump), press Enter.
  await page.evalJs(`document.querySelectorAll('.v2-qbtn')[2].focus(); void 0`)
  await page.key({ key: 'Enter', code: 'Enter', vk: 13, text: '\r' })
  await sleep(400)
  results.z5KeyboardToast = await page.evalJs(`document.body.innerText.includes('Brain dump → routed to MYA')`)
  // Keep the toast continuously mounted across the capture (re-dispatch resets
  // the 3s dismiss timer) so the compositor frame lag cannot miss it.
  for (let i = 0; i < 3; i += 1) {
    await page.evalJs(`document.querySelectorAll('.v2-qbtn')[2].click(); void 0`)
    await sleep(800)
  }
  // Defect F7: the toast is anchored to the zone bottom (below the fold when
  // populated) — scroll it into view for the evidence capture.
  await page.evalJs(`(() => {
    const t = document.querySelector('.v2-toast');
    if (t) window.scrollTo(0, Math.max(0, t.getBoundingClientRect().top + window.scrollY - 620));
  })(); void 0`)
  const toastShot = await page.shot('05-z5-toast-success.png', { settleMs: 500 })
  await sleep(3200)
  results.z5ToastAutoDismissed = await page.evalJs(`!document.body.innerText.includes('Brain dump → routed to MYA')`)
  record('keyboard-walkthrough', { ...results, screenshots: [paletteShot, execShot, toastShot] })
}

async function scenarioStateRun(cdp, name, rules, assertion, shotName) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules })
  await page.navigate(`${PREVIEW_URL}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  const observed = await page.waitFor(assertion.expr, { label: assertion.label, timeoutMs: 20000 })
  await sleep(400)
  const shot = await page.shot(shotName)
  const cls = await page.evalJs('window.__MOSV2_PHASE_B_PERF__ ? window.__MOSV2_PHASE_B_PERF__.cls : null')
  record(name, { assertion: assertion.label, observed: Boolean(observed), console: badConsole(page), cls, screenshot: shot })
  await page.close()
}

async function scenarioStale(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules() })
  await page.navigate(`${PREVIEW_URL}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 7`,
    { label: 'populated before failure' },
  )
  const clsBefore = await page.evalJs('window.__MOSV2_PHASE_B_PERF__ ? window.__MOSV2_PHASE_B_PERF__.cls : null')
  // Source starts failing now; the next 60s tasks/pulse cadence tick must go stale,
  // never blank (§9: populated → empty on refresh failure is forbidden).
  page.rulesRef.current = errorRules()
  await page.waitFor(`document.querySelectorAll('.v2-tile[data-status="stale"]').length >= 2`, {
    label: 'stale after failed cadence refresh (≤90s, tasks cadence is 60s)', timeoutMs: 95000,
  })
  const staleInfo = await page.evalJs(`(() => {
    const tiles = [...document.querySelectorAll('.v2-tile[data-status="stale"]')];
    return {
      count: tiles.length,
      asOfTags: tiles.map((t) => (t.querySelector('.v2-tile__asof') || {}).textContent || null),
      contentRetained: tiles.every((t) => !t.querySelector('.v2-tile__skeleton')),
    };
  })()`)
  await sleep(300)
  const shot = await page.shot('10-home-stale.png')
  const clsAfter = await page.evalJs('window.__MOSV2_PHASE_B_PERF__ ? window.__MOSV2_PHASE_B_PERF__.cls : null')
  record('home-stale-transition', {
    ...staleInfo,
    clsAcrossTransition: { before: clsBefore, after: clsAfter },
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

async function scenarioGallery(cdp) {
  const page = await Page.open(cdp, {
    inject: AUTH_INJECT,
    rules: [{ match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } }],
  })
  await page.navigate(`${PREVIEW_URL}/v2/gallery`, 2500)
  await page.waitFor(`document.body.innerText.includes('Foundation gallery')`, { label: 'gallery rendered' })
  const shot = await page.shot('12-gallery-full.png', { fullPage: true })
  record('gallery', {
    apiRequests: apiInventory(page),
    thirdParty: thirdPartyRequests(page).map((r) => r.url),
    console: badConsole(page),
    screenshot: shot,
    note: 'Gallery is Phase A/B specimens only — see validation doc deviation on the §12.8 Phase C specimen harness.',
  })
  await page.close()
}

async function scenarioModuleRoute(cdp) {
  const page = await Page.open(cdp, {
    inject: AUTH_INJECT,
    rules: [{ match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } }],
  })
  await page.navigate(`${PREVIEW_URL}/v2/work`, 2000)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  const shot = await page.shot('13-module-work.png')
  record('module-route-work', { console: badConsole(page), screenshot: shot })
  await page.close()
}

async function scenarioReducedMotion(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules(), reducedMotion: true })
  await page.navigate(`${PREVIEW_URL}/v2/home`, 2500)
  const bootNeverShown = await page.evalJs(`!document.querySelector('.v2-boot')`)
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 7`,
    { label: 'populated under reduced motion' },
  )
  const motion = await page.evalJs(`(() => {
    const probe = document.querySelector('.v2-tile') || document.body;
    const cs = getComputedStyle(probe);
    return { matchMediaReduce: matchMedia('(prefers-reduced-motion: reduce)').matches, transitionDuration: cs.transitionDuration };
  })()`)
  const shot = await page.shot('14-reduced-motion.png')
  record('reduced-motion', {
    bootSequenceSkipped: bootNeverShown,
    ...motion,
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

async function scenarioLegacy(cdp) {
  const page = await Page.open(cdp, {
    inject: AUTH_INJECT,
    rules: [{ match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } }],
  })
  await page.navigate(`${PREVIEW_URL}/os`, 3000)
  const rendered = await page.evalJs(`document.body.innerText.length > 0`)
  const shot = await page.shot('15-legacy-os.png')
  record('legacy-spot-check', {
    osRendered: rendered,
    note: 'Byte-identity of legacy surfaces is proven by git diff (only src/v2 files touched); this run confirms /os still boots under the same build.',
    screenshot: shot,
  })
  await page.close()
}

// ─── Main ────────────────────────────────────────────────────────────────────

const preview = await startPreview()
const chrome = await startChrome()
const cdp = await CDP.connect(chrome.wsUrl)

try {
  await scenarioFlagOff(cdp)
  const home = await scenarioHomePopulated(cdp)
  await scenarioKeyboard(home)
  await home.close()
  await scenarioStateRun(cdp, 'home-error', errorRules(), {
    expr: `document.querySelectorAll('.v2-tile[data-status="error"]').length >= 5`,
    label: 'tiles in ruled error state on 502',
  }, '06-home-error.png')
  await scenarioStateRun(cdp, 'home-empty', emptyRules(), {
    expr: `document.body.innerText.includes('Nothing scheduled today.') && document.body.innerText.includes('No active projects.')`,
    label: 'ruled quiet-empty copy rendered',
  }, '07-home-empty.png')
  await scenarioStateRun(cdp, 'home-permission', permissionRules(), {
    expr: `location.pathname === '/v2/home'
      && document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 7
      && !document.querySelector('.v2-handled-log')
      && Boolean(localStorage.getItem('som_user'))`,
    label: '401 on audit: no redirect, no logout, siblings populated, digest quiet-hidden (9.5/§10)',
  }, '08-home-permission.png')
  await scenarioStateRun(cdp, 'home-mock-rejection', mockRules(), {
    expr: `[...document.querySelectorAll('.v2-tile')].some((t) => t.className.includes('v2-z3__pulse') && t.getAttribute('data-status') === 'error')`,
    label: '"status":"mock" payload enters error state, never renders (§3.6)',
  }, '09-home-mock-rejection.png')
  await scenarioStale(cdp)
  await scenarioStateRun(cdp, 'home-loading', delayedPopulatedRules(6000), {
    expr: `document.querySelectorAll('.v2-tile__skeleton').length >= 3`,
    label: 'skeleton loading state visible while sources in flight (6s delayed fulfillment)',
  }, '11-home-loading.png')
  await scenarioGallery(cdp)
  await scenarioModuleRoute(cdp)
  await scenarioReducedMotion(cdp)
  await scenarioLegacy(cdp)
} finally {
  report.finishedAt = new Date().toISOString()
  writeFileSync(path.join(EVIDENCE_DIR, 'report.json'), JSON.stringify(report, null, 2))
  cdp.ws.close()
  chrome.proc.kill('SIGKILL')
  preview.kill('SIGKILL')
}

console.log(`\nEvidence written to ${path.relative(ROOT, EVIDENCE_DIR)}/ (report.json + PNGs)`)
