# MYA Operator Bridge — Post-Merge Hardening Phase 1 Contracts v1.0

Branch: `fix/operator-bridge-post-merge-hardening-1` from main `8d1e2e5e8580c43b460053588beff3a47b630e18`.
Scope: staging control plane and local Operator Bridge only. No production, autonomy, loop, worker auto-start, or protected-action change.

## A. Writer-lock recovery (staging-control-plane/store.mjs)

- The single-writer lock (`staging/ledger/writer.lock`) is acquired with bounded waiting (`lockWaitMs`, default 500 ms; `lockPollMs`, default 50 ms) and always fails closed with `STAGING_LEDGER_LOCKED` (503) on timeout.
- A lock is recovered only when its recorded holder PID is verifiably dead (`ESRCH`). A live holder, a foreign-permission holder (`EPERM`), a non-integer/missing PID, or unreadable metadata always fails closed.
- Recovery renames the stale lock to a unique tombstone atomically; exactly one concurrent recoverer wins. Every recovery decision is appended as structured JSON (`lock-recovery.jsonl`, 0600) without secrets.

## B. Login throttling (staging-control-plane/app.mjs)

- `X-Forwarded-For` is honored only when the direct peer is in `config.trustedProxyIps` (env `STAGING_TRUSTED_PROXY_IPS`, default empty = never trust). The rightmost hop is used — the value the trusted proxy itself appended. Missing, blank, or oversized (>512 chars) headers fall back to the socket address.
- Buckets are keyed `clientIdentity|owner_id`, so throttling one identity never locks out the owner from another identity. Limit 5 attempts / 60 s per bucket; expired buckets are swept on every insert; the map is capped at 1024 buckets and fails closed (429) when full.

## C. Required artifacts (operator-bridge/work-order-ledger.mjs, artifact-store.mjs)

- `FileWorkOrderLedger.completeIdempotently` enforces `required_artifacts` for every canonical completion: without a configured `artifactVerifier` it fails closed (`REQUIRED_ARTIFACT_UNVERIFIABLE`); missing types → `REQUIRED_ARTIFACT_MISSING`; result/evidence hashes foreign to the work order → `ARTIFACT_REFERENCE_INVALID`.
- `LocalArtifactStore.listArtifacts(workOrderId)` returns only that work order's manifests and is the intended verifier source.
- Boundary: the raw supervised `transition()` pathway used by operator-run review scripts is unchanged; canonical completion is the enforced path. Transition-level enforcement is deferred (requires evidence-pathway rewiring and requalification).

## D. Human-decision enforcement (staging-control-plane/store.mjs)

- Completion rejects any decision card with an enabled control (`approve` → `EXECUTOR_SELF_APPROVAL_REJECTED`; `reject`/`revise` → `PROTECTED_CONTROL_ENABLED`), and rejects a `human_decision_required: true` card unless every control is explicitly `enabled: false` (`HUMAN_DECISION_CONTROL_UNVERIFIED`). Protected actions remain disabled regardless of the flag. No programmatic action route exists.

## E. JWT scopes (staging-control-plane/security.mjs, app.mjs)

- Supported scopes (exactly): owner — `work-orders:submit`, `work-orders:read`, `work-orders:retry`; ORCA — `claim`, `heartbeat`, `artifact:return`, `complete`, `block`, `release`.
- `verifyToken` validates scopes after signature/issuer/audience/integer-exp/role: missing, non-array, empty, or unknown scopes → `INVALID_TOKEN` (401); a missing required scope → `INSUFFICIENT_SCOPE` (403). Every route declares its required scope.

## F. Nested command guards (operator-bridge/orca-edge-worker.mjs)

- Forbidden fields (`command`, `shell`, `script`, `argv`, `executable`, `remote_command`, `remoteCommand`, `process`) are rejected recursively at every object/array depth, aligned with the staging worker and control plane. No shell or general execution surface is introduced.

## G. Completion-replay identity (staging-control-plane/store.mjs)

- Replay is idempotent only when `result_artifact_id`, `evidence_artifact_id`, AND `decision_card_artifact_id` all match the completed record; any divergence → `COMPLETION_CONFLICT` (409). No completed record is replaced.

## H. Completion atomicity (operator-bridge/work-order-ledger.mjs)

- `completeIdempotently` performs replay check, transition validation, lease/fencing revalidation, and required-artifact verification inside one `_exclusive` atomic write boundary. Concurrent divergent completions yield exactly one `COMPLETED` transition and one `COMPLETION_CONFLICT`; identical replays return the same record.
