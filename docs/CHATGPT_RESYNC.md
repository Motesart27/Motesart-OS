# ChatGPT Re-Sync — FinanceMind Dual Brain
**To:** ChatGPT (web) — please read fully before next FinanceMind / Motesart OS task.
**From:** Claude (claude.ai) + Codex (local) — co-owners of this system with you.
**Date:** 2026-05-04
**Repo HEAD at brain landing:** `8fdd7ba`
**Brain coverage verified through:** `027c191` (FM-6A + FM-6A.1 SHIPPED)
**⚠ Undocumented gap:** 12 commits — Phase 4A/4B Music Lessons subsystem (see PROJECT_BRAIN Section 13A)

---

## Why You're Getting This

FinanceMind now lives on **two surfaces**, and three agents work on it:

| Agent | Surface | Tools |
|---|---|---|
| **Codex** (local) | Motesart-OS repo `MotesartOS.jsx` | Git, local build, .agents/skills |
| **ChatGPT** (you) | Same Motesart-OS repo via web | GitHub connector |
| **Claude** (claude.ai) | Standalone `~/Downloads/financemind/index.html` + `server.py` | Project files, AI Brain in-app |

You and Codex share one repo. Claude works on a separate, simpler standalone app. **All three must stay in sync** through `PROJECT_BRAIN.md` — the single canonical state file.

---

## The One Rule You Need

**Read `PROJECT_BRAIN.md` before any FinanceMind task.** That file is now the source of truth, not your memory, not session context, not the last message thread. If something contradicts it, the brain wins until updated.

---

## What You Must Know Right Now

### 1. Repo state vs brain coverage

```text
Repo HEAD at brain landing:    8fdd7ba
Brain coverage verified through: 027c191
Undocumented gap:               12 commits (Phase 4A/4B Music Lessons)
```

**Important:** The brain is HISTORICAL. It does NOT cover everything in the repo. If you are advising on `MotesartOS.jsx` outside the FinanceMind tab, or on `src/components/PianoLessonsSection.jsx`, you are working in undocumented territory — flag that explicitly to Motes before acting.

### 1A. Brain coverage commit chain (verified)

```text
027c191   fix(financemind): FM-6A.1 hide safety gate count text below 480px
fbc0737   feat(financemind): FM-6A smart month safety gate preview
1f06e59   fix(financemind): remove duplicate borderLeft (warning eliminated)
```
Build PASS at `027c191`. FM Safety Gate live in production.
Production URL verified live: https://motesart-os.netlify.app/os
**No active build warnings** at brain coverage SHA.

### 1B. Truth Layer (canonical, FinanceMind scope only)

```text
Live income baseline:   $3,428    [STALE]
Preview baseline:       ~$4,123
Debbie:                 PREVIEW ONLY
Church WU:              PREVIEW ONLY
MT variance:            $418.49   [UNRESOLVED]
Capital One Phone Bill: PENDING   [do not guess]
Safety Gate verdict:    BLOCKED   [live in production]
```

### 1C. ADR-001 (preserved — must NOT be altered without explicit ADR update)

```text
- Evelyn remains the payer / contact
- Luke remains SOM-only (does NOT appear in Music Lessons / Piano Lessons UI)
- service_recipient_name remains the learner display field on receipts and PDFs
```

### 2. Locked Income Rules (user-confirmed 2026-05-04)
```text
ALL music lessons are weekly on TUESDAYS:
  Renee  $125 / Tue
  Evelyn $75  / Tue
  Debbie $85  / Tue

BOTH churches active weekly on SUNDAYS:
  Church (NJ) $400 / Sun
  Church (WU) $300 / Sun
```

Smart Month Engine helpers already exist in `MotesartOS.jsx`:
```js
countWeekdaysInMonth(year, monthIndex, weekday)
getNextMonthTargetDate(referenceDate)
generateRecurringIncomeForMonth(year, monthIndex)
generateMonthSummary(year, monthIndex)
```

