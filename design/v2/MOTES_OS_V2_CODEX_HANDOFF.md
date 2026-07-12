# MOTES OS v2 — "THE COCKPIT" · IMPLEMENTATION HANDOFF

**From:** Fable (Chief Product Designer seat) · **To:** implementing agent (Codex / Claude Code per Multi-Agent Build Protocol)
**Date:** July 10, 2026 · **Repo:** `Motesart27/Motesart-OS` (React/Vite) · **Backend:** `Deployable-python-codebase-som` (FastAPI/Railway)
**Companion files:** `motes-os-v2-design-bible.html` (tokens + rules) · `motes-os-v2-desktop.html` · `motes-os-v2-phone.html` (reference behavior)

---

## 0 · GROUND RULES (non-negotiable)

1. **Feature-flagged, additive, incremental.** All v2 work lives behind `MOS_V2` (env + runtime flag) on a `/v2` route. The legacy dashboard remains untouched and reachable until Phase F completes. No big-bang rewrite, ever.
2. **Multi-Agent Build Protocol applies.** Feature branches `feat/mosv2-<phase>`, never `main`. Preview deploy → Denarius approval → Codex adversarial review → Execution Engine ship/no-ship → merge. Full SHA list reported after every push. `PROJECT_BRAIN.md` updated at session close.
3. **Motesart Spec Protocol applies.** One work classification per commit (Visual / Functional / Data Model / Architecture — never mixed). Phases C, D, G each require their state map + interaction matrix approved **before** code.
4. **Build Guardian applies.** Component-boundary patches only, `safe_replace()`, no global find-and-replace, build verification + regression check per patch, deploy ledger entry per deploy.
5. **Locked systems are read-only.** The Mya voice pipeline (Deepgram → Anthropic tool-use → ElevenLabs), the 5-state voice machine, VAD thresholds, greeting pool, and `MYA_VOICE_TOOL` schema are LOCKED. v2 re-skins their surfaces; it does not modify their logic.
6. **EXECUTION ENGINE audit standard is the bar for PASS** (no undefined vars, no missing state, no broken glyphs/mojibake, no console errors, localStorage + backend sync verified, reset clears all layers, production API base resolution verified — no localhost fallback).

---

## 1 · DESIGN TOKENS (Phase A deliverable — copy verbatim)

```css
/* tokens.css — Graphite Design System v1.0 · single source of truth */
:root{
  /* surfaces */
  --bg-0:#0B0D10; --bg-1:#101318; --bg-2:#161A21; --bg-3:#1D232C; --bg-4:#242B36;
  --glass:rgba(22,26,33,.72); --glass-hi:rgba(29,35,44,.8);
  --stroke-1:rgba(255,255,255,.06); --stroke-2:rgba(255,255,255,.12); --stroke-3:rgba(255,255,255,.2);
  /* ink */
  --text-1:#F2F4F8;   /* 15.8:1 on bg-2 */
  --text-2:#A8B0BC;   /*  8.0:1 */
  --text-3:#8A93A1;   /*  4.8:1 — contrast floor, nothing dimmer ships */
  /* accent marks — chart-grade, CVD-validated as a set on #161A21 */
  --info:#4C8DFF; --good:#29A472; --warn:#D97706; --crit:#EF4444; --ai:#9678F2; --exec:#B28437;
  /* accent text tier — ≥5.7:1 on all surfaces */
  --info-t:#82B4FF; --good-t:#45D392; --warn-t:#F0A32B; --crit-t:#F87171; --ai-t:#B7A5FF; --exec-t:#E2BA6C;
  /* accent dims — fills */
  --info-d:rgba(76,141,255,.12); --good-d:rgba(41,164,114,.14); --warn-d:rgba(217,119,6,.14);
  --crit-d:rgba(239,68,68,.13);  --ai-d:rgba(150,120,242,.13);  --exec-d:rgba(178,132,55,.15);
  /* locked Mya states (carried from v1 SHAs 50c1103 / 0d98169) */
  --mya-processing:#F97316; --mya-speaking:#2DD4BF;
  /* geometry */
  --r-s:10px; --r-m:16px; --r-l:20px; --r-xl:28px;
  /* motion */
  --t-fast:150ms; --t-med:220ms; --t-slow:300ms;
  --ease:cubic-bezier(.4,0,.2,1); --spring:cubic-bezier(.34,1.56,.64,1);
  /* elevation */
  --e1:0 1px 2px rgba(0,0,0,.24); --e2:0 4px 12px rgba(0,0,0,.28); --e3:0 8px 28px rgba(0,0,0,.38);
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,monospace;
}
```

