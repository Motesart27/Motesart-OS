# MYA Operator Bridge — Bounded Worker Contract v1.0 (Fable Review Package)

Branch: `fix/operator-bridge-bounded-worker-pilot` from baseline `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e`.
Exact head SHA: `1edc00441e375b0c493fc0ba7c16120dc884430b` (`feat(scripts): bounded worker pilot entry + staging-smoke exit evidence`).
Chain: baseline `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e` → `93a3f7e650af87cbccb321522be973472324153c` (`fix(operator-bridge): bounded worker hardening — lock, fencing, session bounds, evidence`) → `1edc00441e375b0c493fc0ba7c16120dc884430b`. Remote tip matched local HEAD exactly at verification time.
Scope: `operator-bridge/`, `scripts/`, `tests/operator-bridge/` only. No production, no Railway, no autonomy activation, no worker start, no merge, no protected-action change.

## 1. Contract point → implementation → tests

| Contract point | Implementation | Tests |
|---|---|---|
| staging only | `OrcaEdgeWorker` constructor environment guard (`WORKER_ENVIRONMENT_REJECTED`); `OrcaStagingWorker` keeps exact-host regex pin + explicit environment guard; `BoundedWorkerSession` requires `environment === 'staging'` | `bounded-worker-session.test.mjs` (constructor rejections), `policy-worker.test.mjs` (wrong-environment rejection) |
| READ_ONLY only | Session `allowedApprovalClasses = ['READ_ONLY']`; `OrcaEdgeWorker` `executionAllowlist.approvalClasses`; `ApprovalPolicy` READ_ONLY-only (preserved) | `bounded-worker-session.test.mjs` (PROTECTED_WRITE skipped, never claimed), `policy-worker.test.mjs` (allowlist claim refusal) |
| `github_pr_read_only_review` allowlisted initially | `DEFAULT_EXECUTION_ALLOWLIST` in `constants.mjs`; enforced at session eligibility AND at `claim_work_order` (`TASK_TYPE_NOT_ALLOWLISTED`) | `bounded-worker-session.test.mjs`, `policy-worker.test.mjs` |
| max 3 orders per session | `maxOrdersPerSession` ceiling = 3, tighten-only, enforced in the session constructor (any value above 3, non-integer, or non-positive → `BOUNDED_SESSION_CONFIG_INVALID`); the run loop checks `orderRecords.length >= maxOrdersPerSession` before every claim and exits `ORDER_CAP_REACHED` | `bounded-worker-session.test.mjs`: constructor rejects `maxOrdersPerSession: 4`; cap tightened to 2 with 5 orders queued → exactly 2 attempted, exit `ORDER_CAP_REACHED` (detail `2/2`), the remaining 3 left `QUEUED` and never claimed |
| max 30-minute total runtime | `sessionBudgetMs` ceiling enforced; session deadline timer aborts in-flight order (`SESSION_TIME_EXHAUSTED`) and terminates loop | `bounded-worker-session.test.mjs` (tightened clock) |
| max 15 minutes per order | `perOrderBudgetMs` ceiling enforced; per-order abort timer (`ORDER_EXECUTION_TIMEOUT`), order blocked, never retried | `bounded-worker-session.test.mjs` (tightened per-order clock) |
| automatic exit after 2 minutes idle | `idleExitMs` ceiling enforced; poll loop exits `IDLE_EXIT` at bound | `bounded-worker-session.test.mjs` (timing-bounded idle test) |
| one-worker cross-process lock | `worker-lock.mjs`: O_EXCL atomic create (`open(path,'wx')`), owning pid recorded, stale recovery only after pid confirmed dead (ESRCH; EPERM/live/malformed fail closed), tombstone rename + revalidation, JSONL recovery log | `worker-lock.test.mjs` (duplicate refused, stale recovered, live never recovered, malformed fails closed, concurrent winners, cross-process SIGKILL recovery); `bounded-worker-session.test.mjs` (duplicate startup refused with evidence) |
| no automatic retry | Session `attemptedOrderIds` — an attempted order is never reclaimed this session; failures are blocked with `HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY` | `bounded-worker-session.test.mjs` (failed order attempt_count stays 1, next order still runs) |
| no daemon / no auto-start | One-shot `scripts/run-bounded-worker-pilot.mjs`; nothing schedules or restarts; idle exit guarantees termination | Contract flags in exit evidence (`daemon: false, auto_start: false`); child-process tests assert process exits |
| no shell-command fields | Existing recursive `ARBITRARY_COMMAND_REJECTED` guards preserved in both workers | `post-merge-hardening.test.mjs` item F (preserved) |
| no approval execution | Decision card controls remain `enabled: false`; completion stays on canonical `completeIdempotently` path only | `post-merge-hardening.test.mjs` (preserved), widened source scan |
| no protected actions | Non-READ_ONLY approval classes are never claimed/executed | `bounded-worker-session.test.mjs`, `policy-worker.test.mjs` |
| no GitHub writes | Collector prohibited-verb list preserved; typed read commands only; `gh` children now bounded with timeout + registry kill | `github-collector.test.mjs` (preserved) |
| no production access | Staging host pin preserved; environment guards added; Kimi adapter loopback pin preserved | `bounded-worker-session.test.mjs`, `policy-worker.test.mjs` |
| exit evidence on every result | `exit-evidence.mjs` + session `_finalize` (idempotent): success, caps, idle, signal, lock-refusal, abnormal (`uncaughtException`/`unhandledRejection`) all write scrubbed evidence (file 0600 + sealed artifact); `run-orca-staging-smoke.mjs` now try/catch/finally + signal handlers | `bounded-worker-session.test.mjs` (every exit reason incl. real SIGTERM/crash child processes), staging smoke finalize |

