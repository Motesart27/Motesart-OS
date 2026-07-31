import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const NETLIFY_CONFIG = path.join(ROOT, 'netlify.toml')
const INDEX_HTML = path.join(ROOT, 'index.html')
const PREVIEW_ORIGIN = 'https://deploy-preview-22--motesart-os.netlify.app'
const PRODUCTION_ORIGIN = 'https://motesart-os.netlify.app'
const ASSIGNED_ORIGINS = new Set([PREVIEW_ORIGIN, PRODUCTION_ORIGIN])
const PRODUCTION_API = 'https://deployable-python-codebase-som-production.up.railway.app/api/:splat'
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1'

function parseValue(raw) {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^\d+$/.test(value)) return Number(value)
  const quoted = value.match(/^"(.*)"$/)
  return quoted ? quoted[1] : value
}

function parseRedirects(source) {
  return source
    .split('[[redirects]]')
    .slice(1)
    .map((block) => Object.fromEntries(
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=')
          return [line.slice(0, separator).trim(), parseValue(line.slice(separator + 1))]
        }),
    ))
}

function splitRuleSource(source) {
  if (!source.startsWith('https://')) return { origin: null, pathname: source }
  const pathStart = source.indexOf('/', 'https://'.length)
  return {
    origin: pathStart === -1 ? source : source.slice(0, pathStart),
    pathname: pathStart === -1 ? '/' : source.slice(pathStart),
  }
}

function matchesPath(pattern, pathname) {
  const expression = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '(.*)')
  return new RegExp(`^${expression}$`).test(pathname)
}

function resolveRequest(rules, requestUrl, { fileExists = false, userAgent = '' } = {}) {
  const url = new URL(requestUrl)
  if (!ASSIGNED_ORIGINS.has(url.origin)) {
    return {
      status: 404,
      target: null,
      siteFound: false,
      staticFile: false,
      userAgent,
    }
  }
  for (const rule of rules) {
    const source = splitRuleSource(rule.from)
    if (source.origin && source.origin !== url.origin) continue
    if (!matchesPath(source.pathname, url.pathname)) continue
    if (!rule.force && fileExists) {
      return {
        status: 200,
        target: url.pathname,
        siteFound: true,
        staticFile: true,
        userAgent,
      }
    }
    return {
      status: rule.status,
      target: rule.to,
      siteFound: true,
      staticFile: false,
      userAgent,
    }
  }
  return {
    status: 404,
    target: null,
    siteFound: true,
    staticFile: false,
    userAgent,
  }
}

async function routingFixture() {
  const [config, shell] = await Promise.all([
    readFile(NETLIFY_CONFIG, 'utf8'),
    readFile(INDEX_HTML, 'utf8'),
  ])
  return { config, shell, rules: parseRedirects(config) }
}

test('direct, trailing-slash, nested, and hard-refresh staging requests serve the app shell', async () => {
  const { rules, shell } = await routingFixture()
  assert.match(shell, /id="root"/)
  assert.match(shell, /src="\/src\/main\.jsx"/)

  const paths = [
    '/operator-bridge-staging',
    '/operator-bridge-staging/',
    '/operator-bridge-staging/work-orders/synthetic',
  ]
  for (const pathname of paths) {
    const response = resolveRequest(rules, `${PREVIEW_ORIGIN}${pathname}`)
    assert.deepEqual(
      { status: response.status, target: response.target },
      { status: 200, target: '/index.html' },
    )
  }

  const hardRefresh = resolveRequest(
    rules,
    `${PREVIEW_ORIGIN}/operator-bridge-staging/work-orders/synthetic`,
    { userAgent: 'fresh-session-no-cache' },
  )
  assert.equal(hardRefresh.status, 200)
  assert.equal(hardRefresh.target, '/index.html')
})

test('iPhone Safari receives the same staging app-shell rewrite', async () => {
  const { config, rules } = await routingFixture()
  const stagingRules = rules.filter((rule) => rule.from.includes('operator-bridge-staging'))
  const response = resolveRequest(
    rules,
    `${PREVIEW_ORIGIN}/operator-bridge-staging`,
    { userAgent: IPHONE_SAFARI },
  )

  assert.equal(response.status, 200)
  assert.equal(response.target, '/index.html')
  assert.equal(response.userAgent, IPHONE_SAFARI)
  assert.equal(config.includes(IPHONE_SAFARI), false)
  assert.equal(stagingRules.every((rule) => !Object.hasOwn(rule, 'conditions')), true)
})

