# MOSV2-C FABLE DESIGN-FIDELITY REVIEW v1 — exact-head review (PR #25, branch `feat/mosv2-c-zones`)

The design-fidelity stage deferred by `docs/vault/MOSV2_C_COMPLETE_VALIDATION_v1.md` flag **F6** ("design-fidelity judgment vs the mockups (1440px) is the Fable review stage; the screenshots in `docs/vault/evidence/mosv2-c-validation/` are the review surface"). This is a REVIEW artifact only: zero production-code changes, zero fixes; every finding is recorded with file:line and severity, per workstream isolation.

- **Reviewed head SHA (exact-head pin):** `84f65b5abcd9bee3ad5010a38ae0a4d1377a0683` — confirmed via `git rev-parse HEAD` at review time; working tree clean (`git status --porcelain` empty); branch `feat/mosv2-c-zones`. Every verdict below references evidence from this head only.
- **Date:** August 4, 2026
- **Classification:** Architecture (documentation only — this stage adds this one file)
- **Design sources (rank order per AGENTS.md):** `design/v2/MOTES_OS_V2_CODEX_HANDOFF.md` (tokens §1, Phase C scope §2) · `design/v2/motes-os-v2-design-bible.html` · `design/v2/motes-os-v2-desktop.html` (Home zones mockup: ZONE 1–5 markup lines 452–577, recipes lines 143–350)
- **Governing plan/rulings:** `docs/vault/MOSV2_C_CURRENT_MAIN_PLAN_v1.1.1.md` (§7 architecture, §8 per-tile plan, §9 state map, §10 interaction matrix, G1–G10 rulings)
- **Review surface:** the 15 regenerated 1440×900 PNGs + `report.json` in `docs/vault/evidence/mosv2-c-validation/` (regenerated 2026-08-04 after the owner-approved F7/F8 fixes), plus code-level token/copy spot checks at the pinned head.
- **Scope note:** D1 was owner-ruled — the Phase C gallery harness is absent, so the FIXTURE-only renderers (`Z3RevenueChart`, `Z3FMStatsView`, `Z3SOMCountView`) mount nowhere and could be reviewed at code level only, not pixel level.

---

## 1 · Per-area verdicts

| Area | Evidence (this head) | Verdict |
|---|---|---|
| Design tokens | `src/v2/tokens.css:1-29` is byte-equivalent to handoff §1 (surfaces, strokes, ink, accents, dims, Mya locks, geometry, motion, elevation, fonts). No invented values found in `src/v2/zones/zones.css` (all declarations consume tokens or plan-sanctioned literals `rgba(255,255,255,.03/.045)`) | **PASS** |
| Zone entrance choreography | `shell.css:78` + `:134`: `translateY(14px) → none`, `.6s var(--ease)`, stagger `50ms + order*80ms` = mockup `desktop.html:70-76` (0.05/0.13/0.21/0.29/0.37s) exactly | **PASS** |
| Zone labels (G10) | `Home.jsx:17-23`: Today / Projects / Business / Life / Quick Actions — plan-ruled; label styling `shell.css:84-85` = mockup `.zlabel` (11px/600/.14em uppercase text-3 + rule) | **PASS** (label names diverge from mockup — plan-ruled, see O-2) |
| Ruled copy verbatim | `Z3Business.jsx:96,124,288` · `Z1Today.jsx:114` · `Z2Projects.jsx:60,107` · `Z4Personal.jsx:45,87` · `z5QuickActions.js:25,31-35` · `Tile.jsx:111` — every ruled line verified verbatim in source and in `02/06/07/09` PNGs | **PASS** |
| Z1 populated (signals, agenda, handled log) | `02-home-populated.png`: ranked signals with severity Chips, agenda slot, quiet handled line. Ranking order visible (exec > warn > info) matches plan 9.4 | **PASS, with flag FR-2** (signal-row typography) |
| Z2 populated (projects, Book lane, countdowns) | `02`: three business groups with `n/n done` ratios, progress bars, counts; Book lane copy task-based only (G1 — no BK_* claims anywhere) | **PASS** |
| Z3 populated (pulse + ruled unavailability lines) | `02/06/07/09`: pulse rows with tone Chips + tabular counts; revenue/FM/SOM lines render the ruled copies with correct dot tones (good / warn / good) | **PASS** |
| Z4 populated (G3 restricted set) | `02`: Personal tasks with mono due tags + personal calendar row; nothing else present (VitalStack/travel/people correctly absent) | **PASS** |
| Z5 quick actions | Labels, order, and 24×24 stroke-1.7 icons ported verbatim from `desktop.html:571-575` (`z5QuickActions.js:16-22`, `Z5QuickActions.jsx:25-50`); padding 18/8/14, gap 9px, radius `--r-m`, bg `--bg-2` = mockup `.qbtn` recipe; success toast copy `Brain dump → routed to MYA` matches the ruled format incl. mockup arrow style; focus ring visible in `05` | **PASS, with flags FR-1 (toast anchor), FR-2 (label typography), O-1 (grid columns)** |
| Toast copy/tone/auto-dismiss | `05` + `z5QuickActions.js` — ruled copies verbatim, crit/good dots, ~3s dismiss (runtime-verified by validation) | **PASS on content; FR-1 on position** |
| Loading skeletons | `11-home-loading.png`: static lines, exact-geometry reservation, no shimmer/pulse — §9 law; CLS 0.000 per validation §3.3 | **PASS** |
| Quiet-empty states | `07-home-empty.png`: all ruled one-liners with good-t dots; SOM/revenue lines truthful | **PASS** |
| Error state | `06-home-error.png`: crit dot + one line + per-tile retry; no crash, siblings isolated; zone error boundary geometry intact | **PASS, with flag FR-2** (retry-link typography/color) |
| Permission (401) state | `08-home-permission.png`: handled log quietly hidden, no redirect, siblings populated — 9.5 honored | **PASS** |
| Mock-rejection state | `09-home-mock-rejection.png`: pulse tile errors; mock values (99999/11111/88888) never rendered — §3.6 honored | **PASS** |
| Stale state | `10-home-stale.png`: last-good retained, 5px warn-t dot pinned top-right, mono `as of 23:09`, zero skeleton replay — §8 recipe exact | **PASS** |
| Reduced motion | `14-reduced-motion.png`: boot never mounts, all content populated, final-state render — matches mockup RM block (`desktop.html:353-357`) and §9 law | **PASS** |
| Palette / exec-mode / module / legacy / flag-off | `03/04/13/15/01`: Phase A/B surfaces unchanged and consistent with their approved gates; exec active-state button matches mockup `#execbtn` gold fill; zone dimming/exec band correctly absent (Phase E scope) | **PASS** |
| Revenue chart / FM-stats / SOM-count fixture renderers | Unmounted (D1, owner-ruled) — code-level only: range tablist, crosshairs, tooltip, scale labels, draw-in `.9s` ≤ 1.4s law, `stroke-dasharray` draw matches handoff motion rules; chart recipe consistent with mockup `.seg/.stat` patterns | **PASS (code-level); pixel review not possible under D1** |

