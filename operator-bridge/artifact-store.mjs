import { createHash, randomUUID } from 'node:crypto'
import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ARTIFACT_TYPES } from './constants.mjs'

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export class ArtifactIntegrityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArtifactIntegrityError'
    this.code = 'ARTIFACT_INTEGRITY_FAILURE'
  }
}

export class LocalArtifactStore {
  constructor({ root, clock = () => Date.now() }) {
    this.root = root
    this.clock = clock
  }

  async init() {
    await Promise.all([
      mkdir(path.join(this.root, 'objects', 'sha256'), { recursive: true }),
      mkdir(path.join(this.root, 'manifests'), { recursive: true }),
      mkdir(path.join(this.root, 'partials'), { recursive: true }),
      mkdir(path.join(this.root, 'packages'), { recursive: true }),
    ])
    return this
  }

  partialPath(workOrderId, sectionId) {
    const safe = `${workOrderId}-${sectionId}`.replace(/[^a-zA-Z0-9._-]/g, '_')
    return path.join(this.root, 'partials', `${safe}.partial`)
  }

  async putArtifact({
    workOrderId,
    artifactType,
    content,
    producingExecutor,
    attempt,
    sensitivity = 'public',
    retentionStatus = 'retained',
  }) {
    if (!ARTIFACT_TYPES.includes(artifactType)) throw new TypeError(`Unsupported artifact type: ${artifactType}`)
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content)
    const hash = sha256(bytes)
    const artifactId = `art_${sha256(`${workOrderId}:${artifactType}:${attempt}:${hash}`).slice(0, 32)}`
    const objectRelative = path.posix.join('objects', 'sha256', hash)
    const objectPath = path.join(this.root, objectRelative)
    const manifestPath = path.join(this.root, 'manifests', `${artifactId}.json`)

    try {
      const existing = await readFile(objectPath)
      if (sha256(existing) !== hash) throw new ArtifactIntegrityError('Stored artifact hash mismatch')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      const temporary = `${objectPath}.${process.pid}.${randomUUID()}.tmp`
      await writeFile(temporary, bytes, { mode: 0o600 })
      await rename(temporary, objectPath)
    }

    try {
      return JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }

    const manifest = {
      artifact_id: artifactId,
      work_order_id: workOrderId,
      artifact_type: artifactType,
      immutable_relative_uri: objectRelative,
      sha256: hash,
      byte_count: bytes.length,
      producing_executor: producingExecutor,
      source_work_order_attempt: attempt,
      created_at: new Date(this.clock()).toISOString(),
      sensitivity_classification: sensitivity,
      retention_status: retentionStatus,
    }
    const temporaryManifest = `${manifestPath}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
    await rename(temporaryManifest, manifestPath)
    return manifest
  }

  async readArtifact(manifest) {
    const absolute = path.resolve(this.root, manifest.immutable_relative_uri)
    const expectedRoot = `${path.resolve(this.root)}${path.sep}`
    if (!absolute.startsWith(expectedRoot)) throw new ArtifactIntegrityError('Artifact path escapes store')
    const content = await readFile(absolute)
    if (sha256(content) !== manifest.sha256 || content.length !== manifest.byte_count) {
      throw new ArtifactIntegrityError('Artifact content failed verification')
    }
    return content
  }

  async copyVerifiedArtifact(manifest, destination) {
    await this.readArtifact(manifest)
    await copyFile(path.join(this.root, manifest.immutable_relative_uri), destination)
  }

  async sealArtifact(manifest) {
    await this.readArtifact(manifest)
    const objectPath = path.join(this.root, manifest.immutable_relative_uri)
    const manifestPath = path.join(this.root, 'manifests', `${manifest.artifact_id}.json`)
    await chmod(objectPath, 0o400)
    await chmod(manifestPath, 0o400)
    return { artifact_id: manifest.artifact_id, sha256: manifest.sha256, sealed: true }
  }
}
