# MOSV2_PHASE_C_EXECUTION_PACKET.md — CANONICAL PHASE C EXECUTION PACKET

---

## 0 · DOCUMENT CONTROL

| Field | Value |
|---|---|
| **Title** | MOSV2_PHASE_C_EXECUTION_PACKET.md — the single canonical packet for planning and implementing Motes OS v2 Phase C (Zones, read-only) |
| **Version** | 1.0 |
| **Date** | July 13, 2026 |
| **Status** | **FOR DENARIUS APPROVAL** |
| **Owning seat** | Chief Architect · **Workstream** | **MOSV2-C** (+ one named prerequisite workstream, §11) |
| **Repository** | `Motesart27/Motesart-OS` · **Required baseline main SHA** | `72a2984b78be18863d4e2076ec8d22f9d1ad5510` (post-Phase-B merge). Codex verifies before branching; drift ⇒ STOP |
| **Supersedes** | No document. Instantiates settled law for one phase; resolves nothing open (§9 items resolve only by Denarius's recorded calls) |
| **Governing sources (versions)** | CODEX_EXECUTION_ORDERS **v1.1** · MOTES_OS_V2_CODEX_HANDOFF **v1.1** · Design Bible **v1.1 ACTIVE** · DESIGN_QA_RUBRIC **v1.0 ACTIVE** · ADR **v1.1 ACTIVE** (incl. DB-C7, DB-G6/§13.5, DC1–DC4, PR3, IMP2/IMP3/IMP9) · VAULT_INDEX **v1.0 ACTIVE** · MOSV2_PHASE_B_EXECUTION_PACKET v1.0 · DESIGN_QA_PHASE_B_PR13_REVIEW_R3 v1.0 · desktop + phone reference mockups · KA Constitution v1.0 (§7/§8 trust ladder) · GROUND_TRUTH_RECONCILIATION_LEDGER v1.0 · BUILD_START_COMMAND_PLAN v1.0 |
| **Source-read confirmation** | All sources read **at file level** for this packet (July 12–13 sessions, cumulative and current): Orders PART 0–3 in full (Phase C prompt verbatim below); Handoff §0–§5 in full (Phase C zone table §2); Bible v1.1 §0–§12 + footer (incl. §6 graphs/data-states, §8 desktop contract, §12 rulings); Rubric in full; ADR v1.1 — document control, taxonomy, GOV/D/SEAT/IMP/PS/MC series, DB-C5/C6/C7 full text, DC1–DC4, PR3, §13 open decisions, §14–§16, tripwire register; VAULT_INDEX authority sections; KA trust-ladder sections; both Phase B artifacts (authored at this seat); GROUND_TRUTH ledger and BUILD_START plan in full; desktop mockup verified at CSS/JS line level in the Phase B pass; phone mockup via Bible §9 (excluded from C). **Not in the vault:** repo copies of `DEPLOY_LEDGER.md`/`PROJECT_BRAIN.md` and `FIELDS.md` — Codex inspects them at session start; live connector state is not verifiable from this seat and is classified in §6 strictly from documented trust evidence (ADR-DC2/PR3; KA §8.3) |

---

## 1 · PHASE C PURPOSE

Phase C turns the Phase B shell's five empty Home zone containers into the living cockpit: **real, read-only data** in Z1 (greeting/date · signal feed · Today agenda · handled log), Z2 (project cards + convention countdown), Z3 (revenue area chart + stat tiles), Z4 (personal tiles), and Z5 (quick actions) — plus the **data adapters** that feed them, the **complete per-tile state language** (loading / empty / error / stale / partial), **freshness signals**, and the one authorized interaction set: range switching on Z3, per-tile retry, and Z5's single write path through the existing dispatch. Everything else stays deferred: palette contents and voice (D), modes (E), phone (F), generated briefs and notifications (G). Phase C is where the interface starts telling the truth about live systems — which is why its PLAN gate (state map + interaction matrix, approved before code) is mandatory law (Handoff §0.3; Orders P2-C; Rubric §4).

---

## 2 · CANONICAL PHASE C PROMPT

Verbatim from CODEX_EXECUTION_ORDERS v1.1, PART 2, "▶ PHASE C — Zones (state map first)" (quoted without alteration):

```text
PHASE C — Zones, read-only. Branch feat/mosv2-c-zones. Before ANY code: post the
state map + interaction matrix from handoff §2 Phase C table in the PR (every tile:
endpoint, fields, refresh cadence, empty/error/loading state) and wait for approval
of the PLAN comment — Motesart Spec Protocol requires it.

Then wire Home's five zones exactly as mocked: Z1 greeting/date (client clock) +
signal feed (max 6, ranked crit>exec>ai>warn>info>good) + Today agenda (calendar,
sanitized titles) + handled-log line (voice audit digest); Z2 project cards (MASTER_TASKS
by business + Book base; convention countdown computed client-side from Jul 19);
Z3 revenue area chart (hand-rolled SVG + crosshair tooltip, 7D/30D/QTD ranges) + stat
tiles; Z4 personal tiles; Z5 quick actions calling the existing create_task_core dispatch
path (this is the ONLY write in this phase — requires_approval respected, optimistic
toast "routed to <executive>").
Every tile degrades gracefully per-tile (skeleton → data | quiet empty state that
suggests, never begs). Fix the known fm_airtable PAT .lstrip('=') issue in a SEPARATE
commit (classification: Functional, backend) before the Z3 revenue tile ships.

Definition of done: AGENTS.md checklist, plus — each tile's empty/error state
screenshotted; network tab shows zero calls when MOS_V2 off; Airtable field names
audited against live schema in the PR.
Stop at the gate.
```

**Amendments and controlling interpretations:**

| # | Original text | Amendment / clarification | Controlling source | Final interpretation |
|---|---|---|---|---|
| A1 | "hand-rolled SVG + crosshair tooltip, 7D/30D/QTD" | Draw-in runs on mount **and on user range change**; never on passive refresh, **never on resize** (the desktop reference's resize re-animation is unlawful deviation DB-D5) | Bible §5/§6 + §12.1-C7 | Range switch re-draws; refresh and resize re-render without draw-in |
| A2 | "Fix the known fm_airtable PAT issue in a SEPARATE commit (Functional, backend)" | `fm_airtable.py` lives in `Deployable-python-codebase-som` — a different repository. Workstream Isolation (ADR-IMP2) makes the "separate commit" a **separate PR in the backend repo** with its own Denarius approval, executed as Phase-C-authorized work | Orders P2-C + PART 1 Workstream Isolation; ADR-IMP2/IMP3; ADR-PR3 | Prerequisite workstream **FM-PAT-B2** (§11). Until it merges and FM reads prove green, FM-derived data is below production trust |
| A3 | (FM data, unstated) | Until B2 ships: `fm_airtable` holds trust status *connected-not-production-trusted*; FM-derived figures carry freshness + caveat; FM-born claims **cap at warn severity / low-medium confidence** | ADR-PR3 (settled law) | Z1 FM-overdue signals and Z3 revenue may not present as production-trusted until B2 lands; severity cap applies meanwhile |
| A4 | "every tile degrades gracefully… quiet empty state" | The per-tile loading/empty/partial/stale/error **visual designs and the chart keyboard equivalent do not exist** — recorded gap DB-G6; the designs land **at this PLAN gate** by architect proposal + Denarius approval | Bible §6 Data states + §12.3-G6; ADR §13.5 | §7.1 of this packet carries the proposed designs; Denarius's approval of the PLAN approves them |
| A5 | "network tab shows zero calls when MOS_V2 off" | Flag as implemented since Phase A: `VITE_MOS_V2` (env) + runtime override; production false | Phase A/B records; Phase B packet §3 | Flag-off proof = zero v2 **network requests**, now meaningful because C fetches |
| A6 | "Today agenda (calendar, sanitized titles)" | Sanitized titles are law on every outbound/displayed calendar surface; sanitizer verification is an acceptance item on touched surfaces | Handoff §2-C Z1; Bible §8 Today column; MYA §14 echo | Agenda renders sanitized titles only; proof in §14 |

---

## 3 · PRECONDITIONS — ALL CONFIRMED

Phase A **COMPLETE** · Phase B **COMPLETE AND CLOSED** (PR #13 merged; main `72a2984…`) · Phase B post-merge runtime confirmation **PASS** (Denarius-stated; §D.1 set of the Phase B R3 review — its completion also clears the R3 condition "before Phase C PLAN approval") · SOM-AUTH-401 **CLOSED** · production `VITE_MOS_V2` **FALSE** · Design Bible **v1.1 ACTIVE** controlling · QA Rubric **v1.0 ACTIVE** controlling · Foundation Gallery **permanent and preserved** (Phase B R3 §B.11; gallery opens every review) · **no Phase C branch or implementation exists** (Denarius-stated) · **no gate blocks Phase C planning** — the two §9 stop-items resolve *inside* this PLAN gate by design; FM-PAT-B2 gates only the live-wiring of FM tiles, not planning or non-FM zones.

---

## 4 · EXACT ALLOWED SCOPE (verified per source; nothing assumed)

| Item | In Phase C? | Source |
|---|---|---|
| Cockpit zone data — Home's five zones, read-only | ✅ | Orders P2-C; Handoff §2-C |
| Data adapters for the §6 sources (frontend, calling existing backend endpoints) | ✅ (implied necessity of "wire… to existing endpoints"; architecture in §10) | Handoff §2-C ("No new tables. No writes."); ADR-IMP9 |
| Today / project / business / life zones (Z1–Z4) | ✅ | Handoff §2-C table |
| "Mya zone" | ⚠ **Not a Phase C zone.** Home has Z1–Z5; Mya surfaces are the MyaBar/palette (B shell, D behavior). Z1's handled-log line reads the voice **audit table** — read-only digest, no Mya behavior | Handoff §2-C Z1; Bible §10 |
| Loading / empty / error / stale / partial / success states, per tile | ✅ — state machine is law; **visuals land at this gate** (§7.1, DB-G6) | Bible §6 Data states; Handoff §2-C |
| Refresh / freshness indicators | ✅ — stale/partial "marked, subtle"; freshness caveat mandatory on FM data until B2 | Bible §6; ADR-PR3 |
| Deterministic fixtures | ✅ **for the Gallery and failure simulation only** — live zones wire real read-only sources; the gallery never fetches (§9.6 proposal) | Orders P2-A item 3 (gallery = regression surface); DoD "empty/error screenshotted" requires simulation |
| Real read-only sources | ✅ — the phase's core | Orders P2-C |
| State transitions incl. retry | ✅ per §7; retry re-enters loading | Bible §6 (degradation law); §7 PROPOSED items marked |
| Accessibility + reduced motion for all new surfaces | ✅ — §7 gates apply to every touched screen; draw-ins render final state under reduced motion | Bible §5/§7 |
| Gallery specimens for each new component **and each data state** | ✅ | Orders P2-A item 3; Bible §4 lede; Phase B precedent (§12 gallery inventory) |
| Route-specific zone behavior | ✅ only on `/v2/home` — module L2 routes stay skeletons (see §16 row 6) | Orders P2-C ("Home's five zones") |
| Z5 quick-action write via existing `create_task_core` dispatch | ✅ — **the ONLY write**, `requires_approval` respected, optimistic toast | Orders P2-C; Handoff Z5; Bible §8 |

## 5 · EXACT EXCLUDED SCOPE

**Phase D voice integration** (palette contents, voice toggle, one-press talk — Orders P2-D) · **executive routing** (EXEC/focus modes are visual stubs until E; executives never feed ambient surfaces — ADR-E7) · **Executive Brief Engine** (G; Z1 feed in C is static-read composition, later replaced behind `MOS_V2_BRIEF`) · **Phase E modes** (E1/E2) · **Phase F phone** (separate tree, own gate) · **Phase G briefing cards / digests / bell data** (bell stays static badge — Bible §8) · **writes or destructive actions** — all writes excluded **except** the single authorized Z5 dispatch path; no delete/update anywhere; task completion toggles are phone/Phase-F territory and optimistic-local even there · **auth changes** (protected; AUTH-401 closed, do not reopen; per-tile 401 handling is display-level only, §9.5) · **backend changes not expressly authorized** — exactly one is authorized: FM-PAT-B2 (§11), its own workstream; nothing else server-side · **new connectors** (Drive connector stays architecturally-approved-not-configured — KA §7; no new vendor, no new scope) · **payment changes** (protected register; no money movement, ever) · **unrelated legacy cleanup** (byte-identical law) · **production flag activation** (`VITE_MOS_V2` stays false in production; preview-only exposure) · **new runtime dependencies** (hand-rolled SVG only — ADR-IMP7/IMP8) · **`/api/search` aggregate** (named in Orders P2-D as a Phase D option, not C).

---

## 6 · DATA-SOURCE AND CONNECTOR REALITY

Trust statuses come **only** from documented evidence (ADR-DC2, ADR-PR3, KA §8.3, GROUND_TRUTH rows 8–9). Nothing below asserts a live connector this seat has not seen proven. Every read path is **frontend → existing backend endpoint**; no client-side Airtable/PAT access exists or is permitted (secrets by name only; ADR-IMP6).

| Zone · data | Canonical source | Availability evidence | Read path & auth | Freshness expectation | Failure behavior | Classification |
|---|---|---|---|---|---|---|
| Z1 greeting + date/clock | Client clock | N/A — no connector | Local; none | Live; 30s tick (Bible §8) | N/A | **VERIFIED AVAILABLE** |
| Z1 signal feed — tasks | MASTER_TASKS (`priority`,`status`,`business` — lowercase, verbatim) via existing backend read routes | Airtable task paths **production-trusted** (ADR-DC2); exact read endpoint named at PLAN after Codex route inspection | Backend route; existing session auth | Cadence per §9.3 proposal | Per-tile degrade; last-good + stale mark | **AVAILABLE WITH CONSTRAINT** — field audit vs live schema in PR (Handoff Airtable discipline) |
| Z1 signal feed — FM overdue | FM routes (`fm_airtable`) | **connected-not-production-trusted until B2** (ADR-DC2/PR3) | Backend FM route; existing auth | Cadence per §9.3; caveat mandatory | Severity **caps at warn** until B2; per-tile degrade | **AVAILABLE WITH CONSTRAINT — B2-gated** |
| Z1 Today agenda | Google Calendar via existing service account + calendar endpoint (wiring SHA a062365) | Calendar **production-trusted** (ADR-DC2: read-in-prompt + event-create f85de95) | Backend calendar endpoint; service-account auth server-side | Cadence per §9.3 | Per-tile degrade; sanitized titles always (A6) | **AVAILABLE WITH CONSTRAINT** — endpoint + sanitizer confirmed at PLAN |
| Z1 handled log | Mya Voice Audit Log `tblDEyL8fzGGVvs2t` (`result_summary`,`response_text`) | Audit write path production-trusted (DC2); read = same base, read-only | Backend route; existing auth | Cadence per §9.3 | Per-tile degrade; line hides when empty (quiet) | **AVAILABLE WITH CONSTRAINT** — table ID verbatim; read-only |
| Z2 projects | MASTER_TASKS grouped by `business` + Book base `app4GKdk1AqmiOyKx` (`BK_Project`,`BK_Blockers`) | Task paths production-trusted; Book base = same Airtable discipline | Backend routes; existing auth | Cadence per §9.3 | Per-tile degrade; countdown is client-computed (dates in data — Bible §8) | **AVAILABLE WITH CONSTRAINT** — Book field names verbatim |
| Z3 revenue chart + FM stats | FM routes (`fm_airtable`) | **B2-gated** (ADR-PR3) | Backend FM routes | Cadence per §9.3 + "as of" freshness tag | Degrade; **must not ship wired live before B2 merges + FM read proven green** | **AVAILABLE WITH CONSTRAINT — B2-gated** (build against fixtures; wire on B2 green) |
| Z3 SOM student count | SOM read routes | Trust **unknown pending inventory** (KA §8.3; GROUND_TRUTH row 9) | Backend SOM route; existing auth | Cadence per §9.3 | Per-tile degrade covers absence | **AVAILABLE WITH CONSTRAINT** — route + auth verified at PLAN; absent route ⇒ BLOCKED note, tile degrades |
| Z3 book pre-orders | Book base reads | Same Airtable discipline | Backend route | Cadence per §9.3 | Per-tile degrade | **AVAILABLE WITH CONSTRAINT** |
| Z4 personal tiles | VitalStack + Life tables | **Unverified from this seat**; Handoff's own law anticipates absence: "degrade gracefully per tile if source absent" | Backend routes where they exist | Cadence per §9.3 | The graceful-degradation IS the spec; absent source ⇒ quiet empty, never an error wall | **AVAILABLE WITH CONSTRAINT** — availability confirmed at PLAN; absence is lawful, not blocking |
| Z5 quick actions | `create_task_core()` via existing dispatch (same path as voice tool) | Write path **production-trusted** (ADR-DC2) | Backend dispatch; `requires_approval` respected | N/A (write) | Failure ⇒ toast error state; no retry storm (§8) | **AVAILABLE WITH CONSTRAINT** — the ONLY write |
| Bell digest, brief generation, Drive documents | — | — | — | — | — | **NOT REQUIRED IN PHASE C** (G; KA §7) |

**Standing gates surfaced:** (1) **FM-PAT-B2** — `fm_airtable.py` PAT `.lstrip('=')` fix, backend repo, own PR, before FM tiles ship live (A2/A3). (2) **SOM read-route trust unknown** — resolved by the PLAN's endpoint audit (or KA-INV-001 inventory if the route is absent). (3) No other connector gate applies; nothing here configures a new connector.

---

## 7 · STATE MAP (complete; per tile)

**Canonical machine (law-grounded):** `idle → loading → populated | empty | error`; `populated → stale` (freshness window exceeded, or refresh failed with last-good present) `→ populated` (next success); `populated → partial` (subset of fields absent — marked); `error → loading` (retry: user action or next cadence). The bible's named states are loading (skeleton), quiet empty, partial/stale (marked, subtle), error (Bible §6); **PROPOSED additions, marked per the tasking:** *idle* (pre-fetch mount instant — trivially real), *retrying* (= loading re-entered via retry; no distinct visual), *permission-denied* (= error subtype: 401/403 copy per §9.5 — **never a global logout**), *offline* (= stale-with-marker when last-good exists, else error; navigator offline event).

| Aspect | Rule |
|---|---|
| Entry events | Mount (idle→loading) · cadence tick or range change (populated→loading, silent — see forbidden) · retry click (error→loading) · fetch resolve (→populated/empty/partial) · fetch reject (→error; →stale if last-good) · freshness expiry (populated→stale) |
| Exit events | Unmount aborts in-flight fetch (§10 cancellation); flag off unmounts all |
| Visible UI (per §7.1 designs) | loading = static skeleton reserving exact final layout (zero CLS) · empty = quiet one-liner, suggests-never-begs · error = crit-t dot + one line + retry link · stale = last-good data + mono "as of HH:MM" tag + subtle warn-t dot · partial = "—" for absent values + scope-naming stale-style tag |
| Announced a11y state | Tile status line is a polite live region (`role="status"`); transitions announce politely, never assertively (Bible §7 Live regions); populated data itself does not re-announce on refresh |
| Retry action | Error state exposes one retry link (11.5px, info-t); retry re-enters loading; no automatic rapid retry loops — next attempt otherwise waits for cadence |
| Fallback | Last-good data always preferred over blanking: populated data NEVER regresses to empty/skeleton on a failed refresh — it goes stale (truthfulness) |
| Persistence | **None.** In-memory last-good only; zero `mosv2.*` keys in Phase C (documented "none" in PR); backend state untouched by reads |
| Forbidden transitions | populated→empty on refresh failure (must go stale/error-with-last-good) · any cross-tile cascade (one tile's error never degrades another — Bible §6 "no cascades") · loading skeleton replay on passive refresh (silent refresh; draw-ins never replay — DB-C7) · error→populated without a fetch · any transition that fires a chart draw-in on resize (DB-D5) |

**7.1 · PROPOSED DB-G6 state designs — FOR DENARIUS APPROVAL AT THIS GATE** (gap-fill by the owning seat; recipes derive strictly from existing bible components/tokens; no new token values):
**Loading:** static skeleton blocks (rgba(255,255,255,.03) fills, stroke-1 hairlines, radius --r-s) reserving the tile's exact populated geometry; no shimmer, no pulse (motion restraint; CLS zero by construction). **Empty:** one text-3 line with a good-t 7px dot; copy suggests, never begs (Z1 feed: "Quiet so far — nothing needs you." · agenda: "Nothing scheduled today." · Z2: "No active projects." · Z3: "No revenue data yet." · Z4: "Nothing tracked today." — copy approved with this packet, editable at review). **Error:** crit-t 7px dot + text-3 line "‹Source› unreachable" + info-t retry link "Retry ↻"; no red washes, no alarm styling (silence law). **Stale:** last-good data stays fully rendered; mono 10px `as of HH:MM` tag in text-3 + 5px warn-t dot, top-right of the tile. **Partial:** absent values render an em-dash in tabular numerals; the stale-style tag names scope ("partial — FM only"). **FM caveat (until B2):** Z3/FM tiles carry the stale-style tag permanently reading `unverified — FM fix pending`, and FM-born signals render at ≤warn severity (ADR-PR3). **Chart keyboard equivalent:** the Z3 plot is focusable (`tabindex=0`, `role="img"`, aria-label = series summary); Left/Right arrows step a keyboard crosshair point-by-point, Home/End jump endpoints, each step announces "‹date› — ‹value›" via a polite live region; visually identical to the pointer crosshair. (Fallback option if rejected: visually-hidden data table.)

---

## 8 · INTERACTION MATRIX (every Phase C control)

| Control | Pointer | Keyboard | Focus | Escape | Disabled | Loading | Error | Reduced motion | SR name/state | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Signal feed row (≤6) | Hover: wash + 2px translateX + reveal arrow; click: **§9.4 proposal** — routes to owning module L2 | Tab-reachable; Enter = click | Focus ring 2px --info/2px | n/a | No disabled state (rows exist only when signals do) | Skeleton rows ×3 | Zone error state | Wash/arrow appear without slide | `role="link"`; name = signal summary; severity in text, never color-alone | Active (nav only) |
| Agenda slot | Hover wash only | Tab-skipped (non-interactive) | n/a | n/a | n/a | Skeleton slots | Zone error | Wash instant | Plain text; time + sanitized title | Display-only in C |
| Handled-log line | None | None | n/a | n/a | n/a | Hidden while loading | Hidden on error (quiet) | n/a | Plain text | Display-only |
| Project card (pcard) | Hover: .lift recipe (−3px, .35° tilt, --e3) | Tab-skipped in C (no action yet) | n/a | n/a | n/a | Skeleton card | Tile error | Lift off; border change only | Plain group; progress labeled in text | Display-only in C |
| Z3 range control (7D/30D/QTD) | Click segment | Tab to control; Left/Right move segment; Enter/Space select | Ring on segment | n/a | No disabled segments | Control inert while zone loads (aria-busy on zone, control not rendered as disabled) | Control persists; chart area shows error | Selection instant; **draw-in replaced by final-state render** | `role="tablist"` pattern (Bible §7 Semantics); selected segment `aria-selected` | **Active** |
| Chart crosshair (pointer) | Mousemove: crosshair + tooltip; leave: hide | — (keyboard path below) | n/a | n/a | n/a | No chart while loading | n/a | Tooltip fade --t-fast → instant | Decorative for SR (kbd path carries values) | Active |
| Chart keyboard crosshair (§7.1) | — | Arrows step; Home/End endpoints | Plot focusable, ring | Esc blurs plot | n/a | Not focusable while loading | Not focusable in error | Steps instant | `role="img"` + per-step polite announcement | **Active (pending §9.1 approval)** |
| Stat tile / personal tile | Hover: −2px + brighten | Tab-skipped | n/a | n/a | n/a | Skeleton | Tile error | Lift off | Label + tabular value + delta in text | Display-only |
| Quick action (qbtn) | Hover: −3px + scale(1.02) --spring, icon ai-t; press scale(.97); click dispatches | Tab-reachable; Enter/Space dispatch | Ring | n/a | **No disabled state** — optimistic dispatch, control resets immediately (avoids extending DB-G8, which is Button-only law) | n/a | Dispatch failure ⇒ toast (crit dot) "couldn't route — try again"; no auto-retry | Lift/scale off; press feedback instant | `role="button"`; name = action label; result toast announced politely | **Active — the ONLY write** |
| Per-tile retry link | Click re-fetches | Tab-reachable; Enter | Ring | n/a | Hidden outside error | Hidden | Visible | n/a | Link name "Retry ‹tile›" | Active |
| Zone "Open ‹module› →" link | Click routes to module L2 skeleton | Tab; Enter | Ring | n/a | n/a | Persists | Persists | Hover color instant | Link, named per module | Active (nav only) |
| Toast (Z5 result/error) | Auto-dismiss ~3s | Not focus-stealing | Never steals focus | n/a | n/a | n/a | Error variant (crit dot) | In/out without slide (opacity) | Container `aria-live="polite"` (Phase A component) | Active |

Forbidden in C: tile collapse/drag/reorder (no spec; no `mosv2.*` keys) · manual global refresh control (no spec) · any feed-row action other than §9.4's ruling · palette result interactions (D).

---

## 9 · OPEN DECISIONS AND TRIPWIRES (nothing else is open; ADR §13 + Bible §12.3 swept)

| # | Question | Controlling source | Options & consequence | Recommendation | Exact Denarius question | Stops implementation? |
|---|---|---|---|---|---|---|
| 9.1 | **DB-G6 designs** — approve §7.1 state visuals + chart keyboard equivalent? | Bible §12.3-G6; ADR §13.5 (resolves at this gate) | Approve as proposed (build proceeds) · amend (revised PLAN) · reject chart-kbd proposal for hidden-table fallback (simpler, less faithful to "values" intent) | Approve as proposed | *"Approve §7.1 state designs + arrow-key chart crosshair as the DB-G6 fill? YES / amendments / TABLE-fallback"* | **YES** — PLAN cannot be approved without this fill |
| 9.2 | **FM-PAT-B2 dispatch** — authorize the backend PR now? | Orders P2-C; ADR-IMP2/PR3 | Dispatch now (FM tiles wire live in-phase once green) · defer (FM tiles ship fixture/caveat-only; severity cap persists) | Dispatch now, first | *"Authorize FM-PAT-B2 (fm_airtable.py PAT fix, SOM repo, own Functional PR) for Codex now? YES/DEFER"* | Blocks **live-wiring of FM tiles only**; all other zones proceed |
| 9.3 | **Refresh cadences** (unspecified anywhere; greeting 30s is the only sourced tick) | Orders P2-C requires cadence per tile in PLAN | **Proposed defaults:** signals/tasks 60s · calendar 300s · handled log 300s · FM/SOM/Book stats 900s · personal 900s; all paused when tab hidden | Approve defaults | *"Approve proposed refresh cadences (60s/300s/900s tiers, visibility-paused)? YES / amend"* | No — rides PLAN approval |
| 9.4 | **Feed-row click action in C** — bible commands "action on click," target unspecified pre-G | Bible §8 Signal feed | Route to owning module L2 skeleton (consistent, cheap) · no-op until G (quieter, but a dead control violates "action on click") | Route to module L2 | *"Feed-row click routes to the owning module screen? YES / no-op"* | No |
| 9.5 | **Per-tile 401/403 handling** — display rule only | AUTH-401 closure lesson (BUILD_START §1: client force-logout-on-any-401 was the fault pattern) | Tile-local error ("sign-in needed") never triggering global logout/redirect · inherit any legacy global 401 behavior (repeats the AUTH-401 failure mode inside v2) | Tile-local, never global | *"v2 tile reads treat 401/403 as tile-local errors, never global logout? YES/NO"* | No — rides PLAN |
| 9.6 | **Gallery fixture harness** — deterministic specimens require fixtures; gallery must never fetch | Orders P2-A item 3; DoD screenshots of empty/error | Fixture module + forced-state specimens (gallery-only injection) · screenshot live-only (cannot deterministically show error/empty — fails DoD) | Fixture harness | *"Approve gallery fixture harness (fixtures render specimens; gallery makes zero network calls)? YES/NO"* | No — rides PLAN |

**Tripwires armed for this phase:** B2 lift (Claude Code verifies FM read green post-merge — ADR §12 duty; lifts PR3's cap) · G-standing BLOCKED (missing endpoint / absent auth / schema surprise ⇒ STOP, BLOCKED note: missing · two options · recommendation) · Phase B substitution ruling's tripwire remains armed (defect found in shell during C ⇒ Phase D+ reverts to full pre-merge runtime proof) · six-signal law is structural — a seventh signal is a defect, not a tuning choice.

---

## 10 · PROPOSED ARCHITECTURE (boundaries only; no implementation code)

**Component boundaries:** one component per zone (`Z1Today`, `Z2Projects`, `Z3Business`, `Z4Personal`, `Z5QuickActions`) composed on `/v2/home` inside the existing zone containers; tiles are child components; Phase A/B primitives (StatCard, Sparkline, ProgressBar/Ring, Chip, Toast, Card/Panel) are consumed, never re-implemented. **Data-adapter boundaries:** one adapter per canonical source (`tasks`, `calendar`, `auditLog`, `fm`, `som`, `book`, `personal`, `dispatch`) — a thin fetch layer over the existing backend endpoints, exposing one uniform per-tile hook contract: `{status, data, lastGood, updatedAt, error, retry}`. Zones never fetch directly; adapters never render. **State ownership:** per-tile, local; **no global store** — cross-tile cascades are structurally impossible if no shared data state exists. **Refresh ownership:** each adapter owns its cadence timer (§9.3), pauses on `visibilitychange`, refreshes silently (no skeleton replay). **Cache rules:** in-memory last-good per adapter instance only; nothing persisted; no `mosv2.*` keys. **Cancellation:** AbortController per fetch; abort on unmount and on superseded range change. **Error boundaries:** one React error boundary per zone — a zone crash renders that zone's error state and never takes down the shell or siblings. **Route boundaries:** all Phase C work mounts under `/v2/home`; module routes untouched (skeletons). **Gallery strategy:** gallery imports zone/tile components with fixture adapters (§9.6) rendering every §7 state as labeled specimens; gallery makes zero network requests (provable in the network tab). **Protected-system isolation:** frontend calls existing backend endpoints only; no client-side Airtable/PAT; no new endpoints; API base from env, zero localhost fallback in prod builds (ADR-IMP9, verified in built bundle). **Rollback:** `VITE_MOS_V2` off (production already false) + single-branch revert; rollback SHA in PR.

## 11 · PROPOSED BRANCH AND FILE SCOPE

**Branch:** `feat/mosv2-c-zones` (Orders P2-C). PR title: `MOSV2-C: Home zones, read-only`.
**Prerequisite workstream (separate):** **FM-PAT-B2** — repo `Deployable-python-codebase-som`, one Functional commit fixing `fm_airtable.py` PAT `.lstrip('=')`, own PR, own Denarius approval, Railway deploy, Claude Code verifies FM read green (B2-lift tripwire). Never mixed into the MOSV2-C PR (cross-repo workstream isolation, A2).
**Codex must inspect (read-only):** main at baseline `72a2984…` · `AGENTS.md` · `design/v2/*` · full `src/v2/` tree as merged (shell, components, gallery, flag plumbing) · router entry · `FIELDS.md` / live schema via existing read paths (field-name audit) · backend route inventory for the §6 read paths (names, auth, shapes — read-only inspection) · `DEPLOY_LEDGER.md` + `PROJECT_BRAIN.md` Phase B entries.
**Likely to change:** new `src/v2/zones/*` and `src/v2/data/*` (adapters + gallery fixtures) · `/v2/home` composition in the v2 tree · Gallery page (state specimens) · nothing else.
**Forbidden:** anything outside `src/v2/*` (+ the already-mounted router entry if strictly needed) · `index.html` (F-1) · legacy routes/components · `package.json`/lockfile · `netlify.toml`/deploy config · env files/values · `design/v2/*` · Airtable schemas (read-only law) · voice pipeline anything · auth anything · the backend repo inside this PR (B2 is its own PR).
**Protected boundaries:** the seven-row register (Orders PART 1) checked before every file; R5 chains apply regardless of task size.

## 12 · REQUIRED GITHUB PLAN COMMENT (Codex posts before any code; implementation stops until approved)

```markdown
MOSV2-C PLAN — Phase C Zones, read-only (MOSV2_PHASE_C_EXECUTION_PACKET v1.0 governs; §-refs cite it)

0. APPROVALS REQUESTED (implementation stops until Denarius answers):
   a. §9.1 DB-G6 state designs + arrow-key chart crosshair — approve / amend / table-fallback.
   b. §9.2 FM-PAT-B2 backend PR — authorize now / defer (defer = FM tiles ship caveat-capped).
   c. §9.3 cadences · §9.4 feed-row click → module L2 · §9.5 tile-local 401 · §9.6 gallery
      fixture harness — approve as proposed or amend.
1. SCOPE: Z1–Z5 on /v2/home wired read-only per packet §4; single Z5 write via existing
   create_task_core dispatch (requires_approval respected); per-tile states per §7;
   interactions per §8. EXCLUSIONS: packet §5 list, verbatim.
2. ENDPOINT & FIELD AUDIT (completed before approval is requested):
   [table: tile → endpoint → fields (verbatim, case-sensitive, from live schema/FIELDS.md)
    → auth dependency → cadence (§9.3) → states designed (§7.1)]
   Any missing endpoint / auth surprise / schema mismatch ⇒ BLOCKED note (missing · two
   options · recommendation), not improvisation.
3. STATE MAP: packet §7 adopted in full, incl. forbidden transitions (no populated→empty
   on failure; no cascades; no draw-in on refresh/resize per DB-C7/D5).
4. INTERACTION MATRIX: packet §8 adopted in full; qbtn optimistic (no disabled state —
   DB-G8 stays Button-only); range control = tablist pattern; chart kbd path per §7.1.
5. DATA SOURCES: packet §6 adopted; FM data caveat-capped at ≤warn until B2 lifts
   (ADR-PR3); SOM route verified in audit or BLOCKED; personal sources may lawfully be
   absent (quiet empty). Adapters call existing backend endpoints only; API base from
   env; no client-side secrets.
6. FILES: src/v2/zones/* + src/v2/data/* + home composition + gallery specimens only.
7. ACCESSIBILITY: §7 gates on every touched surface; polite status regions; severity
   never color-alone; sanitized agenda titles; chart values keyboard-reachable.
8. REDUCED MOTION: draw-ins render final state; lifts/washes instant; verified at runtime.
9. PERFORMANCE: skeletons reserve exact layout (zero CLS on every state transition,
   instrumented via the shipped __MOSV2_PHASE_B_PERF__ observer); transform/opacity only;
   draw-ins once per mount/range change; cumulative v2 bundle ≤80KB gz (delta reported).
10. ERROR HANDLING: per-zone error boundaries; per-tile degradation; retry per §7; no
    auto-retry storms; 401/403 tile-local (§9.5).
11. ROLLBACK: VITE_MOS_V2 off (prod already false) + revert SHA named.
12. PROOF PACKAGE: packet §14 in full, incl. per-state screenshots via the gallery
    fixture harness and zero-network-calls-flag-off evidence.
13. OPEN DECISIONS: item 0 only. IMPLEMENTATION STOPS HERE pending "Approved — PLAN".
```

## 13 · ACCEPTANCE CRITERIA — PHASE C DEFINITION OF DONE

**Data correctness:** field names verbatim/case-sensitive, audited against live schema in the PR; signal ranking exactly crit>exec>ai>warn>info>good, max six (structural); countdown computed from event dates in data; FM figures caveated until B2 lift; agenda titles sanitized. **State completeness:** every tile demonstrates loading/empty/error/stale/partial/populated per §7 (fixture-simulated where live simulation is impractical); forbidden transitions absent. **Visual fidelity:** side-by-side with the desktop reference at 1440px for populated Z1–Z5; §7.1 designs as approved; scale truthfulness on all trend visuals (windowed range + grounding labels — Bible §6). **Interaction:** §8 matrix demonstrated, incl. range switching with lawful draw-in and Z5 optimistic dispatch respecting `requires_approval`. **Accessibility:** §7 gates on touched screens; polite live regions; chart keyboard path delivering values; contrast floor; focus ring everywhere interactive. **Reduced motion:** runtime-verified — draw-ins render final state, no breathing/lift/slide. **Console:** zero errors/warnings headless on `/v2/home`, `/v2` (gallery), one module route; pre-ruled meta warning excepted; any new warning = full-strength gate. **Performance:** zero CLS through every state transition and refresh (instrumented, numbers posted); 60fps rule. **Bundle:** delta reported; cumulative v2 ≤80KB gz. **Network behavior:** flag ON = §6 endpoints only, no third-party calls; flag OFF = **zero v2 network requests** (network-tab evidence); gallery = zero requests. **Failure simulation:** each source's error and empty states induced and screenshotted (§9.6 harness); one offline/stale demonstration with last-good retained. **Stale/partial:** freshness tags render per §7.1; populated data never blanks on failed refresh. **Flag-off isolation + legacy:** `/` and `/os` byte-identical spot-check; `index.html` untouched. **Gallery completeness:** every new component in every §7 state as labeled specimens; Phase A+B specimens retained. **Screenshots/evidence:** per §14; missing proof = automatically not approved. **Sequencing:** approved PLAN comment precedes all code (gate-zero item for C); B2 merged + FM read green before FM tiles ship live.

## 14 · DESIGN QA PROOF PACKAGE

Deploy-preview URL @ head SHA · PR = MOSV2-C only · branch/head/rollback SHAs · approved PLAN link (+ recorded §9 answers) · **1440px screenshots:** populated Z1–Z5 (side-by-side-ready), each tile's loading/empty/error/stale/partial from the gallery harness, range control in all three states with draw-in evidence (mount + range change) and refresh WITHOUT draw-in, Z5 dispatch toast (success + failure), gallery page with all Phase C specimens · **network evidence:** flag-off zero-requests capture; gallery zero-requests capture; flag-on request inventory matching §6 · **field-audit table** (live-schema-verified) · ranking-order proof (fixture with known severities → rendered order) · sanitized-title spot-check (raw vs rendered) · reduced-motion runtime observations · headless console report ×3 routes · CLS numbers across state transitions (shipped observer) · bundle hash + delta · keyboard walkthrough incl. chart value stepping and Z5 dispatch · FM-PAT-B2 merge link + post-deploy FM read green proof (or the recorded DEFER with caveat-capped FM evidence) · legacy spot-check statement · `mosv2.*` line ("none") · voice-health 5/5 NOT required (no Mya surface touched) unless the audit-log read path proves otherwise at PLAN.

## 15 · MERGE AND SEQUENCING GATE

Codex cannot self-approve; cannot self-merge (branch protection, ADR-IMP4). Reviewer ≠ builder (R4/GOV3). **Denarius's explicit "Approved" is the only merge authority** — once at the PLAN gate, once at the PR gate (ADR-GOV1). After merge: DEPLOY_LEDGER + PROJECT_BRAIN entries (ADR-IMP11). **Phase D does not begin** — no branch, no code — until Phase C is merged, bookkeeping lands, and Denarius pastes the Phase D prompt (D has its own PLAN gate: full interaction matrix). **FM-PAT-B2 remains a separate workstream** with its own approval chain whatever §9.2's answer is; its lift is verified by Claude Code, never assumed.

## 16 · CONTRADICTION CHECK

| # | Sources | Issue | Classification |
|---|---|---|---|
| 1 | Orders P2-C "separate commit" for fm_airtable vs Workstream Isolation + two repos | Same-PR impossible cross-repo | **Settled** — separate backend PR (A2); Phase-C-authorized |
| 2 | FM data required by Z1/Z3 vs PAT defect | FM reads below production trust | **Blocking prerequisite (bounded)** — B2 gates live FM wiring only; ADR-PR3's caveat regime lawfully covers any interim (already settled law) |
| 3 | Bible §8 "Module placeholders: **until Phase C**…" + mockup toast "module screens are Phase C" vs Orders/Handoff Phase C = Home's five zones only | Module-screen population appears scheduled by the bible note but absent from every phase prompt | **Settled by rank** (handoff+orders > bible note > mockup demo copy, which is non-normative): C touches Home only; module L2s stay skeletons. **N-note to architect seat:** module-screen population is genuinely unscheduled in the orders — a post-C scheduling ruling is owed, no build impact now |
| 4 | Handoff localStorage note names "collapsed tiles" under `mosv2.*` vs no collapse interaction in any C source | Key hint without a feature | **No conflict** — general v2 law, not a C requirement; C introduces no keys, documents "none" |
| 5 | Desktop reference re-animates chart on resize vs draw-in law | Known deviation | **Settled** — DB-D5 unlawful; C7 governs (A1) |
| 6 | SOM read-route trust unknown (KA §8.3) vs Z3 SOM tile | Unverified route | **Open verification, not open decision** — resolved by PLAN endpoint audit; absent ⇒ BLOCKED note + lawful degradation |
| 7 | VAULT_INDEX cites Bible v1.0; FABLE_HANDOFF/ADR-PR1 AUTH-401 rows stale | Known staleness | **Settled** — supersedes chains govern; MINOR refreshes owed at architect seat (also 18px handoff amendment from Phase B, still owed) |
| 8 | Handoff §0.2 "Codex adversarial review" phrasing vs D3 roles | May echo | **Settled** — D3 |
| 9 | Z5 write vs "read-only" phase name | Apparent | **No conflict** — orders name the single authorized write explicitly; everything else read-only |
| 10 | Repo state at baseline vs seat visibility | Not verifiable from seat | **No conflict** — Codex verifies baseline SHA + inspects at session start |

## 17 · FINAL READINESS VERDICT

**READY FOR DENARIUS PHASE C PLAN APPROVAL.**

Every controlling source was read at file level; the data-source table asserts nothing undocumented (trust statuses trace to ADR-DC2/PR3 and KA §8.3); the state map and interaction matrix are complete with all proposals explicitly marked; the six §9 questions are packaged with exact approval language, and only 9.1 stops implementation — it resolves inside this very gate. The single blocking prerequisite (FM-PAT-B2) is bounded to FM live-wiring and carries its own workstream and lift tripwire. Nothing was implemented, GitHub was not modified, Phase D was not begun.

---

*How to use: Denarius — approve this packet, then answer PLAN item 0 (a–c) when Codex posts it; two-gate rhythm as always. Codex — verify baseline, run the §12 endpoint/field audit, post the PLAN, stop; the packet's citations replace memory; file-level law wins over this packet on any discrepancy (BLOCKED note, never silent). Claude Code — B2 lift verification is yours when FM-PAT-B2 deploys. Reviewer — §13/§14 are your gate; gallery first; Phase B's substitution tripwire is armed. Architect (successor) — log §9 answers into ADR §13 closures; the §16 row-3 scheduling note and row-7 refreshes are owed. Storage: vault, beside the Phase A/B chains; amend only by superseding version.*

*— Chief Architect seat · Execution Engine · Motesart Technologies*
