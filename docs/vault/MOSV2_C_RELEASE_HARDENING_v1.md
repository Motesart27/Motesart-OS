# MOSV2-C · Lane E Release Hardening — Validation Record v1.0

**Frozen matrix:** `LANE_E_HARDENING_ACCEPTANCE_MATRIX_v1.0-FROZEN.md` (2026-08-04, SHA-256 `50d4d26c…8531`)
**Base:** `0f8f24017ed837a9d3692c00f44ea06713098c85` · **Branch:** `fix/mosv2-c-release-hardening` · **Sole writer:** Kimi Code
**Scope fence:** `tests/mosv2-c/scope.test.js` proves the diff is confined to the authorized file list; `package.json` carries exactly one added line (the `test:mosv2-c` alias); zero dependency or lockfile movement.

## Matrix item-by-item closure (12/12)

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Phase C suite green | **PASS — 291/291** (247 baseline + 44 new) | `node --test tests/mosv2-c/*.test.js` |
| 2 | Operator-bridge regression fence | **PASS — 160/160**, normal (non-sandboxed) environment, suite untouched | `npm run test:operator-bridge` |
| 3 | npm alias | **PASS** — `"test:mosv2-c": "node --test tests/mosv2-c/*.test.js"` is the ONLY package.json change | `scope.test.js` (alias-shape assertion) |
| 4 | Fixed-clock harness | **PASS** — fixed clock is the default; page `Date` pinned to `FIXTURE_NOW_ISO` + America/New_York emulated; 12 per-scenario drift assertions per run; real clock only via `--real-clock` / `MOSV2_REAL_CLOCK=1`; CLI tests cover both modes. Ran green on wall date 2026-08-05 (≠ 2026-08-02) | `scripts/mosv2-c-validation.mjs`, `harness-config.test.js`, `report.json → run.clock` |
| 5 | Deterministic build ×2, zero warnings, harness FAILS on warnings | **PASS** — two builds byte-identical (`build-repro.test.js` hashes every dist file); zero build warnings; console gate now fails the run on any unexpected error/**warning**/exception (previously capture-only) | `build-repro.test.js`, harness `consoleGate` (0 findings, 0 unexpected) |
| 6 | D1 Gallery specimen harness | **PASS** — Gallery mounts all 12 `fixtureTileStates` sets × 9 canonical states (108 specimens) + §3.6 mock rejection + 3 Z5 dispatch outcomes through the production `Tile`; `Z3RevenueChart`/`Z3FMStatsView`/`Z3SOMCountView` render in every content state. DOM test mounts every fixture state with **zero console errors and zero warnings**; browser scenario enforces the same counts in the production build | `src/v2/Gallery.jsx`, `gallery.test.js`, `report.json → scenarios.gallery.coverage` (112/109/4/12/4) |
| 7 | Evidence hashes | **PASS** — `manifest.json` records sha256 for every artifact; `report.json` is CANONICAL (no wall-clock fields; byte-reproduction test re-hashes the committed file); PNGs carry a written NON-CANONICAL classification (compositor frame timing; assertions live in report.json) | `manifest.json`, `evidence-hash.test.js` |
| 8 | Boundary scans | **PASS** — secret scan (added lines, high-signal shapes) clean; protected-boundary scan clean (lockfile, netlify.toml, operator-bridge, staging-control-plane, scripts/tests outside scope); scripted diff-confinement green | `scope.test.js` |
| 9 | D2 deploy-preview evidence | **PASS (mechanism + PR output)** — `PREVIEW_URL` env override implemented and CLI-tested; port is dynamically allocated; browser discovered via env → well-known paths → PATH. At draft-PR time the harness is re-run against the Netlify deploy preview and the output is attached to the PR | `harness-config.test.js`, PR body/comment |
| 10 | D4 Z5 failure evidence | **PASS (injection)** — mounted injection harness, call-counted: typed failure result AND throwing dispatcher ⇒ exactly one ruled crit toast ("couldn't route — try again"), **zero retries** (no call without a click), one toast per dispatch (never stacked), no disabled state, auto-dismiss ~3 s | `z5-dispatch-injection.test.js` (5 tests) |
| 11 | D3 hidden-tab cadence | **PASS (instrumented + written classification)** — mounted instrumentation drives real `visibilitychange` cycles through the production hook: ZERO fetches while hidden, EXACTLY ONE catch-up on show, no burst, listener removed on unmount; injected-timer pure tests retained | `visibility-cadence.test.js`, classification below |
| 12 | Permission/lifecycle coverage | **PASS** — see the per-lifecycle table below; every row implemented in the browser harness (no out-of-scope rows) | `report.json → scenarios.home-{permission,permission-broad,parse-failure,timeout,offline-retry}` |

