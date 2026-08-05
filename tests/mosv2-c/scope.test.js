// scope.test.js — scripted boundary enforcement (frozen matrix §8, Codex
// addition): the Lane E diff must be confined EXACTLY to the authorized file
// list, package.json may carry ONLY the single test:mosv2-c scripts entry,
// no added line may contain a secret, and protected boundaries (lockfile,
// netlify.toml, operator-bridge, staging-control-plane, backend references)
// must stay untouched. Compares the frozen base against the union of
// committed work and the working tree — the same check the reviewer runs.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = '0f8f24017ed837a9d3692c00f44ea06713098c85'

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

const EXACT = new Set([
  'src/v2/Gallery.jsx',
  'src/v2/gallery.css',
  'scripts/mosv2-c-validation.mjs',
  'package.json',
])
const PREFIXES = ['src/v2/data/', 'tests/mosv2-c/', 'docs/vault/']

function authorized(file) {
  return EXACT.has(file) || PREFIXES.some((prefix) => file.startsWith(prefix))
}

function changedFiles() {
  const tracked = git(['diff', '--name-only', BASE, '--']).split('\n').filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
  return [...new Set([...tracked, ...untracked])].sort()
}

const PROTECTED = [
  /^package-lock\.json$/,
  /^netlify\.toml$/,
  /^operator-bridge\//,
  /^staging-control-plane\//,
  /^\.github\//,
  /^server\.js$/,
  /^vite\.config\.js$/,
  /^scripts\/(?!mosv2-c-validation\.mjs$)/,
  /^tests\/(?!mosv2-c\/)/,
]

// High-signal secret shapes only (scans ADDED lines, so legitimate code
// mentioning tokens generically never trips this).
const SECRET_PATTERNS = [
  /gho_[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-(?:ant|proj|live|test)-[A-Za-z0-9_-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, // JWT
]

describe('scope fence · diff confined to the authorized file list (matrix §8)', () => {
  it('every changed file is inside the exact authorized scope', () => {
    const files = changedFiles()
    assert.ok(files.length > 0, 'expected Lane E changes against the frozen base')
    const violations = files.filter((file) => !authorized(file))
    assert.deepEqual(violations, [], `files outside the authorized scope:\n${violations.join('\n')}`)
  })

  it('package.json carries ONLY the test:mosv2-c scripts entry', () => {
    const diff = git(['diff', '-U0', BASE, '--', 'package.json'])
    const added = diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    const removed = diff.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---'))
    assert.deepEqual(removed, [], 'no package.json line removed')
    assert.equal(added.length, 1, 'exactly one package.json line added')
    assert.match(added[0], /^\+\s+"test:mosv2-c": "node --test tests\/mosv2-c\/\*\.test\.js",?$/)
  })

  it('no dependency or lockfile movement of any kind', () => {
    const files = changedFiles()
    assert.equal(files.includes('package-lock.json'), false, 'lockfile untouched')
    const pkg = git(['diff', BASE, '--', 'package.json'])
    assert.equal(/"dependencies"|"devDependencies"/.test(pkg), false, 'dependency blocks untouched')
  })

  it('protected boundaries are untouched', () => {
    const files = changedFiles()
    for (const file of files) {
      for (const pattern of PROTECTED) {
        assert.equal(pattern.test(file), false, `protected boundary touched: ${file}`)
      }
    }
  })
})

describe('scope fence · secret scan (matrix §8)', () => {
  it('no added line in the diff contains a secret', () => {
    const files = changedFiles()
    const offenders = []
    for (const file of files) {
      const full = path.join(ROOT, file)
      let isText = true
      try {
        const buffer = readFileSync(full)
        if (buffer.includes(0)) isText = false // binary (e.g. evidence PNGs)
      } catch { continue }
      if (!isText || !statSync(full).isFile()) continue
      const diff = git(['diff', '-U0', BASE, '--', file])
      const added = diff
        ? diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).map((line) => line.slice(1))
        : readFileSync(full, 'utf8').split('\n') // untracked: whole file is added
      for (const line of added) {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(line)) offenders.push(`${file}: ${pattern}`)
        }
      }
    }
    assert.deepEqual(offenders, [], `secret-shaped content in added lines:\n${offenders.join('\n')}`)
  })
})
