// perf-proof.test.js — MOSV2-C performance-stage proof (AGENTS.md performance
// non-negotiables; PLAN §14 proof-package items that are provable statically):
// every keyframes animation targets compositor/paint properties only, chart
// draw-in replays on mount + range change only (never on data refresh), and
// the shipped __MOSV2_PHASE_B_PERF__ layout-shift observer that supplies the
// §14 CLS numbers. Bundle-size numbers vs the 80 kB gz ceiling are build
// evidence and live in the governed proof document, not in this suite.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const STYLESHEETS = [
  '../../src/v2/tokens.css',
  '../../src/v2/shell/shell.css',
  '../../src/v2/components/components.css',
  '../../src/v2/zones/zones.css',
  '../../src/v2/gallery.css',
]

const shellSource = read('../../src/v2/shell/index.jsx')
const z3Source = read('../../src/v2/zones/Z3Business.jsx')
const zonesCss = read('../../src/v2/zones/zones.css')

// ─── keyframes property audit ───────────────────────────────────────────────

// Compositor-only (transform/opacity) plus SVG stroke draw-ins, which are
// paint-only and never trigger layout.
const ALLOWED_KEYFRAME_PROPS = new Set(['transform', 'opacity', 'stroke-dashoffset', 'stroke-dasharray'])

// Pre-existing Phase B deviations, pinned by exact name so any NEW violation
// fails this suite while the recorded ones stay visible. Follow-up recorded
// in the MOSV2-C failure/perf proof document:
//   v2-fill         — Phase B v2-progress fill animates `width` (layout)
//   v2-system-pulse — Phase B status dot animates `box-shadow` (paint)
const KNOWN_DEVIATIONS = new Map([
  ['v2-fill', new Set(['width'])],
  ['v2-system-pulse', new Set(['box-shadow'])],
])

function keyframesAudit(css, filename) {
  const found = []
  let from = 0
  for (;;) {
    const at = css.indexOf('@keyframes', from)
    if (at === -1) return found
    const name = css.slice(at).match(/@keyframes\s+([A-Za-z0-9_-]+)/)[1]
    const open = css.indexOf('{', at)
    let depth = 0
    let close = open
    for (; close < css.length; close += 1) {
      if (css[close] === '{') depth += 1
      else if (css[close] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    const body = css.slice(open + 1, close)
    const props = new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]))
    found.push({ filename, name, props })
    from = close + 1
  }
}

describe('perf proof · keyframes animate compositor/paint properties only (60fps rule)', () => {
  const audit = STYLESHEETS.flatMap((path) => keyframesAudit(read(path), path.split('/').pop()))

  it('every keyframe animates only transform/opacity/stroke-draw properties', () => {
    const violations = []
    for (const { filename, name, props } of audit) {
      const known = KNOWN_DEVIATIONS.get(name)
      for (const prop of props) {
        if (ALLOWED_KEYFRAME_PROPS.has(prop)) continue
        if (known && known.has(prop)) continue
        violations.push(`${filename} @keyframes ${name} animates "${prop}"`)
      }
    }
    assert.deepEqual(violations, [], `60fps-rule violations:\n${violations.join('\n')}`)
  })

  it('the two pinned Phase B deviations are exactly as recorded — no silent growth', () => {
    for (const [name, expectedProps] of KNOWN_DEVIATIONS) {
      const entry = audit.find((item) => item.name === name)
      assert.ok(entry, `@keyframes ${name} still exists (Phase B surface)`)
      const actual = new Set([...entry.props].filter((prop) => !ALLOWED_KEYFRAME_PROPS.has(prop)))
      assert.deepEqual([...actual].sort(), [...expectedProps].sort(), `${name} deviation set changed`)
    }
  })

  it('continuous (infinite) animations are transform/opacity only apart from the pinned status dot', () => {
    for (const path of STYLESHEETS) {
      const css = read(path)
      for (const match of css.matchAll(/animation:\s*([A-Za-z0-9_-]+)[^;}]*infinite/g)) {
        const name = match[1]
        if (KNOWN_DEVIATIONS.has(name)) continue
        const entry = audit.find((item) => item.name === name)
        assert.ok(entry, `infinite animation ${name} resolves to a keyframe`)
        for (const prop of entry.props) {
          assert.ok(
            ['transform', 'opacity'].includes(prop),
            `infinite animation ${name} must be transform/opacity only, found "${prop}"`,
          )
        }
      }
    }
  })
})

describe('perf proof · chart draw-in runs on mount + range change only (AGENTS.md)', () => {
  it('the animated chart group is keyed by range — refresh re-renders in place, never replays', () => {
    assert.match(z3Source, /<g key=\{range\}>/, 'draw-in group remounts only when the range key changes')
    const group = z3Source.slice(z3Source.indexOf('<g key={range}>'))
    assert.ok(/v2-chart__area/.test(group) && /v2-chart__line/.test(group), 'the keyed group owns both animated paths')
  })

  it('the draw animations are one-shot (no infinite replay) and RM-collapsed', () => {
    assert.match(zonesCss, /\.v2-chart__area \{[^}]*animation: v2-z3-fade [^;]*both;/)
    assert.match(zonesCss, /animation: v2-z3-draw [^;]*forwards;/)
    assert.ok(!/v2-z3-(draw|fade)[^;}]*infinite/.test(zonesCss), 'chart draw-in never loops')
    assert.match(zonesCss, /\.v2-chart__line, \.v2-chart__area \{ animation-duration: \.01ms !important/)
  })
})

describe('perf proof · CLS observer ships (PLAN §14 evidence mechanism)', () => {
  it('the shell publishes __MOSV2_PHASE_B_PERF__ and accumulates layout-shift value', () => {
    assert.match(shellSource, /window\.__MOSV2_PHASE_B_PERF__ = proof/)
    assert.match(shellSource, /proof\.cls \+= entry\.value/)
    assert.match(shellSource, /entries\.push\(\{ value: entry\.value, startTime: entry\.startTime \}\)/)
  })

  it('the observer watches buffered layout-shift entries and excludes recent input', () => {
    assert.match(shellSource, /observer\.observe\(\{ type: 'layout-shift', buffered: true \}\)/)
    assert.match(shellSource, /if \(entry\.hadRecentInput\) return/)
  })
})
