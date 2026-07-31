# MYA Operator Bridge Architecture Decision v1.0

Status: Ratified for a supervised local Phase 1 slice; production deployment is not authorized.

Governing work order: `Motesart27/Motesart-OS#21`

Kimi architecture report SHA-256: `9ff8521e1e890c02b7f4715f817545748bc19e9ad058b861ef13c98fd906bb50`

## Safety posture

- Global autonomy and every autonomous loop remain off.
- Dry-run is the default. Protected writes require a human approval in a future authorized phase.
- Executors cannot approve their own work.
- The Phase 1 pilot is read-only against GitHub and local-only for all bridge state and artifacts.
- ORCA has no inbound listener. It initiates outbound requests to the control plane and approved providers.
- No merge, deployment, credential rotation, production mutation, or production enablement is part of this decision.

## Evidence classification

### Kimi recommendations

Kimi recommended an outbound-only ORCA poller, one leased work order, typed and deny-by-default actions, a content-addressed append-only artifact store, a read-only GitHub collection stage, a sandboxed Kimi analysis stage, and a human decision card that carries no execution authority. For production, Kimi recommended a durable cloud control plane with a relational system of record, row-level atomic leasing, fencing tokens, idempotency keys, event records, and repository-scoped ephemeral executors.

Kimi also proposed broad adapter contracts and some production assumptions that were not grounded in the repository. Those assumptions are not adopted as facts.

### Codex source-verified facts

- Motesart-OS is currently a React/Vite frontend repository and has no general-purpose Operator Bridge backend or durable work-order ledger.
- The backend Maya runner is a specialized `/api/maya/runner/tick` contract for the dormant LOOP-P1 supervised proof. It uses a service token and is coupled to that control-plane and ledger model.
- The backend ledger proxy is a separate service-token FastAPI application whose routes and schema are specific to insert-only Maya-run ledger records backed by Airtable.
- Reusing either backend component as a general bridge ledger would widen production and Airtable scope, so Phase 1 does not modify or call them.
- CLIProxyAPI is locally reachable on loopback, the ORCA Kimi gateway verification passes, and the verified model is `kimi-k3`.
- No authorized callable Fable/Claude adapter is present in the inspected machine/repository integration surface.
- GitHub CLI can perform the required read-only PR collection from the local executor without giving the bridge a general shell interface.

### Accepted decisions

1. **Cloud control plane:** Phase 1 uses a local file-backed, append-only-event control plane in Motesart-OS. The production target is a small cloud service with a durable relational ledger and transactional operations; no production cloud service is selected or built in Phase 1.
2. **Work-order ledger:** The local ledger persists complete work-order snapshots plus immutable transition events through atomic temporary-file replacement. The production ledger must use database transactions and row-level concurrency.
3. **State machine:** `DRAFT`, `NEEDS_APPROVAL`, `QUEUED`, `CLAIMED`, `RUNNING`, `VERIFYING`, `READY_FOR_APPROVAL`, `COMPLETED`, `BLOCKED`, `FAILED`, `CANCELLED`, and `EXPIRED`, with an explicit allowlist of transitions and immutable terminal states.
4. **Executor leasing:** One lease owner and random fencing token per claim; lease expiry, heartbeat, reclaim, and attempt count are enforced. Every active-lease mutation requires the token.
5. **Idempotency:** Work-order creation is unique by idempotency key. Completion is replay-safe only when result and evidence hashes agree; divergent replay is rejected.
6. **ORCA connection:** ORCA is an outbound-only worker. It polls or calls the control plane and never exposes a listener or accepts a remotely supplied command line.
7. **Kimi adapter:** Use loopback CLIProxyAPI, streaming server-sent events, time-to-first-token measurement, incremental partial persistence, bounded local timeout, section and assembled hashes, and no retry after partial output. OAuth remains unchanged.
8. **Codex adapter:** Phase 1 represents Codex execution through typed internal handler profiles. It does not expose a general command endpoint. A production Codex adapter requires a separate reviewed capability contract.
9. **GitHub collector:** Use typed `gh` read operations for repository/PR identity, immutable diff, checks, committed files at a pinned SHA, and commit history. GitHub writes are absent from the contract.
10. **Artifact storage:** Phase 1 uses a local content-addressed store. Executors exchange artifact IDs and immutable relative URIs, never Desktop filename discovery. Production requires durable object storage with retention controls and a durable metadata ledger.
11. **Fable adapter:** Preserve an explicit adapter interface. In the absence of an authorized callable route, return `BLOCKED_ADAPTER_UNAVAILABLE`; do not substitute Kimi/Codex and do not ask Denarius to transfer files.
12. **Motesart OS return channel:** Generate a local decision-card contract with evidence hashes, status, blockers, and disabled approval controls. It is evidence, not execution authority.
13. **Approval engine:** Read-only work may proceed under the supervised work order. Local/protected/critical writes are disabled in Phase 1. Self-approval is always rejected.
14. **Offline recovery:** An unavailable ORCA moves the work order to a visible `BLOCKED` state with `WAITING_FOR_ORCA`. Reconnection returns it to `QUEUED`; lease expiry is reclaimed without losing the job.
15. **Audit and observability:** Store state transitions, lease events, artifact provenance, hashes, Kimi timing/byte metadata, typed blocker codes, and a final pilot timeline. Logs contain structural events only and no secrets or payload bodies.