Motion rules: hover lift −2/−3px + shadow bloom (+ optional ≤0.4° tilt on cards); press `scale(.97)`; progress bars fill `width 1.4s cubic-bezier(.4,0,.2,1)` + glow (locked standard); chart draw-in ≤1.4s once per mount, never on refresh; `prefers-reduced-motion` collapses everything to opacity.

---

## 2 · PHASES

### PHASE A · Foundation — *Visual, zero risk*
- Add `tokens.css`, `Button`, `Card`, `Panel`, `Chip`, `StatCard`, `Sparkline`, `ProgressBar`, `ProgressRing`, `Toast`, `Kbd` under `src/v2/components/`.
- `/v2` route behind `MOS_V2` flag renders a component gallery page (acts as visual regression page thereafter).
- **Test:** build passes, new bundle hash, `/` untouched, gallery renders with zero console errors.
- **Rollback:** flag off. No shared files modified.

### PHASE B · Shell — *Visual*
- `RailNav` (64→216px hover overlay, purple active beacon), `TopBar` (search pill, focus switcher, EXEC button, bell), `Stage` grid (12-col, max 1560px), boot sequence (1.5s, skippable, reduced-motion aware), Mya bar (visual only, opens palette shell).
- Modules routed inside `/v2/*`: home, mya, exec, work, life, som, book, money, crm (placeholder screens with the L2 workspace template).
- **Test:** keyboard reachability of every rail item; rail expansion overlays without reflow; zero CLS on boot.

### PHASE C · Zones — *Functional (state map required first)*
Wire Home's five zones **read-only** to existing endpoints. No new tables. No writes.

