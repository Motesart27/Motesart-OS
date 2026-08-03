// no-new-storage-keys.test.js — MOSV2-C storage law (PLAN §7/§9: in-memory
// last-good only, zero new localStorage keys). Static scan of every src/v2
// source file: no writes or removals may exist anywhere; the only permitted
// read is the existing `som_token` key.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const v2Root = fileURLToPath(new URL('../../src/v2', import.meta.url))

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const sourceFiles = walk(v2Root).filter((file) => /\.(jsx?|css)$/.test(file))

describe('no-new-storage-keys · src/v2 static scan', () => {
  it('no localStorage writes or removals anywhere in src/v2', () => {
    const offenders = []
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      if (/localStorage\.(setItem|removeItem|clear)\s*\(/.test(source)) offenders.push(file)
    }
    assert.deepEqual(offenders, [], `localStorage writes found in: ${offenders.join(', ')}`)
  })

  it('the only localStorage read key is the existing som_token', () => {
    const reads = []
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/localStorage\.getItem\(\s*(['"`])([^'"`]+)\1/g)) {
        reads.push({ file, key: match[2] })
      }
    }
    assert.ok(reads.length > 0, 'expected the som_token read to exist in apiFetch.js')
    for (const read of reads) {
      assert.equal(read.key, 'som_token', `unexpected localStorage key "${read.key}" in ${read.file}`)
    }
  })

  it('sessionStorage is never used in src/v2', () => {
    const offenders = []
    for (const file of sourceFiles) {
      if (/sessionStorage/.test(readFileSync(file, 'utf8'))) offenders.push(file)
    }
    assert.deepEqual(offenders, [])
  })
})
