#!/usr/bin/env node
// scripts/founder-home-qa.mjs — Founder Home (feat/founder-home-mobile) mobile QA driver.
// Branch-only evidence: drives the production build's /v2/founder route through
// headless Chrome over CDP at phone viewports 390×844 and 393×852, with every
// backend response served by LOCAL request interception (repo fixtures +
// scenario-local long-copy payloads defined here). Zero live network.
//
// Scenario matrix per viewport:
//   populated / loading / error / empty / permission / broad-permission /
//   offline / long-copy
// Plus stale-unverified at 390×844 only (populated → network dropped → cadence
// refresh fails with last-good retained → STALE → UNVERIFIED chips, data held).
//
// Gates (any failure → exit 1):
//   · zero horizontal overflow in every scenario
//   · every rendered interactive element (a, button) ≥ 44px in both dimensions
//     where visible (retry links, launchers)
//   · zero unexpected console errors / exceptions
//   · scenario-specific truth-chip and copy assertions
//
// Output: docs/vault/evidence/founder-home-qa/ (report.json + PNGs)
// Usage:  node scripts/founder-home-qa.mjs
//         PREVIEW_URL=http://127.0.0.1:PORT node scripts/founder-home-qa.mjs

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'vault', 'evidence', 'founder-home-qa')
const TIMEZONE_ID = 'America/New_York'
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '393x852', width: 393, height: 852 },
]

const fixtures = await import(path.join(ROOT, 'src', 'v2', 'data', 'fixtures.js'))
const {
  fixtureProjectTasks, fixturePulse, fixtureAgenda, fixturePersonalCalendar, fixtureHandledLog,
} = fixtures
const FIXTURE_NOW_MS = new Date(fixtures.FIXTURE_NOW_ISO).getTime()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Browser / preview process management (mirrors mosv2-c harness) ──────────

function which(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout.split('\n').map((line) => line.trim()).find(Boolean) ?? null
}

function resolveChrome() {
  const fromEnv = process.env.MOSV2_CHROME_PATH || process.env.CHROME_PATH
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`MOSV2_CHROME_PATH does not exist: ${fromEnv}`)
    return fromEnv
  }
  const wellKnown = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (existsSync(wellKnown)) return wellKnown
  const onPath = which('google-chrome') || which('chromium')
  if (onPath) return onPath
  throw new Error('No Chrome/Chromium found — set MOSV2_CHROME_PATH')
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

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
  const profile = mkdtempSync(path.join(tmpdir(), 'founder-qa-chrome-'))
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
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

// ─── Minimal CDP client ──────────────────────────────────────────────────────

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

// ─── Interception rule sets ──────────────────────────────────────────────────

const VERIFY_USER = { email: 'validation@local', name: 'Denarius', role: 'executive' }

function wire(obj, drop = []) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => key !== 'classification' && !drop.includes(key)),
  )
}

function populatedRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/tasks'), body: wire(fixtureProjectTasks) },
    { match: (url) => url.includes('/api/pulse'), body: wire(fixturePulse, ['expectedCounts']) },
    {
      match: (url) => url.includes('/api/mya/calendar/events'),
      body: { events: [...fixtureAgenda.events, ...fixturePersonalCalendar.events], fetched_at: fixtures.FIXTURE_NOW_ISO },
    },
    { match: (url) => url.includes('/api/mya/audit/handled'), body: { items: fixtureHandledLog.items } },
  ]
}

function delayedPopulatedRules(delayMs) {
  return populatedRules().map((rule) => (
    rule.match.toString().includes('auth') ? rule : { ...rule, delayMs }
  ))
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
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/tasks'), body: wire(fixtureProjectTasks) },
    { match: (url) => url.includes('/api/pulse'), body: wire(fixturePulse, ['expectedCounts']) },
    {
      match: (url) => url.includes('/api/mya/calendar/events'),
      body: { events: [...fixtureAgenda.events, ...fixturePersonalCalendar.events], fetched_at: fixtures.FIXTURE_NOW_ISO },
    },
    { match: (url) => url.includes('/api/mya/audit/handled'), status: 401, body: { detail: 'Unauthorized' } },
  ]
}

function broadPermissionRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/'), status: 401, body: { detail: 'Unauthorized' } },
  ]
}

function offlineRules() {
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/'), fail: 'InternetDisconnected' },
  ]
}

// ─── Long-copy scenario fixtures (QA-local; fixtures.js untouched) ──────────
// 120+ char titles, 300+ char next_action / latest_update_summary, long
// business name — the wrapping/no-overflow stress case the GO requires.

const LONG_TITLE = 'Board packet: confirm the autumn touring and curriculum rollout narrative across every single Motesart business line'
const LONG_NEXT_ACTION = 'Pull the consolidated Friday operating numbers, reconcile them against the Airtable master ledger, draft the variance explanation for the board packet, and circulate it to every executive agent for sign-off before the Monday morning operating review with the full leadership group in attendance'
const LONG_UPDATE = 'E7A Executive reported the consolidated distribution dashboard refresh is now reconciled against the master ledger; remaining variance note is drafted and awaiting founder sign-off before Monday circulation'
const LONG_BUSINESS = 'School of Motesart'

const longTask = (id, overrides = {}) => ({
  id,
  business: LONG_BUSINESS,
  title: `${LONG_TITLE} (${id})`,
  status: 'in_progress',
  priority: 'urgent',
  owner: 'Denarius',
  assigned_agent: 'SOM Executive',
  due_date: '2026-08-04',
  next_action: LONG_NEXT_ACTION,
  latest_update_summary: LONG_UPDATE,
  created_at: '2026-07-28T14:00:00-04:00',
  ...overrides,
})

function longCopyRules() {
  const tasks = [
    longTask('rec-qa-long-1'),
    longTask('rec-qa-long-2', { priority: 'high', status: 'pending' }),
    { id: 'rec-qa-short-1', business: 'E7A', title: 'Sync licensing quote', status: 'pending', priority: 'low', owner: 'Denarius', created_at: '2026-08-01T10:15:00-04:00' },
  ]
  const pulse = {
    ok: true,
    pulse: {
      urgent: [longTask('rec-qa-pulse-1')],
      overdue: [longTask('rec-qa-pulse-2', { status: 'in_progress', priority: 'high' })],
      blocked: [],
      approval: [longTask('rec-qa-pulse-3', { status: 'pending' })],
      done_today: [longTask('rec-qa-pulse-4', { status: 'done' })],
      stale: [],
    },
  }
  return [
    { match: (url) => url.includes('/auth/verify'), body: { valid: true, user: VERIFY_USER, exp: null } },
    { match: (url) => url.includes('/api/tasks'), body: { ok: true, count: tasks.length, tasks } },
    { match: (url) => url.includes('/api/pulse'), body: pulse },
    {
      match: (url) => url.includes('/api/mya/calendar/events'),
      body: {
        events: [{ title: `Quarterly operating review — full leadership readout on the autumn rollout narrative`, start: '2026-08-02T21:00:00-04:00', end: '2026-08-02T22:30:00-04:00' }],
        fetched_at: fixtures.FIXTURE_NOW_ISO,
      },
    },
    { match: (url) => url.includes('/api/mya/audit/handled'), body: { items: [{ timestamp: '2026-08-02T19:41:00-04:00', route: 'create_task', result_summary: LONG_UPDATE, response_text: LONG_UPDATE }] } },
  ]
}

// ─── Page harness ────────────────────────────────────────────────────────────

const AUTH_INJECT = `
  window.MOS_V2 = true;
  try {
    localStorage.setItem('som_user', ${JSON.stringify(JSON.stringify(VERIFY_USER))});
    localStorage.setItem('som_token', 'validation-probe-token');
  } catch (error) { /* storage unavailable */ }
`

