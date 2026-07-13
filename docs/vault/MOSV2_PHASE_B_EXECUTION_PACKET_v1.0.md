# MOSV2_PHASE_B_EXECUTION_PACKET.md — CANONICAL PHASE B EXECUTION PACKET

---

## 0 · DOCUMENT CONTROL

| Field | Value |
|---|---|
| **Title** | MOSV2_PHASE_B_EXECUTION_PACKET.md — the single canonical packet for planning and implementing Motes OS v2 Phase B (Shell) |
| **Version** | 1.0 |
| **Date** | July 12, 2026 |
| **Status** | **FOR DENARIUS APPROVAL** |
| **Owning seat** | Chief Architect |
| **Workstream** | **MOSV2-B** |
| **Repository** | `Motesart27/Motesart-OS` |
| **Required baseline main SHA** | `a5073deaabf4f4db910178ae692acb77bb61b2d2` (post-Phase-A merge + central AUTH-401 closure PR #11). Codex verifies main is at this SHA before branching; any drift ⇒ STOP, report |
| **Supersedes** | No document. Instantiates settled law for one phase; changes no law, resolves no open decision (the §7 items resolve only by Denarius's recorded calls) |
| **Governing sources (versions)** | 1. CODEX_EXECUTION_ORDERS **v1.1** · 2. MOTES_OS_V2_CODEX_HANDOFF **v1.1** · 3. motes-os-v2-design-bible **v1.1 ACTIVE** (Jul 12; supersedes v1.0 in full) · 4. DESIGN_QA_RUBRIC **v1.0 ACTIVE** · 5. ARCHITECTURE_DECISION_REGISTER **v1.1 ACTIVE** · 6. VAULT_INDEX **v1.0 ACTIVE** · 7. desktop + phone reference mockups (versionless reference class) · 8. BUILD_START_COMMAND_PLAN v1.0 (AUTH-401 closure record) · 9. DESIGN_QA_PHASE_A_PR9_REVIEW_R3 v1.0 (Phase A closure + F-1 + console-gate ruling) |
| **Source-read confirmation** | All sources above read **at file level** for this packet, July 12, 2026: Orders in full (PART 0–3); Handoff in full (§0–§5); Bible v1.1 §0–§12 + footer; Rubric in full; ADR v1.1 §0–§5 + DB-C5 full text + §13–§16; VAULT_INDEX authority sections; GROUND_TRUTH_RECONCILIATION_LEDGER v1.0 in full; BUILD_START_COMMAND_PLAN v1.0 in full; desktop mockup anatomy verified at CSS/JS line level (rail L79/L82, topbar L116, stage L144, grid L145, MyaBar L272, toasts L342, boot L638). **PROJECT_BRAIN.md and DEPLOY_LEDGER.md are not in the vault** — they live in the repo; their Phase A closure entries are expected per ADR-IMP11 and are verified by Codex at session start, not from this seat. Live repo/deploy state is not verifiable from this seat (FABLE_HANDOFF §2.5); closure SHAs and PR numbers recorded as Denarius supplied them |

---

## 1 · PHASE B PURPOSE

Phase B builds the **persistent cockpit shell** — the frame every later phase mounts into: navigation rail, top bar, stage grid, boot sequence, MyaBar, empty command-palette shell, and placeholder module routes. It exists so that Phase C's zones, Phase D's palette internals, and Phase E's modes land inside an already-proven, already-accessible, zero-CLS shell instead of building scaffolding and features simultaneously (Handoff §2-B; Orders P2-B; ADR-OS3: strictly ordered gated phases). Phase B is **Visual classification, zero data**: nothing fetches, nothing writes, Mya's pipeline is untouched — the shell only has to be exactly right.

---

## 2 · EXACT CANONICAL PHASE B PROMPT

Verbatim from CODEX_EXECUTION_ORDERS v1.1, PART 2, "▶ PHASE B — Shell" (the ```text block, quoted without alteration):

```text
PHASE B — Shell. Branch feat/mosv2-b-shell. Reference: handoff §2 Phase B; port
structure and timings from design/v2/motes-os-v2-desktop.html (rail, topbar, boot).

Build: RailNav (64px, hover/focus-within expands to 216px as an OVERLAY — stage must
not reflow; purple active beacon; bottom: system pulse, settings, identity),
TopBar (search pill with ⌘K hint, focus-switcher segmented control [visual only this
phase], EXEC button [visual only], bell), Stage (12-col grid, 24px gutters, max 1560px),
boot sequence (wordmark + orb, ≤1.6s, click-skip, absent under reduced-motion),
MyaBar (bottom-center, opens an empty palette shell on Space/⌘K/click; Esc closes;
focus trapped while open).
Route /v2/{home,mya,exec,work,life,som,book,money,crm} — placeholder screens using the
L2 workspace template from the bible (header + KPI strip skeleton + worklist/context-rail
skeleton). Zone containers on /v2/home with the 60ms stagger entrance, empty.

Definition of done: AGENTS.md checklist, plus — keyboard-only video/walkthrough notes
(tab through rail, open/close palette shell, E toggles a stub exec class), zero CLS
during boot and rail hover (measure), screenshots: home skeleton, rail expanded,
palette shell open.
Stop at the gate.
```

**Amendments and controlling interpretations** (each shows: original → amendment → source → controlling final reading):

| # | Original prompt text | Amendment | Source | Controlling final interpretation |
|---|---|---|---|---|
| A1 | "the 60ms stagger entrance" | Zone entrance = rise 14px + fade, .6s `--ease`, delays **50/130/210/290/370ms (80ms cadence)** — the mockup's exact timing; "60ms" is prose approximation | Bible v1.1 §5 (Zone entrance row) + §12.1 ruling **DB-C2**, Denarius-approved | Build the 80ms cadence. The 60ms phrase is dead prose |
| A2 | "Stage (12-col grid, 24px gutters, max 1560px)" | 24px **is law** (handoff rank 1); the desktop reference renders `gap:18px` (recorded deviation **DB-D2**, mockup L145 verified). Ruling **DB-C5** makes surfacing **mandatory**: "Phase B's PLAN comment must open with this ruling request, and the Stage may not be built past that point without his recorded call" | Bible v1.1 §3 Grid + §12.1-C5 + §12.2-D2; ADR v1.1 DB-C5 full text + §13.2 | The Stage gutter value is **decided by Denarius at the PLAN gate** (§7.1 below) before the Stage is built. Every other Stage value (12-col, 1560px max, offsets) builds as written |
| A3 | "boot sequence (wordmark + orb, ≤1.6s, …)" | Clarification, not conflict: **1.5s is the design duration** (mockup-exact: `setTimeout(boot, reduced?50:1500)`, L638); **1.6s is the hard ceiling**. Both bind | Bible v1.1 §5 Boot row + §12.1 ruling **DB-C1** | Auto-advance at 1500ms; never exceed 1600ms; click-skip anytime |
| A4 | "absent under reduced-motion" (boot) | The mockup implements reduced motion as a 50ms timeout (near-instant demo shorthand); the **law is "absent entirely"** | Bible v1.1 §5 Reduced-motion rule + Boot row; mockup L638 | Under `prefers-reduced-motion`, the boot overlay does not appear at all — do not port the 50ms shorthand |
| A5 | "empty palette shell … focus trapped while open" | The static mockup does **not** implement the trap or exact focus restore — recorded gap **DB-G3**. Law stands; implementation + keyboard evidence are owed at this gate (and D) | Bible v1.1 §7 Focus containment + §12.3-G3; ADR §13 preamble (G3 = obligation, not open decision) | Codex implements trap + exact-element focus restore from scratch; mockup silence is not permission |
| A6 | (palette shell, unstated timing) | The ≤120ms interactive gate (ruling DB-C3) is **measured at Phase D**, where the palette gains contents; Phase B's shell ports the §5 entrance motion (veil fade + sheet scale .97→1, `--t-med --ease`) | Bible v1.1 §5 Palette row + §12.1-C3; Orders P2-D DoD | B ships the correct motion; D ships the measured 120ms proof |

---

## 3 · PRECONDITIONS — ALL CONFIRMED

| Precondition | Status | Basis |
|---|---|---|
| Phase A complete | ✅ | Denarius (this tasking); Motesart-OS main at `a5073de…`; Phase A closed READY FOR APPROVAL at R3 review and merged by Denarius |
| SOM-AUTH-401 closed | ✅ | Closed July 11, NOT-A-FAULT (BUILD_START_COMMAND_PLAN §1); closure records: SOM backend main `566f68a…`, backend PR #19, central PR #11 (Denarius-supplied) |
| Design Bible v1.1 controlling | ✅ | ACTIVE Jul 12, supersedes v1.0 in full (footer activation record); rubric §2.2 version guard satisfied |
| QA Rubric v1.0 controlling | ✅ | ACTIVE Jul 11 (rubric §0) |
| Foundation Gallery permanent | ✅ | Orders P2-A item 3: "permanent visual-regression surface — keep it updated in every later phase"; R3 made it the Phase B review's opening check |
| Production `VITE_MOS_V2` remains **false** | ✅ | Denarius-stated; flag concept `MOS_V2` (Orders PART 1) implemented as the Vite env flag in Phase A. Phase B changes nothing about production flag state |
| Phase B not started | ✅ | Denarius-stated; no `feat/mosv2-b-shell` branch exists |
| No open gate blocking planning | ✅ | The only Phase-B-tagged open decision (§13.2 stage gutter) is resolved *inside* the Phase B PLAN gate by design — it blocks the Stage build step, not planning. F-1 (shell meta) is excluded scope (§5). SOM-HEALTH false-RED was a different repo and is closed |

---

## 4 · EXACT ALLOWED SCOPE

All items below are the settled Phase B shell (Orders P2-B; Handoff §2-B; Bible §3/§4/§5/§7/§8). Nothing else ships in MOSV2-B.

1. **Collapsed navigation rail** — 64px fixed left (Bible §3 Rail).
2. **Expanded navigation rail** — 216px on hover *or* focus-within, gaining `--e3` (Bible §3).
3. **Rail overlay behavior** — fixed overlay; stage margin stays 64px; zero reflow, zero CLS, measured (Bible §3 Rail + CLS rule; Rubric §9-B).
4. **Top bar** — 64px sticky glass bar: title + dateline · search pill (⌘K hint) · focus switcher (visual only) · EXEC button (visual only, stub class toggle on E) · bell (static badge) (Bible §3 Top bar; Orders P2-B).
5. **Stage shell/grid** — 12-col, max 1560px, offset/padding per Bible §3 Geometry; gutter per Denarius's §7.1 call; ambience = exactly two fixed radial gradients (Bible §3 Ambience).
6. **Boot sequence** — wordmark + breathing orb, 1.5s design / ≤1.6s ceiling, click-skip, absent under reduced motion (Bible §5 Boot; DB-C1).
7. **MyaBar visual shell** — bottom-center pill per Bible §4 MyaBar recipe; press/click/Space/⌘K opens the empty palette shell (no voice behavior — that is Phase D law).
8. **Command-palette visual shell** — veil + sheet + pin row + footer per Bible §4 Command palette, **empty** (no index, no results, no mic behavior); Esc closes; focus trapped while open; exact focus restore on close (Bible §7; DB-G3 obligation).
9. **Placeholder module routes** — `/v2/{home,mya,exec,work,life,som,book,money,crm}` using the L2 skeleton exactly as prose-defined: header + KPI strip skeleton + worklist/context-rail skeleton — **skeletons only, no elaboration** (Handoff §2-B; Bible §3 L2 / DB-G1; ADR §13.3).
10. **Zone containers on /v2/home** — empty, entering with the DB-C2 stagger (80ms cadence).
11. **Shell accessibility** — full §7 gate set as applicable: focus ring 2px `--info`/2px offset everywhere; Tab-reachable rail; Space/⌘K suppressed while typing; Esc semantics; `aria-pressed` on EXEC stub; `aria-current` on active rail item; contrast floor (Bible §7).
12. **Reduced-motion behavior** — boot absent; zone entrance instant; breathing stopped; transitions collapse (Bible §5 Reduced motion; §7).
13. **Shell performance and CLS controls** — transform/opacity-only animation (+R-2 rail-width exception); zero CLS during boot and rail hover, instrumented, not eyeballed (Bible §5 R-1/R-2, §11; Rubric §9-B).
14. **Permanent /v2 Foundation Gallery preservation** — Phase A gallery still renders clean; Phase B shell components added to it in every applicable state (Orders P2-A item 3; Bible §4 lede).

## 5 · EXACT EXCLUDED SCOPE

Explicitly out, with the rule that owns each: **live data / any fetching** (Phase C; Phase B is Visual-only) · **dashboard data zones** (Phase C — B ships empty containers only) · **Executive Brief Engine** (Phase G, hard-gated on its spec) · **real executive routing** (module screens are skeletons; rail routes to placeholders — Bible §8 Module placeholders) · **backend work of any kind** (wrong repo, wrong classification) · **auth work** (protected register row 1; AUTH-401 is closed — do not reopen) · **Airtable work** (schemas read-only; no data phase) · **voice-pipeline changes** (locked, SHAs 50c1103/0d98169; MyaBar is a visual shell only) · **phone implementation** (Phase F; separate tree law) · **Phase C–G work of any kind** (ADR-OS3: plan ahead allowed, build ahead forbidden) · **F-1 shell-meta follow-up** (the deprecated `apple-mobile-web-app-capable` meta in shared index.html — R3 §3: own workstream, own approval; touching index.html in MOSV2-B violates both workstream isolation and legacy byte-identity) · **protected-system changes** (all seven register rows) · **unrelated cleanup** (AGENTS.md; CLAUDE-rule analog: a build PR touches its build, nothing else — drive-by discoveries become FOLLOW-UP notes).

---

## 6 · PHASE B REFERENCE ANATOMY (every value cited)

| Element | Exact value / behavior | Controlling source |
|---|---|---|
| Rail collapsed width | 64px, fixed left, full height | Bible §3 Rail Geometry; mockup `#rail` L79 |
| Rail expanded width | 216px on hover **or** focus-within; gains `--e3` | Bible §3; mockup L82 (`#rail:hover,#rail:focus-within`) |
| Rail overlay | Fixed overlay; stage `margin-left` stays 64px; expansion reflows nothing; zero CLS measured | Bible §3 Rail + Whitespace/CLS; Orders P2-B ("stage must not reflow") |
| Rail label transition | Labels/status dots appear on expand only: fade + slide (opacity + 6px translateX), `--t-med` | Bible §3 Anatomy + §5 Rail-expand row |
| Nav items | 40px tall, radius `--r-s`, 22px stroke icons | Bible §3 Anatomy |
| Active beacon | Active item: text-1 on rgba(255,255,255,.06) + 3px purple beacon bar at left edge, inset 9px top/bottom, glow `0 0 12px rgba(150,120,242,.7)` | Bible §3 Anatomy |
| Brand orb | 26px, breathing (3.2s catalog pulse) | Bible §3 Anatomy; §5 Breathing row |
| Foot cluster | System pulse (8px green breathing dot + "All systems green") · Settings link · identity row (30px avatar + name) | Bible §3 Anatomy |
| Top bar | 64px, sticky, glass rgba(11,13,16,.72) + blur(20px) saturate(140%), bottom hairline; mockup: `height:64px; padding:0 28px 0 24px; margin-left:64px` | Bible §3 Top bar; mockup L116 |
| Top bar contents | Left: screen title + live dateline. Center: search pill (max 440px, 36px, pill radius, ⌘K kbd hint, hover brightens one step). Right: focus switcher (segmented: Balanced·Teach·Write·Money·CEO; active = ai-d fill + ai-t text + inset purple ring — **visual only in B**), EXEC button (34px pill, gold hairline + exec-t; hover exec-d fill + soft gold glow + −1px lift — **visual only in B**, `aria-pressed`), bell (34px circle, static 7px crit-t badge dot + 2px bg-0 ring, no pulse) | Bible §3 Top bar; Orders P2-B |
| Stage anatomy | `margin-left:64px; padding:26px 28px 120px` (120px = MyaBar clearance); max-width 1560px; 12-col grid; gutter = §7.1 decision (law 24px / reference 18px); ambience: exactly two fixed radial gradients (info .05 top-center; ai .035–.05 far corner) on `--bg-0`; selection rgba(150,120,242,.35) | Bible §3 Geometry + Ambience; mockup L144–145 |
| Zone labels (for skeleton headers) | 11px/600 uppercase .14em text-3 + 1px stroke-1 hairline + optional "Open ‹module› →" link 11.5px | Bible §3 Zone labels |
| MyaBar position | Fixed bottom 22px, centered over stage: `translateX(calc(−50% + 32px))` compensating the 64px rail | Bible §4 MyaBar; mockup L272 |
| MyaBar shell | 48px pill: glass-hi + blur(24px) saturate(150%), stroke-2, `--e3` + ambient glow `0 0 34px rgba(150,120,242,.12)`; hover −2px, glow .22, border rgba(150,120,242,.4); contents: 22px breathing orb · "How can I help?" 13px text-2 · Space kbd hint. In B: press opens the empty palette shell — no voice | Bible §4 MyaBar; Orders P2-B |
| Palette shell anatomy | Veil rgba(5,6,8,.55) + blur(6px), fades `--t-med`. Sheet: fixed top 16%, width min(640px, 92vw), glass-hi + blur(28px) saturate(160%), stroke-2, radius `--r-xl`, `--e3` + `0 0 60px rgba(150,120,242,.14)`. Entrance scale(.97→1) + fade, `--t-med --ease`. Pin row: 26px orb · 17px/500 input (placeholder "How can I help?") · 34px mic (visual only in B). Footer: ↵ run · esc close · status line. Body: **empty in B** | Bible §4 Command palette; A6 above |
| Boot choreography | Wordmark (.55em tracking) fades in .8s · 10px breathing orb (1.6s pulse) · hint at .9s · auto-advance **1500ms design / ≤1600ms ceiling** · click-skip anytime · overlay fades .5s while zones enter | Bible §5 Boot row (DB-C1); mockup L638 |
| Entrance choreography | Zones rise 14px + fade, .6s `--ease`, delays 50/130/210/290/370ms (80ms cadence) — empty containers in B | Bible §5 Zone entrance (DB-C2) |
| Keyboard & Escape | Space / ⌘K open palette shell (suppressed while typing in any input) · Esc closes and **restores focus to the exact prior element** · E toggles the stub exec class (suppressed while typing) · arrows reserved (D) · every rail item and interactive element Tab-reachable · focus trapped while palette open | Bible §7 Keyboard map + Focus containment (DB-G3); Orders P2-B DoD |
| Reduced-motion substitutions | Boot **absent entirely** (not fast — absent; A4) · zone entrance instant · rail labels appear without slide (opacity/instant) · breathing stopped (orb, system pulse) · palette veil/sheet instant · transitions ≤.01ms | Bible §5 Reduced-motion rule + §7; A4 |
| Gallery states (permanent) | Every new shell component in every applicable §4-lede state: rail item default/hover/focus/active-beacon (collapsed + expanded contexts) · topbar search pill default/hover/focus · focus-switcher segments incl. active · EXEC default/hover/focus/stub-active · bell w/ badge · MyaBar default/hover/focus · palette shell open (static) · L2 skeleton specimen. Disabled states: none specified for shell controls — none shown (DB-G8 is Button-only law) | Orders P2-A item 3; Bible §4 lede; DB-G8 scope clause |

---

## 7 · OPEN DECISION REGISTER

**7.1 · Stage gutter — the mandatory PLAN-gate decision (ADR §13.2; DB-C5).** Current governing law: **24px** (Handoff §2-B + Orders P2-B, rank 1). Recorded deviation: **18px** in the desktop reference (`gap:18px`, single occurrence, mockup L145 — DB-D2, file-verified).

- **Visual consequence of 24px:** airier zone rhythm, slightly lower density; every side-by-side visual-match comparison against the reference carries a permanent, explained 6px divergence — the feel pass's "difference test" must forever except it.
- **Visual consequence of 18px:** pixel-parity with the reference every future review compares against; marginally denser grid — the density the mockups actually demonstrate.
- **Architecture consequence:** none structurally either way (one CSS `gap` value; no component API, CLS, or bundle impact). The real consequence is precedential: adopting 18px requires a **recorded handoff amendment** (rank-1 law changes only by superseding version); adopting 24px requires **permanent review discipline** (a standing lawful divergence from the behavioral reference).
- **Recommendation (advisory only):** **amend to 18px.** The visual-match DoD and the rubric's difference test are anchored to the mockup; a law that permanently disagrees with the reference every review compares against builds friction into every future gate. One recorded one-line amendment ends it.
- **Exact approval question for Denarius:** *"Stage gutter: reply '24' to adopt law as written (24px, recorded divergence from the reference in every visual review) or '18' to amend MOTES_OS_V2_CODEX_HANDOFF §2 Phase B / Orders P2-B to 18px (law matches reference). Your call is recorded either way, and the Stage builds to it."*

**7.2 · L2 workspace detail (ADR §13.3; DB-G1) — checked, no decision required at this gate.** No mockup reference exists for L2 screens; the bible's prose definition (header + KPI strip + worklist/context-rail skeleton) is the complete Phase B law. Phase B builds skeletons to that prose and **stops**; any elaboration impulse routes to the architect seat as a design question. This item resolves at its own gate (Phase B–C bounded design amendment), not here.

**No other unresolved Phase B decisions exist.** Sweep basis: ADR §13 (items 1–12 — only §13.2 and §13.3 touch Phase B), bible §12.3 gaps (G3 = implementation obligation, not a decision; G4/G5/G6/G7 belong to D/F/C/G), and bible §12.1 rulings (all settled). Nothing else is invented.

---

## 8 · PROPOSED BRANCH AND FILE SCOPE

**Branch:** `feat/mosv2-b-shell` (Orders P2-B verbatim; AGENTS.md branch-naming law). PR title: `MOSV2-B: shell (rail, topbar, stage, boot, MyaBar, palette shell, module routes)`.

**Codex must inspect first (read-only):** repo main at the required baseline SHA · `AGENTS.md` · `design/v2/` (all four files) · `src/v2/tokens.css` (byte-identical law) · the Phase A tree under `src/v2/` (components + gallery + flag plumbing — confirm exact file names as built, not as assumed) · the router entry that mounts `/v2` · `PROJECT_BRAIN.md` + `DEPLOY_LEDGER.md` (Phase A entries per ADR-IMP11) · `package.json` (verify zero dependency changes will be needed) · `vite`/build config (flag mechanics — **inspect only**).

**Files likely to change (all inside the v2 boundary):** new shell components under `src/v2/` (RailNav, TopBar, Stage, Boot, MyaBar, PaletteShell, L2 skeleton template) · module route definitions inside the lazy `/v2` tree (`/v2/{home,mya,exec,work,life,som,book,money,crm}`) · the Foundation Gallery page (add Phase B components/states) · at most the `/v2` router entry if route registration lives there.

**Forbidden to change:** anything outside `src/v2/*` + the `/v2` router entry · `index.html` (F-1 territory; legacy-served bytes) · legacy `/` routes and components (byte-identical law) · `package.json`/lockfile (no new runtime deps) · `netlify.toml`, Railway/deploy config (protected: approval required) · env files/values (protected: never modify, never print) · `design/v2/*` (docs; discrepancy found ⇒ BLOCKED note, never an in-PR edit) · anything in `Deployable-python-codebase-som` (wrong repo) · Airtable anything · voice-pipeline anything.

**Protected-system boundaries:** the seven-row Protected Systems Register (Orders PART 1) is law and is checked before touching any file; a task appearing to require a protected system ⇒ STOP, BLOCKED note. R5: protected-adjacent work has its own approval chain regardless of size.

---

## 9 · REQUIRED PLAN COMMENT (Codex posts this on the PR before any code)

```markdown
MOSV2-B PLAN — Phase B Shell (execution packet MOSV2_PHASE_B_EXECUTION_PACKET v1.0 governs; citations therein)

0. RULING REQUESTED FIRST (DB-C5 / ADR §13.2 — Stage is not built until answered):
   Stage gutter — law says 24px (handoff §2-B), the desktop reference renders 18px (DB-D2).
   Denarius: reply "24" (adopt law) or "18" (amend handoff). Recorded either way.
   I will build the Stage to your recorded call; all other Stage values build as written.

1. SCOPE: RailNav (64→216 overlay, beacon, foot cluster) · TopBar (title/dateline, search pill,
   focus switcher [visual], EXEC [visual, stub class on E], bell) · Stage (12-col, 1560px,
   two-radial ambience) · Boot (1.5s design/≤1.6s ceiling, click-skip, absent under reduced
   motion) · MyaBar shell · empty palette shell (trap + exact focus restore — DB-G3) ·
   /v2/{home,mya,exec,work,life,som,book,money,crm} L2 skeletons · empty Home zone containers
   (80ms-cadence entrance, DB-C2) · gallery updated with all new components/states.
2. EXCLUSIONS: no data, no zones content, no voice behavior, no phone, no backend, no auth,
   no Airtable, no index.html (F-1), no protected systems, no cleanup. Packet §5 is the list.
3. FILES: new src/v2/ shell components + module routes + gallery additions + /v2 router entry
   only. Exact Phase A file names confirmed at baseline SHA before branching. Nothing outside
   the v2 boundary changes.
4. STATE MODEL: rail {collapsed, expanded(hover|focus-within)} · palette {closed, open(trapped)}
   with restore-target element recorded on open · boot {pending, running, skipped, done;
   absent under reduced motion} · exec stub {off, on} (aria-pressed) · route {active per rail
   item} (aria-current). No persisted state; no mosv2.* keys introduced (statement in PR).
5. KEYBOARD: Tab reaches every rail item and control · Space/⌘K open shell (suppressed while
   typing) · Esc closes, restores exact prior focus · E toggles stub exec (suppressed while
   typing) · focus ring 2px --info / 2px offset throughout.
6. MOTION: only catalog rows — rail expand (--t-med --ease, R-2 lawful width), label fade-slide,
   boot choreography (DB-C1), zone stagger (DB-C2), palette veil/sheet (--t-med --ease),
   breathing pulses (3.2s/2.4s), hover lifts. Transform/opacity only otherwise.
7. REDUCED MOTION: boot absent entirely (not shortened — packet A4) · entrance instant ·
   breathing stopped · transitions collapse. Verified at runtime, evidence posted.
8. PERFORMANCE: zero CLS during boot and rail expand — instrumented (PerformanceObserver
   layout-shift), numbers posted, not eyeballed · bundle delta reported, cumulative ≤80KB gz.
9. ACCESSIBILITY: §7 gate set as scoped in packet §4.11; trap + restore demonstrated in the
   keyboard walkthrough.
10. ROLLBACK: VITE_MOS_V2 off = no /v2, zero v2 bytes/calls; rollback SHA named in PR;
    production flag stays false.
11. PROOF: packet §11 package, in full, before review is requested.
12. UNRESOLVED: item 0 only. No other open Phase B decisions exist (packet §7).
IMPLEMENTATION STOPS HERE pending Denarius: (a) the gutter call, (b) "Approved — PLAN".
```

(The working loop's ≤20-line PLAN convention is expanded here by this packet's explicit instruction — see §13 row 8. The PLAN cites the packet instead of restating law.)

---

## 10 · ACCEPTANCE CRITERIA — PHASE B DEFINITION OF DONE

Union of Orders P2-B DoD + AGENTS.md DoD + Handoff §3 + Bible §11, instantiated for B:

- **Visual:** side-by-side match to the desktop reference at 1440px for home skeleton, rail expanded, palette shell open; gutter matches Denarius's recorded §7.1 call; no invented values (V1–V4).
- **Interaction:** rail expands on hover and focus-within as a true overlay; boot auto-advances 1500ms (≤1600ms), click-skips; MyaBar/Space/⌘K open the shell; Esc closes with exact focus restore; E toggles the stub class.
- **Keyboard:** keyboard-only video or walkthrough notes posted — tab through rail, open/close palette shell, E toggle; Space/⌘K suppressed while typing; no unreachable interactive element.
- **Accessibility:** focus ring spec everywhere; `aria-pressed` (EXEC stub), `aria-current` (rail), trap + restore proven; contrast floor respected (token-derived).
- **Reduced motion:** runtime-verified (emulation or OS toggle — the R3 evidence standard): boot absent, entrance instant, breathing stopped; evidence posted.
- **Console:** zero errors and warnings on touched screens, headless run. The pre-existing shell-meta deprecation warning is classified by the R3 §2 ruling and does not count; any **new or changed** warning reopens the gate at full strength (that ruling's tripwire).
- **Performance:** zero CLS during boot and rail hover — **measured and reported** (instrumented); transform/opacity-only animation (+ lawful R-2 rail width).
- **Bundle:** new hash + delta reported; cumulative v2 core ≤80KB gzip (flag if a projection would exceed it).
- **Feature flag:** `VITE_MOS_V2` off ⇒ `/v2` absent, zero v2 bytes where the build tool allows, zero v2 network calls; production stays false.
- **Legacy isolation:** `/` + one legacy tab spot-checked byte-identical; `index.html` untouched.
- **Rollback:** flag-off rollback stated + rollback SHA named in the PR description.
- **Gallery preservation:** Phase A gallery renders clean at head; Phase B components present in all §6 gallery states.
- **Screenshots/proof:** per §11 below. Missing proof = automatically not approved (Orders PART 3.1).

## 11 · DESIGN QA PROOF PACKAGE (what Codex submits for Fable review)

Deploy-preview URL (linked to the head SHA) · PR = one workstream (MOSV2-B) · branch + head SHA + rollback SHA · **1440px screenshots:** home skeleton (boot completed), rail collapsed, rail expanded (overlay over content visible), palette shell open, one L2 placeholder screen, Foundation Gallery incl. every new Phase B state (§6 gallery row) · boot evidence (short capture or frame sequence incl. click-skip) · keyboard walkthrough (keys pressed → what happened, incl. trap-and-restore demonstration) · reduced-motion runtime evidence (method named + the four observations: no boot, instant entrance, no breathing, collapsed transitions) · headless console report (zero errors/warnings; R3-classified meta warning noted if present) · CLS instrumentation numbers for boot + rail expand · bundle hash + delta · legacy spot-check statement · `mosv2.*` keys line ("none introduced") · Denarius's recorded gutter call quoted. Review then runs the rubric's eight passes; the gallery is the first check (R3 handoff note).

## 12 · MERGE GATE

Codex cannot self-approve and cannot self-merge (branch protection makes this mechanical — ADR-IMP4). The reviewer is never the builder (R4/ADR-GOV3): Codex builds, the Principal Reviewer seat reviews, Claude Code verifies where dispatched. **Denarius's explicit "Approved" is the only merge authority** (ADR-GOV1). After merge: `DEPLOY_LEDGER.md` + `PROJECT_BRAIN.md` entries (date · phase · SHA · bundle hash · rollback SHA — ADR-IMP11). **Phase C does not begin** — not even its branch — until Phase B is merged, bookkeeping lands, and Denarius pastes the Phase C prompt (its PLAN gate is separate law).

## 13 · CONTRADICTION CHECK

| # | Sources | Conflict | Classification |
|---|---|---|---|
| 1 | Orders P2-B "60ms stagger" vs desktop reference 80ms cadence | Real, ruled | **Settled** — DB-C2: mockup timing wins (80ms cadence) |
| 2 | Handoff "1.5s" boot vs AGENTS.md "≤1.6s" | Apparent | **No conflict** — DB-C1: design duration + ceiling, both bind |
| 3 | Handoff/Orders 24px gutter vs reference 18px | Real | **Open ruling required** — DB-C5/§13.2; resolved by Denarius at this PLAN gate (§7.1). The packet's sole open item |
| 4 | Orders P2-D "palette ≤120ms" vs B building the shell | Apparent | **No conflict** — DB-C3 reconciles (interactive-time definition); measured gate belongs to Phase D (§2-A6) |
| 5 | Reference reduced-motion boot = 50ms timeout vs bible "absent entirely" | Real, small | **Settled** — bible §5 law controls; the 50ms is demo shorthand, not ported (A4) |
| 6 | VAULT_INDEX cites Bible v1.0 ACTIVE vs Bible v1.1 ACTIVE now | Staleness | **Settled** — v1.1's supersedes chain governs (rubric §2.2 auto-accept); MINOR index facts-refresh owed, non-blocking |
| 7 | FABLE_HANDOFF §5/ADR-PR1 record AUTH-401 OPEN vs closed Jul 11 | Staleness | **Settled** — BUILD_START_COMMAND_PLAN records closure + supersession; MINOR refresh owed, non-blocking |
| 8 | Handoff §0.2 "Codex adversarial review" phrasing vs D3 roles (Codex builds; Opus reviews) | Dead-law echo | **Settled** — ruling D3 (FABLE_HANDOFF §7): July roles control; the phrase is a May-protocol residue |
| 9 | Working loop "≤20-line PLAN" vs this packet's §9 expanded PLAN | Procedural | **Deviation, authorized** — Denarius's Phase B tasking commissioned the full PLAN; his approval of this packet records it. The PLAN cites the packet rather than restating law |
| 10 | Repo state (design/v2 on main, AGENTS.md, branch protection, Phase A tree) vs this seat's visibility | Not verifiable from seat | **No conflict** — expected per Phase A closure + BUILD_START; Codex verifies at session start against the required baseline SHA (§0/§8) |

## 14 · FINAL READINESS VERDICT

**READY FOR DENARIUS PHASE B PLAN APPROVAL.**

Every governing source was read at file level; every value in §6 carries its citation; the single open decision (§7.1 stage gutter) is packaged with its consequences and exact approval question, and by ruling DB-C5 it is answered inside this very gate — it does not block issuing the packet or posting the PLAN. Two stale-record notes (§13 rows 6–7) are MINOR refreshes owed at the architect seat, non-blocking. No code was implemented, GitHub was not modified, and Phase C was not begun.

---

## 15 · HOW TO USE THIS DOCUMENT

**Denarius:** two acts open Phase B — approve this packet, then answer §7.1 ("24" or "18") when Codex's PLAN comment opens with it. Your explicit "Approved — PLAN" releases implementation; your explicit "Approved" on the finished PR releases merge. Nothing else moves without you. **Codex:** verify main at the §0 baseline SHA, read AGENTS.md + design/v2 + the Phase A tree, post the §9 PLAN verbatim-in-substance, stop at both gates; this packet's citations replace memory — where the packet and a governing file disagree, the file wins and you post a BLOCKED note. **Principal Reviewer:** review to §10–§11 under the rubric; gallery first; gutter conformance = whatever call §7.1 recorded. **Chief Architect (successor):** §7 items close by Denarius's recorded calls — log them into ADR §13.2 closure + a handoff amendment if "18"; MINOR refreshes owed per §13 rows 6–7. **Storage:** vault, beside the Phase A review chain; amend only by superseding version.

*— Chief Architect seat · Execution Engine · Motesart Technologies*
