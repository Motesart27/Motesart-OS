// build-repro.test.js — deterministic-build proof (frozen matrix §5): two
// consecutive `npm run build` runs must produce BYTE-IDENTICAL dist/ trees,
// with ZERO build warnings, and the V2 combined bundle (V2App JS + CSS, gzip)
// must hold ≤ 80 kB against the §14 ceiling. Runs the real build twice —
// slow by design (gated timeouts), hermetic by cleaning dist/ each pass.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = path.join(ROOT, 'dist')
const GZIP_CEILING_BYTES = 80 * 1024

function hashTree(dir, base = dir, out = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) hashTree(full, base, out)
    else out[path.relative(base, full)] = createHash('sha256').update(readFileSync(full)).digest('hex')
  }
  return out
}

function buildOnce() {
  rmSync(DIST, { recursive: true, force: true })
  const result = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  assert.equal(result.status, 0, `build failed:\n${output.slice(-2000)}`)
  return output
}

function assertZeroWarnings(output) {
  assert.equal(/^\(\)/m.test(output), false, `vite emitted a warning notice:\n${output}`)
  assert.equal(/\bwarnings?\b/i.test(output), false, `build output mentions warnings:\n${output}`)
}

function v2Bundle() {
  const assets = path.join(DIST, 'assets')
  const files = readdirSync(assets).filter((name) => /^V2App-[\w-]+\.(js|css)$/.test(name)).sort()
  assert.equal(files.length, 2, `expected exactly V2App JS + CSS, saw: ${files.join(', ')}`)
  return files.map((name) => ({
    name,
    raw: readFileSync(path.join(assets, name)).length,
    gzip: gzipSync(readFileSync(path.join(assets, name))).length,
    sha256: createHash('sha256').update(readFileSync(path.join(assets, name))).digest('hex'),
  }))
}

describe('deterministic build (matrix §5)', () => {
  it('two consecutive builds are byte-identical with zero warnings', { timeout: 240000 }, () => {
    const firstOutput = buildOnce()
    assertZeroWarnings(firstOutput)
    const first = hashTree(DIST)

    const secondOutput = buildOnce()
    assertZeroWarnings(secondOutput)
    const second = hashTree(DIST)

    assert.deepEqual(second, first, 'dist/ must be byte-identical across consecutive builds at the same head')
  })

  it('V2 combined JS+CSS bundle holds ≤ 80 kB gzip', { timeout: 240000 }, () => {
    if (!existsSync(DIST)) buildOnce()
    const parts = v2Bundle()
    const combined = parts.reduce((sum, part) => sum + part.gzip, 0)
    for (const part of parts) {
      console.log(`  ${part.name}: raw ${part.raw} B · gzip ${part.gzip} B · sha256 ${part.sha256.slice(0, 16)}`)
    }
    console.log(`  combined V2 gzip: ${combined} B vs ceiling ${GZIP_CEILING_BYTES} B`)
    assert.ok(
      combined <= GZIP_CEILING_BYTES,
      `V2 combined gzip ${combined} B exceeds the 80 kB ceiling (${GZIP_CEILING_BYTES} B)`,
    )
  })
})
