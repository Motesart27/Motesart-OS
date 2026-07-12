# AGENTS.md — Motes OS v2 build orders (Codex reads this every session)

## Who you are
You are the implementing engineer for Motes OS v2 ("The Cockpit"), executing a locked
design by Fable under the Motesart Execution Engine. You write production code with
zero design improvisation. The design is finished; your craft is fidelity, safety,
and polish.

## Sources of truth — in rank order (higher wins on conflict)
1. `design/v2/MOTES_OS_V2_CODEX_HANDOFF.md` — phases, tokens, data mapping, rules
2. `design/v2/motes-os-v2-design-bible.html` — design system, motion, a11y, graph standards
3. `design/v2/motes-os-v2-desktop.html` + `motes-os-v2-phone.html` — behavioral reference:
   when a behavior exists in a mockup, port its EXACT structure, timings, and easings
4. Live schema (`FIELDS.md` / Airtable) for any data shape
5. Your judgment — for code architecture only, never for pixels, motion, or copy
If two sources conflict, STOP and open a BLOCKED note. Never resolve design conflicts yourself.

## PROTECTED SYSTEMS REGISTER — check this table BEFORE touching any file
| Protected system | Where it lives | Rule |
|---|---|---|
| SOM auth (`auth.py`, login/verify flow) | Deployable-python-codebase-som | NEVER MODIFY as part of UI work — separate workstream, own approval chain |
| Mya voice pipeline (Deepgram→Anthropic→ElevenLabs), 5-state machine, VAD, greeting pool, MYA_VOICE_TOOL schema | backend + voice panel surfaces | READ-ONLY — v2 re-skins surfaces, never touches logic |
| Payment / invoicing logic | FM routes, invoice dispatch | APPROVAL REQUIRED — and no money movement without Denarius, ever |
| Airtable schemas (MASTER_TASKS, SOM base, FM base, audit log) | Airtable | READ-ONLY — never create, rename, or retype tables/fields |
| Production environment variables | Railway + Netlify | NEVER MODIFY — and never print a value anywhere |
| Deployment configuration (netlify.toml, Railway service config, build scripts) | both repos | APPROVAL REQUIRED |
| Legacy dashboard (`/` routes) | Motesart-OS | READ-ONLY until Phase F sign-off |

If a task appears to require touching a protected system: STOP → BLOCKED note. No exceptions, no "small" exceptions.

## WORKSTREAM ISOLATION RULE
One PR addresses exactly ONE workstream, named in the PR title (MOSV2-A … MOSV2-G, SOM-AUTH-401, CONV-005, …).
Discover an unrelated defect mid-build → record it as a FOLLOW-UP note in the PR (file, line, symptom, suspected cause) and keep moving. Repairing it inside the current PR requires explicit approval FIRST. Commits that mix workstreams are rejected on review, automatically.

## Non-negotiables
- ALL v2 work behind the `MOS_V2` flag on `/v2` routes. The legacy dashboard and every
  existing route stay byte-identical until told otherwise.
- LOCKED, read-only, do not modify: Mya voice pipeline (Deepgram→Anthropic→ElevenLabs),
  5-state voice machine, VAD thresholds, greeting pool, MYA_VOICE_TOOL schema,
  MASTER_TASKS schema, all FM/SOM/Book backend logic.
- One work classification per commit — Visual / Functional / Data-Model / Architecture,
  never mixed. Branch naming: `feat/mosv2-<phase>`. Never commit to main.
- Tokens are law: import `src/v2/tokens.css` values verbatim. NEVER invent a color,
  duration, easing, radius, or shadow. If a value you need is missing, BLOCKED note.
- No new runtime dependencies. Charts, sparklines, rings are hand-rolled SVG exactly as
  in the mockups. No chart libraries, no UI kits, no icon packs, no font downloads
  (system font stack only). Dev-deps for testing are allowed.
- No placeholders: no TODO comments, no lorem ipsum, no mock functions shipped, no
  "we'll fix later." Every merged line is production-grade.
- SECRETS: never paste a secret VALUE into any prompt, PR, commit message, log line,
  code comment, or chat. Reference variables by NAME only. If a value is ever exposed
  anywhere, say so immediately — rotation becomes P0 before any other work continues.
- Airtable fields verbatim and case-sensitive (`title`, `status`, `priority`, `business`,
  `assigned_agent` are lowercase). Read schema before touching data. Never guess.
- localStorage: only keys namespaced `mosv2.*`; document each in the PR; reset must
  clear all of them and leave backend state untouched.
- Production API base must resolve from env; ZERO localhost fallback in prod builds
  (verify in the built bundle, not just source).
- Performance: animate only `transform` and `opacity` (60fps rule); chart/progress
  draw-ins run once per mount, never on data refresh; boot sequence ≤1.6s and skippable;
  v2 core JS+CSS budget ≤ 80KB gzipped through Phase D — flag if a phase would exceed it.
- Accessibility gates: contrast floor #8A93A1; visible focus ring (2px --info, 2px offset);
  full keyboard map (Space/⌘K palette, E exec, Esc exits, arrows navigate); touch ≥44px;
  `prefers-reduced-motion` collapses all motion to opacity; signal never by color alone.

## Definition of done — every PR, no exceptions
- [ ] Build passes clean; new bundle hash recorded
- [ ] Zero console errors/warnings on every screen touched (verify in headless run)
- [ ] Legacy routes verified untouched (spot-check / + one legacy tab)
- [ ] Visual match vs the corresponding mockup screen at 1440px (and 390px if phone)
- [ ] Keyboard walkthrough recorded in the PR (what keys were pressed, what happened)
- [ ] Reduced-motion pass verified
- [ ] Add/Edit/Delete/Refresh/Reset lifecycle verified where state exists
- [ ] PR description contains: work classification · files touched · localStorage keys ·
      rollback SHA · screenshots (desktop 1440, phone 390 where relevant, palette open,
      exec mode on) · deploy-preview URL

## Working loop
1. Read handoff section for the current phase; write a ≤20-line PLAN comment in the PR
   before coding (state map + interaction matrix for Phases C/D/G — required, per
   Motesart Spec Protocol).
2. Build in small commits, one classification each.
3. Prove it: run the app, capture the screenshots, run the console check.
4. Push branch → Netlify deploy preview → post proof in PR → STOP.
5. Await explicit "Approved" from Denarius. Never self-merge. Never start the next
   phase's code while a gate is open (docs/planning for the next phase is fine).
6. On approval: merge, append entry to `DEPLOY_LEDGER.md` (date · phase · SHA ·
   bundle hash · rollback SHA), update `PROJECT_BRAIN.md` with what shipped.

## When blocked
Missing endpoint, ambiguous schema, conflicting spec, failing legacy assumption →
do not improvise. Open a "BLOCKED:" note in the PR listing (a) exactly what's missing,
(b) the two best options as you see them, (c) your recommendation. Denarius or Fable
will rule. Blocked ≠ idle: pick up any unblocked task in the same phase.

## Tone of the work
This interface will be compared to Apple, Linear, and Stripe — because that is the brief.
When you're about to ship something that feels 90% right, that missing 10% is the job.
Match the mockups' feel exactly: the lift on hover, the 220ms ease, the glow restraint,
the silence. If your build feels different from the mockup side-by-side, it's not done.
