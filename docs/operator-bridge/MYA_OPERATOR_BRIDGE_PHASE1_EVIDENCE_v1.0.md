# MYA Operator Bridge Phase 1 Evidence v1.0

Status: Local supervised vertical slice completed; independent Fable execution is visibly blocked and resumable.

Branch: `feature/mya-operator-bridge-v1-phase1`

Immutable Motesart-OS base: `473fafa89407a7da8b0e6550e32d48bb694d89e2`

No merge, deployment, credential rotation, production mutation, autonomy enablement, loop enablement, public ORCA exposure, or PR #32 modification occurred.

## Input integrity

- Phase 0 evidence: 8/8 internal SHA-256 entries verified.
- Phase 0A evidence: 45/45 internal SHA-256 entries verified.
- Final Kimi architecture report: `9ff8521e1e890c02b7f4715f817545748bc19e9ad058b861ef13c98fd906bb50`.
- Kimi section response hashes:
  - Current state and trust boundaries: `c453d3f391d18c5c3eba59a68e415aca9ff14137ddd036a34bddeb4b9d021cd6`
  - Tonight bridge: `07e5356b20bc246aec038c2d35dacdbdabc003acdedacfb3b976445e6deda6e7`
  - Production bridge: `f051d7a579e193ada4db0c3f75d83dbbaa1919e934b2e3fc2d1013da196ef508`
  - Work order and leasing: `a055215945d6ae7270facf29a65d1e8b19ff4c05d52b65e5decc5dc8a29ce91f`
  - Adapter contracts: `dc5ab43e810c56f074d810cf3d41f5c02f97ad07a4d1986b2b2d8d092ee3ff3a`
  - Threat model: `0c67a3b9a7ca1e9f4def3cc7f841d4f98f345994396b059670ee91af7ec0de82`
  - Implementation sequence: `40b642afce1eafbd635171613d51fdce9a96ffea72dfad5c8de3087d60905ad6`
  - Testing and observability: `815917b34a97d597cfb59d0b06e82834a5ce12ae7a81415b0add85f47db970b1`
  - Final verdict: `f5d720a0ed38ade234294e5ac8d00eb430b77a2a15dc21523f8c98cfa5473b7d`
- ORCA gateway executable SHA-256: `660c128e105bba83f5aff1b6326d24a4ac3ccbe2f7f86f8dcfeef62b83c3b11c`.
- Manual Kimi client SHA-256: `565e337ac153bdf490c577256a161255aedfc4e8d5944410d57889637ba1fefe`.
- Live `orca-gateway verify-kimi`: PASS, model `kimi-k3`.
- CLIProxyAPI: running on loopback `127.0.0.1:8317`.

## Source-contract findings

- The existing Maya runner is a specialized service-token route for the dormant LOOP-P1 proof and is not a general work-order executor.
- The existing ledger proxy is a separate service-token, Airtable-backed Maya-run ledger and is not a general Operator Bridge ledger.
- Phase 1 therefore required no backend source, Railway, Airtable, or PR #32 change.
- Claude Code `2.1.205` is installed locally, but no authorized Fable identity, callable governance contract, or independently reviewed Fable adapter was found. Installation alone was not treated as authorization.

## Local implementation evidence

- Control plane: file-backed snapshots and immutable transition events, with atomic replacement for the local single-host slice.
- Work-order state machine: 12 explicit states and deny-by-default transitions.
- Lease: one owner, random fencing token, TTL, heartbeat, expiry reclaim, and attempt count.
- Idempotency: unique creation key and hash-equal completion replay.
- ORCA: outbound-only typed handler map; arbitrary command, shell, script, argv, and executable fields are rejected.
- Kimi: streaming SSE, loopback-only URL validation, first-token/final timing, incremental partial writes, timeout classification, content-addressed partial/final artifacts, and no retry after partial output.
- Artifacts: content-addressed SHA-256 objects with immutable relative URI, byte count, executor, attempt, timestamp, classification, and retention state.
- GitHub: typed read-only commands for identity, PR metadata, diff, checks, selected committed files, and history.
- Approval: protected actions disabled and executor self-approval rejected.
- Fable: explicit `BLOCKED_ADAPTER_UNAVAILABLE` response, resumable without human file transfer.
- Return channel: local decision-card schema with disabled approval controls.

## PR #32 supervised pilot

Final evidence root (ignored local state): `.operator-bridge/pilot-pr32-phase1-final-v2`

- Work order: `WO-MYA-BRIDGE-PR32-PHASE1`
- PR base: `15e4889b9a2ce9334755d471843e5bdf39faf430`
- PR exact read-only head: `8e312dc83206ac022088ce2cc0cda18f97fb026d`
- Exact upstream diff SHA-256: `265a9faaa659cd527deb17aa2c761cc624c6c09bb187a778cb2ae7bf6b24704c`
- Potential credential-bearing diff lines redacted before persistence: 12.
- Persisted GitHub collection artifacts: 5.
- Kimi model: `kimi-k3`
- Kimi streaming: true
- Time to first token: 8,662 ms
- Completion duration: 27,765 ms
- Kimi response artifact SHA-256: `c0114ca908a2f90902d138c29c465a365d156394df510473512016f10b4a4781`
- Decision card SHA-256: `bc8bbfaeceba575121b5e19003006b2d62a523869ef694f50c6f296cf2afd0a4`
- Evidence report SHA-256: `1d3b81600197d260f6dd784eb67f6f7b9a11a34f0e6f0a9212654eb608812f67`
- Final status: `BLOCKED`
- Blocker: `BLOCKED_ADAPTER_UNAVAILABLE`
- Resumable: true
- Manual artifact movements by Denarius: 0
- GitHub writes: 0
- Production mutations: 0

The collector hashes the exact upstream diff in memory. Potential credential literals are redacted before artifact persistence. The source hash and redaction count preserve collection evidence without retaining a removed credential value.

## Validation

Commands:

```text
npm run test:operator-bridge
npm run build
node --check scripts/run-operator-bridge-pilot.mjs
node --check operator-bridge/work-order-ledger.mjs
node --check operator-bridge/kimi-streaming-adapter.mjs
git diff --check
```

Results before commit:

- Operator Bridge tests: 24 passed, 0 failed, 0 skipped.
- Vite production build: passed; existing bundle-size advisory remained nonblocking.
- Node syntax checks: passed.
- Pilot artifact manifests: 10 verified, 0 hash failures.
- Persisted unredacted potential credential literals in diff artifacts: 0.
- High-confidence bearer/private-key/API-token scan findings in final pilot evidence: 0.
- `git diff --check`: passed.

## Remaining blocker and production unknowns

The slice is locally complete but cannot obtain independent Fable review until Denarius authorizes and an independent reviewer ratifies a callable Fable adapter identity and contract. Cloud provider, durable database, object-store retention, production identity, and production deployment decisions remain unresolved and are not silently assumed by this slice.
