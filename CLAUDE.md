# CLAUDE.md — Motesart OS (Mya Control Center)

Read at the start of every session. This file is **repo law**: commands, conventions, gotchas, and no-touch rules. It holds *rules*, not *state*.
- Architecture & data flow → **PROJECT.md** (what talks to what, why, critical paths).
- Known issues, ordered by severity, each with a scoped fix → **GAPS.md** (check it before "fixing" anything — some oddities are intentional).
- FinanceMind income rules + ADR-001 only → `PROJECT_BRAIN.md` (stale for everything else; do not trust its "current state").

## WHAT THIS REPO IS
Executive OS dashboard **only** — a private, single-operator command center ("Mya Control Center").
- Live: https://motesart-os.netlify.app · Route: `/os` (admin login required).
- Frontend only: React + Vite → Netlify. It calls a **separate** Python backend on Railway (`deployable-python-codebase-som-production.up.railway.app`) for everything real (AI, Airtable, calendar, auth tokens). This repo holds **no** Airtable/AI code and should hold **no** secrets.

## WHAT THIS REPO IS NOT
- NOT the SOM student/teacher platform → repo `school-of-motesart`.
- NOT the Book Manager app → repo `book-manager`.
- NOT the backend/API → repo `Deployable-python-codebase-som` (Railway).

