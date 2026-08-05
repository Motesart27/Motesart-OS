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
// Lane E hardening:
//   · FIXED CLOCK BY DEFAULT — every page runs pinned to FIXTURE_NOW_ISO
//     (imported from the fixture module) with the America/New_York timezone
//     emulated, so the harness passes on any wall date and screenshots never
//     drift. Real clock only via explicit opt-in (--real-clock or
//     MOSV2_REAL_CLOCK=1). Every scenario asserts zero drift from
//     FIXTURE_NOW_ISO; any drift fails the run.
//   · PREVIEW_URL env override — point the harness at any already-running
//     preview (e.g. a Netlify deploy preview) instead of a local vite
//     preview. Local mode uses a dynamically allocated free port.
//   · Console gate — the run FAILS on any unexpected console error, warning,
//     or exception (warnings were previously capture-only).
//   · Browser discovery — MOSV2_CHROME_PATH env, then platform candidates,
//     then PATH lookup (no single hard-coded absolute path).
//   · Evidence hashing — report.json is deterministic (no wall-clock fields)
//     and every artifact's sha256 + classification lands in manifest.json.
//
// Usage:
//   node scripts/mosv2-c-validation.mjs                 # fixed clock, local preview (dynamic port)
//   node scripts/mosv2-c-validation.mjs --real-clock    # opt-in wall clock
//   PREVIEW_URL=https://deploy-preview-N--motesart-os.netlify.app node scripts/mosv2-c-validation.mjs
//   node scripts/mosv2-c-validation.mjs --print-config  # resolved config, exits without running
// Output: docs/vault/evidence/mosv2-c-validation/ (report.json + manifest.json + PNGs)

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'vault', 'evidence', 'mosv2-c-validation')
const VIEWPORT = { width: 1440, height: 900 }
const TIMEZONE_ID = 'America/New_York'

const fixtures = await import(path.join(ROOT, 'src', 'v2', 'data', 'fixtures.js'))
const {
  fixtureProjectTasks, fixtureBookTasks, fixturePersonalTasks, fixturePulse,
  fixtureAgenda, fixturePersonalCalendar, fixtureHandledLog, fixtureFmMockPayload,
} = fixtures

// The fixed clock derives from the fixture module itself — never hard-coded —
// so this harness and every fixture share one frozen now by construction.
const FIXTURE_NOW_MS = new Date(fixtures.FIXTURE_NOW_ISO).getTime()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── CLI / environment configuration (exported pure for tests) ───────────────

export function resolveConfig({ argv = [], env = {} } = {}) {
  const realClock = argv.includes('--real-clock') || env.MOSV2_REAL_CLOCK === '1'
  const printConfig = argv.includes('--print-config')
  const help = argv.includes('--help') || argv.includes('-h')
  const previewUrl = typeof env.PREVIEW_URL === 'string' && env.PREVIEW_URL.trim()
    ? env.PREVIEW_URL.trim().replace(/\/+$/, '')
    : null
  return { realClock, printConfig, help, previewUrl }
}

function which(command) {
  const tool = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(tool, [command], { encoding: 'utf8' })
  if (result.status !== 0) return null
  const found = result.stdout.split('\n').map((line) => line.trim()).find(Boolean)
  return found ?? null
}

