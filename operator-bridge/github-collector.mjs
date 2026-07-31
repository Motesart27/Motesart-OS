import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { sha256 } from './artifact-store.mjs'

const execFileAsync = promisify(execFile)
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SAFE_FILE_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./ -]+$/

async function defaultRunner(args) {
  try {
    const result = await execFileAsync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    return { stdout: result.stdout, exitCode: 0 }
  } catch (error) {
    if (typeof error.stdout === 'string') return { stdout: error.stdout, exitCode: error.code ?? 1 }
    throw new Error('GitHub read-only command failed')
  }
}

function assertTarget(repository, pullRequest) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new TypeError('Invalid GitHub repository identifier')
  if (!Number.isSafeInteger(pullRequest) || pullRequest < 1) throw new TypeError('Invalid pull-request number')
}

export function sanitizeUnifiedDiff(diff) {
  let redactionCount = 0
  const sanitized = diff.split(/\r?\n/).map((line) => {
    let next = line
    const assignment = /^([+-](?!--|\+\+).*?(?:password|passwd|secret|token|credential|api[_-]?key)\b[^=:\n]{0,80}[=:]\s*)(['"])([^'"]{8,})(\2)/i
    if (assignment.test(next)) {
      next = next.replace(assignment, '$1$2[REDACTED_POTENTIAL_SECRET]$4')
      redactionCount += 1
    }
    const patterns = [
      /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
      /\bsk-[A-Za-z0-9_-]{20,}\b/g,
      /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
      /\bAKIA[0-9A-Z]{16}\b/g,
    ]
    for (const pattern of patterns) {
      next = next.replace(pattern, () => {
        redactionCount += 1
        return '[REDACTED_POTENTIAL_SECRET]'
      })
    }
    return next
  }).join('\n')
  return { sanitized, redactionCount, sourceSha256: sha256(diff) }
}

export class GitHubReadOnlyCollector {
  constructor({ artifactStore, runner = defaultRunner, executor = 'orca-edge-worker' }) {
    this.artifactStore = artifactStore
    this.runner = runner
    this.executor = executor
  }

  async _run(args) {
    const prohibited = new Set(['pr merge', 'pr comment', 'pr close', 'issue create', 'api --method'])
    const joined = args.join(' ')
    if ([...prohibited].some((pattern) => joined.includes(pattern))) throw new Error('GitHub write action rejected')
    return this.runner(args)
  }

  async collect({ repository, pullRequest, selectedFiles = [], workOrderId, attempt }) {
    assertTarget(repository, pullRequest)
    for (const file of selectedFiles) {
      if (!SAFE_FILE_PATTERN.test(file)) throw new TypeError('Invalid committed-file path')
    }
    const [repo, pr, diff, checks] = await Promise.all([
      this._run(['repo', 'view', repository, '--json', 'nameWithOwner,url,defaultBranchRef,isPrivate']),
      this._run([
        'pr', 'view', String(pullRequest), '--repo', repository, '--json',
        'number,title,url,state,isDraft,mergedAt,baseRefName,baseRefOid,headRefName,headRefOid,files,commits',
      ]),
      this._run(['pr', 'diff', String(pullRequest), '--repo', repository, '--patch']),
      this._run(['pr', 'checks', String(pullRequest), '--repo', repository, '--json', 'name,state,link,bucket,workflow']),
    ])
    const prData = JSON.parse(pr.stdout)
    const sanitizedDiff = sanitizeUnifiedDiff(diff.stdout)
    const collected = []
    const entries = [
      ['repository_identity', repo.stdout],
      ['pull_request_identity', pr.stdout],
      ['diff', sanitizedDiff.sanitized],
      ['workflow_status', JSON.stringify({ exit_code: checks.exitCode, checks: JSON.parse(checks.stdout || '[]') }, null, 2)],
      ['commit_history', JSON.stringify(prData.commits ?? [], null, 2)],
    ]
    for (const [artifactType, content] of entries) {
      collected.push(await this.artifactStore.putArtifact({
        workOrderId,
        artifactType,
        content,
        producingExecutor: this.executor,
        attempt,
        sensitivity: 'public',
      }))
    }
    for (const file of selectedFiles) {
      const response = await this._run([
        'api', `repos/${repository}/contents/${file}`, '-f', `ref=${prData.headRefOid}`,
        '-H', 'Accept: application/vnd.github.raw+json', '--method', 'GET',
      ])
      collected.push(await this.artifactStore.putArtifact({
        workOrderId,
        artifactType: 'source_snapshot',
        content: response.stdout,
        producingExecutor: this.executor,
        attempt,
        sensitivity: 'public',
      }))
    }
    return {
      repository,
      pull_request: pullRequest,
      base_sha: prData.baseRefOid,
      head_sha: prData.headRefOid,
      state: prData.state,
      draft: prData.isDraft,
      changed_file_count: prData.files?.length ?? 0,
      diff_source_sha256: sanitizedDiff.sourceSha256,
      diff_redaction_count: sanitizedDiff.redactionCount,
      artifacts: collected,
    }
  }
}
