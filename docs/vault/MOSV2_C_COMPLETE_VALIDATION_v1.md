# MOSV2-C COMPLETE VALIDATION v1 — governed evidence document (PR #25, branch `feat/mosv2-c-zones`)

Per PLAN v1.1.1 §13 (test plan), §14 (acceptance criteria and proof package), and the AGENTS.md definition of done — the final validation-gate record for Phase C. This document assembles the complete re-run record, the static checklist verification, and the runtime evidence deferred by `docs/vault/MOSV2_C_FAILURE_PERFORMANCE_PROOF_v1.md` §3 item 3 (headless console report, CLS readings, network captures, screenshots, keyboard-walkthrough recording).

PLAN reference: `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md`. Companion evidence: `docs/vault/MOSV2_C_LIVE_FIELD_AUDIT_v1.md` (§3.4/§3.7) · `docs/vault/MOSV2_C_FAILURE_PERFORMANCE_PROOF_v1.md`.

- **Date:** August 3, 2026
- **Branch / head SHA:** `feat/mosv2-c-zones` @ `31e71dcfeba93386f47e7bf36c84fd510cde1206`
- **Rollback SHA (merge-base vs main):** `2f0c3f45ec5a60e85d7e4b36fcab74a8081f0c6e` (= `origin/main`, the current-main baseline recorded in PLAN §0)
- **Classification:** Functional (validation tooling + documentation only; zero production-code changes in this stage — the diff adds `scripts/mosv2-c-validation.mjs`, `docs/vault/evidence/mosv2-c-validation/*`, and this document)
- **Working-tree status:** all stage artifacts left uncommitted per stage instructions

---

## 1 · Full re-run record (commands + numbers)

| Gate | Command | Result |
|---|---|---|
| Phase C suite | `node --test tests/mosv2-c/*.test.js` (glob required; bare dir fails on Node 25) | **tests 243 · suites 72 · pass 243 · fail 0** (241.6 ms) |
| Operator-bridge suite (§13 "untouched and still green") | `npm run test:operator-bridge` | **tests 127 · pass 127 · fail 0** (2449.5 ms) |
| Production build | `npm run build` | **vite v5.4.21 ✓ built in 665 ms**, 90 modules, zero warnings |
| Lint/format scripts | — | **None exist** in `package.json` (scripts: dev/build/preview/start/test:operator-bridge/pilot/qualify); nothing to run |

### Bundle hashes + size vs the 80 kB gz ceiling (§14)

Build at head `31e71dc` + this stage's uncommitted tooling/docs (not shipped):

| Asset | Raw | gzip (vite) | gzip (`gzip -c`, measured) | sha256 (first 16) |
|---|---|---|---|---|
| `dist/assets/V2App-BiUGqMkZ.js` | 52,727 B | 15.71 kB | 15,731 B | `404abe1146c750ef` |
| `dist/assets/V2App-Bsi0NWCt.css` | 37,464 B | 7.68 kB | 7,696 B | `c05353d7e501860e` |
| **Combined v2 JS+CSS** | | **23.39 kB** | **22.87 kB** | |

- Phase B cumulative baseline (DEPLOY_LEDGER): 13.41 kB gz → **Phase C cumulative: 23.39 kB gz vs ≤ 80 kB ceiling → 56.61 kB headroom (70.8% unused)**. Budget holds.
- The JS content hash differs from the failure/perf proof's `V2App-Co4EbrAa` (measured at head `e545a84`). Verified: `git diff e545a84..31e71dc` touches only docs + test files (zero shipped source), two consecutive rebuilds here produce the identical hash (deterministic build), and both builds measure 52.67 kB raw / 15.71 kB gz. The earlier hash string is not reproducible in this environment; the authoritative hash at the validation head is **`V2App-BiUGqMkZ.js`** (sha256 `404abe1146c750ef…`).

---

## 2 · Static checklist verification (diff `0e8a4050..31e71dc`, plus uncommitted stage files)

