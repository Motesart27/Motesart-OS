// harness-config.test.js — Lane E CLI/config proofs for the validation
// harness (frozen matrix §4 fixed clock + §9 PREVIEW_URL override; founder
// item 10 dynamic port + browser discovery). Covers BOTH clock modes, the
// PREVIEW_URL override, browser discovery order, dynamic port allocation,
// and the drift-rejection predicate — fast and Chrome-free; the end-to-end
// --print-config spawn proves the script wires the flags without launching
// a browser.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  clockDrift,
  findFreePort,
  fixedClockSource,
  resolveChrome,
  resolveConfig,
} from '../../scripts/mosv2-c-validation.mjs'

const SCRIPT = fileURLToPath(new URL('../../scripts/mosv2-c-validation.mjs', import.meta.url))

describe('harness config · clock modes (matrix §4)', () => {
  it('fixed clock is the DEFAULT — no flag, no env', () => {
    const config = resolveConfig({ argv: [], env: {} })
    assert.equal(config.realClock, false)
  })

  it('real clock requires explicit opt-in: --real-clock', () => {
    assert.equal(resolveConfig({ argv: ['--real-clock'], env: {} }).realClock, true)
  })

  it('real clock requires explicit opt-in: MOSV2_REAL_CLOCK=1', () => {
    assert.equal(resolveConfig({ argv: [], env: { MOSV2_REAL_CLOCK: '1' } }).realClock, true)
    assert.equal(resolveConfig({ argv: [], env: { MOSV2_REAL_CLOCK: '0' } }).realClock, false)
    assert.equal(resolveConfig({ argv: [], env: { MOSV2_REAL_CLOCK: 'true' } }).realClock, false, 'only the explicit "1" opts in')
  })

  it('the injected clock pin freezes Date at the fixture now but passes explicit args through', () => {
    const source = fixedClockSource(1780000000000)
    assert.match(source, /const FIXED_NOW = 1780000000000;/)
    assert.match(source, /static now\(\) \{ return FIXED_NOW; \}/)
    assert.match(source, /args\.length === 0 \? \[FIXED_NOW\] : args/, 'no-arg construction freezes; dated construction stays real')
    assert.match(source, /class FrozenDate extends RealDate/, 'Date.parse/UTC/prototype survive inheritance')
  })

  it('drift rejection: identical ms passes, any other ms fails with both instants named', () => {
    const fixtureMs = new Date('2026-08-02T20:00:00-04:00').getTime()
    assert.equal(clockDrift(fixtureMs, fixtureMs), null)
    const drift = clockDrift(fixtureMs + 1000, fixtureMs)
    assert.match(drift, /clock drift from FIXTURE_NOW_ISO/)
    assert.match(drift, /2026-08-03T00:00:01\.000Z/, 'observed instant named')
  })
})

describe('harness config · PREVIEW_URL override (matrix §9)', () => {
  it('unset PREVIEW_URL → local preview mode', () => {
    assert.equal(resolveConfig({ argv: [], env: {} }).previewUrl, null)
    assert.equal(resolveConfig({ argv: [], env: { PREVIEW_URL: '   ' } }).previewUrl, null, 'blank env is not an override')
  })

  it('PREVIEW_URL drives the harness and trailing slashes are normalized', () => {
    const config = resolveConfig({ argv: [], env: { PREVIEW_URL: ' https://deploy-preview-31--motesart-os.netlify.app/ ' } })
    assert.equal(config.previewUrl, 'https://deploy-preview-31--motesart-os.netlify.app')
  })
})

describe('harness config · browser discovery (founder item 10)', () => {
  it('env override wins and must exist', () => {
    const resolved = resolveChrome({ MOSV2_CHROME_PATH: '/usr/bin/true' }, 'linux')
    assert.deepEqual(resolved, { path: '/usr/bin/true', source: 'env' })
  })

  it('a nonexistent env override is a hard error, never a silent fallback', () => {
    assert.throws(
      () => resolveChrome({ MOSV2_CHROME_PATH: '/nonexistent/browser-xyz' }, 'linux'),
      /MOSV2_CHROME_PATH does not exist/,
    )
  })

  it('platform candidates include well-known paths and PATH lookups', () => {
    // Whatever the CI machine looks like, discovery must either resolve or
    // throw the actionable error — never reference a single hard-coded path.
    try {
      const resolved = resolveChrome({}, process.platform)
      assert.ok(resolved.path.length > 0)
      assert.ok(['env', 'well-known', 'PATH'].includes(resolved.source))
    } catch (error) {
      assert.match(error.message, /set MOSV2_CHROME_PATH/)
    }
  })
})

describe('harness config · dynamic port (founder item 10)', () => {
  it('findFreePort returns an OS-assigned free port (never a fixed number)', async () => {
    const [a, b] = await Promise.all([findFreePort(), findFreePort()])
    assert.ok(a > 0 && b > 0)
    assert.notEqual(a, b, 'two allocations never collide')
    assert.notEqual(a, 4619, 'the old fixed port is gone')
  })
})

describe('harness config · --print-config end-to-end (no browser launched)', () => {
  it('prints the resolved fixed-clock config and exits 0', () => {
    const out = execFileSync('node', [SCRIPT, '--print-config'], {
      encoding: 'utf8',
      env: { ...process.env, MOSV2_CHROME_PATH: '/usr/bin/true' },
    })
    const config = JSON.parse(out)
    assert.equal(config.clock.mode, 'fixed')
    assert.match(config.clock.fixtureNowIso, /^2026-08-02T20:00:00-04:00$/, 'fixed mode derives from fixtures.js FIXTURE_NOW_ISO')
    assert.equal(config.clock.timezoneId, 'America/New_York')
    assert.equal(config.preview.mode, 'local vite preview (dynamic port)')
    assert.deepEqual(config.chrome, { path: '/usr/bin/true', source: 'env' })
  })

  it('real-clock opt-in and PREVIEW_URL are reflected', () => {
    const out = execFileSync('node', [SCRIPT, '--print-config', '--real-clock'], {
      encoding: 'utf8',
      env: { ...process.env, MOSV2_CHROME_PATH: '/usr/bin/true', PREVIEW_URL: 'https://deploy-preview-31--motesart-os.netlify.app' },
    })
    const config = JSON.parse(out)
    assert.equal(config.clock.mode, 'real')
    assert.equal(config.preview.mode, 'external (PREVIEW_URL)')
    assert.equal(config.preview.url, 'https://deploy-preview-31--motesart-os.netlify.app')
  })
})