Use these. Do not duplicate them.

### 3. Active Blockers (do not bypass)
```text
1. MT subscription variance $418.49 — itemized $235.28 vs sheet $653.77
2. Capital One Phone Bill — amount unknown, marked PENDING (do NOT guess)
3. Standalone app D.income = $3,428 is stale; new baseline ~$4,123 — DO NOT auto-overwrite
```

### 4. Hard Rules
- **Preview first.** No live FM number is overwritten without user confirmation.
- **Never guess missing amounts.** Phone Bill stays "Pending" until user provides.
- **No backend / Airtable save** until UI previews are visually verified.
- **Small commits.** Don't combine UI preview + live overwrite + Airtable save in one commit.
- **Surface sync.** Any logic added to one surface must be ported to the other within 1 session, or explicitly marked surface-specific in the brain.

### 5. GitHub Connector Action Item (for you)
Your connector identifies as `Motesart27` but the repos aren't appearing in your scope. **Re-authorize the GitHub connector and explicitly grant access to:**
```text
Motesart-OS
Deployable-python-codebase-som
```
Until that's fixed, Codex (local) is the primary build path; you're read-only via what the user pastes.

---

## What Each Agent Owns

### Codex Owns
- All commits to `MotesartOS.jsx`
- Travel Builder shortcut wiring
- Smart Month Engine helpers + preview panels
- MT reconciliation preview
- Capital One ledger preview
- Backend work in `Deployable-python-codebase-som`

### You (ChatGPT) Own
- Strategic planning + phase ordering
- Reading commits via GitHub connector once re-authorized
- Long-form architecture docs
- Cross-checking Codex's math (you caught the $418.49 variance — that's the gold standard)
- Pre-flight gates before Codex builds

### Claude Owns
- Standalone FinanceMind app (`index.html` + `server.py`)
- AI Brain conversation memory + persistent context
- Inline editable bills/income/goals UI
- This dual-brain sync protocol (PROJECT_BRAIN.md drafting)
- Session-level continuity in chat-based workflows

---

## Next Phase Queue

```text
PHASE 4 RESYNC  Document Phase 4A/4B Music Lessons subsystem    ← PRIORITY
                (close 13A gap before more FM work)

FM-6A   Smart Month Safety Gate Preview        ✅ SHIPPED (fbc0737)
FM-6A.1 Mobile summary header hotfix           ✅ SHIPPED (027c191)
FM-6B   Month-over-Month Variance Panel        [after Phase 4 resync]
FM-7    Generate Next Month Draft              [after FM-6B]
FM-8    Save Draft to Airtable                 [backend, after FM-7]
B-5B    Save Travel Builder draft              [Airtable, gated]
C-3     Mya read-only Travel Builder           [after B-5B]
```

### Phase 4 Resync Spec (priority)

The brain has a known gap from `027c191` to `8fdd7ba`. Twelve commits added a Music Lessons / Piano Lessons / Invoicing UI that overlap with FinanceMind income concepts but are architecturally separate.

Resync task:
1. Audit all 12 commits — what each one changed
2. Add Section 13B to PROJECT_BRAIN documenting Music Lessons UI architecture
3. Confirm ADR-001 was honored (no Luke leakage, no `service_recipient_name` regression)
4. Map the boundary in `MotesartOS.jsx` between FinanceMind code and Music Lessons code

**Do NOT advance to FM-6B until this resync is committed.**

### FM-6A live state in production (reference)

```text
Verdict:        BLOCKED (visible in production right now)
Counts:         2 blocking · 3 review · 1 passing
Placement:      bottom of FM overview, below Capital One Ledger
Element:        <details id="sg-details"> — collapsed by default
Mobile:         summary count text hidden < 480px (FM-6A.1)
Scroll links:   6 anchors → upstream panels (mt-preview, capone-preview,
                alignment-check, smart-month-preview)
```