## Commands
```bash
npm install                 # deps: react 18, react-router-dom 6, vite 5
npm run dev                 # Vite dev server → http://localhost:5173
npm run build               # → static dist/  (what Netlify publishes)
npm run preview             # serve the production build locally
# npm start  → DEAD: runs `node server.js`, which does not exist. Do not use. (GAPS #5)
```
- **No tests, no lint, no typecheck exist** (no vitest/jest, no `.eslintrc`, no tsconfig — this is plain JS/JSX). If you add tests, use Vitest and add a `"test"` script (GAPS #4).
- **Deploy:** push to `main` → Netlify auto-builds and deploys. `netlify.toml` proxies `/api/*` → Railway (`force = true`) and SPA-falls-back `/*` → `index.html`.
- **Env:** set `VITE_API_URL` (the Railway base) in Netlify UI / local `.env` (not committed; no `.env.example` exists yet — add one if you touch env). Vite only exposes vars prefixed `VITE_`.

## RULES (do not violate)
1. **Never add SOM student/teacher pages or the Book app here.** Wrong repo (see above).
2. **Never push without Execution Engine approval.** Flow is always **Build → Preview → Approval → Push**.
3. **The `agent` field sent to `/api/agent` must be UPPERCASE** (`PA|E7A|SOM|FM|BOOK`). It's a hard backend contract via `AGENT_API_MAP` in `MotesartOS.jsx`. Same for backend endpoint paths/JSON shapes in `src/services/api.js` and `dispatchService.js` — change both sides or neither.
4. **Secrets stay server-side (Railway).** Never commit a key, password, or signing secret; never read an API key from `localStorage`; never call Anthropic/Deepgram/etc. from the browser. (The repo currently violates this — see GAPS #1 and #3 — treat those as bugs to remove, not patterns to copy.)
5. **Surgical edits only. Read the live file before editing; never rewrite a working file.** Local memory is untrusted — the monolith changes often.
6. **One feature per session.** No silent dependency changes. No `git add -A` — stage files explicitly by name.
7. **`main` is production.** There is no staging. A bad merge ships to the owner's live dashboard.

## RULE 3A — MOBILE PROOF SHIPPING GATE (NON-BYPASSABLE)
No frontend change may be called **complete, shipped, green, verified, or done** unless ALL five are true:
1. Desktop check completed.
2. Mobile viewport check at **390×844**.
3. Mobile viewport check at **430×932** OR a real phone screenshot.
4. Screenshot / visual proof reviewed.
5. Result explicitly marked `MOBILE_PASS` · `MOBILE_FAIL` · `MOBILE_NOT_TESTED`.

If `MOBILE_NOT_TESTED`, status MUST be stated as **DEPLOYED BUT NOT SHIPPED**.
Forbidden unless mobile proof exists: `done` · `shipped` · `complete` · `green` · `verified` · `fully working` · `final`.

Required closure block for every frontend change:
```
FRONTEND CLOSURE BLOCK:
- Code committed:       [yes / no / SHA]
- Netlify deploy state: [building / live / failed]
- Desktop tested:       [yes / no]
- Mobile 390×844:       [pass / fail / not tested]
- Mobile 430×932:       [pass / fail / not tested]
- Screenshot reviewed:  [yes / no]
- Final status:         SHIPPED | DEPLOYED_NOT_SHIPPED | FAILED
```
This rule cannot be waived, skipped, or satisfied by assumption. (The app is an installed iPhone PWA — mobile is the primary surface.)

## Conventions this codebase follows
- **File layout:** entry `src/main.jsx` → `App.jsx` (routes `/login`, `/os`). `/os` is the whole app: `src/pages/MotesartOS.jsx` (~5,200 lines, ~30 inline sub-components). Extracted, reusable pieces live in `src/components/`; API/logic in `src/services/`; hooks in `src/hooks/`; seed/config data in `src/config/`. **New self-contained features should be new files in `src/components/`, not more monolith** (GAPS #7).
- **State:** local React state only — no Redux/Zustand/context store beyond `AuthContext` (auth) and `ToastProvider` (toasts). Persistence is `localStorage`. Known keys: `som_user`, `som_token`, `_mos_dispatches`, `_mos_queue`, `_mos_key`/`_fm_key` (Anthropic key — being removed, GAPS #3), `jean_*`, `bk_*` (Book), `TB_*`/`fm_itin_v1`/travel draft (Travel Builder).
- **Backend calls:** go through `src/services/api.js` (the HTTP client + token attach) or `dispatchService.js`. Prefer relative `/api/...` (Netlify proxy) over hardcoding the Railway URL; today the code mixes both (GAPS #9) — don't add new hardcoded origins.
- **Auth:** `AuthContext` holds `user`; `PrivateRoute` gates `/os`. Login → `${VITE_API_URL}/auth/login` → JWT in `localStorage.som_token`. NOTE: `verifySession()` only decodes the JWT locally (no server check) — it is **not** a security boundary (GAPS #2).
- **Styling:** dark/gold luxury theme done with **inline `style={{}}` objects** + a `T` token map (`bg #070709`, `surface #0c0c10`, `card #111116`, `gold #c9a84c`, `green #4caf7d`, `blue #5a8fc9`, `amber #c9914c`, `red #c95a5a`). Tailwind is installed but effectively unused — don't reach for utility classes; match the existing inline style. Mobile responsiveness lives in raw CSS + media queries in `index.html` (`.os-sidebar`, `.os-content-area`, etc.). Fonts: DM Sans (UI), Chart.js loaded via CDN `<script>` (global `window.Chart`).
- **Error handling:** fetch helpers throw on `!res.ok`; UI degrades gracefully (approvals fall back to seed, executives show "Offline," dispatch queues offline). `ErrorBoundary` wraps `/os`. Avoid the existing silent `catch {}` pattern — log via `console.warn` at least (GAPS #15).
- **Business/route vocabularies:** businesses/executives use `som|fm|e7a|book|os`; dispatch routes use `pa|book|som|claude|os|finance`; they're bridged by `_bizMap` in `dispatchService.js`. Keep the mapping in one place (GAPS #12).

## Gotchas (looks-like-X-but-isn't)
1. **Edit "doesn't take effect"** → you edited an extracted component the monolith doesn't import, or edited the monolith when a component owns it. Grep `MotesartOS.jsx` first.
2. **`netlify/functions/osauth.mjs` is NOT the live login** and holds a committed password + HMAC secret. Frontend logs in via Railway `/auth/login`; the function is orphaned and shadowed by the `/api/*` proxy. Don't "fix login" here (GAPS #1, #6).
3. **Dispatch AI classification is dead** — `dispatchService.classifyDispatch` posts to `/.netlify/functions/claude`, which doesn't exist → 404 → canned fallback receipt. The dispatch itself still posts to `/api/mya/dispatch` (GAPS #3).
4. **`api.fm()` never worked** — it reads `FM_APP_URL` (no `VITE_` prefix) so Vite leaves it undefined (GAPS #8).
5. **Most of the dashboard is mock data** — `BUSINESSES`, `DEMO_NOTIFICATIONS`, `PERSONAL` are hardcoded in `MotesartOS.jsx`; notification counts and campaign %s never change. Only approvals/dispatch/executives/agent/calendar/lessons are backend-backed (GAPS #11).
6. **`ExecutiveTile` offline text always says "SOM"** even for FM/E7A/Book (GAPS #14).
7. **Railway sleeps (free tier)** → first call after idle fails; the login screen's "Wake servers" button hits `/health`. Expect cold-start latency, not a bug.
8. **`PROJECT_BRAIN.md` is stale by ~34 commits** and FinanceMind-scoped — trust it for income rules + ADR-001 only (GAPS #10).
9. **`.DS_Store` files are committed** (added before `.gitignore`); don't add more (GAPS #16).

## Generated / do-not-hand-edit
`dist/` (Vite build output), `node_modules/`, `package-lock.json` (npm-managed). There is no `.next`, no build cache to clear.

## Session close
End every session with the RULE 3A closure block for any frontend change, and update `GAPS.md` if you resolved or discovered an issue. Do not update `PROJECT_BRAIN.md` headers to claim coverage you didn't verify — append to its gap section instead.