| Zone / tile | Source of truth | Notes |
|---|---|---|
| Z1 greeting + date | client clock | greeting by hour (visual layer distinct from Mya's locked voice greeting pool) |
| Z1 signal feed | `GET` MASTER_TASKS (priority + status) · calendar endpoint (SHA a062365 wiring) · FM overdue query | max 6 signals, ranked: crit > exec > ai > warn > info > good |
| Z1 Today agenda | Google Calendar (existing service acct) | sanitized titles (Codex security fix) |
| Z1 handled log | Mya Voice Audit Log `tblDEyL8fzGGVvs2t` (`result_summary`, `response_text`) | read-only digest |
| Z2 projects | MASTER_TASKS grouped by `business` + Book base `app4GKdk1AqmiOyKx` (BK_Project, BK_Blockers) | convention countdown computed client-side |
| Z3 revenue chart + stats | FM routes (`fm_airtable`) · SOM student count · book pre-orders | ⚠ fix `fm_airtable.py` PAT `.lstrip('=')` (known issue) before this tile ships |
| Z4 personal | VitalStack + Life tables | degrade gracefully per tile if source absent |
| Z5 quick actions | `create_task_core()` via existing dispatch — same path as voice tool | each action = prefilled MASTER_TASKS write, `requires_approval` respected |

**Airtable discipline (CRITICAL, from system doc):** field names are case- and whitespace-sensitive; confirmed MASTER_TASKS fields are lowercase `title`, `status`, `priority`, `business`, `assigned_agent`. Read from `FIELDS.md`/live schema — never guess. Never confuse `I` / `l` / `1`.
**localStorage:** namespace all v2 keys `mosv2.*` (layout, focus pref, collapsed tiles). Reset must clear every `mosv2.*` key **and** verify backend state untouched.

### PHASE D · Command Palette — *Functional (interaction matrix required first)*
- `Space` / `⌘K` global (suppressed while typing in inputs), `Esc` closes, arrows + Enter select.
- One index: students, invoices, chapters, projects, people, calendar events + **actions**. Filter client-side over a `/api/search` aggregate (new read-only endpoint, or client merge of existing reads for v1 of this phase).
- Unmatched query ⇒ natural-language dispatch to Mya (existing text pipeline once Multi-input Phase 1 lands; until then, creates a MASTER_TASKS entry via `create_task_core`).
- Mic button surfaces the **existing** voice machine states (idle/listening/processing #F97316/speaking breathe) — reuse, don't rebuild.

### PHASE E · Executive Mode + Focus Layer — *Visual first, then Data Model (preference)*
- E1 (Visual): body-class modes; exec dims non-`ceo` zones to 10% blur; focus modes dim non-tagged zones to 32%; hover restores. Keyboard `E`.
- E2 (Data Model): persist last mode per device profile in `mosv2.mode`; optional auto-suggest rules (lesson <2h ⇒ suggest Teach) — suggestions only, never auto-switch without a dismissible prompt.

### PHASE F · Phone shell — *Visual/Functional*
- Viewport-routed (<640px) wallet deck: Today / Projects / Business / Life / Mya. Scroll-snap deck, dots, tap-to-complete rows (writes task status ONLY after Phase C write-path approval; until then optimistic-local).
- Not responsive-squeezed desktop: separate component tree `src/v2/phone/`, shared tokens + data hooks.

### PHASE G · Ambient intelligence — *Architecture (spec + approval gate before any code)*
- Morning brief generator (server-side: calendar + FM + SOM + Book digest → 6 ranked signals), notification digest, handled-log summarization. This is the only phase that adds backend surface; it gets its own C-4-grade spec.

---

## 3 · ACCEPTANCE CHECKLIST (every phase, per EXECUTION ENGINE)

- [ ] Runtime works · UI renders · zero console errors · no mojibake/broken glyphs
- [ ] All interactive elements: visible hover state + focus ring + ≥AA contrast (muted floor `#8A93A1`)
- [ ] Add/Edit/Delete/Refresh/Reset lifecycle verified where applicable; `mosv2.*` reset clears all layers
- [ ] Production API base resolution verified — no localhost fallback in prod build
- [ ] `prefers-reduced-motion` verified; keyboard path verified (Space/⌘K, E, Esc, arrows)
- [ ] Voice/speech path untouched and still green (health check 5/5)
- [ ] New bundle hash noted in deploy ledger · rollback SHA named in PR description

## 4 · ADDENDUM (Jul 10, v1.1) — MYA COMMUNICATION LAYER

Denarius's operating reality: long stretches where he can speak but not type. The front end must treat voice as a first-class input and reminders as guaranteed-delivery output.

**Voice toggle (Phase D):** persistent speaker control in MyaBar + palette, key `mosv2.voice`, default ON. OFF = no `/api/mya/tts` call at all; greeting and replies render as text. ON = existing TTS path unchanged. Frontend-only; pipeline stays locked.

**One-press talk (Phase D):** MyaBar press with voice ON jumps straight to listening (single press = talk). Voice OFF → same press opens palette on the text input. Esc exits listening without firing.

**Calendar executive behavior (Phase D acceptance):** Mya already sees the live calendar in-prompt (SHA a062365) and creates events via tool (verified f85de95). Phase D must prove three utterances end-to-end: book a practice slot, move a lesson, find the next free 2-hour block. If free-slot answers are unreliable from prompt context, a `suggest_time` tool is proposed as a separate gated backend workstream — never built inside a UI PR.

**Reminder channels (Phase G spec):** calendar-native reminders (popup + email overrides on every Mya-created event) are the primary reach-him channel today; Mya-initiated email is new backend surface requiring an approved spec (mechanism, triggers, quiet hours, templates) before any code; channel matrix = severity → channel → timing, silence by default.

**Also carried in v1.1 of the execution orders:** Protected Systems Register (auth.py, voice pipeline, payments, Airtable schemas, prod env vars, deploy config — each Read-only / Approval-required / Never-modify), Workstream Isolation Rule (one PR = one workstream, FOLLOW-UP notes for drive-by discoveries), SOM-AUTH-401 gate before Phase A, secrets-never-in-prompts rule, and GitHub branch protection on main.

## 5 · WHAT SUCCESS LOOKS LIKE

Denarius opens `/v2` and doesn't feel like he opened an app. The OS greets him, tells him what it already handled, shows him the six things that deserve his eyes, and waits. Space answers anything. E clears the room. The phone is a wallet, not a dashboard. And no line of the legacy system broke while we got there.

*— Fable, for the Execution Engine · Motesart Technologies*