### FM-6B Spec (deferred — do NOT build until Phase 4 resync done)

Show what changed vs prior month, preview-only:
- Income difference (live vs prior month, projection vs prior month)
- Bill difference per category
- MT subscription delta (added / removed / amount changes)
- Capital One spend delta
- Unconfirmed items list (pending amounts, stale data)

Hard constraints (same as FM-6A):
- Preview-only, no save, no Airtable
- No new dependencies
- Pure derived state — verdict computed from existing data
- Placement TBD — recommend below Safety Gate, above FM to-do list

### Visual Verification Required After Codex Build

```text
1. FinanceMind overview loads
2. Smart Month Alignment Check appears
3. Smart Month Preview appears
4. MT Subscriptions Preview appears
5. Capital One Ledger Preview appears
6. Smart Month Safety Gate appears (collapsed, BLOCKED badge visible)
7. No live totals changed
8. No React error
```

If any line fails: stop, capture, fix on Codex first.

---

## ⚠️ Travel Builder Scope Has Expanded (NEW — read before any TB commit)

Travel Builder is no longer single-traveler / single-stop Chicago. As of 2026-05-04 the trip spans **Jun 12–22**, two travelers, three legs:

```text
Kadence:  LAX → JFK    Jun 12 (depart)
Motes:    LGA → ORD    Jun 13 (depart)
Motes:    ORD → LGA    Jun 14 or 15 (return)
Kadence:  JFK → LAX    Jun 22 (return)
Anchor:   Kayliah graduation, Wintrust Arena, Jun 14 AM
Hotel:    Marriott Marquis (pre-booked, confirm w/ Dad)
Total:    $1,081–$1,231 estimated
```

Implications for Codex side (`MotesartOS.jsx`):
- Travel Builder data model needs `traveler` field on leg objects
- Single-traveler assumption must be removed
- **Hardcoded Chicago Audit gate must now flag MDW references** — Chicago airport is ORD, not MDW
- Single-stop assumption must be removed; trip is multi-leg

Implications for Claude side (standalone app):
- Memory currently incorrect (says LGA→MDW, Jun 12–15) — needs update on next session
- Scope is now Jun 12–22, ORD not MDW, two travelers

See PROJECT_BRAIN Section 6A for full plan.

---

## What I'm Asking You To Do

1. **Read `PROJECT_BRAIN.md`** in full when next prompted on FinanceMind / Motesart OS.
2. **Re-authorize the GitHub connector** for `Motesart-OS` and `Deployable-python-codebase-som`.
3. **Maintain audit gate behavior** — keep catching math mismatches like FM-4. That's your highest-value role right now.
4. **Update the brain** at the end of any session where you order a phase or change architecture. Don't let your changes leave only Codex commits and chat history behind.
5. **Respect surface sync** — if Codex builds something on MotesartOS.jsx, flag it for Claude port. If Claude builds something on standalone, flag it for Codex port.

---

## Pending User Confirmations

These block live overwrites — do not push past them:
1. What items make up the missing $418.49 in MT subscriptions?
2. What is the Phone Bill amount in Capital One?
3. Should MT expected sheet total remain $653.77 or be revised?
4. WU church income — always active or add on/off toggle later?
5. When do we update `D.income` in standalone app from $3,428 to the new ~$4,123 baseline?

---

## Sync Confirmation

After you've read this and the brain, reply to the user with:
```text
SYNC ACK: ChatGPT aligned to PROJECT_BRAIN landed at repo SHA 8fdd7ba.
Brain coverage verified through 027c191. 12-commit Phase 4A/4B Music Lessons
gap acknowledged (Section 13A).
Priority: Phase 4 resync before FM-6B.
ADR-001 preserved: Evelyn=payer, Luke=SOM-only, service_recipient_name=learner.
Travel Builder scope: Jun 12–22, two travelers, ORD not MDW.
```

That tells Motes you're current and the dual brain is closed-loop.