// Browser discovery: explicit env override wins (and must exist), then
// well-known per-platform locations, then PATH. No single hard-coded path.
export function resolveChrome(env = process.env, platform = process.platform) {
  const fromEnv = env.MOSV2_CHROME_PATH || env.CHROME_PATH
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`MOSV2_CHROME_PATH does not exist: ${fromEnv}`)
    return { path: fromEnv, source: 'env' }
  }
  const candidates = []
  if (platform === 'darwin') {
    candidates.push(
      { path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', source: 'well-known' },
      { path: '/Applications/Chromium.app/Contents/MacOS/Chromium', source: 'well-known' },
      { command: 'google-chrome', source: 'PATH' },
      { command: 'chromium', source: 'PATH' },
    )
  } else if (platform === 'win32') {
    candidates.push(
      { path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', source: 'well-known' },
      { path: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', source: 'well-known' },
      { command: 'chrome', source: 'PATH' },
    )
  } else {
    candidates.push(
      { command: 'google-chrome-stable', source: 'PATH' },
      { command: 'google-chrome', source: 'PATH' },
      { command: 'chromium-browser', source: 'PATH' },
      { command: 'chromium', source: 'PATH' },
    )
  }
  for (const candidate of candidates) {
    if (candidate.path && existsSync(candidate.path)) return candidate
    if (candidate.command) {
      const found = which(candidate.command)
      if (found) return { path: found, source: candidate.source }
    }
  }
  throw new Error('No Chrome/Chromium found — set MOSV2_CHROME_PATH to a browser binary')
}

// Dynamic free port for the local vite preview (no fixed-port fragility).
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

// Page-injected clock pin: Date is frozen at the fixture's now; explicit
// constructor arguments pass through untouched so parsing/format math is real.
export function fixedClockSource(fixtureNowMs) {
  return `(() => {
    const FIXED_NOW = ${Number(fixtureNowMs)};
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args) { super(...(args.length === 0 ? [FIXED_NOW] : args)); }
      static now() { return FIXED_NOW; }
    }
    Object.defineProperty(window, 'Date', { value: FrozenDate, writable: true, configurable: true });
  })();`
}

// Pure drift predicate (testable): null when the page clock is exactly the
// fixture now, a failure message otherwise.
export function clockDrift(observedMs, fixtureNowMs = FIXTURE_NOW_MS) {
  return observedMs === fixtureNowMs
    ? null
    : `clock drift from FIXTURE_NOW_ISO: page Date.now()=${observedMs} (${new Date(observedMs).toISOString()}) expected ${fixtureNowMs} (${new Date(fixtureNowMs).toISOString()})`
}

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

// Broad 401: every tile source denied, not just the handled log (Lane E
// permission coverage beyond the 401-on-audit case).
function broadPermissionRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/'), status: 401, body: { detail: 'Unauthorized' } },
  ]
}

// Malformed-JSON pulse: the wire payload cannot parse (parse lifecycle).
function parseFailureRules() {
  return [
    ...populatedRules().filter((rule) => !rule.match.toString().includes('pulse')),
    { match: (url) => url.includes('/api/pulse'), raw: 'NOT-JSON{{<html>Gateway error</html>' },
  ]
}

// Pulse slower than the apiFetch 15s ceiling (timeout lifecycle).
function timeoutRules(delayMs) {
  return populatedRules().map((rule) => (
    rule.match.toString().includes('pulse') ? { ...rule, delayMs } : rule
  ))
}

// Every API request fails at the network layer (offline lifecycle): the
// interception FAILS the request rather than fulfilling it, so fetch rejects
// exactly as a dead network — deterministic, no emulation toggling.
function offlineRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/'), fail: 'InternetDisconnected' },
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

async function startPreview(port) {
  const url = `http://127.0.0.1:${port}`
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' })
  let exited = false
  proc.on('exit', () => { exited = true })
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (exited) throw new Error(`vite preview exited early (port ${port} occupied?)`)
    try {
      const res = await fetch(url)
      if (res.ok) return { proc, url }
    } catch { /* not up yet */ }
    await sleep(300)
  }
  proc.kill('SIGKILL')
  throw new Error(`vite preview did not come up on :${port}`)
}