function fixedClockSource(fixtureNowMs) {
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

class Page {
  static async open(cdp, { viewport, rules = null } = {}) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    const page = new Page()
    page.cdp = cdp
    page.sessionId = sessionId
    page.targetId = targetId
    page.viewport = viewport
    page.consoleEntries = []
    page.exceptions = []

    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Network.enable')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 2, mobile: true,
    })
    await page.send('Emulation.setTimezoneOverride', { timezoneId: TIMEZONE_ID })
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: fixedClockSource(FIXTURE_NOW_MS) })
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: AUTH_INJECT })

    cdp.onEvent((msg) => {
      if (msg.sessionId !== sessionId) return
      if (msg.method === 'Runtime.consoleAPICalled') {
        page.consoleEntries.push({
          type: msg.params.type,
          text: msg.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '),
        })
      } else if (msg.method === 'Runtime.exceptionThrown') {
        page.exceptions.push(msg.params.exceptionDetails.text + ' ' +
          (msg.params.exceptionDetails.exception?.description ?? ''))
      }
    })

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
            await page.send('Fetch.failRequest', { requestId, errorReason: rule.fail })
          } else {
            if (rule.delayMs) await sleep(rule.delayMs)
            const requestedHeaders = request.headers?.['Access-Control-Request-Headers']
              ?? request.headers?.['access-control-request-headers']
            await page.send('Fetch.fulfillRequest', {
              requestId,
              responseCode: rule.status ?? 200,
              responseHeaders: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Access-Control-Allow-Origin', value: '*' },
                { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
                { name: 'Access-Control-Allow-Headers', value: requestedHeaders ?? 'Authorization, Content-Type' },
              ],
              body: Buffer.from(JSON.stringify(rule.body ?? {})).toString('base64'),
            })
          }
        } catch { /* target gone */ }
      }
      respond()
    })
    return page
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId)
  }

  async navigate(url, settleMs = 0) {
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

  async waitFor(expression, { timeoutMs = 20000, label = expression } = {}) {
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

  async shot(name, { fullPage = true, settleMs = 1200 } = {}) {
    await this.send('Runtime.evaluate', {
      expression: 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 60))))',
      awaitPromise: true,
    })
    await sleep(settleMs)
    const params = { format: 'png' }
    if (fullPage) {
      const metrics = await this.send('Page.getLayoutMetrics')
      const height = Math.min(Math.ceil(metrics.cssContentSize.height), 16000)
      params.clip = { x: 0, y: 0, width: this.viewport.width, height, scale: 1 }
      params.captureBeyondViewport = true
    }
    const { data } = await this.send('Page.captureScreenshot', params)
    const file = path.join(EVIDENCE_DIR, name)
    writeFileSync(file, Buffer.from(data, 'base64'))
    return name
  }

  // Layout + a11y metrics for the GO-mandated checks.
  async metrics() {
    return this.evalJs(`(() => {
      const doc = document.documentElement;
      const interactive = [...document.querySelectorAll('a, button')];
      const small = interactive
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && (r.height < 44 || r.width < 44);
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          text: (el.textContent || '').trim().slice(0, 40),
          w: Math.round(el.getBoundingClientRect().width),
          h: Math.round(el.getBoundingClientRect().height),
        }));
      const chips = [...document.querySelectorAll('.fh-section[data-truth]')]
        .map((el) => ({ section: el.getAttribute('aria-label'), truth: el.getAttribute('data-truth') }));
      const launcherChips = [...document.querySelectorAll('.fh-launcher .fh-chip')]
        .map((el) => el.textContent.trim());
      const nextActions = [...document.querySelectorAll('.fh-task__next')]
        .map((el) => ({ wrap: getComputedStyle(el).overflowWrap, chars: el.textContent.length }));
      return {
        innerWidth: window.innerWidth,
        scrollWidth: doc.scrollWidth,
        hOverflow: doc.scrollWidth > window.innerWidth + 1,
        sections: document.querySelectorAll('.fh-section').length,
        chips,
        launcherChips,
        smallTargets: small,
        nextActions,
        rootPaddingBottom: getComputedStyle(document.querySelector('.fh-root')).paddingBottom,
        skeletons: document.querySelectorAll('.fh-skeleton').length,
        retries: document.querySelectorAll('.fh-retry').length,
        taskRows: document.querySelectorAll('.fh-task').length,
        events: document.querySelectorAll('.fh-event').length,
      };
    })()`)
  }

  async close() {
    await this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {})
  }
}

