import { execFile } from 'node:child_process'

import { sanitizeUnifiedDiff } from './redaction.mjs'

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const SAFE_FILE_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./ -]+$/
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000

// Every gh invocation is a bounded child process: it carries an explicit
// wall-clock timeout (SIGTERM kill), and it is registered with the worker
// resource registry so no child survives any worker exit path.
async function defaultRunner(args, { timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS, processRegistry = null } = {}) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = execFile(
        'gh',
        args,
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: 'SIGTERM' },
        (error, stdout) => {
          if (processRegistry) processRegistry.untrackChild(child)
          if (error) {
            if (error.killed || error.signal) return reject(new Error('GITHUB_READ_ONLY_COMMAND_TERMINATED'))
            if (typeof error.stdout === 'string') return resolve({ stdout: error.stdout, exitCode: error.code ?? 1 })
            return reject(new Error('GitHub read-only command failed'))
          }
          return resolve({ stdout, exitCode: 0 })
        },
      )
    } catch {
      return reject(new Error('GitHub read-only command failed'))
    }
    if (processRegistry) processRegistry.trackChild(child)
    return undefined
  })
}

function assertTarget(repository, pullRequest) {
  if (!REPOSITORY_PATTERN.test(repository)) throw new TypeError('Invalid GitHub repository identifier')
  if (!Number.isSafeInteger(pullRequest) || pullRequest < 1) throw new TypeError('Invalid pull-request number')
}

export { sanitizeUnifiedDiff }

export class GitHubReadOnlyCollector {
  constructor({ artifactStore, runner = null, executor = 'orca-edge-worker', timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS, processRegistry = null } = {}) {
    this.artifactStore = artifactStore
    this.runner = runner ?? ((args) => defaultRunner(args, { timeoutMs, processRegistry }))
    this.executor = executor
    this.timeoutMs = timeoutMs
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