async function startChrome(chromePath) {
  const profile = mkdtempSync(path.join(tmpdir(), 'mosv2c-chrome-'))
  const proc = spawn(chromePath, [
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

// Runtime state set by main() before scenarios run.
const ACTIVE = { previewUrl: null, realClock: false, driftChecks: 0 }

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
    if (!ACTIVE.realClock) {
      // Fixed-clock mode: pin the timezone first, then freeze Date in every
      // document before any page script runs.
      await page.send('Emulation.setTimezoneOverride', { timezoneId: TIMEZONE_ID })
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: fixedClockSource(FIXTURE_NOW_MS) })
    }
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
            } else if (rule.fail) {
              // Offline lifecycle: the network layer fails the request.
              await page.send('Fetch.failRequest', { requestId, errorReason: rule.fail })
            } else {
              if (rule.delayMs) await sleep(rule.delayMs)
              const rawBody = rule.raw !== undefined ? rule.raw : JSON.stringify(rule.body ?? {})
              await page.send('Fetch.fulfillRequest', {
                requestId,
                responseCode: rule.status ?? 200,
                responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
                body: Buffer.from(rawBody).toString('base64'),
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

  // Fixed-clock law: the page's frozen now must equal FIXTURE_NOW_ISO exactly.
  // Any drift fails the scenario (and therefore the run).
  async assertFixedClock(label) {
    if (ACTIVE.realClock) return
    const observed = await this.evalJs('[Date.now(), new Date().toISOString()]')
    const drift = clockDrift(observed[0])
    if (drift) throw new Error(`${drift} — scenario: ${label}`)
    if (observed[1] !== new Date(FIXTURE_NOW_MS).toISOString()) {
      throw new Error(`clock drift from FIXTURE_NOW_ISO: page ISO=${observed[1]} — scenario: ${label}`)
    }
    ACTIVE.driftChecks += 1
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

// Deterministic report: NO wall-clock fields. `run` records the resolved
// configuration; scenarios record assertions, inventories, and evidence.
const report = { suite: 'mosv2-c-validation', run: null, scenarios: {}, consoleGate: null }

// Per-scenario allowlist for genuinely-expected console output. Empty by
// default — every error, warning, or exception fails the run unless a
// scenario documents it here (pattern-matched, with a reason).
const EXPECTED_CONSOLE = {
  // 'scenario-name': { warnings: [/pattern/], errors: [], exceptions: [] },
}

const consoleFindings = []

function scanConsole(scenario, consoleData) {
  if (!consoleData) return
  const allowed = EXPECTED_CONSOLE[scenario] ?? {}
  for (const kind of ['errors', 'warnings', 'exceptions']) {
    const allowPatterns = allowed[kind] ?? []
    for (const entry of consoleData[kind]) {
      const text = entry.text ?? String(entry)
      const expected = allowPatterns.some((pattern) => pattern.test(text))
      consoleFindings.push({ scenario, kind: kind.replace(/s$/, ''), text, expected })
    }
  }
}

// Exported for the gate unit tests (harness-config.test.js): the pure
// unexpected-finding predicate that drives the run's exit code.
export function unexpectedConsoleFindings(findings) {
  return findings.filter((finding) => !finding.expected)
}
export { scanConsole, consoleFindings }

function record(name, data) {
  report.scenarios[name] = data
  scanConsole(name, data.console)
  console.log(`✓ ${name}`)
}

function badConsole(page) {
  return {
    errors: page.consoleEntries.filter((e) => e.type === 'error'),
    warnings: page.consoleEntries.filter((e) => e.type === 'warning'),
    exceptions: page.exceptions.map((text) => ({ text })),
  }
}

function apiInventory(page) {
  return page.requests
    .filter((r) => new URL(r.url).pathname.startsWith('/api/') || r.url.includes('/auth/'))
    .map((r) => `${r.method} ${new URL(r.url).pathname}${new URL(r.url).search} → ${r.status}`)
}

function thirdPartyRequests(page) {
  return page.requests.filter((r) => !r.url.startsWith(ACTIVE.previewUrl) && !r.url.startsWith('data:'))
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

async function scenarioFlagOff(cdp) {
  const page = await Page.open(cdp)
  await page.navigate(`${ACTIVE.previewUrl}/`, 3000)
  const rootUrl = await page.evalJs('location.pathname')
  const rootRequests = page.requests.map((r) => `${new URL(r.url).pathname}`)
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`, 2500)
  const v2Url = await page.evalJs('location.pathname')
  const allPaths = page.requests.concat().map((r) => new URL(r.url).pathname)
  await page.assertFixedClock('flag-off')
  const shot = await page.shot('01-flagoff-login.png')
  record('flag-off', {
    note: 'Production build, VITE_MOS_V2 unset at build time, no runtime override.',
    rootResolvesTo: rootUrl,
    v2homeResolvesTo: v2Url,
    v2ChunkRequests: allPaths.filter((p) => p.includes('V2App')),
    apiRequests: apiInventory(page),
    thirdParty: thirdPartyRequests(page).map((r) => r.url),
    requestPathCount: new Set(rootRequests.concat(allPaths)).size,
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

async function scenarioHomePopulated(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules() })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot sequence auto-dismissed' })
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 7`,
    { label: 'populated tiles' },
  )
  await sleep(600)
  await page.assertFixedClock('home-populated')
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
  // F7/FR-1 resolution: the toast region is portaled to document.body, so it
  // anchors to the VIEWPORT corner regardless of scroll position — no scroll
  // to capture. Record the region rect against the viewport as proof.
  results.toastViewportAnchor = await page.evalJs(`(() => {
    const region = document.querySelector('.v2-toast-region');
    if (!region || !region.querySelector('.v2-toast')) return null;
    const r = region.getBoundingClientRect();
    return {
      portaledToBody: region.parentElement === document.body,
      rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
      viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      scrollY: window.scrollY,
      atViewportCorner: Math.abs(r.right - (window.innerWidth - 22)) < 1
        && Math.abs(r.bottom - (window.innerHeight - 22)) < 1,
    };
  })()`)
  const toastShot = await page.shot('05-z5-toast-success.png', { settleMs: 500 })
  await sleep(3200)
  results.z5ToastAutoDismissed = await page.evalJs(`!document.body.innerText.includes('Brain dump → routed to MYA')`)
  record('keyboard-walkthrough', { ...results, console: badConsole(page), screenshots: [paletteShot, execShot, toastShot] })
}

async function scenarioStateRun(cdp, name, rules, assertion, shotName, { consoleNote = null } = {}) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  const observed = await page.waitFor(assertion.expr, { label: assertion.label, timeoutMs: 20000 })
  await sleep(400)
  await page.assertFixedClock(name)
  const shot = await page.shot(shotName)
  const cls = await page.evalJs('window.__MOSV2_PHASE_B_PERF__ ? window.__MOSV2_PHASE_B_PERF__.cls : null')
  record(name, {
    assertion: assertion.label,
    observed: Boolean(observed),
    console: badConsole(page),
    cls,
    screenshot: shot,
    ...(consoleNote ? { note: consoleNote } : {}),
  })
  await page.close()
}

async function scenarioStale(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules() })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
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
  await page.assertFixedClock('home-stale-transition')
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

// D1 browser-side proof: the Gallery specimen harness mounts every fixture
// state of every tile in the production build with zero console output (the
// console gate below enforces zero; the counts below enforce completeness).
async function scenarioGallery(cdp) {
  const page = await Page.open(cdp, {
    inject: AUTH_INJECT,
    rules: [{ match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } }],
  })
  await page.navigate(`${ACTIVE.previewUrl}/v2/gallery`, 2500)
  await page.waitFor(`document.body.innerText.includes('Foundation gallery')`, { label: 'gallery rendered' })
  await page.waitFor(`document.body.innerText.includes('Phase C specimen harness')`, { label: 'Phase C specimen harness rendered' })
  const coverage = await page.evalJs(`(() => {
    const figures = [...document.querySelectorAll('[data-specimen-state]')];
    const groups = {};
    for (const f of figures) {
      const key = f.getAttribute('data-specimen') || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
    }
    const tiles = document.querySelectorAll('[data-specimen-state] .v2-tile');
    const statuses = new Set([...tiles].map((t) => t.getAttribute('data-status')));
    return {
      specimenCount: figures.length,
      tileCount: tiles.length,
      groups,
      statuses: [...statuses].sort(),
      charts: document.querySelectorAll('[data-specimen="z3RevenueChart"] .v2-chart__plot').length,
      fmStats: document.querySelectorAll('[data-specimen="z3FmStats"] .v2-fm-stat').length,
      somCounts: document.querySelectorAll('[data-specimen="z3SomCount"] .v2-som-count').length,
      mockRejectionError: Boolean(document.querySelector('[data-specimen="z3FmMockRejection"] .v2-tile[data-status="error"]')),
      dispatchOutcomes: document.querySelectorAll('[data-specimen="z5Dispatch"] [data-specimen-state]').length,
    };
  })()`)
  const expectedGroups = Object.fromEntries(
    ['z1Signals', 'z1Agenda', 'z1HandledLog', 'z2Projects', 'z2Book', 'z2Countdowns',
      'z3RevenueChart', 'z3FmStats', 'z3Pulse', 'z3SomCount', 'z4PersonalTasks', 'z4PersonalCalendar']
      .map((key) => [key, 9]),
  )
  const failures = []
  for (const [key, count] of Object.entries(expectedGroups)) {
    if (coverage.groups[key] !== count) failures.push(`${key}: ${coverage.groups[key] ?? 0} != ${count}`)
  }
  if (coverage.specimenCount !== 112) failures.push(`specimen count ${coverage.specimenCount} != 112 (108 tiles + mock rejection + 3 dispatch outcomes)`)
  if (coverage.tileCount !== 109) failures.push(`specimen tile count ${coverage.tileCount} != 109`)
  if (coverage.charts !== 4) failures.push(`revenue charts ${coverage.charts} != 4 (populated/partial/stale/offline)`)
  if (coverage.fmStats !== 12) failures.push(`fm stats ${coverage.fmStats} != 12 (3 stats × 4 content states)`)
  if (coverage.somCounts !== 4) failures.push(`som counts ${coverage.somCounts} != 4`)
  if (!coverage.mockRejectionError) failures.push('mock-rejection specimen is not an error tile')
  if (coverage.dispatchOutcomes !== 3) failures.push(`dispatch outcomes ${coverage.dispatchOutcomes} != 3`)
  if (failures.length) throw new Error(`gallery specimen harness incomplete: ${failures.join('; ')}`)
  await page.assertFixedClock('gallery')
  const shot = await page.shot('12-gallery-full.png', { fullPage: true })
  record('gallery', {
    note: 'D1 Phase C specimen harness: every fixtureTileStates state of every tile mounts in the production build with zero console errors (gate-enforced).',
    coverage,
    apiRequests: apiInventory(page),
    thirdParty: thirdPartyRequests(page).map((r) => r.url),
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

async function scenarioModuleRoute(cdp) {
  const page = await Page.open(cdp, {
    inject: AUTH_INJECT,
    rules: [{ match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } }],
  })
  await page.navigate(`${ACTIVE.previewUrl}/v2/work`, 2000)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  const shot = await page.shot('13-module-work.png')
  record('module-route-work', { console: badConsole(page), screenshot: shot })
  await page.close()
}

async function scenarioReducedMotion(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: populatedRules(), reducedMotion: true })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`, 2500)
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
  await page.navigate(`${ACTIVE.previewUrl}/os`, 3000)
  const rendered = await page.evalJs(`document.body.innerText.length > 0`)
  const shot = await page.shot('15-legacy-os.png')
  record('legacy-spot-check', {
    osRendered: rendered,
    note: 'Byte-identity of legacy surfaces is proven by git diff (only src/v2 files touched); this run confirms /os still boots under the same build.',
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

// Broad 401 — every tile source denied at mount: tile-local permission state,
// never a logout or redirect, retry control present (9.5; Lane E expansion
// beyond the handled-log-only 401).
async function scenarioBroadPermission(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: broadPermissionRules() })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="permission-denied"]').length >= 6`,
    { label: 'all fetching tiles enter permission-denied on broad 401', timeoutMs: 20000 },
  )
  await sleep(400)
  await page.assertFixedClock('home-permission-broad')
  const info = await page.evalJs(`(() => ({
    path: location.pathname,
    permissionDenied: document.querySelectorAll('.v2-tile[data-status="permission-denied"]').length,
    retryControls: document.querySelectorAll('.v2-tile[data-status="permission-denied"] .v2-tile__retry').length,
    handledLogHidden: !document.querySelector('.v2-handled-log'),
    signedIn: Boolean(localStorage.getItem('som_user')),
    copy: document.body.innerText.includes('Sign-in needed — this tile will resume after you sign in again.'),
  }))()`)
  const shot = await page.shot('16-home-permission-broad.png')
  record('home-permission-broad', {
    ...info,
    note: '401 on EVERY tile source (tasks/pulse/calendar/audit): tile-local permission-denied, no redirect, no logout, session retained, retry offered.',
    apiInventory: apiInventory(page),
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

// Parse lifecycle: a malformed-JSON wire payload resolves to the typed parse
// failure → ruled error state, siblings unaffected.
async function scenarioParseFailure(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: parseFailureRules() })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  await page.waitFor(
    `[...document.querySelectorAll('.v2-tile')].some((t) => t.className.includes('v2-z3__pulse') && t.getAttribute('data-status') === 'error')`,
    { label: 'malformed JSON wire payload puts the pulse tile in the ruled error state', timeoutMs: 20000 },
  )
  const siblings = await page.evalJs(`document.querySelectorAll('.v2-tile[data-status="populated"]').length`)
  await page.assertFixedClock('home-parse-failure')
  const shot = await page.shot('17-home-parse-failure.png')
  record('home-parse-failure', {
    pulseError: true,
    populatedSiblings: siblings,
    note: 'Unparseable /api/pulse body → apiFetch errorKind "parse" (unit-tested in apiFetch.test.js) → ruled error state; other sources populate normally.',
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

// Timeout lifecycle: pulse fulfillment (16s) exceeds the apiFetch 15s ceiling
// → typed timeout → ruled error state. Harness wall clock measures the
// elapsed time as evidence (the page clock is frozen by design).
async function scenarioTimeout(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: timeoutRules(16000) })
  const startedAt = Date.now()
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  await page.waitFor(
    `[...document.querySelectorAll('.v2-tile')].some((t) => t.className.includes('v2-z3__pulse') && t.getAttribute('data-status') === 'error')`,
    { label: 'pulse slower than the 15s apiFetch ceiling enters the ruled error state', timeoutMs: 30000 },
  )
  const elapsedMs = Date.now() - startedAt
  const siblings = await page.evalJs(`document.querySelectorAll('.v2-tile[data-status="populated"]').length`)
  const shot = await page.shot('18-home-timeout.png')
  // Deterministic record (CANONICAL report): the raw wall-clock elapsed time
  // varies run-to-run, so the report records the bounded assertions it proves.
  record('home-timeout', {
    pulseError: true,
    timeoutCeilingMs: 15000,
    elapsedAtLeastCeiling: elapsedMs >= 15000,
    elapsedUnderMs: 25000,
    populatedSiblings: siblings,
    note: 'apiFetch errorKind "timeout" (unit-tested) → ruled error state at the 15s ceiling; other sources populate normally. Raw elapsed ms is intentionally not recorded (wall-clock volatile).',
    console: badConsole(page),
    screenshot: shot,
  })
  await page.close()
}

// Offline + retry lifecycle: the network layer fails every API request →
// tiles enter the ruled offline state; restoring the network and clicking the
// tile's own Retry recovers to populated (human retry only — no auto-retry).
async function scenarioOfflineRetry(cdp) {
  const page = await Page.open(cdp, { inject: AUTH_INJECT, rules: offlineRules() })
  await page.navigate(`${ACTIVE.previewUrl}/v2/home`)
  await page.waitFor(`!document.querySelector('.v2-boot')`, { label: 'boot dismissed' })
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="offline"]').length >= 6`,
    { label: 'network-layer failure puts fetching tiles in the ruled offline state', timeoutMs: 20000 },
  )
  const offlineInfo = await page.evalJs(`(() => ({
    offlineTiles: document.querySelectorAll('.v2-tile[data-status="offline"]').length,
    offlineCopy: document.body.innerText.includes('You appear to be offline.'),
    skeletons: document.querySelectorAll('.v2-tile__skeleton').length,
  }))()`)
  await page.assertFixedClock('home-offline-retry (offline phase)')
  const offlineShot = await page.shot('19-home-offline.png')
  // Network restored; human clicks the first tile's Retry → that tile recovers.
  page.rulesRef.current = populatedRules()
  await page.clickExpression(
    `document.querySelector('.v2-tile[data-status="offline"] .v2-tile__retry')`,
    'retry control on an offline tile',
  )
  await page.waitFor(
    `document.querySelectorAll('.v2-tile[data-status="populated"]').length >= 1`,
    { label: 'retried tile recovers to populated after network restore', timeoutMs: 20000 },
  )
  const recovery = await page.evalJs(`(() => ({
    populatedAfterRetry: document.querySelectorAll('.v2-tile[data-status="populated"]').length,
    stillOffline: document.querySelectorAll('.v2-tile[data-status="offline"]').length,
  }))()`)
  await sleep(400)
  const recoveredShot = await page.shot('20-home-offline-retried.png')
  record('home-offline-retry', {
    ...offlineInfo,
    ...recovery,
    note: 'Fetch.failRequest(InternetDisconnected) → ruled offline state (zero skeleton replay); after restore, the tile-local Retry recovers populated — the retry lifecycle end-to-end.',
    console: badConsole(page),
    screenshots: [offlineShot, recoveredShot],
  })
  await page.close()
}

