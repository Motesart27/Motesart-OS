# MOSV2-C CURRENT-MAIN PLAN — Source/Auth Matrix and Home Zones (PLAN ONLY)

---

## 0 · DOCUMENT CONTROL

| Field | Value |
|---|---|
| **Title** | MOSV2-C Current-main PLAN, source/auth matrix and Home zones |
| **Version** | **1.1.1** — the **final pre-implementation PLAN revision** (supersedes the unapproved v1.1 draft and v1.0) |
| **Filename** | `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` — filename and document version are intentionally identical at this revision; this is the only Phase C PLAN file |
| **Date** | August 2, 2026 |
| **Status** | **PLAN GATE — FOR DENARIUS EXACT-HEAD APPROVAL** |
| **Workstream** | **MOSV2-C** (single workstream per ADR-IMP2; nothing else mixed in) |
| **Repository** | `Motesart27/Motesart-OS` · **PR** #25 (draft) |
| **Current-main baseline (verified)** | `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e` — confirmed equal to `origin/main` |
| **Packet baseline (superseded)** | `72a2984b78be18863d4e2076ec8d22f9d1ad5510` (23 commits behind current main; drift in §2) |
| **Governing packet** | `docs/vault/MOSV2_PHASE_C_EXECUTION_PACKET_v1.0.md` (filename unchanged; byte-identical on current main to the PR #15 mirror) |
| **Branch** | `feat/mosv2-c-zones` (isolated worktree; zero implementation commits) |
| **Backend audited ref** | `Motesart27/Deployable-python-codebase-som` `origin/main` = `15e4889b9a2ce9334755d471843e5bdf39faf430` (2026-07-24, "KIMI-MANUAL-001") |
| **Classification** | Architecture (documentation only) |
| **Amendment record** | v1.0 — initial current-main PLAN (head `b333db0`). v1.1 — recorded founder rulings G1–G4, G7, G8, mock-data ruling, same-origin rule, live field-verification gate (head `c41bf31`; reviewed, never approved). **v1.1.1 — final pre-implementation revision; supersedes the unapproved v1.1 draft; resolves the three independent-review findings: document identity (filename = version), unambiguous live-audit destination (PR #25 itself, §3.7), and deterministic fail-closed pre-B2 FM behavior (§3.8). Documentation only.** |

**NO PHASE C IMPLEMENTATION HAS BEGUN.** This PR contains exactly one file (this document). No component, adapter, endpoint, or configuration was created or modified.

**How this plan was grounded:** every packet assumption was re-verified at file level against (a) current main `2f0c3f4` of this repo and (b) backend `origin/main` `15e4889`. Nothing was inherited from the packet's July 13 baseline without re-verification. Where the packet and current source disagree, current source wins and the disagreement is recorded in §2 or §5.

**Data classification law (applies to every statement in this plan and to every tile at implementation):** the plan and the UI must always distinguish, and never blur, five classes —
1. **LIVE** — data served by a verified same-origin `/api/*` endpoint whose fields passed the live field-verification gate (§3.4);
2. **UNAVAILABLE-LIVE** — a lawful endpoint exists but its data may not be presented yet (pre-B2 FM, founder-deferred SOM); renders explicit unavailability or quiet-empty, never a production-connected claim;
3. **FIXTURE** — deterministic Gallery data, visibly labeled FIXTURE, used to demonstrate components and states; Gallery performs zero network calls (9.6);
4. **MOCK** — backend payloads carrying `"status":"mock"`; **never valid populated data**, always forced into the adapter's unavailable/error state (§3.6);
5. **DEFERRED** — sources with no endpoint (Book BK_* model, VitalStack/Life, canonical daily revenue series, SOM `/api/*` route); owned by later backend workstreams, never improvised inside Phase C.
No quiet-empty or unavailable deferred tile may be marked or styled as production-connected.

---

## 1 · CURRENT-MAIN BASELINE CONFIRMATION

- `origin/main` HEAD = `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e` (merge of PR #24). Verified by fresh `git fetch` + `git rev-parse origin/main`.
- Isolated worktree created at `~/Motesart-OS-c-zones`, branch `feat/mosv2-c-zones` pointing at that SHA. Zero divergence from main.
- Phase A **COMPLETE** (DEPLOY_LEDGER: PR #9, main `60d19cfa…`) · Phase B **COMPLETE** (PR #13, main `dc4eb48c…`) · production `VITE_MOS_V2` = **false** (DEPLOY_LEDGER lines 17, 92; PROJECT_BRAIN §15/§17).
- `src/v2/` on current main = 8 files: `V2App.jsx`, `Gallery.jsx`, `tokens.css`, `gallery.css`, `components/index.jsx` + css, `shell/index.jsx` + css. **No adapters, no hooks, no fetch code anywhere under `src/v2/`** (grep for `fetch(|XMLHttpRequest|axios` = zero hits).
- Home zone containers exist as skeletons only: `src/v2/shell/index.jsx:198-220` (`HomeSkeleton`), classes `v2-zone--1..5`, header copy "Shell ready · live data arrives in Phase C".
- No Phase C implementation exists anywhere in `src/` (grep for `Z1Today|Z2Projects|Z3Business|Z4Personal|Z5QuickActions|useAdapter|create_task_core` = zero hits in code).

---

## 2 · OLD-PACKET VERSUS CURRENT-MAIN DRIFT TABLE

Drift window: `72a2984b…` (packet baseline, July 13) → `2f0c3f4…` (current main, July 31). 23 commits, 53 files, +7635/−34.

| # | Packet assumption (July 13) | Current-main reality (verified) | Impact on Phase C |
|---|---|---|---|
| D1 | Baseline main = `72a2984b…` | Current main = `2f0c3f4…` (23 commits ahead: PRs #15, #16, #17-commit, #22, #23, #24) | Baseline updated; branch cut from current main |
| D2 | `/v2` index renders the Gallery | `src/v2/V2App.jsx:7-13`: index redirects to `home`; Gallery now at explicit `/v2/gallery` (commit `473fafa`, MOSV2-AB-VISIBILITY-001) | Gallery specimen URL is `/v2/gallery`; proof package updated |
| D3 | `/v2/*` reachable without auth | `src/App.jsx`: entire `/v2/*` tree behind `PrivateRoute`; flag-off `/v2` redirects to `/login`; login preserves `location.state.from` | All v2 reads will carry the `som_token` JWT; tile-local 401 handling (9.5) is now load-bearing |
| D4 | Design Bible v1.0 controlling | Bible **v1.1 ACTIVE** (PR #16): adds DB-G8 Button disabled-state recipe | 9.x rulings re-cited against v1.1; qbtn "no disabled state" rationale (DB-G8 stays Button-only) unchanged |
| D5 | Zone labels Today/Projects/Business/Life/Quick Actions | Shell labels Z4 = **"Life"**, Z5 = **"Mya"** (`shell/index.jsx:199-205`) | Cosmetic label mismatch; Z5 tile set is quick actions per packet/handoff. Relabel of the Z5 container heading is in-scope under `src/v2/*` at implementation |
| D6 | `netlify.toml` static since baseline | +15 lines: staging redirects for `deploy-preview-22--motesart-os.netlify.app` (`/operator-bridge-staging*`); **the `/api/*` proxy rule is untouched** (`netlify.toml:5-9`) | Proxy assumption intact; deploy config remains protected — no Phase C change requested or permitted |
| D7 | `src/main.jsx` synchronous bootstrap | Rewritten: async bootstrap with host-conditional branch into `src/operator-bridge-staging/`; build-time `__OPERATOR_BRIDGE_BUILD_HEAD__` define in `vite.config.js` | None for v2 zones; noted so no plan step touches the entry file |
| D8 | `public/manifest.json` `start_url: /` | `start_url: /v2/home`, `scope: /` | PWA entry lands on `/v2/home`; legacy `/` still byte-identical in the app itself |
| D9 | No operator-bridge in repo | `operator-bridge/`, `staging-control-plane/`, `tests/operator-bridge/`, `scripts/` added (PRs #22–24, ~7,500 lines) | **Zero intersection with `src/v2`** (verified by grep). Per the tasking: no Operator Bridge or phone-pilot work is mixed into Phase C |
| D10 | Packet exists at baseline SHA | The packet file itself was added **after** the baseline by PR #15 (`8bd8e0b`); on current main it is byte-identical to that mirror | Governing packet text confirmed current |
| D11 | Packet §3: "no Phase C branch exists" | Branch `feat/mosv2-c-zones` now exists (this PLAN); zero implementation commits | Stale precondition only; implementation statement above stands |
| D12 | Packet §6: "exact read endpoint named at PLAN after Codex route inspection" | Route inspection complete — §4 matrix names every endpoint with file:line citations | Plan gate satisfied |
| D13 | Packet §11: `FIELDS.md` to inspect for field audit | **`FIELDS.md` does not exist anywhere in the repo** (glob-verified), though `AGENTS.md:14` and the handoff cite it | Field audit performed at backend code level; live-schema confirmation now governed by the founder's live field-verification gate (§3.4) |

**Not drifted:** `VITE_MOS_V2` flag plumbing (`src/App.jsx:14`: `VITE_MOS_V2 === 'true' || window.MOS_V2 === true`) · `index.html` byte-identical · legacy dashboard routes byte-identical except `App.jsx`/`Login.jsx`/`main.jsx` auth-bootstrap changes above · no new runtime dependencies (`package.json` deps unchanged; only 3 operator-bridge scripts added) · no mounted backend route removed.

---

## 3 · FOUNDER DECISIONS — RECORDED RULINGS

### 3.1 · Round 1 (packet §9 items) — recorded as approved recommendations

| # | Decision | Recorded ruling |
|---|---|---|
| 9.1 | DB-G6 state designs + chart keyboard equivalent | **APPROVED** — packet §7.1 state visuals and the arrow-key chart crosshair (plot focusable, `role="img"`, Left/Right step, Home/End endpoints, polite per-step announcement) are the design fill |
| 9.2 | FM-PAT-B2 dispatch | **APPROVED** — dispatch FM-PAT-B2 as a **separate repository, branch and PR**; expanded by Round 2 ruling G8 (§3.2) |
| 9.3 | Refresh cadences | **APPROVED** — tasks/signals **60s** · calendar/audit **300s** · FM/SOM/Book/personal **900s** · **all timers pause on `visibilitychange` (hidden tab)** and resume on visible |
| 9.4 | Signal-feed row click | **APPROVED** — rows route to the owning module screen (L2 skeleton in Phase C) |
| 9.5 | Tile 401/403 | **APPROVED** — tile-local error ("sign-in needed"), **never** a global logout or redirect |
| 9.6 | Gallery fixtures | **APPROVED** — deterministic fixture module + forced-state specimens; **Gallery performs zero network calls** (provable in the network tab) |

### 3.2 · Round 2 (founder rulings on the v1.0 gap register) — RECORDED VERBATIM AS RULINGS

**G1 — BOOK MANAGER: APPROVED WITH TASK-LANE FALLBACK.** For Phase C: use the existing MASTER_TASKS Book business lane; `GET /api/tasks?business=Book` may provide task-based Book information. Do **not** claim `BK_Project`, `BK_Blockers`, or a dedicated Book read model exists. Dedicated Book Manager reads remain a later backend workstream. The Z2 Book tile must render a lawful quiet-empty state when no Book tasks exist.

**G2 — SCHOOL OF MOTESART: DEFER THE LIVE SOM STUDENT-COUNT TILE.** No direct browser call to `/students/*`. Specifically prohibited inside Phase C: direct absolute browser URL to the backend; bypassing the existing `/api/*` proxy; unauthenticated browser data access; CORS workarounds; Netlify proxy changes; backend authentication changes mixed into the Phase C PR. Phase C behavior: the Z3 SOM student-count tile renders a **quiet-empty** state with truthful copy `SOM data connection pending.` Gallery fixtures may demonstrate the eventual tile states. A later separate backend workstream must provide an authenticated, same-origin `/api/*` read route before live SOM student data is displayed.

**G3 — LIFE / PERSONAL: APPROVED WITH A RESTRICTED TILE SET.** Phase C Z4 may use **only**: (a) Personal business-lane tasks from MASTER_TASKS (`GET /api/tasks?business=Personal`), and (b) personal-calendar events from the verified calendar read path (`GET /api/mya/calendar/events`, which merges `GOOGLE_CALENDAR_ID_PERSONAL` server-side). Do **not** use: VitalStack (no canonical source exists); hardcoded or mock travel responses; hardcoded or mock people responses; invented health, life, or personal metrics. Missing data renders a quiet-empty state. Do not display an error merely because an optional Life source does not exist.

**G4 — REVENUE SERIES: DO NOT REPRESENT MONTHLY DATA AS A 7-DAY OR 30-DAY SERIES.** The verified `FM_Monthly_Summary.Total_Income by Month` source does not support truthful 7D and 30D plotting. Ruling:
1. Build the Z3 chart component and all required interaction/accessibility behavior using deterministic Gallery fixtures.
2. Demonstrate: 7D, 30D, QTD, pointer crosshair, keyboard crosshair, loading, empty, stale, partial, error.
3. The live cockpit chart must remain **quiet-empty or explicitly unavailable** until a canonical daily revenue-series source is verified.
4. Truthful live copy: `Revenue trend unavailable — daily source not connected.`
5. Do not interpolate, duplicate, or subdivide monthly values into daily points.
6. Do not silently substitute invoice totals or piano revenue.
7. FM summary/stat tiles may become live only after FM-PAT-B2 is deployed and independently verified green.
8. Mock FM responses remain forbidden as executive data.
This ruling blocks only the live revenue-series adapter, not the chart component, Gallery specimens, or valid FM summary tiles after B2.

**G8 — FM-PAT-B2: AUTHORIZE THE BROADER FIVE-FILE DEFECT CORRECTION AS A SEPARATE BACKEND PR.** The separate backend workstream may correct the identical `.lstrip("=")` PAT defect in `fm_airtable.py`, `airtable_client.py`, `morning_brief.py`, `piano.py`, `travel.py`. Requirements: (1) separate repository `Motesart27/Deployable-python-codebase-som`; (2) separate branch and PR; (3) one bounded Functional workstream; (4) exact five-file correction boundary unless tests require narrowly related test files; (5) no unrelated refactor; (6) tests for all five corrected credential-read paths; (7) secret scan; (8) exact-head independent review; (9) no merge or deployment without later founder authorization; (10) FM tiles remain untrusted and caveated until post-deployment live reads are independently green. Full workstream plan in §16.

### 3.3 · G7 — AUTH FOLLOW-UP (recorded)

The unauthenticated backend-read finding (§4, nearly all read endpoints carry no server-side auth) remains recorded as a **separate security follow-up**, owned by a future backend workstream. Phase C does **not** reopen or modify authentication. The Phase C frontend still sends its existing JWT (`som_token`) on same-origin requests, but the plan and UI must **not claim endpoints enforce authentication when source proves they do not**. Per-endpoint auth truth is stated in §4 and §6.

### 3.4 · LIVE FIELD-VERIFICATION GATE (founder-ruled; binds implementation)

Before the first implementation commit that wires any live endpoint:
1. Perform one authorized live read of that endpoint.
2. Record safe response keys and shapes.
3. Compare live fields against this PLAN (§4).
4. Do not print credentials or sensitive record contents.
5. Add the live-schema field audit directly to PR #25, as it evolves from its approved PLAN gate into the Phase C implementation PR (destination law in §3.7).
6. **Stop that tile's implementation** for: missing field · changed case · unexpected mock response · authentication failure · unexpected response shape · provider error.
7. A failure in one tile must not block lawful implementation of unrelated tiles.

### 3.5 · SAME-ORIGIN DATA RULE (founder-ruled; binds all Phase C browser code)

Phase C browser code may use **only**: (a) current same-origin `/api/*` routes through the established Netlify proxy; (b) verified local/client-derived values such as date and countdown calculations. Phase C may **not** introduce direct browser calls to provider or backend origins (no absolute Railway/Netlify/Airtable/Google URLs in v2 code, no new proxy rules, no CORS reliance).

### 3.6 · MOCK-DATA RULING (founder-ruled; binds every Phase C adapter)

- Payloads containing `"status":"mock"` are **not valid populated data**.
- Mock payloads must enter the adapter's **unavailable/error state**.
- Mock values must never appear as real executive metrics.
- The UI may not hide or remove the mock marker and display the values.
- Deterministic Gallery fixtures remain separate and visibly classified as fixtures.

### 3.7 · IMPLEMENTATION EVIDENCE DESTINATION (founder-ruled; unambiguous)

1. After exact-head founder approval, **PR #25 remains open and draft**.
2. PR #25 transitions from PLAN-only to Phase C implementation on the **same branch** `feat/mosv2-c-zones`.
3. Before the first commit that wires each live endpoint, the §3.4 live field-verification gate is run for that endpoint.
4. The safe endpoint/field audit is added **directly to PR #25**.
5. The audit must be present in the PR body or an explicitly linked governed evidence document on the same branch **before that tile is considered wired**.
6. **No separate implementation PR is assumed.**
7. A separate implementation PR would require a **new founder ruling**.
8. FM-PAT-B2 remains a **separate backend repository and PR** and is **not mixed into PR #25**.

Every reference in this plan to implementation evidence, audits, proof, or wiring commits means: **PR #25, as it evolves from its approved PLAN gate into the Phase C implementation PR.**

### 3.8 · PRE-B2 / POST-B2 FM RULE (founder-ruled; deterministic, fail-closed — supersedes every earlier disjunctive FM statement)

**BEFORE FM-PAT-B2 IS DEPLOYED AND INDEPENDENT LIVE READS ARE GREEN:**
1. No FM-derived value may render as populated live cockpit data.
2. No FM-derived signal may appear in the live Z1 signal feed.
3. No FM summary or statistic may appear as a live Z3 value.
4. The live FM tiles render an explicit unavailable or quiet-empty state.
5. Approved copy: `Financial data unavailable — verification pending.`
6. Gallery fixtures may demonstrate FM component states but must be visibly labeled FIXTURE and perform zero network calls.
7. Any payload with `"status":"mock"` remains an error/unavailable result (§3.6).
8. Monthly revenue data remains prohibited as a substitute for a daily series (G4).

**AFTER FM-PAT-B2 IS DEPLOYED AND INDEPENDENT LIVE READS ARE GREEN:**
1. The verified FM summary/stat endpoints may be wired.
2. The §3.4 live-field gate must still pass before rendering.
3. FM-derived Z1 signals may be introduced only from verified non-mock data.
4. The revenue chart remains unavailable until a canonical daily series exists.
5. B2 approval alone does not create or authorize a daily revenue series.

This rule replaces all earlier "suppressed or caveat-rendered", "suppressed or ≤warn", "fixture-fed or live with caveat", and "live but unverified" phrasing. The packet's A3 ≤warn-severity interim regime is **superseded** by this fail-closed rule for Phase C.

---

## 4 · NINE-DOMAIN SOURCE/AUTH MATRIX (verified against current main + backend `15e4889`; amended per §3.2, §3.7, §3.8)

Legend — Availability: **AV** available · **CON** constrained · **MISS** missing · **DEFER** deferred by founder ruling. "Phase C legal" = usable under packet §4/§5 and the §3 rulings. All frontend reads go **same-origin only** through the Netlify proxy `/api/* → https://deployable-python-codebase-som-production.up.railway.app/api/:splat` (§3.5); the frontend sends `Authorization: Bearer <som_token>` (JWT in localStorage, `src/services/api.js:4-6`) but does not claim server-side enforcement where none exists (§3.3). **No client-side Airtable/PAT anywhere — confirmed and remains law.**

### Domain 1 — MASTER_TASKS

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable base `AIRTABLE_MASTER_TASKS_BASE_ID` / table `AIRTABLE_MASTER_TASKS_TABLE_ID` (env-named, `app/airtable_client.py:44-45`; router docstring names base `app4GKdk1AqmiOyKx`, tables `MASTER_TASKS`+`TASK_UPDATES` — see Gap G5 on the base-ID conflict) |
| Exact endpoint | `GET /api/tasks` (`app/routers/tasks.py:305`); filters `business,status,priority,owner,assigned_agent,requires_approval(true only),due_today,limit≤200`. Aggregate: `GET /api/pulse` (`tasks.py:369`) |
| Authentication | **None server-side** (verified; no auth dependency on the route); frontend sends Bearer `som_token` anyway — §3.3 truthful-claim rule applies |
| Exact fields (case-verified in code) | lowercase: `title, business, status, priority, owner, assigned_agent, source, approval_status, requires_approval, approval_requested_at, approved_at, next_action, task_context, due_date, waiting_on, project_or_area, task_type, completed_at, created_at, workflow_updated_at, latest_update_summary, notify_on_complete, is_stale` (`tasks.py:315-322, 56-63`). Enums: business ∈ {E7A, SOM, FM, Book, Personal}; status ∈ {pending, in_progress, blocked, done}; priority ∈ {urgent, high, medium, low} |
| Response shape | `{"ok": true, "tasks": [{"id", ...fields}], "count": n}`; pulse → `{"ok", "pulse": {urgent, overdue, blocked, approval, done_today, stale}}` |
| Trust classification | Production-trusted per ADR-DC2 (documented); code-level defects below temper specific filters |
| Freshness expectation | 60s cadence (9.3) |
| Failure behavior | Per-tile degrade; last-good + stale mark |
| Availability | **AV with constraints** |
| Production-trusted | Yes (documented), with defect notes |
| New connector required | No |
| Phase C legal | **Yes — LIVE candidate** — Z1 signal feed + Z2 project grouping + Z4 Personal lane + Z2 Book lane (G1), all through same-origin proxy, all subject to the §3.4 gate |
| Unknowns / required proof | Live Airtable schema not directly queried (code-level audit only) — resolved per tile by the §3.4 gate. Known backend defects to respect: duplicate `{status}` fields in the live base make `?status=` filtering suspect (`tasks.py` Phase 2.4 docstring); sort by computed `created_at` has Airtable-422 history (`tasks.py:331` vs Phase 2.2 header); `?requires_approval=false` silently ignored (`tasks.py:321`); `due_today` uses naive server-local time (`tasks.py:324`). Phase C filters client-side from the unfiltered list where feasible and never depends on `?status=` alone |

### Domain 2 — Google Calendar

| Attribute | Verified value |
|---|---|
| Authoritative source | Google Calendar API, service account `GOOGLE_SERVICE_ACCOUNT_JSON` (server-side only); calendars `GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_ID_PERSONAL` merged server-side (`app/services/calendar_executor.py:21-40`); day bounds in `USER_TIMEZONE` (default `America/New_York`) |
| Exact endpoint | `GET /api/mya/calendar/events?days_ahead=7&max_results=20` (`app/routers/mya.py:636-650`). Also `GET /api/mya/calendar/day-intelligence` (`mya.py:653-667`) |
| Authentication | None server-side (verified); service-account auth is server-side only |
| Exact fields | Event: `{summary, title, description, start, end, source_calendar_id}` (`calendar_executor.py:475-492`). Range fetch carries **no `id` / no `is_all_day`** (those exist only in the window-fetch variant, `calendar_executor.py:495-516`) |
| Response shape | `{"events": [...], "count", "days_ahead", "fetched_at"}` |
| Sanitizer | **Verified present, server-side, applied on every read:** `_sanitize_cal_text` (`calendar_executor.py:43-49`) — strips `[\n\r\t]`, `[\[\]{}<>`]`, `(system|assistant|user|developer):` prefixes (case-insensitive), collapses whitespace, truncates 160 chars |
| Trust classification | Production-trusted (ADR-DC2) |
| Freshness | 300s cadence (9.3) |
| Failure behavior | Per-tile degrade; sanitized titles always (packet A6) |
| Availability | **AV with constraints** |
| Production-trusted | Yes |
| New connector required | No |
| Phase C legal | **Yes — LIVE candidate** — Z1 Today agenda + Z4 personal-calendar events (G3) + Z2 countdown date inputs, same-origin, §3.4-gated |
| Unknowns / required proof | "Today's remaining events" has no dedicated endpoint; the adapter filters the range response client-side to today. Live event shape spot-checked at the §3.4 gate (raw vs rendered sanitized title proof) |

### Domain 3 — Mya Voice Audit Log

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable table from env `AIRTABLE_MYA_AUDIT_TABLE_ID` in base `AIRTABLE_BASE_ID` (`app/services/audit_log.py:43-44`, `handled_log_read.py:26-28`). **The packet's table ID `tblDEyL8fzGGVvs2t` appears only in PROJECT_BRAIN.md:265-273, never in code** — code reads the env var |
| Exact endpoint | `GET /api/mya/audit/handled?limit=1..10` (`app/routers/mya_audit_read.py:49`) |
| Authentication | **JWT required** — `Depends(get_current_user)` (`mya_audit_read.py:49-53`). The only cockpit feed source with enforced auth; 401 body `{"detail": "..."}` (FastAPI default) |
| Exact fields | Items: `{timestamp, route, result_summary, response_text}` — case-verified (`mya_audit_read.py:22-25`, `handled_log_read.py:11`). Display-sanitized server-side (HTML-unescape, tag strip, truncate 180/240) |
| Response shape | `{"ok", "items": [...], "count", "fetched_at"}`; Airtable failure → 502 `{"detail":"Handled log unavailable"}` |
| Trust classification | Write path production-trusted (ADR-DC2); **read model constrained** |
| Freshness | 300s cadence (9.3) |
| Failure behavior | Line hides when empty (quiet); 401 → tile-local per 9.5 |
| Availability | **CON** |
| Production-trusted | Partially — known live defect below |
| New connector required | No |
| Phase C legal | **Yes — LIVE candidate** — Z1 handled-log digest, null-tolerant rendering, §3.4-gated |
| Unknowns / required proof | **The writer (`audit_log.write_entry`, `audit_log.py:24`) never writes `result_summary`** — it writes `transcript`, not `result_summary`; PROJECT_BRAIN documents the live defect "audit rows return null fields — suspected column-name mismatch." The tile renders `response_text` fallback when `result_summary` is null (G9). Proof: §3.4 live read showing actual null behavior |

### Domain 4 — Book Manager

| Attribute | Verified value |
|---|---|
| Authoritative source | Packet/handoff name Book base `app4GKdk1AqmiOyKx` with fields `BK_Project`, `BK_Blockers` |
| Exact endpoint | **MISSING.** No book router exists; repo-wide grep for `BK_` on backend `origin/main` = **zero hits**. Base `app4GKdk1AqmiOyKx` is referenced in backend code only as the **MASTER_TASKS** base (`tasks.py:5` docstring) and in `scripts/seed_people.py` — see Gap G5 |
| Authentication | N/A |
| Exact fields | `BK_Project`, `BK_Blockers` — **unverified** (absent from all code) |
| Response shape | N/A |
| Trust classification | Unknown — no read path exists |
| Freshness | 900s cadence via the task-lane fallback (9.3) |
| Failure behavior | Lawful quiet empty (founder G1: renders quiet-empty when no Book tasks exist) |
| Availability | **MISS (dedicated model) · task-lane fallback APPROVED (G1)** |
| Production-trusted | No — and the UI must not claim a Book read model exists (G1) |
| New connector required | Yes — a backend read endpoint; **DEFERRED** to a later backend workstream (G1), never improvised in Phase C |
| Phase C legal | **Yes, restricted (G1):** task-based Book information only, via `GET /api/tasks?business=Book` (Domain 1 path, same-origin). BK_* data: **not legal** in Phase C |
| Unknowns / required proof | Whether the Book base/BK_* fields exist at all — owned by the deferred backend workstream, not Phase C |

### Domain 5 — FinancialMind

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable base `AIRTABLE_BASE_ID` (same SOM student base; `airtable_client.py` header names `appTN4wNd5Kgbqdwl`), tables `FM_Transactions, FM_Bills, FM_Savings, FM_Accounts, FM_Monthly_Summary` (`app/routers/fm_airtable.py:35-41`) |
| Exact endpoint | `GET /api/fm/summary` (`fm_airtable.py:304`) · `GET /api/fm/bills?status` (`:167`) · `GET /api/fm/savings?status` (`:188`) · `GET /api/fm/accounts?entity` (`:209`) · `GET /api/fm/monthly?entity` (`:230`) — **all unauthenticated** (verified) |
| Authentication | None server-side (verified; §3.3 truthful-claim rule applies) |
| Exact fields (case-verified) | Bills: `Bill_Name, Amount, Due_Day, Frequency, Entity, Account, Auto_Pay, Status, Last_Paid_Date, Notes, Confirmed_By_Denarius` · Savings: `Stash_Name, Goal_Amount, Current_Balance, Monthly_Target, Last_Deposit_Date, Last_Deposit_Amount, Status, Priority, Notes` · Accounts: `Account_Name, Entity, Account_Type, Institution, Last_4, Current_Balance, Credit_Limit, Status` · Monthly: `Month, Entity, Total_Income, Total_Expenses, Net, Expense_Ratio, Savings_Deposited, Flag_Notes` (`fm_airtable.py:129-160, 280-291`) — **PascalCase, opposite of MASTER_TASKS convention; verbatim or nothing** |
| Response shape | Lists → `{"count", "bills|stashes|accounts|months": [{"id", ...fields}]}` · Summary → `{"status": "live"|"mock", "source", "as_of", "ytd": {income, expenses, net, expense_ratio}, "monthly": [...], "savings"|"top_categories", "flags"}` |
| Trust classification | **connected-not-production-trusted until FM-PAT-B2 is deployed and independent live reads are green** (ADR-PR3 + ruling G8 req. 10 + §3.8) |
| Freshness | 900s (9.3) once wired post-B2; pre-B2 there is nothing to refresh — tiles render the ruled unavailable state |
| Failure behavior | Per-tile degrade; **`"status":"mock"` payload ⇒ adapter unavailable/error state, never rendered (§3.6)** |
| Availability | **CON — B2-gated (G8); UNAVAILABLE-LIVE until B2 deploy + independent green (§3.8, fail-closed)** |
| Production-trusted | **No** |
| New connector required | No — but the B2 backend PR is required (G8; separate repo/branch/PR; §16) |
| Phase C legal | **Pre-B2 (deterministic, §3.8):** no FM-derived value renders as populated live data; no FM-derived signal in the live Z1 feed; FM tiles render explicit unavailability with copy `Financial data unavailable — verification pending.`; fixtures only, visibly labeled FIXTURE, zero network. **Post-B2 + independent green + §3.4 gate:** the verified summary/stat endpoints may wire; FM-derived Z1 signals only from verified non-mock data; the monthly series never feeds the 7D/30D chart (G4); B2 does not create or authorize a daily series |
| Unknowns / required proof | (a) PAT defect confirmed at `fm_airtable.py:23` and replicated in `airtable_client.py:12-13`, `morning_brief.py:32`, `piano.py:89`, `travel.py:13-14` — all five in B2 scope per G8. (b) **Mock-fallback hazard:** `/api/fm/summary` silently serves hardcoded numbers with `"status":"mock"` (`fm_airtable.py:372-421`) — handled by §3.6. (c) No FM revenue/invoice/overdue-specific endpoint exists; post-B2 overdue-bills derive from `GET /api/fm/bills?status=` + `Due_Day` client-side. Proof: post-B2 §3.4 live read with `status:"live"` |

### Domain 6 — School of Motesart

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable SOM base (`AIRTABLE_BASE_ID`, `appTN4wNd5Kgbqdwl`), Students table |
| Exact endpoint | `GET /students/` (`app/routers/students.py:31`) · `GET /students/active` (`:37`) — **mounted OUTSIDE the `/api` prefix** (`main.py:56-81`) |
| Authentication | None server-side (verified) |
| Exact fields | Per-student: `{id, name, status, teacher, level, dpm_percent, dpm_status, dpm_status_display, weekly_summary, tami_memory, assigned_weekly_practice, weekly_practice_minutes, total_weekly_target, consistency_score, student_instruments, linked_parents}` (`students.py:9-28`), sourced from Airtable fields `"Students Name", "Status", "Teacher", "Level", "DPM%", "DPM Status"` (note spaces/%) |
| Response shape | JSON array of student objects (list endpoints) |
| Trust classification | Route exists but is **founder-deferred** (G2) |
| Freshness | 900s if ever wired (9.3) |
| Failure behavior | Quiet-empty by ruling, not by failure |
| Availability | **DEFER (G2)** |
| Production-trusted | No |
| New connector required | A later separate backend workstream must provide an authenticated, same-origin `/api/*` read route before live SOM student data is displayed (G2) |
| Phase C legal | **No live use.** Ruling G2 prohibits: direct absolute browser URL to the backend · bypassing the `/api/*` proxy · unauthenticated browser data access · CORS workarounds · Netlify proxy changes · backend auth changes in the Phase C PR. Phase C behavior: Z3 SOM tile renders **quiet-empty** with copy `SOM data connection pending.` Gallery FIXTURES may demonstrate the eventual tile states |
| Unknowns / required proof | The future `/api/*` SOM route's shape — owned by the deferred backend workstream |

### Domain 7 — Personal/Life data

| Attribute | Verified value |
|---|---|
| Authoritative source | Packet names "VitalStack + Life tables" — **neither exists** |
| Exact endpoint | **VitalStack/Life: MISSING** — no `vital`/`life` tables or routes exist on backend `origin/main`. Ruled-usable reads (G3): Personal lane of `GET /api/tasks?business=Personal`; personal-calendar events via `GET /api/mya/calendar/events` (server-merged `GOOGLE_CALENDAR_ID_PERSONAL`). Not usable (G3): `GET /api/travel/trips` (`travel.py:164` — hardcoded `MOCK_TRIPS` fallback, `travel.py:25-38`); `GET /api/people` (`people_router.py:51` — prohibited by G3 as a Life source) |
| Authentication | None server-side on all of the above (verified) |
| Exact fields | Task-lane + calendar fields as Domains 1–2; VitalStack/Life fields — **none exist to verify** |
| Response shape | Per Domains 1–2 envelopes |
| Trust classification | Task/calendar paths inherit their domains' trust; travel/people carry mock-fallback or prohibition and are excluded by G3 |
| Freshness | 900s (9.3) |
| Failure behavior | Quiet-empty; **never an error** merely because an optional Life source does not exist (G3) |
| Availability | **MISS (VitalStack/Life) · AV restricted set (G3)** |
| Production-trusted | Restricted set inherits Domain 1/2 trust |
| New connector required | Would be required for VitalStack/Life — **DEFERRED**, not authorized in Phase C (G3) |
| Phase C legal | **Yes, restricted (G3):** Personal task lane + personal-calendar events only. No invented health/life/personal metrics; no mock travel/people data |
| Unknowns / required proof | None blocking — missing data renders quiet-empty by ruling |

### Domain 8 — Business/revenue statistics

| Attribute | Verified value |
|---|---|
| Authoritative source | **No canonical revenue/statistics source exists** — confirmed and now founder-ruled (G4) |
| Exact endpoint | No stats/metrics/revenue router exists. Existing aggregates: `GET /api/pulse` (Domain 1 task buckets — production-trusted) · `GET /api/fm/summary` (Domain 5, B2-gated + mock hazard) · `GET /api/mya/morning-brief` (`morning_brief.py:303`, no auth) · `GET /api/piano/invoices` (`piano.py:263`, no auth; base hardcoded `appkksRRCOGUotdI8` at `piano.py:19`; **prohibited as a substitute revenue source by G4 req. 6**) |
| Authentication | None server-side on all (verified) |
| Exact fields | As cited per endpoint; monthly series `Month, Total_Income` verified (Domain 5) |
| Response shape | Per-endpoint envelopes as cited |
| Trust classification | pulse: production-trusted · FM: B2-gated, fail-closed pre-B2 (§3.8) · piano: prohibited substitute · daily revenue series: **does not exist** |
| Freshness | 900s (9.3) |
| Failure behavior | Per-tile degrade; revenue chart renders explicit unavailability, not error |
| Availability | **CON (pulse; FM stats post-B2 only) · DEFER (daily revenue series, G4)** |
| Production-trusted | Only `/api/pulse` |
| New connector required | A canonical daily revenue-series source — **DEFERRED** backend workstream (G4) |
| Phase C legal | **Yes for:** pulse tile (LIVE candidate) and FM summary/stat tiles (post-B2-green only, §3.8). **The Z3 revenue area chart:** component + all interaction/accessibility behavior built on deterministic Gallery FIXTURES demonstrating 7D/30D/QTD, both crosshairs, and all five data states; the **live chart stays quiet-empty/unavailable** with copy `Revenue trend unavailable — daily source not connected.` until a canonical daily source is verified. **Prohibited (G4):** interpolating/duplicating/subdividing monthly values into daily points; silently substituting invoice totals or piano revenue; representing monthly data as a 7D/30D series |
| Unknowns / required proof | What the canonical daily revenue source will be — owned by the deferred backend workstream |

### Domain 9 — create_task_core dispatch

| Attribute | Verified value |
|---|---|
| Authoritative source | `create_task_core(fields: dict)` — `app/routers/tasks.py:208-242` (MASTER_TASKS write) |
| Exact endpoint | `POST /api/tasks` (`tasks.py:391`, body `TaskCreate`, 201 → `{"ok", "task"}`) — the same core used by the voice/agent tool path `POST /api/agent` → `execute_create_task` (`agent.py:503-551`). Same-origin `/api/*` per §3.5 |
| Authentication | **None server-side** on `POST /api/tasks` (verified; §3.3 truthful-claim rule applies; frontend sends Bearer `som_token`) |
| Exact fields | Requires `title` + `business`; optional `priority, owner, assigned_agent, due_date, requires_approval, task_context, next_action, …` (same lowercase field set as Domain 1) |
| requires_approval behavior | Boolean field; when true the backend also writes `approval_status="pending"` + `approval_requested_at` (`tasks.py:416-418`, `agent.py:509-533`). **Approval never blocks creation** (by design, `agent.py` header v3.2); FM-agent tasks force it true. Surfacing via `GET /api/tasks?requires_approval=true` and the `approval` bucket of `/api/pulse` |
| Response shape | `create_task_core` → `{"id", "deduped": bool, **airtable_fields}`; dedupe: same business + non-done + normalized title returns existing with `deduped: true` (`tasks.py:171-205`) |
| "Routed to \<executive\>" source | `assigned_agent`; `default_agent()` maps business → executive (`tasks.py:84-91`: SOM→"SOM Executive", FM→"FM Executive", E7A→"E7A Executive", Book→"Book Executive", Personal→"MYA") |
| Trust classification | Write path production-trusted (ADR-DC2) |
| Freshness | N/A (write); optimistic toast per packet |
| Failure behavior | Dispatch failure ⇒ toast "couldn't route — try again"; no auto-retry |
| Availability | **AV** |
| Production-trusted | Yes |
| New connector required | No — **existing dispatch path only; no new write path** |
| Phase C legal | **Yes** — the ONLY write in Phase C; implemented LAST (Z5); `requires_approval` respected exactly as the backend defines it; §3.4 gate applies to the write's response shape before wiring |
| Unknowns / required proof | The unauthenticated nature of `POST /api/tasks` is a recorded backend posture fact (G7 follow-up), not a Phase C defect. Proof: preview-deploy dispatch smoke with `requires_approval: true` verifying `approval_status: pending` lands and the task is not executed |

---

## 5 · UNKNOWN/GAP SUMMARY (amended per founder rulings)

| Metric | Count |
|---|---|
| Total domains reviewed | 9 |
| Total endpoints verified (code-level, backend `15e4889`, file:line cited) | 19 |
| Fields verified at code level | ~90 (MASTER_TASKS 22 · calendar event 6 + day-intel 12 · audit 4 · FM 36 · students 15 · travel/people ~6 · dispatch/task-create ~10) |
| Fields verified against LIVE Airtable schema | **0** — no credentials used in planning; live verification is now a founder-ruled pre-implementation gate per tile (§3.4) |
| Fields unresolved | `BK_Project`, `BK_Blockers` (absent everywhere; deferred G1) · all VitalStack/Life fields (no tables exist; deferred G3) · `result_summary` (read model expects it; writer never writes it; G9 render rule) |
| Missing routes | 5 — Book Manager reads (G1 deferred) · SOM aggregate count (G2 deferred) · canonical daily revenue series (G4 deferred) · VitalStack/Life reads (G3 deferred) · authenticated same-origin `/api/*` SOM route (G2 required future workstream) |
| Authentication gaps | 4 — nearly all read endpoints unauthenticated server-side (G7 follow-up) · `/students/*` bypasses the proxy AND auth (G2 deferred) · audit-log read is the only JWT-enforced feed (401 surface, handled tile-locally per 9.5) · backend CORS `allow_origins=["*"]` with `allow_credentials=True` (G7 follow-up) |
| Schema mismatches | 4 — base `app4GKdk1AqmiOyKx` claimed as Book base (packet/handoff) vs MASTER_TASKS base (backend docstring) · duplicate `{status}` fields in live MASTER_TASKS base · `result_summary` write/read mismatch · `FIELDS.md` cited as governing but absent from the repo |
| Trust gaps | 4 — FM-PAT defect (G8 five-file B2 authorized) · FM `/api/fm/summary` silent mock fallback (§3.6 ruling) · travel silent mock fallback (G3 excluded) · piano hardcoded base ID / unauthenticated invoices (G4 req. 6 prohibited substitute) |

### Gap register with rulings, recommendations, and blast radius

| # | Gap | Founder ruling / recommendation | Blocks |
|---|---|---|---|
| G1 | **Book Manager reads missing** (Domain 4) | **RULED — approved with task-lane fallback:** `GET /api/tasks?business=Book` only; no BK_* claims; quiet-empty when no Book tasks; dedicated Book reads = later backend workstream | One tile only (Z2 Book info), now resolved by ruling |
| G2 | **`/students/*` outside `/api` proxy + unauthenticated** (Domain 6) | **RULED — live SOM tile DEFERRED:** quiet-empty `SOM data connection pending.`; direct URL / proxy bypass / CORS workaround / netlify.toml change / backend auth change all prohibited in Phase C; future authenticated same-origin `/api/*` route required | One tile only (Z3 SOM student count), deferred |
| G3 | **VitalStack/Life absent** (Domain 7) | **RULED — restricted tile set approved:** Personal task lane + personal-calendar events only; no VitalStack, no mock travel/people, no invented metrics; quiet-empty, never error, for absent optional sources | Z4 tile contents resolved by ruling |
| G4 | **No canonical revenue series** (Domain 8) | **RULED:** chart component + interactions built on deterministic Gallery fixtures (7D/30D/QTD, both crosshairs, all states); live chart quiet-empty `Revenue trend unavailable — daily source not connected.`; no monthly-as-daily, no interpolation, no piano/invoice substitution; FM stat tiles live only post-B2-green (§3.8) | Live revenue-series adapter only — not the chart component, fixtures, or post-B2 FM stat tiles |
| G5 | **Base-ID conflict `app4GKdk1AqmiOyKx`** (Book base per packet vs MASTER_TASKS base per backend) | Treat backend code as ground truth: MASTER_TASKS lives under `AIRTABLE_MASTER_TASKS_BASE_ID` env; do not assert the Book base ID anywhere in Phase C. Architect seat to reconcile docs post-C | Nothing (documentation hygiene) |
| G6 | **`FIELDS.md` absent; zero live-schema field verification** | **Superseded by founder gate §3.4:** one authorized live read per endpoint before its wiring commit; audit added directly to PR #25, as it evolves from its approved PLAN gate into the Phase C implementation PR (§3.7); per-tile stop conditions; failures isolated per tile | Nothing in planning; implementation gate per-endpoint |
| G7 | **Read endpoints unauthenticated server-side** | **RULED — separate security follow-up:** stays recorded; Phase C does not reopen or modify auth; frontend sends its JWT but never claims enforcement that source disproves | Nothing in Phase C |
| G8 | **FM-PAT-B2 scope** — same `.lstrip("=")` defect in 5 files | **RULED — broader five-file correction authorized** as a separate backend PR (`fm_airtable.py`, `airtable_client.py`, `morning_brief.py`, `piano.py`, `travel.py`) with tests, secret scan, exact-head review; no merge/deploy without later founder authorization; pre-B2 FM behavior deterministic fail-closed per §3.8 | Live-wiring of FM tiles only |
| G9 | **`result_summary` never written** (Domain 3) | Handled-log tile renders `response_text` with `result_summary` preferred when non-null; writer mismatch recorded as a backend FOLLOW-UP | Nothing (rendering rule) |
| G10 | **Zone label mismatch** (shell Z5 "Mya" vs packet "Quick Actions") | Relabel the Z5 container heading during implementation under allowed `src/v2/*` scope; no behavior change | Nothing (cosmetic) |

**Verdict:** no gap blocks this PLAN. G1–G4 and G8 are founder-ruled; G6 is superseded by the founder's live field-verification gate; G7 is a recorded follow-up. Remaining gaps block at most one tile each, and per §3.4 req. 7 a tile-level failure never blocks unrelated tiles.

---

## 6 · CONNECTOR TRUST TABLE (current-main re-verification of packet §6; amended per rulings)

| Source | Packet trust claim | Current-main verification | Phase C posture (classification per §0 law) |
|---|---|---|---|
| Client clock (Z1 greeting/date) | Verified available | No connector; 30s tick per Bible §8 | **LIVE (local/client-derived, §3.5-b)** |
| MASTER_TASKS reads | Production-trusted (ADR-DC2) | Endpoints exist, fields verified, no server auth (G7 truthful-claim rule); documented filter defects | **LIVE candidate** — client-side filtering; §3.4 gate |
| Google Calendar | Production-trusted (ADR-DC2) | Endpoint + server-side sanitizer verified | **LIVE candidate** — §3.4 gate |
| Mya audit log | Write-trusted; read same base | Read endpoint exists, JWT-enforced, `result_summary` null defect (G9) | **LIVE candidate** — fallback rendering |
| Book base | "Same Airtable discipline" | **No read path exists** | **DEFERRED (G1)** — task-lane fallback is LIVE candidate; no BK_* claims |
| FM routes | B2-gated | PAT defect confirmed (5 files); mock fallback confirmed | **PRE-B2: UNAVAILABLE-LIVE, fail-closed (§3.8)** — no FM value, signal, or statistic renders live; explicit unavailability copy `Financial data unavailable — verification pending.`; FIXTURES only, labeled, zero network. **POST-B2 + independent green + §3.4 gate:** summary/stat endpoints may wire; Z1 FM signals only from verified non-mock data |
| SOM routes | Unknown pending inventory | Routes exist; proxy/auth constrained | **DEFERRED (G2)** — quiet-empty `SOM data connection pending.`; fixtures may demo states |
| VitalStack/Life | Unverified; absence lawful | **Absent** | **DEFERRED (G3)** — restricted set: Personal tasks + personal calendar only |
| Daily revenue series | (unnamed in packet) | **Does not exist** | **DEFERRED (G4)** — chart on FIXTURES; live chart explicitly unavailable; B2 does not create or authorize this source (§3.8) |
| `create_task_core` dispatch | Production-trusted write | Verified; approval semantics verified | **LIVE candidate** — only write, implemented last |
| Drive connector | Architecturally-approved-not-configured | Unchanged | **Not in Phase C** |

---

## 7 · PROPOSED ARCHITECTURE (boundaries only — no implementation code)

Adopted from packet §10, re-verified against current main, amended per §3 rulings:

- **Components:** one per zone — `Z1Today`, `Z2Projects`, `Z3Business`, `Z4Personal`, `Z5QuickActions` — composed on `/v2/home` inside the existing `v2-zone--1..5` containers (`shell/index.jsx:198-220`); tiles are child components. Phase A/B primitives consumed, never re-implemented: `Card`, `Panel`, `Chip`, `StatCard`, `Sparkline`, `ProgressBar`, `ProgressRing`, `Toast`, `Button`, `Kbd` (`src/v2/components/index.jsx`). Tokens from `src/v2/tokens.css` verbatim.
- **Adapters:** one per canonical source — `tasks`, `calendar`, `auditLog`, `personal`, `book` (task-lane only, G1), `dispatch` — thin fetch layer over the verified §4 endpoints, exposing one uniform per-tile contract `{status, data, lastGood, updatedAt, error, retry}`. Zones never fetch directly; adapters never render. **No `som` adapter is built in Phase C** (G2 deferral); **no revenue-series adapter is built in Phase C** (G4 deferral) — the chart consumes fixtures only. **The `fm` adapter is not wired to live rendering pre-B2** (§3.8): FM tiles render the ruled unavailable state from a fixture-fed demonstration path only; the adapter's live path activates solely after B2 deploy + independent green + §3.4 gate.
- **Same-origin law (§3.5):** adapters call same-origin `/api/*` only. No absolute backend/provider URLs, no new proxy rules, no CORS reliance. Local/client-derived values (clock, countdowns) need no endpoint.
- **Mock rejection law (§3.6):** every adapter inspects payloads for `"status":"mock"`; a mock payload transitions the tile to unavailable/error, is never rendered as data, and the marker is never stripped.
- **State:** per-tile, local; **no global store** (cross-tile cascades structurally impossible). Last-good retained **in memory only**; **zero new localStorage keys** (documented "none" in PR).
- **Refresh:** each adapter owns its cadence timer per 9.3 (60s/300s/900s tiers), **pauses on `visibilitychange`**, silent refresh (no skeleton replay). Pre-B2 FM tiles hold no cadence — there is no live FM fetch to schedule (§3.8).
- **Cancellation:** `AbortController` per fetch; abort on unmount and superseded range change.
- **Errors:** one React error boundary per zone; zone crash renders that zone's error state, never the shell or siblings.
- **Auth:** all requests send Bearer `som_token`; **401/403 tile-local, never global logout** (9.5); the UI never claims server-side enforcement that source disproves (§3.3).
- **Routes:** Phase C mounts under `/v2/home` only; module L2 routes stay skeletons; legacy routes untouched.
- **Gallery:** imports zone/tile components with **fixture adapters** rendering every state as labeled specimens, **visibly classified FIXTURE** (§3.6/§3.8); **zero network calls** (9.6) — the existing Gallery already makes zero network calls and this invariant is preserved.
- **Flag:** `VITE_MOS_V2` env + `window.MOS_V2` override (`src/App.jsx:14`); production remains **false**; flag-off = zero v2 network requests (lazy chunk never loads).
- **API base:** `VITE_API_URL || ''` same-origin proxy (`api.js:1`); **zero localhost fallback** — verified clean under `src/` today (the one hardcoded production-Railway fallback lives in legacy `MyaDispatchPanel.jsx`, out of scope; no equivalent may be introduced in v2 — §3.5).

---

## 8 · PER-TILE PLAN (mandatory content for every tile; amended per rulings)

State language for every tile (packet §7 + approved 9.1 designs): `idle → loading → populated | empty | error`; `populated → stale → populated`; `populated → partial`; `error → loading` on retry. **Loading:** static skeleton reserving exact final geometry (zero CLS; no shimmer). **Empty:** one quiet line + good-t dot (suggests, never begs). **Error:** crit-t dot + "‹Source› unreachable" + "Retry ↻" link. **Stale:** last-good fully rendered + mono `as of HH:MM` tag + warn-t dot. **Partial:** em-dash for absent values + scope-naming tag. **401/403:** tile-local "sign-in needed" error subtype, never global logout (9.5). **Retry:** user retry link re-enters loading; otherwise next cadence tick; no auto-retry storms. **Last-good:** populated data never regresses to skeleton/empty on failed refresh — it goes stale. **A11y:** tile status line is a polite live region (`role="status"`); severity never color-alone; focus ring 2px `--info`. **Reduced motion:** draw-ins render final state; lifts/washes instant. **Classification:** every tile is labeled below as LIVE candidate / UNAVAILABLE-LIVE / FIXTURE-only / DEFERRED per the §0 law; no DEFERRED or UNAVAILABLE-LIVE tile is ever styled or described as production-connected.

### Z1 — Today

| Tile | Component | Source · Endpoint · Fields | Classification | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|---|
| Greeting + date | `Z1Greeting` | Client clock; no endpoint | LIVE (client-derived) | none · 30s tick · pauses hidden | No network states; gallery specimen static; evidence: 1440px screenshot + reduced-motion pass |
| Signal feed (max 6, ranked crit>exec>ai>warn>info>good) | `Z1SignalFeed` | MASTER_TASKS `GET /api/tasks` fields `title,status,priority,business,assigned_agent,due_date,requires_approval` · FM overdue `GET /api/fm/bills` fields `Bill_Name,Amount,Due_Day,Status` (**post-B2 only, §3.8**) | LIVE candidate (tasks) · FM signals: UNAVAILABLE-LIVE pre-B2 | `tasks` · 60s · paused hidden (`fm` joins only post-B2) | All six states via fixtures; ranking proof with known-severity fixture; row click routes to owning module L2 (9.4); **pre-B2 deterministic rule: no FM-derived signal appears in the live feed at all (§3.8); post-B2 FM signals only from verified non-mock data after the §3.4 gate**; evidence: fixture-order screenshot + nav walkthrough |
| Today agenda | `Z1Agenda` | Calendar `GET /api/mya/calendar/events?days_ahead=1` fields `title,start,end` (sanitized server-side) | LIVE candidate | `calendar` · 300s · paused hidden | Non-interactive rows; empty "Nothing scheduled today."; sanitized-title raw-vs-rendered spot-check in PR |
| Handled-log digest | `Z1HandledLog` | Audit `GET /api/mya/audit/handled?limit=3` fields `timestamp,route,result_summary,response_text` — **JWT endpoint; 401 tile-local** | LIVE candidate | `auditLog` · 300s · paused hidden | Hidden while loading; hidden on error (quiet); `result_summary` null ⇒ `response_text` fallback (G9); evidence: null-field fixture specimen |

### Z2 — Projects

| Tile | Component | Source · Endpoint · Fields | Classification | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|---|
| Project cards | `Z2ProjectCards` | MASTER_TASKS `GET /api/tasks` grouped client-side by `business`; fields `business,title,status,priority` | LIVE candidate | `tasks` (one adapter per source, shared) · 60s · paused hidden | Hover lift only (`.lift` recipe); display-only in C; empty "No active projects."; skeleton cards |
| Book information (ruled G1) | `Z2BookInfo` | **Task-lane fallback only:** `GET /api/tasks?business=Book` fields `title,status,priority`. **No `BK_Project`/`BK_Blockers` claims; no dedicated Book read model claimed anywhere in UI or copy** | LIVE candidate (task-lane); dedicated Book model DEFERRED | `book` (task-lane over `GET /api/tasks`) · 900s · paused hidden | **Lawful quiet-empty when no Book tasks exist (G1)**; copy must read as task-based Book info, never as a Book-system connection; dedicated Book Manager reads = later backend workstream |
| Countdowns | `Z2Countdowns` | Data-derived: computed client-side from date fields in fetched data (`due_date`, event dates); **no hardcoded dates** | LIVE (client-derived from LIVE sources) | derives from `tasks`/`calendar` data · recompute on tick · paused hidden | Empty when no dated events; evidence: fixture with known date ⇒ rendered countdown proof |

### Z3 — Business

| Tile | Component | Source · Endpoint · Fields | Classification | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|---|
| Revenue area chart (ruled G4) | `Z3RevenueChart` | **No live source in Phase C.** Component and all interaction/accessibility behavior built against **deterministic Gallery FIXTURES** demonstrating 7D, 30D, QTD, pointer crosshair, keyboard crosshair, loading, empty, stale, partial, error | **FIXTURE-only component; live data DEFERRED** | **No revenue-series adapter built**; live chart renders explicit unavailability | Live cockpit copy: `Revenue trend unavailable — daily source not connected.` · **Prohibited:** monthly-as-daily representation, interpolation/duplication/subdivision of monthly values, piano/invoice substitution (G4) · Hand-rolled SVG + crosshair tooltip; range control = `role="tablist"`; keyboard crosshair per 9.1 (plot `tabindex=0`, `role="img"`, arrows step, Home/End endpoints, polite per-step "‹date› — ‹value›"); draw-in on mount + range change only, never refresh/resize (DB-C7/D5); scale-truthfulness labels; fixtures visibly labeled FIXTURE · **B2 approval does not change this tile (§3.8 post-B2 req. 4–5)** |
| FM stat tiles (ruled §3.8 + G8) | `Z3FMStats` | `GET /api/fm/summary` fields `status,as_of,ytd.{income,expenses,net}` — **`"status":"mock"` ⇒ unavailable/error state, never rendered (§3.6)** | **UNAVAILABLE-LIVE pre-B2 (fail-closed); LIVE only post-B2 + independent green + §3.4 gate** | `fm` · 900s · paused hidden — **only once activated post-B2**; no live FM fetch pre-B2 | **Pre-B2 deterministic state:** explicit unavailability with copy `Financial data unavailable — verification pending.` — no FM value renders as populated live data · Gallery fixtures demonstrate all component states, visibly labeled FIXTURE, zero network · **Post-B2:** wire only after B2 deploy + independent green live reads + §3.4 gate pass; partial state renders em-dash per absent field |
| Business pulse tile | `Z3Pulse` | `GET /api/pulse` fields `urgent,overdue,blocked,approval,done_today,stale` | LIVE candidate | `tasks` · 60s · paused hidden | Production-trusted source; all states via fixtures |
| SOM student count (ruled G2 — DEFERRED) | `Z3SOMCount` | **No live call.** `/students/*` use prohibited (direct URL, proxy bypass, unauthenticated access, CORS workaround, netlify.toml change, backend auth change) | **DEFERRED — quiet-empty** | **No `som` adapter built** | Live tile renders quiet-empty with truthful copy `SOM data connection pending.`; Gallery FIXTURES may demonstrate the eventual loading/populated/empty/error/stale/partial states, visibly labeled FIXTURE; live data requires a future authenticated same-origin `/api/*` route from a separate backend workstream |
| Book pre-orders | deferred/quiet-empty | No endpoint exists (Domain 4/8) | DEFERRED | — | Quiet-empty; recorded, not improvised; never styled as production-connected |

### Z4 — Life (ruled G3 — restricted tile set)

| Tile | Component | Source · Endpoint · Fields | Classification | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|---|
| Personal tasks tile | `Z4PersonalTasks` | Personal lane `GET /api/tasks?business=Personal` fields `title,status,due_date,priority` | LIVE candidate | `personal` (task-lane over `GET /api/tasks`) · 900s · paused hidden | Quiet-empty when no Personal tasks; never an error for absence (G3) |
| Personal calendar tile | `Z4PersonalCalendar` | Personal events from `GET /api/mya/calendar/events` (server-merged `GOOGLE_CALENDAR_ID_PERSONAL`) fields `title,start,end` (sanitized) | LIVE candidate | `calendar` (shared) · 300s · paused hidden | Quiet-empty "Nothing tracked today."; sanitized titles |
| (Excluded by G3) | — | VitalStack (no canonical source) · travel responses (mock fallback) · people responses · invented health/life/personal metrics | DEFERRED / prohibited | — | Not built; no placeholder tiles claiming them |

### Z5 — Quick Actions (implemented LAST; the ONLY write)

| Tile | Component | Source · Endpoint · Fields | Classification | Adapter · Cadence | States / fixtures / evidence |
|---|---|---|---|---|---|
| Quick actions | `Z5QuickActions` | `POST /api/tasks` → `create_task_core`; body `title,business,priority,assigned_agent,requires_approval`; response `{"ok","task":{"id","deduped",...}}` | LIVE candidate (write) | `dispatch` · no cadence (write) | qbtn optimistic, no disabled state (DB-G8 stays Button-only); `requires_approval: true` respected — backend sets `approval_status:"pending"`, approval never blocks; success toast "routed to ‹executive›" from `assigned_agent`; failure toast "couldn't route — try again", no auto-retry; Toast `aria-live="polite"`, never steals focus; §3.4 gate applies to the response shape; evidence: preview-deploy dispatch smoke proving `approval_status: pending` lands and nothing executes |

---

## 9 · STATE MAP (complete — adopted from packet §7, approved 9.1; amended per §3.6/§3.8)

**Canonical machine:** `idle → loading → populated | empty | error`; `populated → stale → populated`; `populated → partial`; `error → loading` (retry). Additions approved at 9.1: *retrying* (= loading re-entered; no distinct visual), *permission-denied* (error subtype for 401/403, tile-local), *offline* (stale-with-marker when last-good exists, else error). Founder amendments: **mock-rejected** is an unavailable/error entry (§3.6); **b2-pending** is the deterministic pre-B2 FM state — explicit unavailability with copy `Financial data unavailable — verification pending.`, entered without any fetch (§3.8).

| Aspect | Rule |
|---|---|
| Entry events | Mount (idle→loading, or idle→b2-pending for FM tiles pre-B2) · cadence tick or range change (populated→loading, silent) · retry click (error→loading) · fetch resolve (→populated/empty/partial; **→error if payload is mock**) · fetch reject (→error; →stale if last-good) · freshness expiry (populated→stale) |
| Exit events | Unmount aborts in-flight fetch · flag off unmounts all · B2-green proof transitions FM tiles from b2-pending into the normal machine via the §3.4 gate |
| Visible UI | loading = static skeleton, exact final geometry, zero CLS · empty = quiet one-liner + good-t dot · error = crit-t dot + one line + retry link · stale = last-good + mono `as of HH:MM` + warn-t dot · partial = em-dash + scope tag · **b2-pending = explicit unavailability, `Financial data unavailable — verification pending.`** · deferred tiles = quiet-empty with ruled copy, never production-connected styling |
| Announced a11y state | Polite live region per tile (`role="status"`); populated data does not re-announce on refresh |
| Retry | One retry link per tile error; re-enters loading; no automatic rapid retry loops |
| Fallback | Last-good always preferred over blanking |
| Persistence | None. In-memory last-good only; zero new `localStorage` keys; backend state untouched by reads |
| Forbidden transitions | populated→empty on refresh failure · cross-tile cascade · skeleton replay on passive refresh · chart draw-in on refresh or resize · error→populated without a fetch · **mock payload → populated (always error/unavailable)** · **deferred source → any live-data presentation** · **FM-derived value, signal, or statistic → populated before B2 deploy + independent green + §3.4 gate (§3.8)** |
| Hidden-tab behavior | All cadence timers pause on `visibilitychange` (9.3); resume on visible without burst |

---

## 10 · INTERACTION MATRIX (complete — every Phase C control)

| Control | Pointer | Keyboard | Focus | Escape | Disabled | Loading | Error | Reduced motion | SR name/state | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Signal feed row (≤6) | Hover wash + 2px translateX + arrow; click routes to owning module L2 (9.4) | Tab; Enter = click | Ring 2px --info/2px | n/a | None (rows exist only when signals do) | Skeleton rows ×3 | Zone error state | Wash/arrow without slide | `role="link"`; name = summary; severity in text, never color-alone | Active (nav only) |
| Agenda slot | Hover wash only | Tab-skipped (non-interactive) | n/a | n/a | n/a | Skeleton slots | Zone error | Wash instant | Plain text; time + sanitized title | Display-only |
| Handled-log line | None | None | n/a | n/a | n/a | Hidden while loading | Hidden on error (quiet) | n/a | Plain text | Display-only |
| Project card | Hover `.lift` (−3px, .35° tilt, --e3) | Tab-skipped in C | n/a | n/a | n/a | Skeleton card | Tile error | Lift off; border only | Plain group; progress labeled in text | Display-only |
| Z3 range control (7D/30D/QTD) — fixture-driven in C | Click segment | Tab to control; Left/Right move; Enter/Space select | Ring on segment | n/a | No disabled segments | Control inert while zone loads (`aria-busy`) | Control persists; chart area errors | Selection instant; draw-in replaced by final-state render | `role="tablist"`; `aria-selected` on segment | **Active (Gallery fixtures); inert on live unavailability** |
| Chart crosshair (pointer) | Mousemove: crosshair + tooltip; leave: hide | — (keyboard path below) | n/a | n/a | n/a | No chart while loading | n/a | Tooltip fade → instant | Decorative for SR (kbd path carries values) | Active (fixtures) |
| Chart keyboard crosshair (9.1 approved) | — | Arrows step; Home/End endpoints | Plot focusable, ring | Esc blurs plot | n/a | Not focusable while loading | Not focusable in error | Steps instant | `role="img"` + per-step polite announcement | **Active (fixtures)** |
| Stat tile / personal tile | Hover −2px + brighten | Tab-skipped | n/a | n/a | n/a | Skeleton | Tile error | Lift off | Label + tabular value + delta in text | Display-only |
| Quick action (qbtn) | Hover −3px + scale(1.02) --spring; press scale(.97); click dispatches | Tab; Enter/Space dispatch | Ring | n/a | **No disabled state** — optimistic dispatch, control resets immediately (DB-G8 stays Button-only) | n/a | Dispatch failure ⇒ toast (crit dot) "couldn't route — try again"; no auto-retry | Lift/scale off; press feedback instant | `role="button"`; name = action label; toast announced politely | **Active — the ONLY write** |
| Per-tile retry link | Click re-fetches | Tab; Enter | Ring | n/a | Hidden outside error | Hidden | Visible | n/a | Link name "Retry ‹tile›" | Active |
| Zone "Open ‹module› →" link | Click routes to module L2 skeleton | Tab; Enter | Ring | n/a | n/a | Persists | Persists | Hover color instant | Link, named per module | Active (nav only) |
| Toast (Z5 result/error) | Auto-dismiss ~3s | Not focus-stealing | Never steals focus | n/a | n/a | n/a | Error variant (crit dot) | In/out opacity only | Container `aria-live="polite"` (Phase A component) | Active |

**Forbidden in C:** tile collapse/drag/reorder · manual global refresh control · any feed-row action other than 9.4 routing · palette result interactions (Phase D) · any write other than the Z5 dispatch · any live chart interaction on the deferred revenue series (the live chart is an unavailability display, not an interactive plot) · any FM-derived live value, signal, or statistic before B2-green (§3.8).

---

## 11 · PROPOSED BRANCH/FILE SCOPE

- **Branch:** `feat/mosv2-c-zones` — cut from current main `2f0c3f4` in an isolated worktree. PR #25 title: `DRAFT — MOSV2-C: Current-main PLAN, source/auth matrix and Home zones`.
- **This PR currently changes exactly one file:** `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` (this document; filename matches document version 1.1.1; no second plan file exists).
- **Implementation phase (post-approval, same branch, same PR — §3.7) will touch only:** new `src/v2/zones/*` and `src/v2/data/*` (adapters + gallery fixtures) · `/v2/home` composition in `src/v2/shell/index.jsx` · `src/v2/Gallery.jsx` (state specimens).
- **Forbidden:** anything outside `src/v2/*` (+ this doc) · `index.html` · `src/main.jsx` · legacy routes/components · `package.json`/lockfile (no new runtime dependency — hand-rolled SVG only) · `netlify.toml`/deploy config (G2 and §3.5 rule around it) · env files/values · `design/v2/*` · Airtable schemas (read-only law) · voice pipeline · auth systems (G7) · `operator-bridge/` and `staging-control-plane/` (separate workstream — not mixed in) · the backend repo (FM-PAT-B2 is its own PR, §16) · any direct browser call to a provider or backend origin (§3.5).
- **Protected-systems register checked:** SOM auth · Mya voice pipeline · payment/invoicing · Airtable schemas · production env vars · deployment config · legacy dashboard — none touched by this plan; G2/§3.5 explicitly route around deployment config and backend auth.

---

## 12 · IMPLEMENTATION SEQUENCE (after exact-head PLAN approval only; all on PR #25 per §3.7)

0. **FM-PAT-B2 dispatched first** (G8): backend repo, own branch/PR, five-file scope per §16; independent green-proof before any FM tile wires live. Not part of PR #25.
1. **Live field-verification gate (§3.4) executed per endpoint before its first wiring commit:** one authorized live read → safe keys/shapes recorded → compared against §4 → audit added directly to PR #25, as it evolves from its approved PLAN gate into the Phase C implementation PR (present in the PR body or an explicitly linked governed evidence document on the same branch before that tile is considered wired). A tile failing the gate stops; unrelated tiles proceed (§3.4 req. 7).
2. `src/v2/data/*` adapters for the **LIVE-candidate sources only** (`tasks`, `calendar`, `auditLog`, `personal`, `book`-task-lane, `dispatch`) with the uniform hook contract, mock-rejection (§3.6) built into every adapter, plus the fixture module (gallery-only injection, zero network, visibly labeled FIXTURE). **No `som` adapter. No revenue-series adapter. The `fm` adapter ships with its live path inactive (§3.8).**
3. Z1 tiles (tasks/calendar/audit adapters) — read-only; **pre-B2: zero FM-derived signals in the live feed (§3.8, deterministic)**.
4. Z2 tiles (project grouping, Book task-lane with G1 quiet-empty, countdowns).
5. Z3: pulse tile; **FM stat tiles render the ruled pre-B2 unavailability** (`Financial data unavailable — verification pending.`) with FIXTURE-only demonstrations in the Gallery; **revenue chart fixture-only** with live unavailability copy (G4); **SOM tile quiet-empty** (G2).
6. Z4 tiles per the G3 restricted set.
7. **Z5 quick actions LAST** — the only write; `requires_approval` behavior verified on preview before merge request.
8. Gallery specimens for every component in every §9 state, fixtures visibly labeled FIXTURE.
9. **FM live-wiring (post-B2 only, §3.8):** after B2 deploys and independent live reads prove green, and after the §3.4 gate passes on each FM endpoint: FM summary/stat endpoints may wire (commit on PR #25, same branch); FM-derived Z1 signals may be introduced only from verified non-mock data; **the revenue chart remains unavailable** — B2 does not create or authorize a daily series.
10. Proof package (§14) assembled in PR #25; the PR remains draft throughout; any transition out of draft, any merge, and any separate implementation PR occur only by explicit founder ruling.

---

## 13 · TEST PLAN (amended per rulings)

- **Unit-level (node:test, the repo's only runner — dev-deps allowed per AGENTS.md):** adapter contract tests (status machine transitions incl. forbidden-transition guards) · **mock-rejection tests for every adapter** (`"status":"mock"` ⇒ unavailable/error; marker never stripped; values never rendered — §3.6) · **pre-B2 FM fail-closed tests**: FM tiles render `Financial data unavailable — verification pending.` with no fetch issued; no FM-derived fixture or payload can reach a populated live state pre-B2 (§3.8) · signal ranking comparator (crit>exec>ai>warn>info>good, max 6) · countdown derivation · sanitized-title passthrough · dedupe/`deduped:true` handling on dispatch response · **same-origin guard test**: static check that no v2 source contains an absolute backend/provider URL (§3.5).
- **Component-level:** gallery forced-state specimens render every §9 state per tile, **fixtures visibly labeled FIXTURE**; revenue chart demonstrates 7D/30D/QTD + both crosshairs + all five data states on fixtures (G4); zero-network assertion on `/v2/gallery` (network-tab evidence).
- **Flag behavior:** flag-off build loads zero v2 chunk and fires zero v2 requests; flag-on request inventory matches §4 same-origin endpoints exactly, no third-party calls; **pre-B2 flag-on inventory contains zero `/api/fm/*` requests** (§3.8).
- **Auth behavior:** expired `som_token` ⇒ audit tile shows tile-local "sign-in needed"; no global logout, no redirect (9.5); no UI copy claims server-side enforcement the source disproves (§3.3).
- **Hidden-tab:** timers pause (instrumented); no request burst on refocus.
- **Deferred/unavailable-tile truthfulness:** SOM tile renders `SOM data connection pending.`, the live chart renders `Revenue trend unavailable — daily source not connected.`, and pre-B2 FM tiles render `Financial data unavailable — verification pending.` — asserted in tests so a future regression cannot silently present them as connected.
- **Legacy isolation:** `/` and `/os` byte-identical spot-check; `index.html` untouched.
- **Existing suites:** `npm run test:operator-bridge` untouched and still green (no intersection); `npm run build` clean with new bundle hash recorded.

---

## 14 · ACCEPTANCE CRITERIA AND PROOF PACKAGE (amended per rulings)

**Acceptance additions (founder-ruled):** no monthly-as-daily or interpolated chart data (G4) · no mock payload ever rendered (§3.6) · no direct browser call to any backend/provider origin (§3.5) · SOM and revenue tiles quiet-empty with ruled copy (G2/G4) · Book tile task-lane only with no BK_* claims (G1) · Z4 restricted set only (G3) · **pre-B2: zero FM-derived values, signals, or statistics on any live cockpit surface — deterministic, fail-closed (§3.8)** · FM tiles live only after B2 deploy + independent green live reads + §3.4 gate pass (§3.8) · live-schema field audit present in PR #25 (body or linked governed evidence document on the same branch) for every wired endpoint before that tile is considered wired (§3.4/§3.7) · per-tile stop conditions honored with failures isolated per tile (§3.4 req. 6–7).

**Proof package (assembled in PR #25, as it evolves from its approved PLAN gate into the Phase C implementation PR — contract committed here):** deploy-preview URL @ head SHA · branch/head/rollback SHAs · approved PLAN link + recorded rulings (§3.1–§3.8) · **1440px screenshots:** populated Z1–Z5; each tile's loading/empty/error/stale/partial from the gallery fixture harness with fixtures visibly labeled FIXTURE; range control in all three states with draw-in evidence (mount + range change) and refresh WITHOUT draw-in; Z5 dispatch toast (success + failure); gallery page with all Phase C specimens · **deferred/unavailable-tile evidence:** SOM quiet-empty, revenue-unavailability, and pre-B2 FM-unavailability screenshots · **network evidence:** flag-off zero-requests capture; gallery zero-requests capture; flag-on request inventory matching §4 same-origin endpoints; **pre-B2 flag-on inventory showing zero `/api/fm/*` requests** · **live-schema field-audit table (§3.4/§3.7):** one authorized live read per wired endpoint, safe keys/shapes, raw-vs-rendered comparison, recorded stop-condition outcomes — present in the PR body or an explicitly linked governed evidence document on the same branch · **mock-rejection evidence:** a `"status":"mock"` payload shown entering the error/unavailable state · ranking-order proof (known-severity fixture → rendered order) · sanitized-title spot-check (raw vs rendered) · reduced-motion runtime observations · headless console report ×3 routes (`/v2/home`, `/v2/gallery`, one module route) · CLS numbers across state transitions via the shipped `__MOSV2_PHASE_B_PERF__` observer · bundle hash + delta against the 80KB gz ceiling (current cumulative v2: 13.41 kB gz per DEPLOY_LEDGER Phase B entry) · keyboard walkthrough incl. chart value stepping (fixtures) and Z5 dispatch · FM-PAT-B2 PR link + post-deploy independent green proof before any FM live-wiring (§3.8) · legacy spot-check statement · `localStorage` line ("none — no new keys") · phone screenshots NOT required (Phase F) · voice-health NOT required (no Mya surface touched).

---

## 15 · ROLLBACK

- Production `VITE_MOS_V2` is **false** and stays false — Phase C ships dark regardless.
- PLAN-stage rollback: close PR, delete branch — zero runtime surface.
- Implementation rollback (future): single-branch revert to named SHA (the merge-base against main at implementation time) + flag off. `DEPLOY_LEDGER.md` entry on merge per ADR-IMP11.

---

## 16 · FM-PAT-B2 SEPARATE WORKSTREAM (ruled G8 — exact proposed scope)

FM-PAT-B2 is a **separate workstream in a separate repository**, never mixed into PR #25 (cross-repo workstream isolation, packet A2/ADR-IMP2; §3.7 req. 8).

| Attribute | Ruled value |
|---|---|
| Repository | `Motesart27/Deployable-python-codebase-som` |
| Branch / PR | Separate branch and PR (name chosen at dispatch; own Denarius approval chain) |
| Classification | One bounded **Functional** workstream |
| Exact correction boundary | Fix the `.lstrip("=")` PAT credential-read defect in exactly five files: `app/routers/fm_airtable.py:23` · `app/airtable_client.py:12-13` · `app/services/morning_brief.py:32` · `app/routers/piano.py:89` · `app/routers/travel.py:13-14` — unless tests require narrowly related test files |
| Excluded | No unrelated refactor; no auth changes; no endpoint changes; no deployment-config changes |
| Tests | Tests for all five corrected credential-read paths (token beginning with `=` preserved; normal token unchanged; empty/absent env behavior unchanged) |
| Secret scan | Required on the PR; no credential values in code, tests, logs, or PR text |
| Review | Exact-head independent review before any merge consideration |
| Merge/deploy | **No merge or deployment without later founder authorization** |
| Trust lift | FM tiles remain **fail-closed and unavailable** (§3.8) until B2 is deployed **and** independent live reads are green **and** the §3.4 gate passes per endpoint. Post-B2: summary/stat endpoints may wire; Z1 FM signals only from verified non-mock data; the revenue chart remains unavailable — **B2 approval alone does not create or authorize a daily revenue series**. The lift is verified independently, never assumed |

---

## 17 · STOP CONDITIONS (implementation halts and reports on any of these)

1. Any §3.4 gate failure on a tile: missing field · changed case · unexpected mock response · authentication failure · unexpected response shape · provider error → that tile stops; unrelated tiles proceed; BLOCKED note recorded in PR #25.
2. Any situation requiring a direct browser call to a backend/provider origin, a proxy change, a CORS workaround, or a netlify.toml edit → STOP; founder ruling required (§3.5, G2).
3. Any pull toward representing monthly FM data as 7D/30D, interpolating daily points, or substituting piano/invoice revenue → STOP; G4 prohibits; the chart stays fixture-only/unavailable.
4. Any FM-derived value, signal, or statistic reaching a live populated surface before B2 deploy + independent green live reads + §3.4 gate pass → **defect; STOP the tile** (§3.8, fail-closed). Any pressure to wire FM earlier → STOP; G8 req. 10.
5. Any request to modify auth, Airtable schemas, env values, deploy config, legacy routes, voice pipeline, or `operator-bridge/` inside Phase C → STOP; protected register; BLOCKED note.
6. Any `"status":"mock"` payload reaching a render path → defect; STOP the tile (§3.6).
7. Any seventh signal in the Z1 feed → defect (six-signal law is structural).
8. Any deferred source (Book BK_*, VitalStack/Life, SOM live, daily revenue) presented as live or production-connected → defect; STOP.
9. Any assumption of a separate implementation PR, or any move of implementation evidence off PR #25, without a new founder ruling → STOP (§3.7).

---

## 18 · STANDING CONFIRMATIONS

- **NO PHASE C IMPLEMENTATION HAS BEGUN** — this PR adds one documentation file and nothing else.
- **PR #25 remains open and draft** — before and after PLAN approval; it is the single destination for Phase C implementation and evidence (§3.7).
- Production V2 remains **false**.
- No Railway or Netlify change performed or proposed in this PR.
- No worker, loop, scheduler, or Operator Bridge process activated or modified.
- Approvals, protected actions, and Mya autonomy remain **off**.
- Phase C phone work is not Phase F; no phone surface is touched.
- This PLAN stops here. Implementation begins only on Denarius's explicit **exact-head "Approved — PLAN"** for the v1.1.1 head SHA.

---

*— MOSV2-C PLAN gate · Motesart Execution Engine*