// ─── Report + gates ──────────────────────────────────────────────────────────

const report = { suite: 'founder-home-qa', run: null, scenarios: {}, gates: null }
const gateFailures = []

function gate(condition, message) {
  if (!condition) gateFailures.push(message)
}

function badConsole(page) {
  return {
    errors: page.consoleEntries.filter((e) => e.type === 'error'),
    warnings: page.consoleEntries.filter((e) => e.type === 'warning'),
    exceptions: page.exceptions.map((text) => ({ text })),
  }
}

async function runScenario(cdp, viewport, name, rules, opts = {}) {
  const page = await Page.open(cdp, { viewport, rules })
  const key = `${viewport.name}/${name}`
  try {
    await page.navigate(`${ACTIVE.previewUrl}/v2/founder`)
    await page.waitFor(opts.waitFor, { label: `${key}: ${opts.waitLabel}` })
    if (opts.settleMs) await sleep(opts.settleMs)
    const metrics = await page.metrics()
    const shotName = `${viewport.name}-${name}.png`
    await page.shot(shotName, { fullPage: true })
    const consoleData = badConsole(page)
    const text = opts.textChecks ? await page.evalJs('document.body.innerText') : null
    const textHits = opts.textChecks
      ? Object.fromEntries(opts.textChecks.map((needle) => [needle, text.includes(needle)]))
      : null
    const pathname = await page.evalJs('location.pathname')
    report.scenarios[key] = { metrics, textHits, pathname, console: consoleData, screenshot: shotName }

    // Universal gates.
    gate(metrics.hOverflow === false, `${key}: horizontal overflow (scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth})`)
    gate(metrics.smallTargets.length === 0, `${key}: ${metrics.smallTargets.length} interactive target(s) under 44px: ${JSON.stringify(metrics.smallTargets.slice(0, 3))}`)
    gate(consoleData.errors.length === 0, `${key}: console errors: ${consoleData.errors.map((e) => e.text).join(' | ').slice(0, 200)}`)
    gate(consoleData.exceptions.length === 0, `${key}: page exceptions: ${consoleData.exceptions.map((e) => e.text).join(' | ').slice(0, 200)}`)
    if (textHits) {
      for (const [needle, hit] of Object.entries(textHits)) {
        gate(hit, `${key}: expected copy missing: "${needle}"`)
      }
    }
    if (opts.extraChecks) await opts.extraChecks(page, metrics, key)
    console.log(`✓ ${key}`)
  } finally {
    await page.close()
  }
}

const chipTruth = (metrics, section) =>
  metrics.chips.find((chip) => chip.section === section)?.truth

// ─── Scenario definitions ────────────────────────────────────────────────────

const SETTLED = `document.querySelectorAll('.fh-section').length >= 9 && document.querySelectorAll('.fh-skeleton').length === 0`