| Check | Method | Result |
|---|---|---|
| All five zones present and mounted | `src/v2/zones/Home.jsx` composes Z1Today / Z2Projects / Z3Business / Z4Personal / Z5QuickActions, each inside `ZoneErrorBoundary` | **PASS** |
| Zone labels exact (G10) | Home.jsx `zones[]` + `z5.test.js` assertion | **PASS** — Today / Projects / Business / Life / Quick Actions |
| All §9 states reachable via fixtures | `fixtureTileStates` (`src/v2/data/fixtures.js:315`): 9 states × 13 tiles + mock-rejection + dispatch outcomes; `fixtures.test.js` drives every state | **PASS (test-level)** — see deviation D1 for the gallery-harness gap |
| Ruled copies verbatim | `grep -rF` over `src/v2`: `Financial data unavailable — verification pending.` · `SOM data connection pending.` · `Revenue trend unavailable — daily source not connected.` · `Sign-in needed — this tile will resume after you sign in again.` · `couldn't route — try again` · all five quiet-empty copies | **PASS** — all present verbatim |
| Links correct | All `to="/v2/*"` targets (`work`, `money`, `life`) and signal routes (`book`, `exec`, `life`, `money`, `mya`, `work`) ∈ the shell module-slug list | **PASS** |
| G-rules honored | G1 Book task-lane only (no BK_* anywhere in `src/v2`) · G2 SOM quiet-empty, no som adapter · G3 Z4 restricted set (Personal lane + calendar only) · G4 chart fixture-only, live tile is unavailability display | **PASS** (re-run via `z3.test.js`, `z4.test.js`, `adapters.test.js`) |
| §3.5 same-origin | `apiFetch.test.js` static guard re-run; `grep` confirms zero `fetch(` in `src/v2` outside `apiFetch.js` | **PASS** |
| §3.8 pre-B2 zero FM | `grep -rn "api/fm" src/v2` → **zero hits** (only a test-side guard probe in `apiFetch.test.js`); no `fm` adapter exists | **PASS** |
| No placeholders in the diff | Added-line scan for `TODO|FIXME|XXX|HACK|lorem|placeholder` → only a test name and the prior proof doc's prose; the `v2-placeholder-chip` PLACEHOLDER chip is **pre-existing Phase B** (present at baseline `0e8a4050`) | **PASS** |
| Scope guard (§11) | Modified files: only `src/v2/components/*`, `src/v2/shell/*`; everything else is new `src/v2/*`, `tests/mosv2-c/*`, `docs/vault/*`. `index.html` byte-identical (sha256 `d9a1712b2182380c…` both ends). No `package.json`/lockfile change — no new runtime dependency | **PASS** |
| `localStorage` line | Runtime enumeration on `/v2/home` after full load: `["som_token", "som_user"]` — both pre-existing legacy auth keys | **PASS — "none — no new keys"** |

---

## 3 · Runtime evidence (headless Chrome via CDP, zero installed dependencies)

**Harness:** `scripts/mosv2-c-validation.mjs` — drives the production `dist/` build through headless Chrome (`--headless=new`, 1440×900) over the DevTools Protocol using Node's built-in WebSocket. The build has `VITE_MOS_V2` **unset at build time (flag OFF, exactly as production)**; flag-on runs use the designed runtime override `window.MOS_V2 = true` (`src/App.jsx:14`) injected before page scripts. **Every backend response is fulfilled by local request interception from the repo's own fixture module** (`src/v2/data/fixtures.js`, imported verbatim — wire-shaped, annotation keys stripped). **Zero live network calls, zero production contact, zero real Z5 submission** (the Z5 dispatcher is the fixture-backed zero-network path by construction; the live POST is not shipped). Auth is stubbed locally at `/auth/verify` so the shell boots without the legacy auth warnings. Raw capture: `docs/vault/evidence/mosv2-c-validation/report.json`; PNGs alongside it.

### 3.1 Network evidence (§13 flag behavior / §14 network captures)

| Capture | Result |
|---|---|
| **Flag-off** (`/` and `/v2/home`, no override) | `/` → `/login`; `/v2/home` → `/login` (route absent). **Zero `V2App-*` chunk requests, zero `/api/*` requests, zero `/auth/*` requests** across both navigations |
| **Flag-on inventory** (`/v2/home`, populated) | Exactly: `GET /auth/verify` (shell boot, legacy auth) · `GET /api/tasks?limit=200` ×2 (Z1 signals, Z2 projects) · `GET /api/tasks?business=Book` · `GET /api/tasks?business=Personal` · `GET /api/pulse` · `GET /api/mya/calendar/events?days_ahead=1&max_results=20` ×2 (Z1, Z4) · `GET /api/mya/audit/handled?limit=3` — **all same-origin, matching the §4 endpoint set; zero third-party calls from v2 code** |
| **Pre-B2 zero `/api/fm/*`** | **`fmApiRequests: []`** — zero FM requests in the flag-on inventory (§3.8 fail-closed) |
| **Gallery zero-requests** (`/v2/gallery`) | Only `GET /auth/verify` (app-boot auth, not gallery data). **Zero `/api/*` data requests — gallery is fixture-only, zero network** |

