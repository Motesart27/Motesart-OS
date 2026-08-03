# MOSV2-C FAILURE + PERFORMANCE PROOF v1 — governed evidence document (PR #25, branch `feat/mosv2-c-zones`)

Per PLAN v1.1.1 §13 (test plan) and §14 (acceptance criteria and proof package) — the failure-proof and performance-proof items that are provable from the worktree without live network, deploy preview, or a headless browser session. Runtime items (headless console report ×3 routes, CLS readings, flag-off/flag-on network captures, screenshots) are assembled in the complete-validation stage and are explicitly out of scope here.

PLAN reference: `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` §9 (state map) · §13 · §14. Companion evidence: `docs/vault/MOSV2_C_LIVE_FIELD_AUDIT_v1.md` (§3.4/§3.7).

- **Date:** August 3, 2026
- **Head SHA at proof time:** `e545a84` (`feat(MOSV2-C): accessibility and reduced-motion pass`); the two new test files below are uncommitted working-tree additions, per stage instructions.
- **Classification:** Functional (tests + documentation only; zero production-code changes)

---

## 1 · Failure proof

### 1.1 Coverage already in place before this stage (audited, not duplicated)

| §13/§14 requirement | Where it is proven |
|---|---|
| Tile-machine lawful + forbidden transitions (error/offline/stale/partial/b2-pending; populated→empty on refresh failure impossible; no skeleton replay; mock→populated impossible) | `tests/mosv2-c/tileMachine.test.js` |
| Mock → error machine proof and FM pre-B2 fail-closed law (§3.6/§3.8) | `tests/mosv2-c/z3.test.js`, `tests/mosv2-c/useTileSource.test.js` |
| `"status":"mock"` → typed `mock` failure at the fetch layer, marker never stripped | `tests/mosv2-c/apiFetch.test.js` |
| Mock-rejection fixture specimen resolves to error, never populated | `tests/mosv2-c/fixtures.test.js` |
| All nine canonical tile states as FIXTURE-labeled specimens per tile | `tests/mosv2-c/fixtures.test.js`, `z3.test.js`, `z4.test.js` |
| Z5 dispatch failure ⇒ ruled crit toast "couldn't route — try again", exactly once, no auto-retry | `tests/mosv2-c/z5.test.js` |
| Silent-refresh failure ⇒ stale with last-good retained; one catch-up after hidden tab, never a burst (9.3) | `tests/mosv2-c/useTileSource.test.js` |
| 401/403 ⇒ typed `permission` failure, never thrown (9.5 fetch layer) | `tests/mosv2-c/apiFetch.test.js` |
| Permission failure ⇒ `permission-denied` without last-good, `stale` with last-good | `tests/mosv2-c/tileMachine.test.js`, `useTileSource.test.js` |
| Deferred/unavailable ruled copy verbatim (SOM / revenue / pre-B2 FM) | `tests/mosv2-c/z3.test.js`, `z4.test.js` |
| Same-origin static guard — no absolute backend/provider URL in any v2 source (§3.5) | `tests/mosv2-c/apiFetch.test.js` |
| Reduced-motion mechanical sweep over every motion-bearing selector | `tests/mosv2-c/a11y.test.js` |
| Ranking-order proof (known-severity fixture → exact rendered order, 7th dropped) | `tests/mosv2-c/fixtures.test.js` |

### 1.2 Gaps closed by this stage — `tests/mosv2-c/failure-proof.test.js` (new, 20 tests)

1. **§13 "mock-rejection tests for every adapter":** pre-stage, mock rejection was proven at the fetch layer (`apiFetch`), the machine layer, and the Z3 FM tile — but not per adapter. The new suite drives a `200 {"status":"mock", …}` response through **all seven read-adapter call paths** (`fetchTasks` plain and `business=Book`, `fetchPulse`, `fetchCalendarEvents`, `fetchHandledLog`, `fetchPersonalTasks`, `fetchBookTasks`) and asserts each resolves `{ ok: false, errorKind: 'mock' }` with the marker payload intact — never `ok`, never rendered. (The dispatch adapter ships no live path by ruling; `z5.test.js` proves that.)
2. **Adapter failure-mapping proof:** `502 → http`, network throw → `offline`, `401 → permission` asserted through every read-adapter call path — typed failures propagate unthrown and unremapped (no adapter swallows or reclassifies a failure).
3. **9.5 tile-local auth failure:** `Tile.jsx` `PERMISSION_DENIED` branch carries the ruled copy verbatim (`Sign-in needed — this tile will resume after you sign in again.`) and the `sign-in needed` announcement; a static scan of all of `src/v2` proves **no global logout or redirect path exists** (no `location.assign/replace/href` mutation, no `localStorage.removeItem/clear`) — an expired `som_token` can only ever degrade one tile.
4. **§14 sanitized-title spot-check (raw vs rendered):** a hostile-looking title (`<img src=x onerror=…> "quoted" & <b>bold</b>`) passes `mapTask` and `mapCalendarEvents` **byte-identical** (sanitization is server-side, packet A6; the client never mutates titles), and a static scan proves `dangerouslySetInnerHTML`/`innerHTML=` exists nowhere in `src/v2` — raw-vs-rendered equality holds by construction.