async function scenarioPopulated(cdp, viewport) {
  await runScenario(cdp, viewport, 'populated', populatedRules(), {
    waitFor: SETTLED,
    waitLabel: 'all sections settled',
    settleMs: 500,
    textChecks: [
      // Section titles render uppercase via .fh-section__head h2 — innerText
      // reflects the rendered transform, so the design-intent strings are
      // uppercase here.
      'MYA BRIEFING',
      'ONE REQUIRED ACTION',
      'TODAY',
      'TOP PRIORITIES',
      'APPROVALS WAITING',
      'BLOCKERS',
      'ACTIVE WORK',
      'RECENT COMPLETIONS',
      'SYSTEM HEALTH',
      'LAUNCHERS',
      'Mix revisions — single 3',
      // Pulse-derived content (the viewData regression class): briefing line,
      // required action (approval outranks urgent), approvals, blockers,
      // completions must all render from the fixture pulse payload.
      '1 approval waiting',
      'APPROVAL NEEDED',
      'Curriculum outline — level 2',
      'Chapter 7 second pass',
      'Pay studio invoice',
      // Handled-log must render through mapHandledLog (G9 result_summary /
      // response_text fallback), not the raw payload.
      'MYA last handled: Task routed to E7A Executive',
    ],
    extraChecks: async (page, metrics, key) => {
      gate(chipTruth(metrics, 'MYA Briefing') === 'LIVE', `${key}: briefing chip not LIVE: ${chipTruth(metrics, 'MYA Briefing')}`)
      gate(chipTruth(metrics, 'Top Priorities') === 'LIVE', `${key}: priorities chip not LIVE`)
      gate(metrics.launcherChips.includes('STAGED'), `${key}: no STAGED launcher chip (fixture must never look live)`)
      gate(metrics.launcherChips.includes('LIVE'), `${key}: no LIVE launcher chip`)
      gate(metrics.events >= 3, `${key}: expected >=3 events, got ${metrics.events}`)
      gate(metrics.taskRows >= 5, `${key}: expected >=5 task rows, got ${metrics.taskRows}`)
    },
  })
}

async function scenarioLoading(cdp, viewport) {
  await runScenario(cdp, viewport, 'loading', delayedPopulatedRules(6000), {
    waitFor: `document.querySelectorAll('.fh-skeleton').length >= 4`,
    waitLabel: 'skeletons visible while sources in flight',
    extraChecks: async (page, metrics, key) => {
      gate(metrics.skeletons >= 4, `${key}: expected >=4 skeletons, got ${metrics.skeletons}`)
    },
  })
}

async function scenarioError(cdp, viewport) {
  await runScenario(cdp, viewport, 'error', errorRules(), {
    waitFor: SETTLED,
    waitLabel: 'all sections settled in error state',
    settleMs: 500,
    textChecks: ['Source unreachable', 'Retry'],
    extraChecks: async (page, metrics, key) => {
      gate(chipTruth(metrics, 'Top Priorities') === 'UNAVAILABLE', `${key}: error chip not UNAVAILABLE`)
      gate(metrics.retries >= 4, `${key}: expected >=4 retry targets, got ${metrics.retries}`)
    },
  })
}

async function scenarioEmpty(cdp, viewport) {
  await runScenario(cdp, viewport, 'empty', emptyRules(), {
    waitFor: SETTLED,
    waitLabel: 'all sections settled in empty state',
    settleMs: 500,
    textChecks: [
      'No fires',
      'No single action required right now.',
      'Nothing scheduled today.',
      'No urgent or high-priority tasks open.',
      'Nothing waiting on your approval.',
      'No blockers or overdue work.',
      'No work in progress.',
      'Nothing completed yet today.',
    ],
    extraChecks: async (page, metrics, key) => {
      // Empty is a truthful zero → LIVE, never fabricated.
      gate(chipTruth(metrics, 'Top Priorities') === 'LIVE', `${key}: empty tasks chip not LIVE`)
      gate(chipTruth(metrics, 'Today') === 'LIVE', `${key}: empty calendar chip not LIVE`)
    },
  })
}