**Bound-enforcement mechanisms (verified in source).** The runtime bounds are independent walls; whichever is hit first terminates the session with scrubbed exit evidence. **(a) Maximum order count** — `maxOrdersPerSession` (contract ceiling 3, tighten-only; constructor rejects anything above 3 with `BOUNDED_SESSION_CONFIG_INVALID`); the run loop checks `orderRecords.length >= maxOrdersPerSession` before every claim and finalizes `ORDER_CAP_REACHED`. **(b) Session runtime bound** — `sessionBudgetMs` (ceiling 30 minutes) sets `sessionDeadline = startedAt + sessionBudgetMs` and arms a tracked deadline timer that fires even mid-order (aborting the in-flight order with the `SESSION_TIME_EXHAUSTED` blocker and waking the poll loop); the loop also checks the deadline directly and finalizes `SESSION_TIME_EXHAUSTED`. **(c) Idle exit** — `idleExitMs` (ceiling 2 minutes): whenever no claimable/eligible order exists and `clock() - lastActivityAt >= idleExitMs`, the session finalizes `IDLE_EXIT`; polls are interruptible 5-second sleeps that shutdown signals and the deadline timer wake early. A fourth wall, `perOrderBudgetMs` (ceiling 15 minutes), aborts any single order through a per-order `AbortController` timer (`ORDER_EXECUTION_TIMEOUT`; the order is blocked and never retried). There is **no `MAX_POLLS` counter** and **no `POST /run` endpoint** anywhere in this state — both are absent, classified nonblocking/deferred in §6 (items 1–2).

## 2. Defect → resolution