---

## 2 · Performance proof

### 2.1 Bundle size vs the 80 kB gz ceiling (§14; AGENTS.md performance law)

Command run (head `e545a84` + the two uncommitted test files; tests are not shipped):

```
npm run build   →   vite v5.4.21 building for production... ✓ built in 719ms
```

v2 chunks (content-hashed; the only `V2App` assets — legacy `index`/`App`/`StagingOperatorBridgeApp` chunks are out of scope per the Phase A/B ledger convention):

| Asset | Raw | gzip (vite gzip-size) | gzip (`gzip -c`, measured) |
|---|---|---|---|
| `dist/assets/V2App-Co4EbrAa.js` | 52.67 kB | 15.71 kB | 15.36 kB |
| `dist/assets/V2App-Bsi0NWCt.css` | 37.46 kB | 7.68 kB | 7.52 kB |
| **Combined v2 JS+CSS** | | **23.39 kB** | **22.87 kB** |

- **Phase B cumulative baseline (DEPLOY_LEDGER):** 13.41 kB gz → **Phase C delta: +9.98 kB gz** (vite measure).
- **Cumulative v2: 23.39 kB gz against the ≤ 80 kB ceiling → 56.61 kB headroom (70.8% unused).** Budget holds with Phase D still to come; no flag required.
- Bundle content hashes: JS `V2App-Co4EbrAa` (sha256 `be76b95b…f1d63bbdefeb`), CSS `V2App-Bsi0NWCt` (sha256 `c05353d7…754ae3c`). The v2 surface ships as separate lazy chunks — the flag-off zero-v2-chunk claim is verified by network capture in the validation stage, not here.

### 2.2 Gaps closed by this stage — `tests/mosv2-c/perf-proof.test.js` (new, 7 tests)

1. **60fps rule, mechanical:** every `@keyframes` in the five v2 stylesheets is parsed and its animated properties audited. All animations target compositor (`transform`/`opacity`) or paint-only SVG stroke draw-in (`stroke-dashoffset`/`stroke-dasharray`) properties — **except two pre-existing Phase B deviations, pinned by exact name so any change or new violation fails the suite** (see §3 flags). Infinite (continuous) animations get a stricter transform/opacity-only audit.
2. **Chart draw-in once per mount + range change, never on data refresh:** `Z3Business.jsx` wraps both animated chart paths in `<g key={range}>` — React remounts (and replays the CSS draw-in) only when the range key changes; a silent refresh re-renders the same keyed group in place. The draw animations are proven one-shot (`both`/`forwards`, no `infinite`) and reduced-motion-collapsed.
3. **§14 CLS evidence mechanism ships:** `src/v2/shell/index.jsx` publishes `window.__MOSV2_PHASE_B_PERF__`, observes `{ type: 'layout-shift', buffered: true }`, excludes `hadRecentInput`, and accumulates `proof.cls` + per-entry values — the instrumentation the validation stage reads for CLS numbers across state transitions.

### 2.3 Test totals

```
node --test tests/mosv2-c/*.test.js   →   tests 243 · suites 72 · pass 243 · fail 0
```

(216 pre-stage + 27 new: 20 failure-proof + 7 perf-proof. `npm run test:operator-bridge` re-run after this stage: 127 pass · 0 fail — untouched and still green, per §13.)

---

## 3 · Deviations and flags

1. **FOLLOW-UP (Phase B surface, not changed here):** `@keyframes v2-fill` (`.v2-progress__fill`, `src/v2/components/components.css:52,76`) animates **`width`** — a layout property — against the AGENTS.md 60fps rule. Symptom: progress-bar draw-in recalculates layout for 1.4s on mount. Suspected fix (separate approved workstream; the element already carries `transform-origin: left`): animate `transform: scaleX()` instead. Pinned as a named exception in `perf-proof.test.js` so it cannot grow silently.
2. **FOLLOW-UP (Phase B surface, not changed here):** `@keyframes v2-system-pulse` (`.v2-system-dot`, `src/v2/shell/shell.css:38`) animates **`box-shadow`** infinitely (paint-only, 8px dot — negligible cost, but technically outside transform/opacity). Pinned likewise.
3. **Deferred to the complete-validation stage (out of this stage's scope, no live network/headless run performed):** CLS readings via the shipped observer, headless console report ×3 routes, flag-off zero-request and flag-on request-inventory captures, 1440px/390px screenshots, keyboard-walkthrough recording.
4. **Transition declarations on color/box-shadow/border-color exist** in the v2 stylesheets — these are design-locked hover/press feedback ported verbatim from the mockups (220ms/--ease, tokens are law). They are one-shot transitions, not continuous animations; recorded here for completeness, not flagged as defects.
5. No new runtime dependencies, no new `localStorage` keys, no placeholders. No production source file was modified in this stage — the diff is exactly two test files plus this document.

*— MOSV2-C failure/performance proof · evidence for PR #25*