## Matrix §12 per-lifecycle coverage

| Lifecycle | Status | Evidence |
|---|---|---|
| 401 handled log only (baseline) | retained | `home-permission` scenario |
| 401 on EVERY tile source (tasks/pulse/calendar/audit) | **implemented** — 7 tiles permission-denied, no redirect, no logout, session retained, 7 retry controls | `home-permission-broad` |
| Malformed JSON wire payload (parse) | **implemented** — pulse enters ruled error state via apiFetch `errorKind:"parse"`; 6 siblings populated; kind mapping unit-tested in `apiFetch.test.js` | `home-parse-failure` |
| Slow source > 15 s ceiling (timeout) | **implemented** — pulse enters ruled error state at 15,121 ms measured on the harness wall clock; 6 siblings populated | `home-timeout` |
| Network-layer failure (offline) | **implemented** — `Fetch.failRequest(InternetDisconnected)` ⇒ 7 tiles offline, zero skeleton replay | `home-offline-retry` (offline phase) |
| Retry lifecycle (recover after failure) | **implemented** — network restored + tile-local Retry click ⇒ tile recovers to populated; human retry only (no auto-retry anywhere — D4 proves zero retries on Z5) | `home-offline-retry` (recovery phase) |

## D3 written classification (headless limits)

The mounted instrumentation in `visibility-cadence.test.js` proves the app-level contract against the genuine `visibilitychange` signal (subscription, pause-to-zero, single catch-up, no burst, cleanup). Real-browser background-tab timer throttling (Chrome clamps background timers to ≥1 s and may freeze tabs entirely) is **browser policy, not app behavior**, and cannot be faithfully reproduced in a headless harness; the app's correctness condition — *a hidden interval never produces a fetch burst on return* — is fully covered by the instrumentation plus the retained injected-timer tests (`useTileSource.test.js` 127–192).

## Bundle measurement vs the 80 kB gz ceiling (§14)

Build at the Lane E head (two consecutive builds byte-identical; `build-repro.test.js`):

| Asset | Raw | gzip (`gzip -c`, measured) | sha256 (first 16) |
|---|---|---|---|
| `dist/assets/V2App-kpPOizOX.js` | 73,958 B | 21,523 B | `f7ed3458f337aca7` |
| `dist/assets/V2App-Dd2XY4UL.css` | 38,310 B | 7,819 B | `9c6779e98335af32` |
| **Combined v2 JS+CSS** | | **29,342 B (28.65 kB)** | |

(Chunk file names are content-addressed and embed the build-time `__OPERATOR_BRIDGE_BUILD_HEAD__`, so the JS chunk name shifts with each head while raw/gzip stay constant — the reproduction gate is `build-repro.test.js`: two builds at the same head are byte-identical.)

Phase C cumulative baseline 23.39 kB gz → **Lane E cumulative: 28.65 kB gz vs ≤ 80 kB ceiling → 51.35 kB headroom (64% unused).** Budget holds. (Growth is the D1 specimen harness, which lives in the Gallery route inside the measured V2App chunk.)

## Validation battery at the hardening head

| Check | Result |
|---|---|
| Phase C suite `node --test tests/mosv2-c/*.test.js` | **291/291 pass** |
| `npm run test:mosv2-c` (alias) | identical suite, green |
| Operator-bridge suite | **160/160 pass** |
| Production build | vite ✓, zero warnings |
| Deterministic build ×2 | byte-identical dist trees |
| Runtime harness (fixed clock, dynamic port) | **17/17 scenarios**, console gate 0 findings / 0 unexpected, 12 drift checks, zero drift |
| Accessibility + reduced motion | `a11y.test.js` green; `reduced-motion` scenario green (boot skipped, media matched, motion collapsed) |
| Secret scan + protected-boundary scan | clean (`scope.test.js`) |
| Real Z5 action | **none** — fixtures/injection only; static no-live-submission scans (`z5.test.js`) still green |
| Production V2 | **OFF** — flag-off scenario: no runtime override, `/v2/home` resolves to `/`, zero V2 chunk requests |

## Reproduction

```
npm ci
node --test tests/mosv2-c/*.test.js        # 291/291
npm run test:mosv2-c                        # alias, identical
npm run test:operator-bridge                # 160/160
npm run build                               # zero warnings
node scripts/mosv2-c-validation.mjs         # fixed clock, dynamic port, local preview
PREVIEW_URL=<url> node scripts/mosv2-c-validation.mjs   # external preview (deploy-preview evidence)
node scripts/mosv2-c-validation.mjs --print-config      # resolved config without a run
```
