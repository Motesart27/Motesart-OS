import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { redactEvidenceValue } from './redaction.mjs'

// Writes exit evidence on every worker result — success, failure, signal,
// timeout, or abnormal exit. Evidence is scrubbed recursively so no token,
// key, password, or credential value can persist, then written mode 0600 and
// (when an artifact store is attached) sealed read-only in the
// content-addressed store.
export async function writeExitEvidence({
  filePath,
  evidence,
  artifactStore = null,
  workOrderId = null,
  producingExecutor = 'bounded-worker-session',
  attempt = 1,
  seal = true,
}) {
  if (!filePath) throw new TypeError('EXIT_EVIDENCE_PATH_REQUIRED')
  const { value: scrubbed, redactionCount } = redactEvidenceValue(evidence)
  const finalEvidence = { ...scrubbed, evidence_redaction_count: redactionCount }
  const text = `${JSON.stringify(finalEvidence, null, 2)}\n`
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  await writeFile(filePath, text, { mode: 0o600 })
  let artifact = null
  if (artifactStore) {
    artifact = await artifactStore.putArtifact({
      workOrderId,
      artifactType: 'evidence_report',
      content: text,
      producingExecutor,
      attempt,
      sensitivity: 'internal',
      retentionStatus: 'exit-evidence-retained',
    })
    if (seal) await artifactStore.sealArtifact(artifact)
  }
  return { filePath, artifact, redactionCount, evidence: finalEvidence }
}