> Observation (pre-existing, out of scope — see flag F5): the legacy boot document `index.html` (byte-identical, protected) issues third-party requests at every load — Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`) and jsdelivr Chart.js. These fire from the legacy HTML shell on all routes including `/v2/*`; no v2 source references any third-party origin.

### 3.2 Headless console report ×3 routes (§14; AGENTS.md DoD)

| Route | Errors | Warnings | Exceptions |
|---|---|---|---|
| `/v2/home` (populated) | 0 | 0 | 0 |
| `/v2/gallery` | 0 | 0 | 0 |
| `/v2/work` (module route) | 0 | 0 | 0 |

Zero console errors/warnings on **every** scenario run, including the 502 error-state, 401 permission, mock-rejection, and stale-transition runs (failed sources resolve to typed tile states, never console noise).

### 3.3 CLS numbers across state transitions (`window.__MOSV2_PHASE_B_PERF__`, §14)

| Transition | CLS | Entries |
|---|---|---|
| Mount → populated (all 9 live tiles + 3 deferred) | **0.000** | 0 |
| Populated → stale (3 tiles, failed 60 s cadence refresh) | **0.000** before / **0.000** after | 0 |
| Error state (502) · empty state · permission (401) · mock-rejection · loading skeletons | **0.000** each | 0 |

The §9 "static skeleton, exact final geometry, zero CLS" law holds at runtime.

### 3.4 State evidence on the live cockpit surface (1440×900 PNGs, fixtures via local interception)

| Screenshot | Evidence | Verified assertion |
|---|---|---|
| `02-home-populated.png` | Populated Z1–Z5 | 7 tiles `data-status="populated"` (signals, agenda, projects, book, pulse, personal tasks, personal calendar) + countdowns; **ruled copies rendered:** FM `b2-pending` "Financial data unavailable — verification pending." · SOM "SOM data connection pending." · revenue "Revenue trend unavailable — daily source not connected." |
| `06-home-error.png` | Error state | ≥5 tiles `data-status="error"` on 502 — crit line + retry, no crash |
| `07-home-empty.png` | Quiet-empty | "Nothing scheduled today." + "No active projects." rendered verbatim |
| `08-home-permission.png` | 401 on audit (9.5) | **No redirect (still `/v2/home`), no logout (`som_user` intact), siblings populated, digest quiet-hidden** per §10 "hidden on error (quiet)". The tile-local "Sign-in needed —" copy is proven at the Tile renderer level in `failure-proof.test.js` §1.2.3 |
| `09-home-mock-rejection.png` | §3.6/§14 mock-rejection evidence | `200 {"status":"mock",…}` on `/api/pulse` ⇒ pulse tile enters `error`, mock values (99999/11111/88888) **never rendered** |
| `10-home-stale.png` | Stale transition | Populated load → sources flipped to 502 → next 60 s cadence tick: **3 tiles `stale`, last-good retained (`contentRetained: true`), mono `as of HH:MM` tags, zero skeleton replay, CLS 0** |
| `11-home-loading.png` | Loading | ≥3 skeleton groups while sources in flight (6 s delayed fulfillment) |
| `12-gallery-full.png` | Gallery page (full-page) | All Phase A/B specimens render; zero-network confirmed. **Phase C specimens absent — deviation D1** |
| `13-module-work.png` | Module route | Workspace skeleton renders (Phase B surface) |
| `15-legacy-os.png` | Legacy spot-check | `/os` boots under the same build; byte-identity proven by git diff (§2 scope guard) |

### 3.5 Keyboard walkthrough (recorded, §14/DoD)

| Keys pressed | Observed |
|---|---|
| `Space` | Command palette opens; input `#v2-palette-input` focused (`03-palette-open.png`) |
| `Esc` | Palette closes; focus restored |
| `E` | Exec mode on — `.v2-shell--exec` applied (`04-exec-on.png`) |
| `E` | Exec mode off |
| `Tab`→focus qbtn 3, `Enter` | Z5 dispatch fires from keyboard: toast **"Brain dump → routed to MYA"** — copy, tone, and ~3 s auto-dismiss verified in DOM (`05-z5-toast-success.png`); toast screen position is defective — flag F7 |

Chart value stepping (arrows/Home/End) is exercisable only on the fixture chart, which is not mounted anywhere — deviation D1. Test proof: `z3.test.js`.

### 3.6 Reduced-motion runtime observations (§14)

With `prefers-reduced-motion: reduce` emulated: **boot sequence never mounts** (`bootSequenceSkipped: true`, law "boot collapses to opacity/skip"), `matchMedia('(prefers-reduced-motion: reduce)').matches === true`, computed `transition-duration: 1e-05s` (motion collapsed), all tiles populate normally, zero console errors (`14-reduced-motion.png`). Mechanical sweep over every motion-bearing selector: `a11y.test.js` (re-run, §1).

### 3.7 Boot-sequence law

Boot auto-dismisses on a 1500 ms timer (≤1.6 s law) and is click-skippable (`BootSequence onSkip`); under reduced motion it never mounts (3.6). Observed in every run.

---

## 4 · §14 proof-package checklist — final status

| §14 item | Status | Where |
|---|---|---|
| Branch/head/rollback SHAs | **PASS** | header above |
| Approved PLAN link + rulings §3.1–§3.8 | **PASS** | `MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` on this branch |
| Deploy-preview URL @ head SHA | **GAP** | requires push + Netlify preview — not authorized in this environment (no git mutations) |
| 1440px populated Z1–Z5 | **PASS** | `02-home-populated.png` |
| Tile loading/empty/error/stale/partial **from the gallery fixture harness** | **DEVIATION D1** (harness absent); live-surface equivalents captured for loading/empty/error/stale (`06/07/08/10/11`) | partial is fixture-only by design (no fetcher resolves `partial`) — test-proven `fixtures.test.js` |
| Range control 3 states + draw-in (mount + range change) + refresh WITHOUT draw-in | **DEVIATION D1** (chart unmounted); one-shot draw-in + keyed-remount proof in `perf-proof.test.js` | — |
| Z5 dispatch toast success + failure | success **PASS** at runtime (`05`); failure **test-proven** (`z5.test.js`) — runtime failure impossible by construction (fixture dispatcher cannot fail; live POST unshipped) | — |
| Gallery page with all Phase C specimens | **DEVIATION D1** | `12-gallery-full.png` (Phase A/B only) |
| SOM quiet-empty / revenue-unavailability / pre-B2 FM-unavailability | **PASS** | rendered on `/v2/home`, `02-home-populated.png` + §3.4 assertions |
| Flag-off zero-requests capture | **PASS** | §3.1 |
| Gallery zero-requests capture | **PASS** | §3.1 |
| Flag-on inventory matching §4 same-origin | **PASS** | §3.1 |
| Pre-B2 flag-on zero `/api/fm/*` | **PASS** | §3.1 |
| Live-schema field-audit table (§3.4/§3.7) | **PASS (prior stage)** | `MOSV2_C_LIVE_FIELD_AUDIT_v1.md` |
| Mock-rejection evidence | **PASS** (runtime + tests) | `09-home-mock-rejection.png` |
| Ranking-order proof | **PASS (test)** | `fixtures.test.js` (known-severity 7-signal fixture → exact order, 7th dropped); order visible in `02` |
| Sanitized-title spot-check (raw vs rendered) | **PASS (test)** | `failure-proof.test.js` §1.2.4 (byte-identical passthrough; no `innerHTML` in `src/v2`) |
| Reduced-motion runtime observations | **PASS** | §3.6 |
| Headless console report ×3 routes | **PASS** | §3.2 |
| CLS numbers across state transitions | **PASS — 0.000 everywhere** | §3.3 |
| Bundle hash + delta vs 80 kB gz | **PASS — 23.39 kB, 70.8% headroom** | §1 |
| Keyboard walkthrough incl. chart stepping + Z5 dispatch | **PASS except chart stepping (D1)** | §3.5 |
| FM-PAT-B2 PR link + post-deploy green proof | **N/A — correctly absent** | separate workstream (§16); nothing FM wired; fail-closed verified (§3.1/§3.4) |
| Legacy spot-check statement | **PASS** | §2 scope guard + `15-legacy-os.png` |
| `localStorage` line ("none — no new keys") | **PASS** | §2 |
| Phone screenshots | **NOT REQUIRED (Phase F)** | — |
| Voice-health | **NOT REQUIRED (no Mya surface touched)** | — |
| Hidden-tab timers pause / no refocus burst (§13) | **TEST-PROVEN; runtime GAP** | instrumented `useTileSource.test.js` (`createCadenceTimer` pause/resume, single catch-up); headless CDP cannot background a tab truthfully |

---

## 5 · Deviations and flags

- **D1 — DEVIATION (needs founder ruling): PLAN §12 step 8 / §11 file scope — the Phase C gallery specimen harness was never implemented.** `src/v2/Gallery.jsx` is untouched by the Phase C diff; `/v2/gallery` renders Phase A/B specimens only. `fixtureTileStates` (13 tiles × 9 states), `Z3RevenueChart`, `Z3FMStatsView`, `Z3SOMCountView` ship but are mounted **nowhere** — consumed only by tests. Blocked §14 items: gallery-harness tile-state screenshots, range-control/draw-in evidence, runtime chart keyboard stepping, "gallery with all Phase C specimens". Mitigations in this document: every reachable state was captured on the **live cockpit surface** via local interception (§3.4), and every state/harness behavior is test-proven. Options: (a) a small follow-up implementation commit on this branch adding the §11-scoped Gallery specimens (`src/v2/Gallery.jsx` was already in the approved file scope), then re-run this harness; (b) accept test-level + live-surface proof for this gate. Recommendation: (a) — the plan named the gallery harness explicitly in the proof package.
- **D2 — GAP: deploy-preview URL** requires branch push + Netlify preview; no git mutations were authorized in this environment. To be attached by the human at push time; re-running `node scripts/mosv2-c-validation.mjs` against the preview URL is a one-line change (`PREVIEW_URL`).
- **D3 — GAP: hidden-tab cadence behavior** is test-instrumented only (timers pause, single catch-up, no burst); not runtime-reproducible in headless Chrome.
- **D4 — GAP: Z5 failure toast** cannot occur at runtime (the only dispatcher is deterministic zero-network success; the live POST is intentionally unshipped). Failure toast, exactly-once, no auto-retry: `z5.test.js`.
- **F5 — FLAG (pre-existing, out of scope):** legacy `index.html` loads Google Fonts and jsdelivr Chart.js on every route, including `/v2/*` (captured in §3.1 `thirdParty` arrays). `index.html` is byte-identical to baseline and protected; v2 code issues zero third-party requests. Recorded for awareness; no action taken.
- **F6 — Human visual review still required:** design-fidelity judgment vs the mockups (1440px) is the Fable review stage; the screenshots in `docs/vault/evidence/mosv2-c-validation/` are the review surface. This stage verified behavior, states, and truthfulness — not pixel fidelity.
- **F7 — FOLLOW-UP DEFECT (Phase C surface, found by runtime validation; NOT fixed here per workstream-isolation — repair needs explicit approval):** the Z5 dispatch toast renders **entirely below the fold** on a populated home at 1440×900 — invisible to the user. It is anchored to the Quick Actions **zone's** bottom-right instead of the viewport's. **File/line:** `src/v2/shell/shell.css:134` (`@keyframes v2-zone-in { to { opacity: 1; transform: translateY(0); } }`) consumed by `.v2-zone` (`shell.css:78`) with `animation … forwards`. **Symptom (measured):** `.v2-toast-region` (`components.css:66`, `position: fixed; right: 22px; bottom: 22px; z-index 20`) renders inside `.v2-zone--5`; the retained identity transform (`getComputedStyle: matrix(1,0,0,1,0,0)`) makes the zone a containing block for fixed descendants, so the toast pins to the zone's bottom edge — populated at innerHeight 900: toast rect top 923 / bottom 969, fully below the viewport (empty-state page: zone bottom 848 → toast bottom 825, 12px clipped at 813). The toast is the only feedback for the only Phase C write. **Suspected cause / minimal fix:** end the keyframe at `transform: none` (interpolates identically, fill holds `none`, no containing block) — one token; alternative: portal the toast to `document.body`. The DOM assertion (copy, tone, auto-dismiss) passes regardless — this is purely positional. `05-z5-toast-success.png` is captured scrolled to the toast, so it documents both the success copy and the wrong anchor point.
- **F8 — FOLLOW-UP VISUAL (Phase C surface, for Fable review; NOT fixed — pixels are design-locked):** at exactly 1440px viewport the fifth quick-action button (Capture idea) is clipped inside the Z5 zone. Measured: `.v2-zone--5` is 316px wide (grid span 3 of 12, `shell.css:83`); `.v2-qa` is `grid-template-columns: repeat(5, 1fr)` (`zones.css:205`) with content scrollWidth 384px in a 274px box; the 3-column collapse (`zones.css:206`) engages only ≤1380px viewport, and 1440 > 1380. No page-level horizontal scroll (`scrollWidth` 1436) — the button is silently cut. Evidence: `02-home-populated.png` right edge.
- Prior flags carried from the failure/perf proof (Phase B `width`/`box-shadow` keyframe exceptions, pinned in `perf-proof.test.js`) are unchanged.
- No placeholders introduced; no new runtime dependencies; no `localStorage` keys added; no production source file modified by this stage.

---

*— MOSV2-C complete validation · evidence for PR #25 · Motesart Execution Engine*