async function scenarioPermission(cdp, viewport) {
  await runScenario(cdp, viewport, 'permission', permissionRules(), {
    waitFor: SETTLED,
    waitLabel: 'sections settled with audit 401',
    settleMs: 500,
    textChecks: ['MYA log: sign-in needed.'],
    extraChecks: async (page, metrics, key) => {
      gate(chipTruth(metrics, 'Top Priorities') === 'LIVE', `${key}: siblings must stay LIVE on audit 401`)
      const health = await page.evalJs(`(() => {
        const row = [...document.querySelectorAll('.fh-health li')].find((li) => li.textContent.includes('MYA log'));
        return row ? row.querySelector('.fh-chip').textContent : null;
      })()`)
      gate(health && health.includes('UNAVAILABLE'), `${key}: MYA log health chip not UNAVAILABLE: ${health}`)
    },
  })
}

async function scenarioBroadPermission(cdp, viewport) {
  await runScenario(cdp, viewport, 'broad-permission', broadPermissionRules(), {
    waitFor: SETTLED,
    waitLabel: 'all sections settled in permission-denied state',
    settleMs: 500,
    textChecks: ['Sign-in needed'],
    extraChecks: async (page, metrics, key) => {
      gate(chipTruth(metrics, 'Top Priorities') === 'UNAVAILABLE', `${key}: 401 chip not UNAVAILABLE`)
      const pathname = await page.evalJs('location.pathname')
      gate(pathname === '/v2/founder', `${key}: redirected away on 401: ${pathname}`)
    },
  })
}

async function scenarioOffline(cdp, viewport) {
  await runScenario(cdp, viewport, 'offline', offlineRules(), {
    waitFor: SETTLED,
    waitLabel: 'all sections settled in offline state',
    settleMs: 500,
    textChecks: ['You appear to be offline.'],
    extraChecks: async (page, metrics, key) => {
      gate(chipTruth(metrics, 'Top Priorities') === 'UNAVAILABLE', `${key}: first-load offline chip not UNAVAILABLE`)
    },
  })
}

async function scenarioLongCopy(cdp, viewport) {
  await runScenario(cdp, viewport, 'long-copy', longCopyRules(), {
    waitFor: SETTLED,
    waitLabel: 'sections settled with long-copy payloads',
    settleMs: 500,
    textChecks: ['Board packet: confirm the autumn touring', 'Pull the consolidated Friday operating numbers'],
    extraChecks: async (page, metrics, key) => {
      gate(metrics.nextActions.length > 0, `${key}: no long next-action rows rendered`)
      gate(metrics.nextActions.every((entry) => entry.wrap === 'anywhere'), `${key}: next-action overflow-wrap not anywhere: ${JSON.stringify(metrics.nextActions.slice(0, 2))}`)
      gate(metrics.nextActions.some((entry) => entry.chars > 250), `${key}: long next-action copy (>250 chars) not present`)
    },
  })
}