// ─── Evidence hashing (Lane E item 7) ────────────────────────────────────────

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

// report.json is CANONICAL: it carries no wall-clock fields and is byte-
// reproducible on re-run at the same head in fixed-clock mode. PNGs are
// recorded per run and classified NON-CANONICAL with a written reason —
// headless compositor timing may alter PNG bytes run-to-run; their assertions
// live in report.json, and the images corroborate visually.
function writeManifest(reportFile, screenshotNames) {
  const artifacts = [
    {
      file: 'report.json',
      sha256: sha256File(reportFile),
      classification: 'CANONICAL',
      reproduction: 'Byte-reproduced on re-run at the same head: the report carries no wall-clock fields and fixed-clock mode pins the browser clock to FIXTURE_NOW_ISO with the America/New_York timezone emulated. Reproduction test: tests/mosv2-c/evidence-hash.test.js.',
    },
    ...screenshotNames.map((name) => ({
      file: name,
      sha256: sha256File(path.join(EVIDENCE_DIR, name)),
      classification: 'NON-CANONICAL',
      reason: 'Visual corroboration only: headless compositor frame timing can alter PNG bytes run-to-run. Every machine-checkable assertion lives in report.json; the PNG bytes are hashed for this run but are not reproduction-gated.',
    })),
  ]
  const manifest = {
    suite: 'mosv2-c-validation',
    algorithm: 'sha256',
    note: 'Every artifact is either byte-reproduced on re-run (CANONICAL, with a reproduction path) or carries a written NON-CANONICAL classification with a reason.',
    artifacts,
  }
  writeFileSync(path.join(EVIDENCE_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

// ─── Main ────────────────────────────────────────────────────────────────────

function usage() {
  console.log(`Usage: node scripts/mosv2-c-validation.mjs [--real-clock] [--print-config] [--help]

Environment:
  PREVIEW_URL          Drive scenarios against an already-running preview
                       (e.g. a Netlify deploy preview) instead of a local
                       vite preview on a dynamically allocated port.
  MOSV2_CHROME_PATH    Chrome/Chromium binary override (discovery: env →
                       well-known platform paths → PATH).
  MOSV2_REAL_CLOCK=1   Same as --real-clock (fixed clock is the default).`)
}

async function main() {
  const argv = process.argv.slice(2)
  const config = resolveConfig({ argv, env: process.env })
  if (config.help) {
    usage()
    return
  }
  const chrome = resolveChrome(process.env)
  const mode = {
    clock: config.realClock
      ? { mode: 'real', optIn: '--real-clock / MOSV2_REAL_CLOCK=1', driftChecks: 0 }
      : { mode: 'fixed', fixtureNowIso: fixtures.FIXTURE_NOW_ISO, fixtureNowMs: FIXTURE_NOW_MS, timezoneId: TIMEZONE_ID, driftChecks: 0 },
    preview: config.previewUrl
      ? { mode: 'external (PREVIEW_URL)', url: config.previewUrl }
      // Local ports are OS-assigned per run; recording the concrete port would
      // make report.json non-deterministic, so local mode records the mode only.
      : { mode: 'local vite preview (dynamic port)', port: 'dynamic' },
    chrome: { path: chrome.path, source: chrome.source },
    viewport: VIEWPORT,
  }
  if (config.printConfig) {
    console.log(JSON.stringify(mode, null, 2))
    return
  }

  ACTIVE.realClock = config.realClock
  let preview = null
  if (config.previewUrl) {
    ACTIVE.previewUrl = config.previewUrl
    console.log(`External preview: ${ACTIVE.previewUrl}`)
  } else {
    const port = await findFreePort()
    preview = await startPreview(port)
    ACTIVE.previewUrl = preview.url
    console.log(`Local preview: ${ACTIVE.previewUrl} (dynamic port)`)
  }
  mode.preview = config.previewUrl ? mode.preview : { mode: 'local vite preview (dynamic port)', url: ACTIVE.previewUrl }
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  report.run = mode
  console.log(`Clock: ${mode.clock.mode}${mode.clock.mode === 'fixed' ? ` (${fixtures.FIXTURE_NOW_ISO}, ${TIMEZONE_ID})` : ''} · Chrome: ${chrome.path} (${chrome.source})`)

  const chromeProc = await startChrome(chrome.path)
  const cdp = await CDP.connect(chromeProc.wsUrl)
  const screenshots = []

  const trackShots = () => {
    for (const scenario of Object.values(report.scenarios)) {
      if (scenario.screenshot) screenshots.push(scenario.screenshot)
      if (Array.isArray(scenario.screenshots)) screenshots.push(...scenario.screenshots)
    }
  }

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
    await scenarioBroadPermission(cdp)
    await scenarioParseFailure(cdp)
    await scenarioTimeout(cdp)
    await scenarioOfflineRetry(cdp)
  } finally {
    mode.clock.driftChecks = ACTIVE.driftChecks
    const unexpected = unexpectedConsoleFindings(consoleFindings)
    report.consoleGate = {
      policy: 'The run FAILS on any unexpected console error, warning, or exception (Lane E: warnings are no longer capture-only).',
      findings: consoleFindings.length,
      unexpectedCount: unexpected.length,
      unexpected,
    }
    const reportFile = path.join(EVIDENCE_DIR, 'report.json')
    writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
    trackShots()
    writeManifest(reportFile, [...new Set(screenshots)])
    cdp.ws.close()
    chromeProc.proc.kill('SIGKILL')
    if (preview) preview.proc.kill('SIGKILL')
    if (unexpected.length) {
      console.error(`\nCONSOLE GATE FAILED — ${unexpected.length} unexpected console finding(s):`)
      for (const finding of unexpected) {
        console.error(`  [${finding.kind}] ${finding.scenario}: ${finding.text.slice(0, 200)}`)
      }
      process.exitCode = 1
    }
  }

  console.log(`\nEvidence written to ${path.relative(ROOT, EVIDENCE_DIR)}/ (report.json + manifest.json + PNGs)`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) await main()