test('preview-only missing assets return 404 while deployed assets still shadow the guard', async () => {
  const { rules } = await routingFixture()
  const missing = resolveRequest(
    rules,
    `${PREVIEW_ORIGIN}/assets/definitely-missing-phase2b.js`,
  )
  const existing = resolveRequest(
    rules,
    `${PREVIEW_ORIGIN}/assets/existing-build-asset.js`,
    { fileExists: true },
  )

  assert.equal(missing.status, 404)
  assert.equal(existing.status, 200)
  assert.equal(existing.staticFile, true)
})

test('production API proxy and global SPA routing remain unchanged', async () => {
  const { config, rules } = await routingFixture()

  assert.deepEqual(rules[0], {
    from: '/api/*',
    to: PRODUCTION_API,
    status: 200,
    force: true,
  })
  assert.deepEqual(rules.at(-1), {
    from: '/*',
    to: '/index.html',
    status: 200,
  })
  assert.equal(
    config.match(/deployable-python-codebase-som-production\.up\.railway\.app/g)?.length,
    1,
  )

  const api = resolveRequest(rules, `${PRODUCTION_ORIGIN}/api/health`)
  const productionDeepLink = resolveRequest(
    rules,
    `${PRODUCTION_ORIGIN}/operator-bridge-staging/nested`,
  )
  const productionMissingAsset = resolveRequest(
    rules,
    `${PRODUCTION_ORIGIN}/assets/definitely-missing-phase2b.js`,
  )

  assert.equal(api.status, 200)
  assert.equal(api.target, PRODUCTION_API)
  assert.deepEqual(
    { status: productionDeepLink.status, target: productionDeepLink.target },
    { status: 200, target: '/index.html' },
  )
  assert.deepEqual(
    { status: productionMissingAsset.status, target: productionMissingAsset.target },
    { status: 200, target: '/index.html' },
  )
})

test('staging rules are canonical-host scoped and reject typographic-dash drift', async () => {
  const { config, rules } = await routingFixture()
  const stagingRules = rules.filter((rule) => rule.from.includes('operator-bridge-staging'))

  assert.equal(config.includes('\u2013'), false)
  assert.equal(stagingRules.length, 2)
  assert.equal(stagingRules.every((rule) => rule.from.startsWith(PREVIEW_ORIGIN)), true)
  assert.equal(stagingRules.every((rule) => rule.to === '/index.html' && rule.status === 200), true)

  const malformedHost = new URL('https://deploy-preview-22–motesart-os.netlify.app').origin
  assert.notEqual(malformedHost, PREVIEW_ORIGIN)
  const malformed = resolveRequest(
    rules,
    `${malformedHost}/operator-bridge-staging`,
  )
  assert.equal(malformed.status, 404)
  assert.equal(malformed.siteFound, false)
  assert.equal(
    rules.some((rule) => rule.from.startsWith(malformedHost)),
    false,
  )
})

function staticJavaScriptImports(source) {
  const imports = new Set()
  const patterns = [
    /\bfrom\s*["']\.\/([^"']+\.js)["']/g,
    /(?:^|[;,])\s*import\s*["']\.\/([^"']+\.js)["']/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) imports.add(match[1])
  }
  return imports
}

async function staticChunkClosure(assetsDir, entryName) {
  const pending = [entryName]
  const visited = new Map()
  while (pending.length) {
    const name = pending.pop()
    if (visited.has(name)) continue
    const source = await readFile(path.join(assetsDir, name), 'utf8')
    visited.set(name, source)
    pending.push(...staticJavaScriptImports(source))
  }
  return visited
}

test('staging bundle closure contains no production backend hostname', { timeout: 30_000 }, async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'motesart-phase2b-routing-'))
  try {
    const vitePackagePath = require.resolve('vite/package.json')
    const vitePackage = JSON.parse(await readFile(vitePackagePath, 'utf8'))
    const vite = path.resolve(path.dirname(vitePackagePath), vitePackage.bin.vite)
    await execFileAsync(
      process.execPath,
      [vite, 'build', '--outDir', outputRoot, '--emptyOutDir'],
      {
        cwd: ROOT,
        env: { ...process.env, COMMIT_REF: 'f'.repeat(40) },
        maxBuffer: 10 * 1024 * 1024,
      },
    )
    const assetsDir = path.join(outputRoot, 'assets')
    const assets = await readdir(assetsDir)
    const stagingEntry = assets.find(
      (name) => /^StagingOperatorBridgeApp-.*\.js$/.test(name),
    )
    assert.ok(stagingEntry, 'staging entry chunk must exist')

    const closure = await staticChunkClosure(assetsDir, stagingEntry)
    assert.equal(closure.size > 0, true)
    for (const [name, source] of closure) {
      assert.equal(
        source.includes('deployable-python-codebase-som-production.up.railway.app'),
        false,
        `${name} contains the production backend hostname`,
      )
    }
  } finally {
    await rm(outputRoot, { recursive: true, force: true })
  }
})