1. **Arbitrary initial-status creation** → `FileWorkOrderLedger.create` accepts only `DRAFT`/`QUEUED` (`INVALID_INITIAL_STATUS` otherwise). Tests in `work-order-ledger.test.mjs`.
2. **Fragile completion source-scan coverage** → scan widened from 2 files to every `operator-bridge/*.mjs` and `scripts/*.mjs` in `post-merge-hardening.test.mjs`.
3. **Duplicate worker startup** → `worker-lock.mjs` cross-process lock (above).
4. **Stale lock recovery** → recovery only after owning pid confirmed dead (ESRCH), tombstone + revalidate + recovery log (above).
5. **Lease/fencing behavior** → `_requireActiveLease` enforces `lease_expires_at` in `transition()` and `completeIdempotently()` (`LEASE_EXPIRED`); `reclaimExpired()` wired into `claim()` via `_reconcileExpiredState` and called by the session loop. Tests in `work-order-ledger.test.mjs`.
6. **Abnormal-exit recovery** → session SIGINT/SIGTERM/uncaughtException/unhandledRejection handlers → graceful finalize with evidence; smoke script wrapped. Tests incl. real child-process SIGTERM and crash.
7. **Wrong-environment rejection** → staging host pin preserved; explicit environment guards on both workers + session.
8. **Child-process and timer cleanup** → `resource-registry.mjs` tracks all timers/children/controllers; `gh` children registered; cleanup (SIGTERM→SIGKILL, abort, clear) on every exit path. Tests assert empty registry + killed fake child.
9. **Redaction and credential leakage** → `redaction.mjs`: extended diff patterns (github_pat_, glpat-, xox*, npm_, sk-ant-, JWT, private-key blocks, unquoted assignments, Google keys) + recursive evidence scrubber; `gh` default runner gained timeout; evidence never contains lease/session tokens (asserted in tests).

## 3. Changed files

Derived via `git diff --name-status 2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e..HEAD`: exactly **19 files**, 2,207 insertions(+), 139 deletions(-).

| Status | File |
|---|---|
| A | `operator-bridge/bounded-worker-session.mjs` |
| M | `operator-bridge/constants.mjs` |
| A | `operator-bridge/exit-evidence.mjs` |
| M | `operator-bridge/github-collector.mjs` |
| M | `operator-bridge/orca-edge-worker.mjs` |
| M | `operator-bridge/orca-staging-worker.mjs` |
| A | `operator-bridge/redaction.mjs` |
| A | `operator-bridge/resource-registry.mjs` |
| M | `operator-bridge/work-order-ledger.mjs` |
| A | `operator-bridge/worker-lock.mjs` |
| A | `scripts/run-bounded-worker-pilot.mjs` |
| M | `scripts/run-operator-bridge-pilot.mjs` |
| M | `scripts/run-orca-staging-smoke.mjs` |
| A | `tests/operator-bridge/bounded-worker-session.test.mjs` |
| M | `tests/operator-bridge/policy-worker.test.mjs` |
| M | `tests/operator-bridge/post-merge-hardening.test.mjs` |
| A | `tests/operator-bridge/redaction.test.mjs` |
| M | `tests/operator-bridge/work-order-ledger.test.mjs` |
| A | `tests/operator-bridge/worker-lock.test.mjs` |

(9 added, 10 modified. This contract document is not part of the 2-commit chain; it is added by a separate documentation-only follow-up commit.)

## 4. Test evidence

**Execution status (verified for this state).**

- No live staging smoke test was executed — `scripts/run-orca-staging-smoke.mjs` was hardened (exit evidence on every result, signal handlers) but never run.
- No real work order was created or executed, and the bounded worker was never started.
- The worker remains unactivated: nothing schedules, installs, daemonizes, or auto-starts it; `scripts/run-bounded-worker-pilot.mjs` is a manual, one-shot entry point only.
- This PR does not authorize merge, deployment, or production use.

**Automated suite (`node --test`, re-verified 2026-08-03 UTC on exact HEAD `1edc00441e375b0c493fc0ba7c16120dc884430b`).**

- Baseline full suite — `node --test tests/operator-bridge/*.test.mjs`: **160/160 passing** (14 test files, 0 failures, 0 skipped).
- Focused bounded-worker run — `bounded-worker-session` (13) + `worker-lock` (8) + `work-order-ledger` (11) + `redaction` (5): **37/37 passing**.

**Independent exact-HEAD review (recorded evidence for this exact HEAD).** 21/21 contract points ENFORCED, including 14 designed-failure probes; 0 blocking findings; 5 nonblocking findings (§6).

All evidence above derives from the automated suite (temporary directories, fake and spawned child processes) and that recorded review — not from any live run, real work order, or worker activation.

## 5. Scans

