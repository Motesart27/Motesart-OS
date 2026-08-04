// a11y.test.js — MOSV2-C accessibility + reduced-motion stage tests (AGENTS.md
// a11y gates; PLAN §9 "Announced a11y state" row; §10 interaction-matrix
// Focus / Reduced motion / SR columns; packet §7 gates). No DOM: components
// are .jsx, so every assertion is a static source scan in the established z5
// style, plus a mechanical sweep proving every motion-bearing selector in the
// four v2 stylesheets is collapsed inside a prefers-reduced-motion block.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

const tileSource = read('../../src/v2/zones/Tile.jsx')
const homeSource = read('../../src/v2/zones/Home.jsx')
const z1Source = read('../../src/v2/zones/Z1Today.jsx')
const z3Source = read('../../src/v2/zones/Z3Business.jsx')
const z5Source = read('../../src/v2/zones/Z5QuickActions.jsx')
const componentsSource = read('../../src/v2/components/index.jsx')
const zonesCss = read('../../src/v2/zones/zones.css')
const componentsCss = read('../../src/v2/components/components.css')
const shellCss = read('../../src/v2/shell/shell.css')
const tokensCss = read('../../src/v2/tokens.css')

// ─── CSS helpers: brace-matched block extraction ────────────────────────────

// Returns the contents of every `@media <query>` block whose query contains
// `needle`, brace-matched (media blocks nest rules, so a naive regex fails).
function mediaBlocks(css, needle) {
  const blocks = []
  let from = 0
  for (;;) {
    const at = css.indexOf('@media', from)
    if (at === -1) return blocks
    const open = css.indexOf('{', at)
    const query = css.slice(at, open)
    let depth = 0
    let close = open
    for (; close < css.length; close += 1) {
      if (css[close] === '{') depth += 1
      else if (css[close] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    if (query.includes(needle)) blocks.push(css.slice(open + 1, close))
    from = close + 1
  }
}

// CSS with every @media and @keyframes block removed — what remains is
// top-level rules with no nested braces.
function topLevelCss(css) {
  let out = css
  for (const at of ['@media', '@keyframes']) {
    for (;;) {
      const start = out.indexOf(at)
      if (start === -1) break
      const open = out.indexOf('{', start)
      let depth = 0
      let close = open
      for (; close < out.length; close += 1) {
        if (out[close] === '{') depth += 1
        else if (out[close] === '}') {
          depth -= 1
          if (depth === 0) break
        }
      }
      out = out.slice(0, start) + out.slice(close + 1)
    }
  }
  return out
}

// Class tokens (`.v2-*`, `.mos-*`) whose rules declare motion outside any
// reduced-motion block.
function motionClassTokens(css) {
  const tokens = new Set()
  for (const match of topLevelCss(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(?:transition|animation)\s*:/.test(match[2])) continue
    for (const token of match[1].matchAll(/\.[A-Za-z0-9_-]+/g)) tokens.add(token[0])
  }
  return [...tokens]
}

function reducedMotionText(css) {
  return mediaBlocks(css, 'prefers-reduced-motion: reduce').join('\n')
}

// Modifier classes collapsed via their base class on the same element (the
// RM block lists `.v2-toast`; a leaving toast still carries `v2-toast`).
const COVERED_BY_BASE = new Set(['.v2-toast--leaving'])

function assertMotionCollapsed(css, filename) {
  const rm = reducedMotionText(css)
  assert.ok(rm.length > 0, `${filename} ships a prefers-reduced-motion block`)
  // The boot subtree is covered structurally: its root is display:none under
  // reduced motion and the shell never mounts it (useReducedMotion gate).
  const bootHidden = /\.v2-boot\s*\{\s*display:\s*none/.test(rm)
  for (const token of motionClassTokens(css)) {
    if (COVERED_BY_BASE.has(token)) continue
    if (bootHidden && token.startsWith('.v2-boot')) continue
    assert.ok(rm.includes(token), `${filename} reduced-motion block collapses ${token}`)
  }
}

// ─── §9 announced a11y state — per-tile polite live region ──────────────────

describe('a11y · Tile state announcements (PLAN §9)', () => {
  it('every tile renders a polite live region for state transitions', () => {
    assert.match(tileSource, /<span role="status" className="v2-tile__sr">/)
  })

  it('announcements fire on transitions only — populated refresh never re-announces', () => {
    assert.match(tileSource, /if \(previous\.current === status\) return/)
    assert.match(tileSource, /previous\.current = status/)
  })

  it('every non-idle tile status has a ruled announcement', () => {
    for (const status of [
      'LOADING', 'POPULATED', 'EMPTY', 'PARTIAL', 'STALE',
      'ERROR', 'PERMISSION_DENIED', 'OFFLINE', 'B2_PENDING',
    ]) {
      assert.match(tileSource, new RegExp(`\\[TILE_STATUS\\.${status}\\]:`), `${status} announced`)
    }
  })

  it('the skeleton is decorative and hidden from assistive tech', () => {
    assert.match(tileSource, /className="v2-tile__skeleton" aria-hidden="true"/)
  })

  it('the retry control is a native button named "Retry ‹tile›" with the ruled focus ring', () => {
    assert.match(tileSource, /aria-label=\{`Retry \$\{title\}`\}/)
    assert.match(zonesCss, /\.v2-tile__retry:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: 2px; \}/)
  })

  it('the stale/offline marker dot carries a text role, never color alone', () => {
    assert.match(tileSource, /className="v2-tile__stale-dot" role="img" aria-label=\{dotLabel\}/)
    assert.match(tileSource, /as of \{formatAsOf\(updatedAt\)\}/)
  })
})

// ─── Home zone landmarks — every section named by its visible label ─────────

describe('a11y · Home zone landmarks', () => {
  it('each zone section is labelled by its visible zone label', () => {
    assert.match(homeSource, /aria-labelledby=\{`v2-zone-label-\$\{zone\.order\}`\}/)
    assert.match(homeSource, /<span id=\{`v2-zone-label-\$\{zone\.order\}`\}>\{zone\.label\}<\/span>/)
  })

  it('the home stage is labelled by the greeting heading', () => {
    assert.match(homeSource, /aria-labelledby="v2-home-title"/)
    assert.match(z1Source, /<h1 id="v2-home-title">/)
  })
})

// ─── §10 Z1 signal row — link role, keyboard = click, severity in text ──────

describe('a11y · Z1 signal feed rows (PLAN §10)', () => {
  it('rows are native buttons with role="link" — Tab + Enter works out of the box', () => {
    assert.match(z1Source, /<button[\s\S]*?role="link"[\s\S]*?className="v2-signal-row"/)
  })

  it('severity is a text Chip (never color alone) and the arrow is decorative', () => {
    assert.match(z1Source, /<Chip tone=\{signal\.severity\}>\{SIGNAL_SEVERITY_LABELS/)
    assert.match(z1Source, /className="v2-signal-row__arrow" aria-hidden="true"/)
  })

  it('rows carry the ruled focus ring and the reduced-motion slide is off', () => {
    assert.match(zonesCss, /\.v2-signal-row:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: 2px; \}/)
    const rm = reducedMotionText(zonesCss)
    assert.match(rm, /\.v2-signal-row:hover, \.v2-signal-row:focus-visible \{ transform: none; \}/)
  })
})

// ─── §10/9.1 Z3 chart — range tablist + keyboard crosshair ──────────────────

describe('a11y · Z3 revenue chart (9.1, PLAN §10)', () => {
  it('the range control is a tablist with aria-selected and roving tabindex', () => {
    assert.match(z3Source, /role="tablist"[\s\S]*?aria-label="Revenue range"/)
    assert.match(z3Source, /role="tab"/)
    assert.match(z3Source, /aria-selected=\{range === name\}/)
    assert.match(z3Source, /tabIndex=\{range === name \? 0 : -1\}/)
  })

  it('arrows and Home/End move across the tablist', () => {
    assert.match(z3Source, /const RANGE_KEYS = new Set\(\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]\)/)
  })

  it('the plot is focusable role="img" with a descriptive name', () => {
    assert.match(z3Source, /role="img"[\s\S]*?tabIndex=\{0\}[\s\S]*?aria-label=\{`Revenue trend/)
  })

  it('Escape blurs the plot; per-step values announce politely', () => {
    assert.match(z3Source, /event\.key === 'Escape'[\s\S]*?event\.currentTarget\.blur\(\)/)
    assert.match(z3Source, /<span role="status" className="v2-tile__sr">[\s\S]*?crosshairAnnouncement/)
  })

  it('plot and range segments carry the ruled focus ring', () => {
    assert.match(zonesCss, /\.v2-chart__plot:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: 2px; \}/)
    assert.match(zonesCss, /\.v2-chart__range:focus-visible \{ outline: 2px solid var\(--info\); outline-offset: 2px; \}/)
  })
})

// ─── §10 Z5 qbtn + Toast — named buttons, polite live region, crit variant ──

describe('a11y · Z5 quick actions + Toast (PLAN §10)', () => {
  it('quick actions are native buttons whose accessible name is the action label', () => {
    assert.match(z5Source, /\{action\.label\}\s*<\/button>/)
  })

  it('qbtn icons are decorative and never disabled (DB-G8 stays Button-only)', () => {
    assert.match(z5Source, /strokeLinejoin="round" aria-hidden="true"/)
    const codeOnly = z5Source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    assert.equal(/disabled/.test(codeOnly), false, 'no disabled state on quick actions')
  })

  it('the Toast container is a polite, atomic live region', () => {
    assert.match(componentsSource, /className="v2-toast-region" aria-live="polite" aria-atomic="true"/)
  })

  it('the toast severity dot is decorative and the crit (error) variant is styled', () => {
    assert.match(componentsSource, /className="v2-toast__dot" aria-hidden="true"/)
    assert.match(componentsCss, /\.v2-toast--crit \.v2-toast__dot \{ background: var\(--crit-t\);/)
  })

  it('Z5 failure toasts use the crit tone (the ruled error variant)', () => {
    assert.match(z5Source, /tone: 'crit', copy: DISPATCH_FAILURE_COPY/)
  })
})

// ─── AGENTS.md gates — focus ring + contrast floor, token law ───────────────

describe('a11y · shell-wide gates (AGENTS.md)', () => {
  it('visible focus ring everywhere interactive: 2px --info, 2px offset', () => {
    assert.match(shellCss, /\.v2-shell :focus-visible \{ outline: 2px solid var\(--info\); outline-offset: 2px; \}/)
  })

  it('contrast floor holds: --text-3 is exactly #8A93A1 and nothing dimmer ships', () => {
    assert.match(tokensCss, /--text-3:#8A93A1;/)
    const ink = tokensCss.match(/\/\* ink \*\/([\s\S]*?)\/\* accent marks/)[1]
    for (const hex of ink.match(/#[0-9A-Fa-f]{6}/g)) {
      const value = parseInt(hex.slice(1), 16)
      assert.ok(value >= 0x8A93A1, `${hex} is at or above the contrast floor`)
    }
  })
})

// ─── Reduced motion — mechanical coverage sweep over every v2 stylesheet ────

describe('reduced motion · every animation/transition collapses', () => {
  it('zones.css — every motion-bearing selector is covered', () => {
    assertMotionCollapsed(zonesCss, 'zones.css')
  })

  it('components.css — every motion-bearing selector is covered', () => {
    assertMotionCollapsed(componentsCss, 'components.css')
  })

  it('shell.css — every motion-bearing selector is covered (incl. rail links, focus switcher, bell)', () => {
    assertMotionCollapsed(shellCss, 'shell.css')
    const rm = reducedMotionText(shellCss)
    for (const selector of ['.v2-rail__link', '.v2-focus-switcher button', '.v2-bell']) {
      assert.ok(rm.includes(selector), `shell.css reduced-motion block collapses ${selector}`)
    }
  })

  it('tokens.css — the shared motion recipes are covered', () => {
    assertMotionCollapsed(tokensCss, 'tokens.css')
  })

  it('zone entrance and chart draw-in render final state instantly', () => {
    const rmShell = reducedMotionText(shellCss)
    assert.match(rmShell, /\.v2-zone \{ opacity: 1; transform: none; animation: none; \}/)
    const rmZones = reducedMotionText(zonesCss)
    assert.match(rmZones, /\.v2-chart__line, \.v2-chart__area \{ animation-duration: \.01ms !important; animation-delay: 0ms !important; \}/)
  })

  it('lift and slide hover motion is removed, not merely sped up', () => {
    const rmComponents = reducedMotionText(componentsCss)
    assert.match(rmComponents, /\.v2-card--lift:hover[\s\S]*?transform: none/)
    const rmZones = reducedMotionText(zonesCss)
    assert.match(rmZones, /\.v2-qbtn:hover, \.v2-qbtn:active \{ transform: none; \}/)
    assert.match(rmZones, /\.v2-pulse-row:hover \{ transform: none; \}/)
  })
})

// ─── Runtime-validation regressions — F7 toast anchor + F8 qa grid ──────────

describe('validation regressions · F7 toast containing block + F8 qa grid', () => {
  it('F7 — the zone entrance fill holds transform: none, so fixed toasts anchor to the viewport', () => {
    assert.match(shellCss, /@keyframes v2-zone-in \{ to \{ opacity: 1; transform: none; \} \}/)
    assert.equal(
      /@keyframes v2-zone-in \{ to \{ opacity: 1; transform: translateY/.test(shellCss), false,
      'a retained non-none transform makes the zone a containing block for fixed descendants (toast below fold)',
    )
  })

  it('F8 — quick actions are 3-up: a span-3 zone never admits five min-content columns', () => {
    assert.match(zonesCss, /\.v2-qa \{ display: grid; grid-template-columns: repeat\(3, 1fr\); gap: 12px; \}/)
    assert.equal(
      /repeat\(5, 1fr\)/.test(zonesCss), false,
      'five columns clip inside the span-3 zone at every viewport (max zone content ~336px < 384px needed)',
    )
  })
})