---

## 2 · Flags (defects found at the reviewed head — recorded, not fixed)

- **FR-1 — HIGH — F7 toast anchoring is NOT resolved at this head; the "RESOLVED" note in the validation doc should be re-opened.** `05-z5-toast-success.png` shows the page scrolled ~200px relative to `02` (topbar and stage heading gone, zone tops shifted up), and the toast sits **22px above the Z5 zone's bottom border and ~23px inside its right border** (measured: toast ≈ x1110–1390 / y715–760; zone right edge ≈ 1413, bottom edge ≈ 780) — not at the viewport corner (right 1418 / bottom 878, which is empty background). A viewport-`position:fixed` element cannot track a scrolled container; the harness can only "scroll to the toast" because the toast is still zone-anchored. Consequence: on the unscrolled populated home (`02`), the Z5 zone bottom is below the 900px fold, so the toast — the only feedback for the only Phase C write — still renders **below the fold**, the original F7 symptom. Disagrees with the mockup: `#toasts` is a body-level, viewport-fixed region (`design/v2/motes-os-v2-desktop.html:342`, `right:22px; bottom:22px; z-index:170`). Contributing structure (recorded for the repair stage, per F7's own alternative): the Toast is rendered inline inside `.v2-zone--5` (`src/v2/zones/Z5QuickActions.jsx:100-102` → `.v2-toast-region` `position:fixed` at `src/v2/components/components.css:66`), while `.v2-zone` retains a transform-bearing entrance (`src/v2/shell/shell.css:78`, keyframe `:134` now ending at `transform:none` — the fill-forwards animation on transform remains the containing-block suspect; the owner-approved one-token fix did not produce viewport anchoring at runtime). Secondary: toast `z-index:20` (`components.css:66`) sits below the Mya bar (`35`) and far below the mockup's `170` — no visual conflict at 1440px, recorded for completeness.
- **FR-2 — HIGH — Phase B's button reset silently overrides every Phase C control's typography and two of its colors.** `src/v2/shell/shell.css:7-8` (`.v2-shell button, .v2-shell input { font: inherit; }` / `.v2-shell button { color: inherit; }`, specificity 0-1-1) beat the Phase C class rules (0-1-0), so the intended values never render. Measured on the PNGs against the unaffected 12px `Open Work →` link (cap height ≈8.5px) — button text cap heights measure ≈11px (≈16px inherited):
  - `.v2-tile__retry` (`src/v2/zones/zones.css:27-31`) — intended 600 11.5px `--info-t`; renders ~16px `--text-1` (visible in `06`/`09`: "Retry ↻" is large and bright instead of small blue). Plan §8/§10 error recipe not met.
  - `.v2-qbtn` (`zones.css:206-213`) — intended 600 12px `--text-2`; renders ~16px `--text-1` (`02`: quick-action labels visibly larger/brighter than the mockup `.qbtn`, `desktop.html:263-269`).
  - `.v2-signal-row` (`zones.css:75-80`) — intended 13px; renders ~16px (`02`: feed rows heavier than the mockup's 13.5px `.feed`, `desktop.html:175-186`; color happens to survive via inheritance).
  - `.v2-chart__range` (`zones.css:155-159`) — intended 600 11px; same exposure (fixture-only, unmounted under D1 — no pixel evidence, code-certain).
  Net effect: Home's interactive text is uniformly larger and heavier than the locked mockup, and the retry affordance loses its `--info-t` identity. Not caught by tests (node:test has no layout engine) or by the validation stage (behavioral, not pixel).
- **O-1 — NOTE (mockup disagreement, owner-approved fix) — quick-actions grid.** F8's fix sets `.v2-qa` to `repeat(3, 1fr)` at all widths (`zones.css:205`, defective ≤1380px query removed). The mockup is `repeat(5,1fr)` down to 1380px and `repeat(3,1fr)` below (`desktop.html:261-262`) — inside a span-5 zone, however, not the shipped span-3 zone (plan §7 reuses the Phase B `v2-zone--1..5` containers). Five columns cannot fit 316px; the fix matches the mockup's own narrow-width arrangement. `02` confirms all five actions fully rendered at 1440px. Recorded; no action.
- **O-2 — NOTE (plan-sanctioned mockup divergences, recorded for traceability; no action):** zone grid 7/5/5/4/3 vs the mockup's 12-hero/7/5/7/5 (plan §7 — Phase B containers govern) · zone labels Today/Projects/Business/Life vs mockup Projects/Business Health/Personal (plan §8 headings + G10) · severity rendered as text Chips instead of the mockup's colored signal dots (9.1/§10 never-color-alone law) · mockup Z1 hero sub-line ("Mya read the field — 6 signals…"), agenda chip row, and "✓ Handled while you were away · View log →" bar are not Phase C tiles (plan §8 Z1 tile set governs) · mockup Z3's big revenue number, 7D/30D/QTD live seg, and sparkline stat tiles are ruled unavailability displays pre-B2 (G2/G4/§3.8) · handled-log copy "Handled quietly: ‹summary›" per plan, not the mockup bar.
- **O-3 — NIT (mockup disagreement, plan silent):** agenda time format renders `6:30 AM` (`z1Agenda.js:34-38`, Intl `hour:'numeric'`) vs the mockup's mono 24h-style `9:00` (`desktop.html:198`). Mono typeface matches; the plan does not lock the format. Recorded.
- **Limitation:** under owner-ruled D1, the revenue chart, FM-stats, and SOM-count fixture renderers have no mounted pixels to review; verdicts for them are code-level only. If a follow-up mounts the gallery specimens, this review should be re-run for those surfaces.

---

## 3 · Review outcome

**APPROVED-WITH-FLAGS** — the head matches the locked design in tokens, choreography, copy, state visuals, and zone composition, but two material fidelity defects stand at `84f65b5`: **FR-1** (dispatch toast still not viewport-anchored; invisible below the fold on the populated home — re-opens validation flag F7) and **FR-2** (button-reset specificity overrides Phase C control typography/colors). Both are Phase C surfaces; per workstream isolation, repairs require explicit owner approval before any implementation stage touches them. No other flags block the design gate.

No placeholders introduced; no production source modified by this stage; no git mutations performed (this file is left uncommitted per stage rules); no tests/builds re-run (tree clean, head unmoved, suites validated at this head by the prior stage: 245 mosv2-c pass, 127 operator-bridge pass, build clean).

---

*— MOSV2-C Fable design-fidelity review · exact-head `84f65b5` · evidence for PR #25 · Motesart Execution Engine*

---

## ADDENDUM · RE-REVIEW AT EXACT HEAD `dd3fe20` (2026-08-04)

**Reviewed head SHA (exact-head pin):** `dd3fe208bada2f7ea25b9da078bbb381f86a554b` — confirmed via `git rev-parse HEAD`; tree clean before this addendum; branch `feat/mosv2-c-zones`. Scope of the re-review: closure of FR-1 and FR-2 (repaired in `dd3fe20` after owner approval), plus a regression sweep of the earlier notes against the regenerated evidence (full harness re-run, all 15 PNGs + `report.json`). Every verdict below references evidence from this head only.

### FR-1 — CLOSED (verified at code, runtime-measurement, and pixel level)

- **Code:** the Toast region now portals to `document.body` via `createPortal` (`src/v2/components/index.jsx`, Toast return) — the mockup's own structure (body-level `#toasts`, `desktop.html:342,610`), immune to any ancestor containing-block trigger by construction. `.v2-toast-region` keeps `position: fixed; right: 22px; bottom: 22px` (`components.css:66`).
- **Runtime measurement:** `report.json → scenarios.keyboard-walkthrough.toastViewportAnchor`: `portaledToBody: true`, rect right **1418** / bottom **878** at viewport 1440×900 with `scrollY: 0` — exactly the mockup's 22px/22px viewport inset; `atViewportCorner: true`.
- **Pixels:** regenerated `05-z5-toast-success.png` is the **unscrolled** populated home (topbar and stage heading visible); the toast renders at the true viewport bottom-right, fully in-frame, with the ruled copy "Brain dump → routed to MYA", good-tone dot, and the focus ring still on the dispatching qbtn. The zone-anchoring evidence from `84f65b5` is gone.
- **Regression coverage:** `tests/mosv2-c/a11y.test.js` — portal assertion + region position assertion.

### FR-2 — CLOSED (verified at code and pixel level)

- **Code:** the reset is now `:where(.v2-shell) button/input { font: inherit; }` / `:where(.v2-shell) button { color: inherit; }` (`src/v2/shell/shell.css:7-10`) — specificity 0-0-1, so it still neutralizes UA button defaults but loses to every `.v2-*` class rule. Correct minimal repair; no component rule was touched.
- **Pixels (re-measured against the unaffected 12px `Open Work →` link, cap ≈8.5px):**
  - `.v2-qbtn` labels (`02-home-populated.png`): cap height ≈8–9px → **12px**, and now the dimmer `--text-2` — matches the mockup `.qbtn` (`desktop.html:263-269`). Was ~16px `--text-1`.
  - `.v2-tile__retry` (`06-home-error.png`): "Retry ↻" now renders **small and `--info-t` blue**, cap ≈8px → 11.5px — the §8/§10 error recipe. Was ~16px `--text-1`.
  - `.v2-signal-row` (`02`): feed summaries cap ≈9px → **13px** (mockup `.feed` 13.5px). Was ~16px.
  - `.v2-chart__range`: unmounted under D1; closure is code-certain (same cascade) and pinned by test.
- **Regression coverage:** two new `a11y.test.js` tests pin the `:where()` specificity and the four controls' ruled typography/colors.

### Regression sweep of prior notes at `dd3fe20`

- **O-1 (qa grid)** unchanged — `repeat(3,1fr)`, all five actions fully rendered in `02`; note stands as recorded.
- **O-2 (plan-sanctioned divergences)** unchanged — grid spans, G10 labels, severity Chips, ruled unavailability tiles all as before in the regenerated `02/06/07/09/10/11`.
- **O-3 (agenda time format)** unchanged — `6:30 AM` in `02`; nit stands.
- **Collateral from the `:where()` change:** Phase A/B surfaces re-checked — `03-palette-open.png` (input, mic, footer, MYA · READY) and `12-gallery-full.png` (785-byte delta ≈ identical) show no typography shift; gallery, module, legacy, flag-off, stale, permission, mock-rejection, and reduced-motion shots regenerated with no new deviations observed. Suite re-run by the repair stage: **247 mosv2-c pass / 0 fail**, build clean (not re-run here — tree clean, head unmoved).
- **Validation doc:** F7 entry now carries the RE-OPENED (FR-1) / RE-RESOLVED history — consistent with this review's record.

### Final verdict at `dd3fe20`

**APPROVED.** Both HIGH flags are verifiably closed — FR-1 by body-level portal with measured viewport anchoring, FR-2 by a zero-specificity reset with pixel-confirmed 12px/11.5px/13px control typography. The remaining notes (O-1, O-2, O-3) are owner-approved or plan-sanctioned divergences, not defects. The head matches the locked mockups in tokens, layout, choreography, typography, color, copy, and state visuals across every reviewable surface; the D1-unmounted fixture renderers remain code-level-approved only. No production code was modified by this re-review; this addendum is left uncommitted per stage rules.

*— Re-review addendum · exact-head `dd3fe20` · MOSV2-C Fable design-fidelity review · PR #25*