// Stale/unverified: populated first, then the network drops. The 60s cadence
// refresh fails with last-good retained → STALE → UNVERIFIED chips, data held.
// 390×844 only (cadence wait dominates runtime; layout is covered elsewhere).
async function scenarioStaleUnverified(cdp, viewport) {
  const page = await Page.open(cdp, { viewport, rules: populatedRules() })
  const key = `${viewport.name}/stale-unverified`
  try {
    await page.navigate(`${ACTIVE.previewUrl}/v2/founder`)
    await page.waitFor(SETTLED, { label: `${key}: initial populated settle` })
    await sleep(500)
    const before = await page.metrics()
    gate(chipTruth(before, 'Top Priorities') === 'LIVE', `${key}: pre-drop chip not LIVE`)

    page.rulesRef.current = offlineRules()
    const deadline = Date.now() + 90000
    let stale = null
    while (Date.now() < deadline) {
      await sleep(2000)
      stale = await page.metrics()
      if (chipTruth(stale, 'Top Priorities') === 'UNVERIFIED' && chipTruth(stale, 'MYA Briefing') === 'UNVERIFIED') break
    }
    const consoleData = badConsole(page)
    const shotName = `${viewport.name}-stale-unverified.png`
    await page.shot(shotName, { fullPage: true })
    const text = await page.evalJs('document.body.innerText')
    report.scenarios[key] = {
      metrics: stale,
      pathname: await page.evalJs('location.pathname'),
      console: consoleData,
      screenshot: shotName,
      note: 'Network dropped after populated load; 60s cadence refresh failed with last-good retained (STALE).',
    }
    gate(stale && chipTruth(stale, 'Top Priorities') === 'UNVERIFIED', `${key}: tasks chip did not flip to UNVERIFIED after failed refresh`)
    gate(chipTruth(stale, 'MYA Briefing') === 'UNVERIFIED', `${key}: pulse chip did not flip to UNVERIFIED after failed refresh`)
    gate(stale.hOverflow === false, `${key}: horizontal overflow in stale state`)
    gate(text.includes('Mix revisions — single 3'), `${key}: last-good data no longer rendered in stale state`)
    gate(text.includes('as of'), `${key}: stale chip missing "as of" freshness detail`)
    gate(consoleData.errors.length === 0, `${key}: console errors: ${consoleData.errors.map((e) => e.text).join(' | ').slice(0, 200)}`)
    console.log(`✓ ${key}`)
  } finally {
    await page.close()
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ACTIVE = { previewUrl: null }

async function main() {
  const chromePath = resolveChrome()
  const externalPreview = process.env.PREVIEW_URL?.trim().replace(/\/+$/, '') || null
  let preview = null
  if (externalPreview) {
    ACTIVE.previewUrl = externalPreview
  } else {
    const port = await findFreePort()
    preview = await startPreview(port)
    ACTIVE.previewUrl = preview.url
  }
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  report.run = {
    note: 'Branch-only QA evidence for feat/founder-home-mobile. Not production evidence.',
    preview: externalPreview ? 'external (PREVIEW_URL)' : 'local vite preview (dynamic port)',
    clock: { mode: 'fixed', fixtureNowIso: fixtures.FIXTURE_NOW_ISO, timezoneId: TIMEZONE_ID },
    chrome: chromePath,
    viewports: VIEWPORTS,
  }
  console.log(`Preview: ${ACTIVE.previewUrl} · Chrome: ${chromePath} · clock fixed at ${fixtures.FIXTURE_NOW_ISO}`)

  const chromeProc = await startChrome(chromePath)
  const cdp = await CDP.connect(chromeProc.wsUrl)
  try {
    for (const viewport of VIEWPORTS) {
      await scenarioPopulated(cdp, viewport)
      await scenarioLoading(cdp, viewport)
      await scenarioError(cdp, viewport)
      await scenarioEmpty(cdp, viewport)
      await scenarioPermission(cdp, viewport)
      await scenarioBroadPermission(cdp, viewport)
      await scenarioOffline(cdp, viewport)
      await scenarioLongCopy(cdp, viewport)
    }
    await scenarioStaleUnverified(cdp, VIEWPORTS[0])
  } finally {
    report.gates = {
      policy: 'Fail on: any horizontal overflow, any interactive target under 44px, any console error/exception, any missing required copy, any wrong truth chip.',
      failures: gateFailures,
    }
    writeFileSync(path.join(EVIDENCE_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    cdp.ws.close()
    chromeProc.proc.kill('SIGKILL')
    if (preview) preview.proc.kill('SIGKILL')
    if (gateFailures.length) {
      console.error(`\nQA GATES FAILED — ${gateFailures.length} finding(s):`)
      for (const failure of gateFailures) console.error(`  · ${failure}`)
      process.exitCode = 1
    }
  }
  console.log(`\nEvidence written to ${path.relative(ROOT, EVIDENCE_DIR)}/ (report.json + PNGs)`)
}

await main()
