# MOSV2-C CURRENT-MAIN PLAN — Source/Auth Matrix and Home Zones (PLAN ONLY)

---

## 0 · DOCUMENT CONTROL

| Field | Value |
|---|---|
| **Title** | MOSV2-C Current-main PLAN, source/auth matrix and Home zones |
| **Version** | 1.0 |
| **Date** | August 2, 2026 |
| **Status** | **PLAN GATE — FOR DENARIUS APPROVAL** |
| **Workstream** | **MOSV2-C** (single workstream per ADR-IMP2; nothing else mixed in) |
| **Repository** | `Motesart27/Motesart-OS` |
| **Current-main baseline (verified)** | `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e` — confirmed equal to `origin/main` at session start |
| **Packet baseline (superseded)** | `72a2984b78be18863d4e2076ec8d22f9d1ad5510` (23 commits behind current main; drift in §2) |
| **Governing packet** | `docs/vault/MOSV2_PHASE_C_EXECUTION_PACKET_v1.0.md` (byte-identical on current main to the PR #15 mirror) |
| **Branch** | `feat/mosv2-c-zones` (isolated worktree; zero implementation commits) |
| **Backend audited ref** | `Motesart27/Deployable-python-codebase-som` `origin/main` = `15e4889b9a2ce9334755d471843e5bdf39faf430` (2026-07-24, "KIMI-MANUAL-001") |
| **Classification** | Architecture (documentation only) |

**NO PHASE C IMPLEMENTATION HAS BEGUN.** This PR contains exactly one new file (this document). No component, adapter, endpoint, or configuration was created or modified.

**How this plan was grounded:** every packet assumption was re-verified at file level against (a) current main `2f0c3f4` of this repo and (b) backend `origin/main` `15e4889`. Nothing was inherited from the packet's July 13 baseline without re-verification. Where the packet and current source disagree, current source wins and the disagreement is recorded in §2 or §5.

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
| D6 | `netlify.toml` static since baseline | +15 lines: staging redirects for `deploy-preview-22--motesart-os.netlify.app` (`/operator-bridge-staging*`); **the `/api/*` proxy rule is untouched** (`netlify.toml:5-9`) | Proxy assumption intact; deploy config remains protected — no Phase C change requested |
| D7 | `src/main.jsx` synchronous bootstrap | Rewritten: async bootstrap with host-conditional branch into `src/operator-bridge-staging/`; build-time `__OPERATOR_BRIDGE_BUILD_HEAD__` define in `vite.config.js` | None for v2 zones; noted so no plan step touches the entry file |
| D8 | `public/manifest.json` `start_url: /` | `start_url: /v2/home`, `scope: /` | PWA entry lands on `/v2/home`; legacy `/` still byte-identical in the app itself |
| D9 | No operator-bridge in repo | `operator-bridge/`, `staging-control-plane/`, `tests/operator-bridge/`, `scripts/` added (PRs #22–24, ~7,500 lines) | **Zero intersection with `src/v2`** (verified by grep). Per the tasking: no Operator Bridge or phone-pilot work is mixed into Phase C |
| D10 | Packet exists at baseline SHA | The packet file itself was added **after** the baseline by PR #15 (`8bd8e0b`); on current main it is byte-identical to that mirror | Governing packet text confirmed current |
| D11 | Packet §3: "no Phase C branch exists" | Branch `feat/mosv2-c-zones` now exists (this PLAN); zero implementation commits | Stale precondition only; implementation statement above stands |
| D12 | Packet §6: "exact read endpoint named at PLAN after Codex route inspection" | Route inspection complete — §4 matrix names every endpoint with file:line citations | Plan gate satisfied |
| D13 | Packet §11: `FIELDS.md` to inspect for field audit | **`FIELDS.md` does not exist anywhere in the repo** (glob-verified), though `AGENTS.md:14` and the handoff cite it | Field audit performed at backend code level instead; live-schema confirmation flagged as Gap G6 |

**Not drifted:** `VITE_MOS_V2` flag plumbing (`src/App.jsx:14`: `VITE_MOS_V2 === 'true' || window.MOS_V2 === true`) · `index.html` byte-identical · legacy dashboard routes byte-identical except `App.jsx`/`Login.jsx`/`main.jsx` auth-bootstrap changes above · no new runtime dependencies (`package.json` deps unchanged; only 3 operator-bridge scripts added) · no mounted backend route removed.

---

## 3 · FOUNDER DECISIONS — RECORDED AS APPROVED RECOMMENDATIONS

Per founder instruction these six packet §9 items are recorded as approved recommendations and govern everything below:

| # | Decision | Recorded ruling |
|---|---|---|
| 9.1 | DB-G6 state designs + chart keyboard equivalent | **APPROVED** — packet §7.1 state visuals and the arrow-key chart crosshair (plot focusable, `role="img"`, Left/Right step, Home/End endpoints, polite per-step announcement) are the design fill |
| 9.2 | FM-PAT-B2 dispatch | **APPROVED** — dispatch FM-PAT-B2 as a **separate repository, branch and PR** (`Deployable-python-codebase-som`, fixing `fm_airtable.py:23` PAT `.lstrip('=')`), its own approval chain; FM data stays caveat-capped until independently green |
| 9.3 | Refresh cadences | **APPROVED** — tasks/signals **60s** · calendar/audit **300s** · FM/SOM/Book/personal **900s** · **all timers pause on `visibilitychange` (hidden tab)** and resume on visible |
| 9.4 | Signal-feed row click | **APPROVED** — rows route to the owning module screen (L2 skeleton in Phase C) |
| 9.5 | Tile 401/403 | **APPROVED** — tile-local error ("sign-in needed"), **never** a global logout or redirect |
| 9.6 | Gallery fixtures | **APPROVED** — deterministic fixture module + forced-state specimens; **Gallery performs zero network calls** (provable in the network tab) |

---

## 4 · NINE-DOMAIN SOURCE/AUTH MATRIX (verified against current main + backend `15e4889`)

Legend — Availability: **AV** available · **CON** constrained · **MISS** missing. "Phase C legal" = usable under packet §4/§5 without new connectors, new endpoints, or protected-system changes. All frontend reads go through the Netlify proxy `/api/* → https://deployable-python-codebase-som-production.up.railway.app/api/:splat`; the frontend authenticates with `Authorization: Bearer <som_token>` (JWT in localStorage, `src/services/api.js:4-6`). **No client-side Airtable/PAT anywhere — confirmed and remains law.**

### Domain 1 — MASTER_TASKS

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable base `AIRTABLE_MASTER_TASKS_BASE_ID` / table `AIRTABLE_MASTER_TASKS_TABLE_ID` (env-named, `app/airtable_client.py:44-45`; router docstring names base `app4GKdk1AqmiOyKx`, tables `MASTER_TASKS`+`TASK_UPDATES` — see Gap G5 on the base-ID conflict) |
| Exact endpoint | `GET /api/tasks` (`app/routers/tasks.py:305`); filters `business,status,priority,owner,assigned_agent,requires_approval(true only),due_today,limit≤200`. Aggregate: `GET /api/pulse` (`tasks.py:369`) |
| Authentication | **None server-side** (no dependency on the route); frontend sends Bearer `som_token` anyway |
| Exact fields (case-verified in code) | lowercase: `title, business, status, priority, owner, assigned_agent, source, approval_status, requires_approval, approval_requested_at, approved_at, next_action, task_context, due_date, waiting_on, project_or_area, task_type, completed_at, created_at, workflow_updated_at, latest_update_summary, notify_on_complete, is_stale` (`tasks.py:315-322, 56-63`). Enums: business ∈ {E7A, SOM, FM, Book, Personal}; status ∈ {pending, in_progress, blocked, done}; priority ∈ {urgent, high, medium, low} |
| Response shape | `{"ok": true, "tasks": [{"id", ...fields}], "count": n}`; pulse → `{"ok", "pulse": {urgent, overdue, blocked, approval, done_today, stale}}` |
| Trust classification | Production-trusted per ADR-DC2 (documented); code-level defects below temper specific filters |
| Freshness expectation | 60s cadence (9.3) |
| Failure behavior | Per-tile degrade; last-good + stale mark |
| Availability | **AV with constraints** |
| Production-trusted | Yes (documented), with defect notes |
| New connector required | No |
| Phase C legal | **Yes** — Z1 signal feed + Z2 project grouping |
| Unknowns / required proof | Live Airtable schema not directly queried (no credentials used — code-level audit only). Known backend defects to respect: duplicate `{status}` fields in the live base make `?status=` filtering suspect (`tasks.py` Phase 2.4 docstring); sort by computed `created_at` has Airtable-422 history (`tasks.py:331` vs Phase 2.2 header); `?requires_approval=false` silently ignored (`tasks.py:321`); `due_today` uses naive server-local time (`tasks.py:324`). Phase C will filter client-side from the unfiltered list where feasible and never depend on `?status=` alone |

### Domain 2 — Google Calendar

| Attribute | Verified value |
|---|---|
| Authoritative source | Google Calendar API, service account `GOOGLE_SERVICE_ACCOUNT_JSON` (server-side only); calendars `GOOGLE_CALENDAR_ID` + `GOOGLE_CALENDAR_ID_PERSONAL` merged (`app/services/calendar_executor.py:21-40`); day bounds in `USER_TIMEZONE` (default `America/New_York`) |
| Exact endpoint | `GET /api/mya/calendar/events?days_ahead=7&max_results=20` (`app/routers/mya.py:636-650`). Also `GET /api/mya/calendar/day-intelligence` (`mya.py:653-667`) |
| Authentication | None server-side; service-account auth is server-side only |
| Exact fields | Event: `{summary, title, description, start, end, source_calendar_id}` (`calendar_executor.py:475-492`). Range fetch carries **no `id` / no `is_all_day`** (those exist only in the window-fetch variant, `calendar_executor.py:495-516`) |
| Response shape | `{"events": [...], "count", "days_ahead", "fetched_at"}` |
| Sanitizer | **Verified present, server-side, applied on every read:** `_sanitize_cal_text` (`calendar_executor.py:43-49`) — strips `[\n\r\t]`, `[\[\]{}<>`]`, `(system|assistant|user|developer):` prefixes (case-insensitive), collapses whitespace, truncates 160 chars |
| Trust classification | Production-trusted (ADR-DC2) |
| Freshness | 300s cadence (9.3) |
| Failure behavior | Per-tile degrade; sanitized titles always (packet A6) |
| Availability | **AV with constraints** |
| Production-trusted | Yes |
| New connector required | No |
| Phase C legal | **Yes** — Z1 Today agenda |
| Unknowns / required proof | "Today's remaining events" has no dedicated endpoint; the adapter filters the range response client-side to today (or consumes the morning-brief calendar section — not chosen; see §7). Live event shape to be spot-checked at implementation (raw vs rendered sanitized title proof) |

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
| Phase C legal | **Yes** — Z1 handled-log digest, with null-tolerant rendering |
| Unknowns / required proof | **The writer (`audit_log.write_entry`, `audit_log.py:24`) never writes `result_summary`** — it writes `transcript`, not `result_summary`; PROJECT_BRAIN documents the live defect "audit rows return null fields — suspected column-name mismatch." The tile must render `response_text` fallback when `result_summary` is null. Proof: one live read at implementation showing actual null behavior |

### Domain 4 — Book Manager

| Attribute | Verified value |
|---|---|
| Authoritative source | Packet/handoff name Book base `app4GKdk1AqmiOyKx` with fields `BK_Project`, `BK_Blockers` |
| Exact endpoint | **MISSING.** No book router exists; repo-wide grep for `BK_` on backend `origin/main` = **zero hits**. Base `app4GKdk1AqmiOyKx` is referenced in backend code only as the **MASTER_TASKS** base (`tasks.py:5` docstring) and in `scripts/seed_people.py` — see Gap G5 |
| Authentication | N/A |
| Exact fields | `BK_Project`, `BK_Blockers` — **unverified** (absent from all code) |
| Response shape | N/A |
| Trust classification | Unknown — no read path exists |
| Freshness | 900s cadence if it existed (9.3) |
| Failure behavior | Lawful quiet empty (packet §6: absence is lawful, not an error wall) |
| Availability | **MISS** |
| Production-trusted | No |
| New connector required | **Yes** — a backend read endpoint (not a vendor connector) would be required; Phase C may not create endpoints (packet §5: no backend changes except FM-PAT-B2) |
| Phase C legal | **No** for BK_* data. **Yes** for the fallback: Book-lane project data via `GET /api/tasks?business=Book` (Domain 1), which is the only lawful Book read in Phase C |
| Unknowns / required proof | Whether the Book base exists at all under that ID; whether BK_* fields exist. Founder decision G1 (§5) |

### Domain 5 — FinancialMind

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable base `AIRTABLE_BASE_ID` (same SOM student base; `airtable_client.py` header names `appTN4wNd5Kgbqdwl`), tables `FM_Transactions, FM_Bills, FM_Savings, FM_Accounts, FM_Monthly_Summary` (`app/routers/fm_airtable.py:35-41`) |
| Exact endpoint | `GET /api/fm/summary` (`fm_airtable.py:304`) · `GET /api/fm/bills?status` (`:167`) · `GET /api/fm/savings?status` (`:188`) · `GET /api/fm/accounts?entity` (`:209`) · `GET /api/fm/monthly?entity` (`:230`) — **all unauthenticated** |
| Authentication | None server-side |
| Exact fields (case-verified) | Bills: `Bill_Name, Amount, Due_Day, Frequency, Entity, Account, Auto_Pay, Status, Last_Paid_Date, Notes, Confirmed_By_Denarius` · Savings: `Stash_Name, Goal_Amount, Current_Balance, Monthly_Target, Last_Deposit_Date, Last_Deposit_Amount, Status, Priority, Notes` · Accounts: `Account_Name, Entity, Account_Type, Institution, Last_4, Current_Balance, Credit_Limit, Status` · Monthly: `Month, Entity, Total_Income, Total_Expenses, Net, Expense_Ratio, Savings_Deposited, Flag_Notes` (`fm_airtable.py:129-160, 280-291`) — **PascalCase, opposite of MASTER_TASKS convention; verbatim or nothing** |
| Response shape | Lists → `{"count", "bills|stashes|accounts|months": [{"id", ...fields}]}` · Summary → `{"status": "live"|"mock", "source", "as_of", "ytd": {income, expenses, net, expense_ratio}, "monthly": [...], "savings"|"top_categories", "flags"}` |
| Trust classification | **connected-not-production-trusted until FM-PAT-B2** (ADR-PR3) |
| Freshness | 900s + mandatory `as of` tag; permanent caveat tag `unverified — FM fix pending` until B2 green |
| Failure behavior | Per-tile degrade; FM-born signals cap at ≤warn severity (packet A3) |
| Availability | **CON — B2-gated** |
| Production-trusted | **No** |
| New connector required | No — but the B2 backend PR is required (9.2, separate repo/branch/PR) |
| Phase C legal | **Yes, caveated** — build against fixtures; wire live only after B2 merges and an independent FM read proves green |
| Unknowns / required proof | (a) PAT defect confirmed: `fm_airtable.py:23` — `os.getenv("AIRTABLE_PAT","").lstrip("=").strip()`, mangles tokens beginning with `=`, evaluated at import time (same pattern at `airtable_client.py:12-13`, `morning_brief.py:32`, `piano.py:89`, `travel.py:13-14` — B2 scope decision needed: fix `fm_airtable.py` only, or all five). (b) **Mock-fallback hazard:** `/api/fm/summary` silently serves hardcoded numbers with `"status":"mock"` when Airtable errors (`fm_airtable.py:372-421`) — the Z3 adapter MUST branch on the `status` field and treat `"mock"` as an error state, never render it. (c) No FM revenue/invoice/overdue-specific endpoint exists; overdue-bills derive from `GET /api/fm/bills?status=` + `Due_Day` client-side. Proof: post-B2 live read with `status:"live"` |

### Domain 6 — School of Motesart

| Attribute | Verified value |
|---|---|
| Authoritative source | Airtable SOM base (`AIRTABLE_BASE_ID`, `appTN4wNd5Kgbqdwl`), Students table |
| Exact endpoint | `GET /students/` (`app/routers/students.py:31`) · `GET /students/active` (`:37`) — **mounted OUTSIDE the `/api` prefix** (`main.py:56-81`) |
| Authentication | None server-side |
| Exact fields | Per-student: `{id, name, status, teacher, level, dpm_percent, dpm_status, dpm_status_display, weekly_summary, tami_memory, assigned_weekly_practice, weekly_practice_minutes, total_weekly_target, consistency_score, student_instruments, linked_parents}` (`students.py:9-28`), sourced from Airtable fields `"Students Name", "Status", "Teacher", "Level", "DPM%", "DPM Status"` (note spaces/%) |
| Response shape | JSON array of student objects (list endpoints) |
| Trust classification | Route now **exists** (packet's KA §8.3 unknown resolved to "exists but constrained") |
| Freshness | 900s (9.3) |
| Failure behavior | Per-tile degrade covers absence |
| Availability | **CON — proxy gap** |
| Production-trusted | No (unauthenticated + proxy bypass) |
| New connector required | No new vendor connector; **but the route does not traverse the Netlify proxy** — see Gap G2 |
| Phase C legal | **Conditionally** — the tile's data path needs founder ruling G2 (direct absolute URL via env var vs a protected `netlify.toml` proxy rule vs deferring the tile) |
| Unknowns / required proof | No aggregate count endpoint — frontend counts `/students/active` client-side. Whether `allow_origins=["*"]` CORS permits a direct cross-origin call from the Netlify origin (backend `main.py:50-55` says yes for non-credentialed). Proof: one live read through whichever path the founder rules |

### Domain 7 — Personal/Life data

| Attribute | Verified value |
|---|---|
| Authoritative source | Packet names "VitalStack + Life tables" |
| Exact endpoint | **VitalStack/Life: MISSING** — no `vital`/`life` tables or routes exist on backend `origin/main`. What exists: `GET /api/travel/trips` + `GET /api/travel/trips/{id}` (`app/routers/travel.py:164,181`, table `tblbjMlX8Lf4LWvKC` in base `FINANCEMIND_AIRTABLE_BASE_ID`); `GET /api/people`, `GET /api/people/{name}` (`people_router.py:51,65`, fields incl. `name, aliases, warmth_rule, active`); the `Personal` lane of MASTER_TASKS; `GOOGLE_CALENDAR_ID_PERSONAL` merged into Domain 2 reads |
| Authentication | None server-side on all of the above |
| Exact fields | Travel/people fields code-verified as cited; VitalStack/Life fields — **none exist to verify** |
| Response shape | Travel/people: list envelopes; travel **falls back to hardcoded `MOCK_TRIPS`** (`travel.py:25-38`) — same fake-data hazard as FM |
| Trust classification | Unverified sources; mock-fallback hazard on travel |
| Freshness | 900s (9.3) |
| Failure behavior | **The graceful degradation IS the spec** (packet §6): absent source ⇒ quiet empty, never an error wall |
| Availability | **MISS** (VitalStack/Life) · CON (travel/people, mock hazard) |
| Production-trusted | No |
| New connector required | Would be required for VitalStack/Life — **not authorized in Phase C** |
| Phase C legal | **Yes for the authorized read paths only** (Personal task lane, personal-calendar merge, people/travel where wanted); Z4 tiles from VitalStack/Life render lawful quiet-empty |
| Unknowns / required proof | Which Z4 tiles the founder wants backed by the existing lawful paths vs quiet-empty. Founder decision G3 (§5) |

### Domain 8 — Business/revenue statistics

| Attribute | Verified value |
|---|---|
| Authoritative source | No canonical revenue/statistics source exists as such |
| Exact endpoint | **No stats/metrics/revenue router exists.** Closest aggregates: `GET /api/pulse` (Domain 1 task buckets) · `GET /api/fm/summary` (Domain 5, B2-gated + mock hazard) · `GET /api/mya/morning-brief` (`morning_brief.py:303`, no auth — aggregates calendar/tasks/executives/finance/health/audit into one envelope) · `GET /api/piano/invoices` (`piano.py:263`, no auth; base **hardcoded** `appkksRRCOGUotdI8` at `piano.py:19`, invoice fields `invoice_id, student, invoice_date, invoice_status, payment_amount, payment_date, payment_source, receipt_pdf_url, receipt_sent`) |
| Authentication | None server-side on all |
| Exact fields | As cited per endpoint |
| Response shape | Per-endpoint envelopes as cited |
| Trust classification | Mixed: pulse production-trusted; FM B2-gated; piano unauthenticated with hardcoded base ID |
| Freshness | 900s (9.3) |
| Failure behavior | Per-tile degrade |
| Availability | **CON** |
| Production-trusted | No (as a revenue source) |
| New connector required | No — but a **canonical revenue-series ruling** is required |
| Phase C legal | **Yes** for pulse + caveated FM monthly series; the Z3 revenue chart series definition needs founder ruling G4 |
| Unknowns / required proof | Which series the Z3 revenue area chart plots for 7D/30D/QTD: candidates are (a) FM `FM_Monthly_Summary.Total_Income` by `Month` (monthly grain — poor for 7D), (b) piano invoices `payment_amount` by `payment_date` (daily grain, SOM-only), (c) FM_Transactions (table exists per `fm_airtable.py:35` but **no read endpoint** for it). No endpoint today serves a daily revenue series. Founder decision G4 (§5) |

### Domain 9 — create_task_core dispatch

| Attribute | Verified value |
|---|---|
| Authoritative source | `create_task_core(fields: dict)` — `app/routers/tasks.py:208-242` (MASTER_TASKS write) |
| Exact endpoint | `POST /api/tasks` (`tasks.py:391`, body `TaskCreate`, 201 → `{"ok", "task"}`) — the same core used by the voice/agent tool path `POST /api/agent` → `execute_create_task` (`agent.py:503-551`) |
| Authentication | **None server-side** on `POST /api/tasks` (frontend sends Bearer `som_token`) |
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
| Phase C legal | **Yes** — the ONLY write in Phase C; implemented LAST (Z5); `requires_approval` respected exactly as the backend defines it |
| Unknowns / required proof | The unauthenticated nature of `POST /api/tasks` is a backend posture fact, not a Phase C defect; frontend sends the JWT regardless. Proof: dispatch smoke on a preview deploy with `requires_approval: true` verifying `approval_status: pending` lands and the task is not executed |

---

## 5 · UNKNOWN/GAP SUMMARY

| Metric | Count |
|---|---|
| Total domains reviewed | 9 |
| Total endpoints verified (code-level, backend `15e4889`, file:line cited) | 19 |
| Fields verified at code level | ~90 (MASTER_TASKS 22 · calendar event 6 + day-intel 12 · audit 4 · FM 36 · students 15 · travel/people ~6 · dispatch/task-create ~10) |
| Fields verified against LIVE Airtable schema | **0** — no credentials used; code-level audit only (Gap G6) |
| Fields unresolved | `BK_Project`, `BK_Blockers` (absent everywhere) · all VitalStack/Life fields (no tables exist) · `result_summary` (read model expects it; writer never writes it) |
| Missing routes | 5 — Book Manager reads · SOM aggregate count · canonical daily revenue series · VitalStack/Life reads · SOM routes under the `/api` proxy prefix |
| Authentication gaps | 4 — nearly all read endpoints unauthenticated server-side · `/students/*` bypasses the proxy AND auth · audit-log read is the only JWT-enforced feed (401 surface) · backend CORS `allow_origins=["*"]` with `allow_credentials=True` |
| Schema mismatches | 4 — base `app4GKdk1AqmiOyKx` claimed as Book base (packet/handoff) vs MASTER_TASKS base (backend docstring) · duplicate `{status}` fields in live MASTER_TASKS base · `result_summary` write/read mismatch · `FIELDS.md` cited as governing but absent from the repo |
| Trust gaps | 4 — FM-PAT defect (B2) · FM `/api/fm/summary` silent mock fallback · travel silent mock fallback · piano hardcoded base ID / unauthenticated invoices |

### Gap register with recommendations and blast radius

| # | Gap | Recommendation | Blocks |
|---|---|---|---|
| G1 | **Book Manager reads missing** (Domain 4) | Phase C lawfully uses `GET /api/tasks?business=Book` for Z2 Book information; treat BK_* as unscheduled. A future backend read endpoint is a post-C workstream, never improvised inside C. **Founder confirm or amend** | One tile only (Z2 Book info) |
| G2 | **`/students/*` outside `/api` proxy + unauthenticated** (Domain 6) | Recommended: count SOM students from `GET /students/active` via a **direct absolute URL resolved from env** (same pattern as `FM_URL` in `api.js:2`), since editing `netlify.toml` touches the protected deployment-config register. Alternative: defer the SOM tile to quiet-empty. **Founder ruling required** | One tile only (Z3 SOM student count) |
| G3 | **VitalStack/Life absent** (Domain 7) | Lawful per packet: Z4 tiles backed only by existing authorized reads (Personal task lane, personal calendar, people/travel as ruled); absent sources render quiet-empty. **Founder confirm tile set** | Planning of Z4 tile contents only; not other zones |
| G4 | **No canonical revenue series** (Domain 8) | Recommended ruling: Z3 chart plots **FM `FM_Monthly_Summary.Total_Income` by `Month`** at 30D/QTD grain with the 7D range rendered from the same series at its native grain and honestly labeled (scale-truthfulness law), all caveat-tagged until B2; piano-invoice revenue deferred. **Founder ruling required before Z3 chart implementation** | Z3 revenue chart tile only (not the Z3 stat tiles backed by pulse/FM summary) |
| G5 | **Base-ID conflict `app4GKdk1AqmiOyKx`** (Book base per packet vs MASTER_TASKS base per backend) | Treat backend code as ground truth: MASTER_TASKS lives under `AIRTABLE_MASTER_TASKS_BASE_ID` env; do not assert the Book base ID anywhere in Phase C. Architect seat to reconcile docs post-C | Nothing (documentation hygiene) |
| G6 | **`FIELDS.md` absent; zero live-schema field verification** | At implementation start, run one live read per wired endpoint on the deploy preview and paste the raw-vs-rendered field table into the PR (packet DoD requires it). No credential access used in planning | Nothing in planning; implementation gate per-endpoint |
| G7 | **Read endpoints unauthenticated server-side** | Out of Phase C scope (auth is a protected system; AUTH-401 stays closed). Recorded as a FOLLOW-UP: a backend auth-hardening workstream should own enforcement. Phase C tiles send the JWT and treat 401/403 tile-locally per 9.5 | Nothing in Phase C |
| G8 | **FM-PAT-B2 scope** — same `.lstrip("=")` defect in 5 files | Recommended B2 scope: fix `fm_airtable.py:23` (packet-mandated) + the identical pattern in `airtable_client.py`, `morning_brief.py`, `piano.py`, `travel.py` as one Functional commit in the backend repo — founder rules scope in the B2 PR, never in this one | Live-wiring of FM tiles only |
| G9 | **`result_summary` never written** (Domain 3) | Handled-log tile renders `response_text` with `result_summary` preferred when non-null; record the writer mismatch as a FOLLOW-UP for a backend workstream | Nothing (rendering rule) |
| G10 | **Zone label mismatch** (shell Z5 "Mya" vs packet "Quick Actions") | Relabel the Z5 container heading during implementation under allowed `src/v2/*` scope; no behavior change | Nothing (cosmetic) |

**Verdict:** no gap blocks this PLAN. G2, G3, G4 require founder rulings that ride alongside PLAN approval; G1, G8 are confirm-or-amend. All other gaps are recorded with recommendations and block at most one tile.

---

## 6 · CONNECTOR TRUST TABLE (current-main re-verification of packet §6)

| Source | Packet trust claim | Current-main verification | Phase C posture |
|---|---|---|---|
| Client clock (Z1 greeting/date) | Verified available | No connector; 30s tick per Bible §8 | **Use** |
| MASTER_TASKS reads | Production-trusted (ADR-DC2) | Endpoints exist, fields verified, no server auth; documented filter defects | **Use**, client-side filtering |
| Google Calendar | Production-trusted (ADR-DC2) | Endpoint + server-side sanitizer verified | **Use** |
| Mya audit log | Write-trusted; read same base | Read endpoint exists, JWT-enforced, `result_summary` null defect | **Use** with fallback rendering |
| Book base | "Same Airtable discipline" | **No read path exists** | **Quiet-empty / task-lane fallback** (G1) |
| FM routes | B2-gated | PAT defect confirmed; mock fallback confirmed | **Fixtures until B2 green; caveat tag permanent until then** |
| SOM routes | Unknown pending inventory | Routes exist; proxy/auth constrained | **Founder ruling G2** |
| VitalStack/Life | Unverified; absence lawful | **Absent** | **Quiet-empty** (G3) |
| `create_task_core` dispatch | Production-trusted write | Verified; approval semantics verified | **Use — only write, implemented last** |
| Drive connector | Architecturally-approved-not-configured | Unchanged | **Not in Phase C** |

---

## 7 · PROPOSED ARCHITECTURE (boundaries only — no implementation code)

Adopted from packet §10, re-verified against current main:

- **Components:** one per zone — `Z1Today`, `Z2Projects`, `Z3Business`, `Z4Personal`, `Z5QuickActions` — composed on `/v2/home` inside the existing `v2-zone--1..5` containers (`shell/index.jsx:198-220`); tiles are child components. Phase A/B primitives consumed, never re-implemented: `Card`, `Panel`, `Chip`, `StatCard`, `Sparkline`, `ProgressBar`, `ProgressRing`, `Toast`, `Button`, `Kbd` (`src/v2/components/index.jsx`). Tokens from `src/v2/tokens.css` verbatim.
- **Adapters:** one per canonical source — `tasks`, `calendar`, `auditLog`, `fm`, `som`, `book` (task-lane only), `personal`, `dispatch` — thin fetch layer over the verified §4 endpoints, exposing one uniform per-tile contract `{status, data, lastGood, updatedAt, error, retry}`. Zones never fetch directly; adapters never render.
- **State:** per-tile, local; **no global store** (cross-tile cascades structurally impossible). Last-good retained **in memory only**; **zero new localStorage keys** (documented "none" in PR).
- **Refresh:** each adapter owns its cadence timer per 9.3 (60s/300s/900s tiers), **pauses on `visibilitychange`**, silent refresh (no skeleton replay).
- **Cancellation:** `AbortController` per fetch; abort on unmount and superseded range change.
- **Errors:** one React error boundary per zone; zone crash renders that zone's error state, never the shell or siblings.
- **Auth:** all requests through `src/services/api.js`-style Bearer `som_token`; **401/403 tile-local, never global logout** (9.5).
- **Routes:** Phase C mounts under `/v2/home` only; module L2 routes stay skeletons; legacy routes untouched.
- **Gallery:** imports zone/tile components with **fixture adapters** rendering every state as labeled specimens; **zero network calls** (9.6) — the existing Gallery already makes zero network calls and this invariant is preserved.
- **Flag:** `VITE_MOS_V2` env + `window.MOS_V2` override (`src/App.jsx:14`); production remains **false**; flag-off = zero v2 network requests (lazy chunk never loads).
- **API base:** `VITE_API_URL || ''` same-origin proxy (`api.js:1`); **zero localhost fallback** — verified clean under `src/` today (the one hardcoded production-Railway fallback lives in legacy `MyaDispatchPanel.jsx`, out of scope).

---

## 8 · PER-TILE PLAN (mandatory content for every tile)

State language for every tile (packet §7 + approved 9.1 designs): `idle → loading → populated | empty | error`; `populated → stale → populated`; `populated → partial`; `error → loading` on retry. **Loading:** static skeleton reserving exact final geometry (zero CLS; no shimmer). **Empty:** one quiet line + good-t dot (suggests, never begs). **Error:** crit-t dot + "‹Source› unreachable" + "Retry ↻" link. **Stale:** last-good fully rendered + mono `as of HH:MM` tag + warn-t dot. **Partial:** em-dash for absent values + scope-naming tag. **401/403:** tile-local "sign-in needed" error subtype, never global logout (9.5). **Retry:** user retry link re-enters loading; otherwise next cadence tick; no auto-retry storms. **Last-good:** populated data never regresses to skeleton/empty on failed refresh — it goes stale. **A11y:** tile status line is a polite live region (`role="status"`); severity never color-alone; focus ring 2px `--info`. **Reduced motion:** draw-ins render final state; lifts/washes instant.

### Z1 — Today

| Tile | Component | Source · Endpoint · Fields | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|
| Greeting + date | `Z1Greeting` | Client clock; no endpoint | none · 30s tick · pauses hidden | No network states; gallery specimen static; evidence: 1440px screenshot + reduced-motion pass |
| Signal feed (max 6, ranked crit>exec>ai>warn>info>good) | `Z1SignalFeed` | MASTER_TASKS `GET /api/tasks` fields `title,status,priority,business,assigned_agent,due_date,requires_approval` · FM overdue `GET /api/fm/bills` fields `Bill_Name,Amount,Due_Day,Status` (caveat-capped ≤warn until B2) | `tasks` + `fm` · 60s · paused hidden | All six states via fixtures; ranking proof with known-severity fixture; row click routes to owning module L2 (9.4); evidence: fixture-order screenshot + nav walkthrough |
| Today agenda | `Z1Agenda` | Calendar `GET /api/mya/calendar/events?days_ahead=1` fields `title,start,end` (sanitized server-side) | `calendar` · 300s · paused hidden | Non-interactive rows; empty "Nothing scheduled today."; sanitized-title raw-vs-rendered spot-check in PR |
| Handled-log digest | `Z1HandledLog` | Audit `GET /api/mya/audit/handled?limit=3` fields `timestamp,route,result_summary,response_text` — **JWT endpoint; 401 tile-local** | `auditLog` · 300s · paused hidden | Hidden while loading; hidden on error (quiet); `result_summary` null ⇒ `response_text` fallback (G9); evidence: null-field fixture specimen |

### Z2 — Projects

| Tile | Component | Source · Endpoint · Fields | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|
| Project cards | `Z2ProjectCards` | MASTER_TASKS `GET /api/tasks` grouped client-side by `business`; fields `business,title,status,priority` | `tasks` (shared Z1 adapter instance per-source rule: one adapter per source, consumed by both zones) · 60s · paused hidden | Hover lift only (`.lift` recipe); display-only in C; empty "No active projects."; skeleton cards |
| Book information | `Z2BookInfo` | **Fallback per G1:** `GET /api/tasks?business=Book` fields `title,status,priority` — BK_* not used (missing) | `book` (task-lane) · 900s · paused hidden | Lawful quiet-empty if no Book tasks; **no BK_* claims in UI copy**; founder G1 confirm |
| Countdowns | `Z2Countdowns` | Data-derived: computed client-side from date fields in fetched data (`due_date`, event dates); **no hardcoded dates** | derives from `tasks`/`calendar` data · recompute on tick · paused hidden | Empty when no dated events; evidence: fixture with known date ⇒ rendered countdown proof |

### Z3 — Business

| Tile | Component | Source · Endpoint · Fields | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|
| Revenue area chart (7D/30D/QTD) | `Z3RevenueChart` | **Per founder ruling G4** — recommended: FM `GET /api/fm/monthly` fields `Month,Total_Income`; adapter MUST reject `"status":"mock"` payloads as error state | `fm` · 900s · paused hidden | Hand-rolled SVG + crosshair tooltip; range control = `role="tablist"`, Left/Right + Enter/Space; keyboard crosshair per approved 9.1 (plot `tabindex=0`, `role="img"`, arrows step, Home/End endpoints, polite per-step "‹date› — ‹value›"); draw-in on mount + range change only, never refresh/resize (DB-C7/D5); scale truthfulness labels; permanent caveat tag until B2 green |
| FM stat tiles | `Z3FMStats` | `GET /api/fm/summary` fields `status,as_of,ytd.{income,expenses,net}` — `"mock"` ⇒ error state, never rendered | `fm` · 900s · paused hidden | StatCard primitives; partial state renders em-dash per absent field; caveat tag until B2 |
| Business pulse tile | `Z3Pulse` | `GET /api/pulse` fields `urgent,overdue,blocked,approval,done_today,stale` | `tasks` · 60s · paused hidden | Production-trusted source; all states via fixtures |
| SOM student count | `Z3SOMCount` | `GET /students/active` count client-side — **path per founder ruling G2** | `som` · 900s · paused hidden | Quiet-empty lawful if ruling defers; evidence per ruling |
| Book pre-orders | deferred/quiet-empty | No endpoint exists (Domain 4/8) | — | Quiet-empty; recorded, not improvised |

### Z4 — Life

| Tile | Component | Source · Endpoint · Fields | Adapter · Cadence · Hidden-tab | States / fixtures / evidence |
|---|---|---|---|---|
| Personal tiles (set per founder G3) | `Z4PersonalTiles` | Existing authorized reads only: Personal lane `GET /api/tasks?business=Personal` fields `title,status,due_date`; personal events via Domain 2 merge | `personal` · 900s · paused hidden | Absent source ⇒ quiet empty, never error wall (the degradation IS the spec); no VitalStack/Life claims |

### Z5 — Quick Actions (implemented LAST; the ONLY write)

| Tile | Component | Source · Endpoint · Fields | Adapter · Cadence | States / fixtures / evidence |
|---|---|---|---|---|
| Quick actions | `Z5QuickActions` | `POST /api/tasks` → `create_task_core`; body `title,business,priority,assigned_agent,requires_approval`; response `{"ok","task":{"id","deduped",...}}` | `dispatch` · no cadence (write) | qbtn optimistic, no disabled state (DB-G8 stays Button-only); `requires_approval: true` respected — backend sets `approval_status:"pending"`, approval never blocks; success toast "routed to ‹executive›" from `assigned_agent`; failure toast "couldn't route — try again", no auto-retry; Toast `aria-live="polite"`, never steals focus; evidence: preview-deploy dispatch smoke proving `approval_status: pending` lands and nothing executes |

---

## 9 · STATE MAP (complete — adopted from packet §7, approved 9.1)

**Canonical machine:** `idle → loading → populated | empty | error`; `populated → stale → populated`; `populated → partial`; `error → loading` (retry). Additions approved at 9.1: *retrying* (= loading re-entered; no distinct visual), *permission-denied* (error subtype for 401/403, tile-local), *offline* (stale-with-marker when last-good exists, else error).

| Aspect | Rule |
|---|---|
| Entry events | Mount (idle→loading) · cadence tick or range change (populated→loading, silent) · retry click (error→loading) · fetch resolve (→populated/empty/partial) · fetch reject (→error; →stale if last-good) · freshness expiry (populated→stale) |
| Exit events | Unmount aborts in-flight fetch · flag off unmounts all |
| Visible UI | loading = static skeleton, exact final geometry, zero CLS · empty = quiet one-liner + good-t dot · error = crit-t dot + one line + retry link · stale = last-good + mono `as of HH:MM` + warn-t dot · partial = em-dash + scope tag · FM caveat tag `unverified — FM fix pending` until B2 |
| Announced a11y state | Polite live region per tile (`role="status"`); populated data does not re-announce on refresh |
| Retry | One retry link per tile error; re-enters loading; no automatic rapid retry loops |
| Fallback | Last-good always preferred over blanking |
| Persistence | None. In-memory last-good only; zero new `localStorage` keys; backend state untouched by reads |
| Forbidden transitions | populated→empty on refresh failure · cross-tile cascade · skeleton replay on passive refresh · chart draw-in on refresh or resize · error→populated without a fetch |
| Hidden-tab behavior | All cadence timers pause on `visibilitychange` (9.3); resume on visible without burst |

---

## 10 · INTERACTION MATRIX (complete — every Phase C control)

| Control | Pointer | Keyboard | Focus | Escape | Disabled | Loading | Error | Reduced motion | SR name/state | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Signal feed row (≤6) | Hover wash + 2px translateX + arrow; click routes to owning module L2 (9.4) | Tab; Enter = click | Ring 2px --info/2px | n/a | None (rows exist only when signals do) | Skeleton rows ×3 | Zone error state | Wash/arrow without slide | `role="link"`; name = summary; severity in text, never color-alone | Active (nav only) |
| Agenda slot | Hover wash only | Tab-skipped (non-interactive) | n/a | n/a | n/a | Skeleton slots | Zone error | Wash instant | Plain text; time + sanitized title | Display-only |
| Handled-log line | None | None | n/a | n/a | n/a | Hidden while loading | Hidden on error (quiet) | n/a | Plain text | Display-only |
| Project card | Hover `.lift` (−3px, .35° tilt, --e3) | Tab-skipped in C | n/a | n/a | n/a | Skeleton card | Tile error | Lift off; border only | Plain group; progress labeled in text | Display-only |
| Z3 range control (7D/30D/QTD) | Click segment | Tab to control; Left/Right move; Enter/Space select | Ring on segment | n/a | No disabled segments | Control inert while zone loads (`aria-busy`) | Control persists; chart area errors | Selection instant; draw-in replaced by final-state render | `role="tablist"`; `aria-selected` on segment | **Active** |
| Chart crosshair (pointer) | Mousemove: crosshair + tooltip; leave: hide | — (keyboard path below) | n/a | n/a | n/a | No chart while loading | n/a | Tooltip fade → instant | Decorative for SR (kbd path carries values) | Active |
| Chart keyboard crosshair (9.1 approved) | — | Arrows step; Home/End endpoints | Plot focusable, ring | Esc blurs plot | n/a | Not focusable while loading | Not focusable in error | Steps instant | `role="img"` + per-step polite announcement | **Active** |
| Stat tile / personal tile | Hover −2px + brighten | Tab-skipped | n/a | n/a | n/a | Skeleton | Tile error | Lift off | Label + tabular value + delta in text | Display-only |
| Quick action (qbtn) | Hover −3px + scale(1.02) --spring; press scale(.97); click dispatches | Tab; Enter/Space dispatch | Ring | n/a | **No disabled state** — optimistic dispatch, control resets immediately (DB-G8 stays Button-only) | n/a | Dispatch failure ⇒ toast (crit dot) "couldn't route — try again"; no auto-retry | Lift/scale off; press feedback instant | `role="button"`; name = action label; toast announced politely | **Active — the ONLY write** |
| Per-tile retry link | Click re-fetches | Tab; Enter | Ring | n/a | Hidden outside error | Hidden | Visible | n/a | Link name "Retry ‹tile›" | Active |
| Zone "Open ‹module› →" link | Click routes to module L2 skeleton | Tab; Enter | Ring | n/a | n/a | Persists | Persists | Hover color instant | Link, named per module | Active (nav only) |
| Toast (Z5 result/error) | Auto-dismiss ~3s | Not focus-stealing | Never steals focus | n/a | n/a | n/a | Error variant (crit dot) | In/out opacity only | Container `aria-live="polite"` (Phase A component) | Active |

**Forbidden in C:** tile collapse/drag/reorder · manual global refresh control · any feed-row action other than 9.4 routing · palette result interactions (Phase D) · any write other than the Z5 dispatch.

---

## 11 · PROPOSED BRANCH/FILE SCOPE

- **Branch:** `feat/mosv2-c-zones` — cut from current main `2f0c3f4` in an isolated worktree. PR title: `DRAFT — MOSV2-C: Current-main PLAN, source/auth matrix and Home zones`.
- **This PR changes exactly one file:** `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.0.md` (this document).
- **Implementation phase will touch only:** new `src/v2/zones/*` and `src/v2/data/*` (adapters + gallery fixtures) · `/v2/home` composition in `src/v2/shell/index.jsx` · `src/v2/Gallery.jsx` (state specimens).
- **Forbidden:** anything outside `src/v2/*` (+ this doc) · `index.html` · `src/main.jsx` · legacy routes/components · `package.json`/lockfile (no new runtime dependency — hand-rolled SVG only) · `netlify.toml`/deploy config (G2 rules around it) · env files/values · `design/v2/*` · Airtable schemas (read-only law) · voice pipeline · auth systems · `operator-bridge/` and `staging-control-plane/` (separate workstream — not mixed in) · the backend repo (FM-PAT-B2 is its own PR).
- **Protected-systems register checked:** SOM auth · Mya voice pipeline · payment/invoicing · Airtable schemas · production env vars · deployment config · legacy dashboard — none touched by this plan; G2 explicitly routes around deployment config.

---

## 12 · IMPLEMENTATION SEQUENCE (after PLAN approval only)

1. **FM-PAT-B2 dispatched first** (9.2): backend repo, own branch/PR, scope per founder G8 ruling; independent green-proof before any FM tile wires live.
2. `src/v2/data/*` adapters with the uniform hook contract + fixtures module (gallery-only injection, zero network).
3. Z1 tiles (tasks/calendar/audit adapters) — read-only, no FM dependency.
4. Z2 tiles (project grouping, Book task-lane, countdowns).
5. Z3 non-FM tiles (pulse; SOM per G2 ruling), then FM tiles against fixtures; live-wire FM only on B2 green.
6. Z4 tiles per G3 ruling.
7. **Z5 quick actions LAST** — the only write; `requires_approval` behavior verified on preview before merge request.
8. Gallery specimens for every component in every §9 state.
9. Proof package (§14) assembled; PR moved from draft to ready only by founder instruction.

---

## 13 · TEST PLAN

- **Unit-level (node:test, the repo's only runner — dev-deps allowed per AGENTS.md):** adapter contract tests (status machine transitions incl. forbidden-transition guards), signal ranking comparator (crit>exec>ai>warn>info>good, max 6), countdown derivation, FM `"status":"mock"` rejection, sanitized-title passthrough, dedupe/`deduped:true` handling on dispatch response.
- **Component-level:** gallery forced-state specimens render every §9 state per tile; zero-network assertion on `/v2/gallery` (network-tab evidence).
- **Flag behavior:** flag-off build loads zero v2 chunk and fires zero v2 requests; flag-on request inventory matches §4 endpoints exactly, no third-party calls.
- **Auth behavior:** expired `som_token` ⇒ audit tile shows tile-local "sign-in needed"; no global logout, no redirect (9.5).
- **Hidden-tab:** timers pause (instrumented); no request burst on refocus.
- **Legacy isolation:** `/` and `/os` byte-identical spot-check; `index.html` untouched.
- **Existing suites:** `npm run test:operator-bridge` untouched and still green (no intersection); `npm run build` clean with new bundle hash recorded.

---

## 14 · PROOF PACKAGE (assembled at implementation PR, per packet §14 — committed here as the contract)

Deploy-preview URL @ head SHA · branch/head/rollback SHAs · approved PLAN link + recorded 9.1–9.6 answers (§3) · **1440px screenshots:** populated Z1–Z5; each tile's loading/empty/error/stale/partial from the gallery fixture harness; range control in all three states with draw-in evidence (mount + range change) and refresh WITHOUT draw-in; Z5 dispatch toast (success + failure); gallery page with all Phase C specimens · **network evidence:** flag-off zero-requests capture; gallery zero-requests capture; flag-on request inventory matching §4 · **field-audit table:** live-schema-verified raw-vs-rendered per endpoint (G6 implementation gate) · ranking-order proof (known-severity fixture → rendered order) · sanitized-title spot-check (raw vs rendered) · reduced-motion runtime observations · headless console report ×3 routes (`/v2/home`, `/v2/gallery`, one module route) · CLS numbers across state transitions via the shipped `__MOSV2_PHASE_B_PERF__` observer · bundle hash + delta against the 80KB gz ceiling (current cumulative v2: 13.41 kB gz per DEPLOY_LEDGER Phase B entry) · keyboard walkthrough incl. chart value stepping and Z5 dispatch · FM-PAT-B2 merge link + post-deploy FM read green proof, or recorded DEFER with caveat-capped FM evidence · legacy spot-check statement · `localStorage` line ("none — no new keys") · phone screenshots NOT required (Phase F) · voice-health NOT required (no Mya surface touched).

---

## 15 · ROLLBACK

- Production `VITE_MOS_V2` is **false** and stays false — Phase C ships dark regardless.
- This PLAN PR rollback: close PR, delete branch — zero runtime surface.
- Implementation rollback (future): single-branch revert to named SHA (the merge-base against main at implementation time) + flag off. `DEPLOY_LEDGER.md` entry on merge per ADR-IMP11.

---

## 16 · FM-PAT-B2 SEPARATION

FM-PAT-B2 is a **separate workstream in a separate repository** (`Motesart27/Deployable-python-codebase-som`), separate branch, separate PR, separate Denarius approval (9.2 approved). Scope: `fm_airtable.py:23` PAT `.lstrip('=')` fix minimum; the four identical patterns (`airtable_client.py:12-13`, `morning_brief.py:32`, `piano.py:89`, `travel.py:13-14`) included only per founder G8 ruling. It is never mixed into the MOSV2-C PR (cross-repo workstream isolation, packet A2/ADR-IMP2). Until it merges **and an independent FM read proves green**, all FM-derived data renders with the permanent caveat tag and FM-born signals cap at ≤warn severity (ADR-PR3). Its lift is verified independently, never assumed.

---

## 17 · STANDING CONFIRMATIONS

- **NO PHASE C IMPLEMENTATION HAS BEGUN** — this PR adds one documentation file and nothing else.
- Production V2 remains **false**.
- No Railway or Netlify change performed or proposed in this PR.
- No worker, loop, scheduler, or Operator Bridge process activated or modified.
- Approvals, protected actions, and Mya autonomy remain **off**.
- Phase C phone work is not Phase F; no phone surface is touched.
- This PLAN stops here. Implementation begins only on Denarius's explicit **"Approved — PLAN"**, together with rulings on G1–G4/G8 where flagged.

---

*— MOSV2-C PLAN gate · Motesart Execution Engine*