## Rejected alternatives

- A public tunnel or inbound ORCA endpoint: rejected because the tonight-safe path is outbound-only.
- A remotely supplied shell command: rejected because actions must resolve to typed internal handlers.
- Airtable or the existing Maya run ledger as the Phase 1 work-order system: rejected because those are production-coupled and task-specific.
- Reusing `/api/maya/runner/tick`: rejected because it is a specialized LOOP-P1 control path, not a general bridge executor contract.
- Desktop filename discovery or asking Denarius to move artifacts: rejected because artifact IDs and immutable URIs are the transport.
- Kimi or Codex acting as its own independent verifier: rejected because no executor may approve its own work.
- Automatic provider retries after streamed output begins: rejected because it risks duplicate or ambiguous final artifacts.
- A handwritten production capability manifest: rejected because production contracts must be generated or source-derived and independently reviewed.

## Tonight-safe design

The bridge runs as isolated Node modules and a local pilot script in Motesart-OS. A file-backed ledger and content-addressed artifact directory live under ignored `.operator-bridge/`. The worker claims exactly one read-only PR #32 work order, collects GitHub evidence through typed read commands, streams a bounded request through the verified local Kimi gateway, invokes the Fable interface, records the expected machine-readable adapter block when unavailable, and generates a local decision card. The pilot ends blocked and resumable when independent review is unavailable. No stage requires manual artifact movement.

## Production target design

The target is a small cloud control plane with a transactional relational ledger, append-only event table, durable object storage, scoped service identities, and outbound executor claim/heartbeat APIs. Executors should be repository-scoped and ephemeral where possible, with fencing tokens and least-privilege credentials. Provider adapters must stream to durable partial artifacts, and approval decisions must be made by distinct authorized identities. This is a target, not a deployment decision; provider, region, tenancy, retention, and incident operations require separate review.

## Unresolved unknowns

- Which cloud platform and relational database will own the production control plane.
- The production identity, tenant, retention, encryption-key, and disaster-recovery contracts.
- The authorized callable Fable/Claude execution path and its independent-review identity proof.
- The final Codex execution sandbox and repository write policy.
- Whether the Motesart OS decision card becomes a frontend component or remains an API/resource contract.
- How a production deployment integrates with the secured backend after PR #32 and subsequent independent approval.

None of these unknowns blocks the local read-only supervised slice. Each blocks production activation of the corresponding capability.
