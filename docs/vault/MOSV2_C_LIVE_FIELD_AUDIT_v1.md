# MOSV2-C LIVE FIELD AUDIT v1 — governed evidence document (PR #25, branch `feat/mosv2-c-zones`)

Per PLAN v1.1.1 §3.4 (live field-verification gate) and §3.7 (evidence destination). One authorized read-only live request per endpoint, executed **2026-08-02** through the existing same-origin `/api/*` proxy path (production Netlify origin, plain `GET`, no body). **No credentials, tokens, or record contents were printed or recorded** — shapes and key names only. Read-only verification only; no provider write, configuration mutation, or credential inspection was performed.

PLAN reference: `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` §4 (source/auth matrix).

---

## Endpoint 1 — `GET /api/tasks` (Z1 signal feed · Z2 projects · Z2 Book lane · Z4 Personal lane)

- **Request:** `GET /api/tasks?limit=2` → **HTTP 200**
- **Safe shape recorded:** `{ ok: bool, tasks: [ { id, business, title, priority, task_context, owner, status, due_date, created_at, source, project_or_area, task_number, next_action, task_id, "Attachment Summary": {state, errorType, value, isStale}, latest_update_summary, approval_status, task_type } ], count: int }`
- **PLAN comparison:** envelope `{ok, tasks[], count}` matches §4 Domain 1. All PLAN-required fields exist with the documented lowercase case.
- **Deviations recorded:**
  1. **Sparse optional fields:** `assigned_agent` and `requires_approval` are absent on records where empty (Airtable omits empty fields; both appear on other records, e.g. in `/api/pulse` buckets). **Adapters must treat them as optional**, never assume presence.
  2. **Extra fields present but unused:** `"Attachment Summary"` (Airtable attachment object, space in name), `task_number`, `task_id`. Ignored by design; never read.
- **Mock marker:** none present.
- **Verdict:** **PASS** — wiring authorized for MASTER_TASKS-backed tiles with the sparse-field rule above.

## Endpoint 2 — `GET /api/pulse` (Z3 business pulse tile)

- **Request:** `GET /api/pulse` → **HTTP 200**
- **Safe shape recorded:** `{ ok: bool, pulse: { urgent: [task], overdue: [task], blocked: [task], approval: [task], done_today: [task], stale: [task] } }` — each bucket is an **array of task objects** (same task shape as Endpoint 1, including `assigned_agent` when set).
- **PLAN comparison:** bucket names match §4 Domain 1 exactly (`urgent, overdue, blocked, approval, done_today, stale`).
- **Deviation recorded:** buckets are **arrays, not counts**. The Z3 pulse tile must render `bucket.length` client-side. PLAN wording listed bucket names without types; this audit is the authoritative clarification.
- **Mock marker:** none present.
- **Verdict:** **PASS with shape clarification** — wiring authorized; tile counts array lengths.

## Endpoint 3 — `GET /api/mya/calendar/events` (Z1 Today agenda · Z4 personal calendar · Z2 countdown dates)

- **Request:** `GET /api/mya/calendar/events?days_ahead=1&max_results=3` → **HTTP 200**
- **Safe shape recorded:** `{ events: [ { summary, title, description, start, end, source_calendar_id } ], count: int, days_ahead: int, fetched_at: str }`
- **PLAN comparison:** exact match with §4 Domain 2 (field names, case, envelope). No `id`/`is_all_day` in the range fetch — as documented; tiles do not use them.
- **Deviations:** none.
- **Mock marker:** none present.
- **Verdict:** **PASS** — wiring authorized.

## Endpoint 4 — `GET /api/mya/audit/handled` (Z1 handled-log digest)

- **Request:** `GET /api/mya/audit/handled?limit=1` (no token) → **HTTP 401** `{ "detail": "Missing or invalid Authorization header" }`
- **PLAN comparison:** matches §4 Domain 3 exactly — this is the only JWT-enforced cockpit feed; the 401 body is the documented FastAPI shape.
- **Gate disposition:** the endpoint is **authentication-gated as planned**; this is not a schema failure. An authenticated live read requires an interactive founder session (`som_token`), which this planning seat does not hold and must not fabricate. The tile's field shape (`{timestamp, route, result_summary, response_text}`, case-verified at `mya_audit_read.py:22-25`) stands at code level.
- **Verdict:** **PASS (auth-gated as planned)** — wiring authorized with ruling 9.5 tile-local 401 handling (tile hides quietly; never a global logout). The first authenticated load in the founder's session completes the live confirmation; `result_summary` null ⇒ `response_text` fallback per gap G9.

## Endpoint 5 — `POST /api/tasks` (Z5 quick actions — the ONLY write)

- **No live request performed.** Real task submission is **not authorized** in this phase (founder Z5 ruling: component + fixture/mocked integration tests only; a later founder-authorized synthetic staging proof may test one real create).
- Field/response shape stands code-verified (`tasks.py:391, 208-242`): request `{title, business, priority?, assigned_agent?, requires_approval?, ...}`; response `{"ok", "task": {"id", "deduped", ...}}`; `requires_approval: true` ⇒ backend sets `approval_status: "pending"` + `approval_requested_at`.
- **Verdict:** **DEFERRED by ruling** — no live mutation.

## Endpoints intentionally NOT requested

- **`/api/fm/*` (all):** zero live requests — founder pre-B2 law (PLAN §3.8). FM tiles render `Financial data unavailable — verification pending.`
- **`/students/*`:** never called — founder G2; outside the same-origin `/api/*` proxy and prohibited. Tile renders `SOM data connection pending.`
- **Revenue series:** does not exist — founder G4; chart is fixture-only. Live chart copy: `Revenue trend unavailable — daily source not connected.`
- **`/api/travel/*`, `/api/people`:** excluded by founder G3 (mock-fallback hazard / prohibited Life source).

---

**Summary:** 4 endpoints read (3 PASS · 1 PASS-auth-gated) · 1 write deferred by ruling · 4 endpoint families not requested by ruling. Two implementation-binding clarifications recorded: (1) MASTER_TASKS optional fields are sparse — adapters must tolerate absence; (2) `/api/pulse` buckets are arrays — the pulse tile counts lengths. No gate failure required stopping any tile.

*— MOSV2-C live field-verification gate · evidence for PR #25*
