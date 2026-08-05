// evidence-hash.test.js — reproducible-evidence proof (frozen matrix §7):
// every harness artifact's recorded sha256 must byte-reproduce the committed
// file on disk, OR the artifact must carry a written NON-CANONICAL
// classification with a reason. Reads the committed
// docs/vault/evidence/mosv2-c-validation/manifest.json + report.json and
// re-hashes every listed artifact. Also fences the determinism laws that
// make report.json canonical: no wall-clock fields, fixed-clock run block,
// and the console gate policy present.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'vault', 'evidence', 'mosv2-c-validation')

function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

const manifestPath = path.join(EVIDENCE_DIR, 'manifest.json')
const reportPath = path.join(EVIDENCE_DIR, 'report.json')

describe('evidence hashing (matrix §7)', () => {
  it('manifest.json exists and lists every evidence artifact with a sha256', () => {
    assert.ok(existsSync(manifestPath), 'manifest.json is committed with the evidence')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    assert.equal(manifest.algorithm, 'sha256')
    assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length >= 10, 'report + screenshots listed')
    for (const artifact of manifest.artifacts) {
      assert.match(artifact.sha256, /^[a-f0-9]{64}$/, `${artifact.file} carries a sha256`)
      assert.ok(
        artifact.classification === 'CANONICAL' || artifact.classification === 'NON-CANONICAL',
        `${artifact.file} classified`,
      )
    }
  })

  it('every recorded hash byte-reproduces the committed artifact on disk', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const artifact of manifest.artifacts) {
      const file = path.join(EVIDENCE_DIR, artifact.file)
      assert.ok(existsSync(file), `${artifact.file} committed`)
      assert.equal(
        sha256File(file),
        artifact.sha256,
        `${artifact.file} hash reproduction (${artifact.classification})`,
      )
    }
  })

  it('CANONICAL artifacts name a reproduction path; NON-CANONICAL artifacts carry a written reason', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    for (const artifact of manifest.artifacts) {
      if (artifact.classification === 'CANONICAL') {
        assert.ok(
          typeof artifact.reproduction === 'string' && artifact.reproduction.length >= 40,
          `${artifact.file} states how its bytes reproduce`,
        )
      } else {
        assert.ok(
          typeof artifact.reason === 'string' && artifact.reason.length >= 40,
          `${artifact.file} states why it is NON-CANONICAL`,
        )
      }
    }
  })

  it('report.json is canonical-shaped: zero wall-clock fields, fixed-clock run block, console gate', () => {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.equal('startedAt' in report, false, 'no startedAt wall-clock field')
    assert.equal('finishedAt' in report, false, 'no finishedAt wall-clock field')
    assert.equal(report.run.clock.mode, 'fixed', 'canonical evidence is produced in fixed-clock mode')
    assert.match(report.run.clock.fixtureNowIso, /^2026-08-02T20:00:00-04:00$/)
    assert.ok(report.run.clock.driftChecks >= 10, 'every scenario asserted zero drift from FIXTURE_NOW_ISO')
    assert.equal(report.consoleGate.unexpectedCount, 0, 'the committed evidence passed the console gate')
    assert.ok(Object.keys(report.scenarios).length >= 15, 'all scenarios recorded')
  })
})