- Secret scan over added lines (`git diff 2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e..HEAD`, patterns: `github_pat_`/`gh[pousr]_`, `sk-`/`sk-ant-`, `glpat-`, `xox*`, `npm_`, `AKIA`, `AIza`, JWT (`eyJ….….`), private-key blocks, `Bearer …`, and keyword assignments): **no real secret values in any added line**. The only matches are (a) the redaction-pattern definitions themselves in `operator-bridge/redaction.mjs` and (b) synthetic designed-failure fixtures in `tests/operator-bridge/redaction.test.mjs` — sequential-alphabet dummies (e.g. a `github_pat_11ABCDEFG0…` probe), the well-known public jwt.io example JWT, and `RAW_*` placeholders that the tests assert are scrubbed from evidence. No live token, key, password, or credential is present. The 40-hex strings in this document are git commit SHAs only.
- Protected-boundary scan (`git diff --name-only` vs baseline): exactly the 19 files in §3 — 10 under `operator-bridge/`, 3 under `scripts/`, 6 under `tests/operator-bridge/`. **Nothing outside those roots**: no `staging-control-plane/`, no deployment, CI, or Railway configuration, no root manifests, and no `docs/` path in the 2-commit chain. (This contract document, under `docs/operator-bridge/`, is added separately by the documentation-only follow-up commit and is the only file in that commit.)

## 6. Honest gaps

0 blocking findings. The 5 nonblocking findings below do not weaken any §1 contract point in this state; items 1–2 are absent-by-design and items 3–5 are deferred hardening.

1. **`MAX_POLLS` is NOT implemented (absent — deferred, nonblocking).** A tree-wide search confirms no `MAX_POLLS`/`maxPolls` poll-count bound exists in this state. The design is still safe without it: polling only occurs while no claimable work exists, an idle queue terminates the session at the 2-minute idle bound (`IDLE_EXIT`), and the 30-minute session clock caps all polling regardless. At the default 5-second poll interval an idle session exits after ~24 polls. An explicit poll counter is deferred hardening, not a contract gap.
2. **A `POST /run` path does NOT exist (absent — deferred, nonblocking).** Verified: the only outbound POSTs are the typed staging control-plane actions in `OrcaStagingWorker` (`/v1/executors/orca/session`, `/v1/executors/orca/claim`, `/v1/executors/orca/work-orders/:id/heartbeat|artifacts|complete|block|release`) and the loopback-pinned Kimi adapter call (`127.0.0.1`/`localhost` only). No `/run` route, no inbound listener, and no remote trigger surface exists anywhere in this state — the bounded worker is a one-shot local process (`scripts/run-bounded-worker-pilot.mjs`) started manually. Having no remote execution surface is strictly safer than a guarded one; an operator-gated trigger can be designed later if ever needed.
3. **`killGraceMs` is not ceiling-clamped.** The session constructor ceiling-checks `maxOrdersPerSession`, `sessionBudgetMs`, `perOrderBudgetMs`, and `idleExitMs` (tighten-only), but not `killGraceMs` (default 1,000 ms); a misconfigured caller could extend post-bound cleanup grace. Nonblocking: cleanup still runs idempotently on every exit path, exit evidence is still written, and every tracked timer/child/controller is still closed.
4. **No cross-session attempt ceiling.** No-automatic-retry is absolute within a session (`attemptedOrderIds`; failed orders are blocked with `HUMAN_REVIEW_REQUIRED_NO_AUTOMATIC_RETRY` and `attempt_count` stays 1), but `attempt_count` carries no lifetime cap across separate future sessions — an explicit human re-queue (or a lease-loss reclaim) could permit a later attempt. Nonblocking: re-activation requires deliberate human action; a lifetime attempt cap is deferred.
5. **Exit-evidence write failure is non-fatal.** If `writeExitEvidence` itself throws, the exit still completes with `evidence_written: false` and an `exit_evidence_write_failed` timeline record — deliberate, because evidence failure must never mask the exit. Nonblocking: the failure is surfaced in the returned result and on stderr by the calling script; "exit evidence on every result" is therefore best-effort under filesystem/artifact-store failure.
