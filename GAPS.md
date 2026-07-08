# GAPS.md — Motesart-OS honest audit

> Audited at HEAD `ff8710a`. Ordered most-severe first. Each item: **what**, **where**, **why it matters**, **fix** (scoped to be executable as one task).
> Read this before "fixing" anything — a few oddities are intentional or deliberately deferred and are noted as such.

Severity legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · ⚪ LOW

---

## 🔴 1. Real credentials and a signing secret are committed to git
**What:** `netlify/functions/osauth.mjs` hardcodes the real admin login email, the real admin password, and the JWT-signing HMAC secret as string literals (values intentionally not repeated here — open the file). `src/pages/Login.jsx` also prefills the real admin email as the default input value.
**Where:** `netlify/functions/osauth.mjs` (lines 3–8: `const EMAIL`, `const PASSWORD`, and the `crypto.createHmac('sha256', ...)` secret), `src/pages/Login.jsx` (`useState(...)` email default).
**Why it matters:** The repo is public — anyone can read the admin password from the file or git history and can forge valid tokens with the known HMAC secret. This is the single highest risk in the codebase. It persists in git history even after deletion. Treat all three values as burned.
**Fix (do all, in order):**
1. Rotate the password immediately (owner action, outside code).
2. Move `EMAIL`, `PASSWORD`, and the HMAC secret to Netlify environment variables (`OSAUTH_EMAIL`, `OSAUTH_PASSWORD_HASH`, `OSAUTH_JWT_SECRET`); read them via `process.env`. Store a bcrypt/scrypt **hash**, not the plaintext password.
3. Remove the email default from `Login.jsx` (use `placeholder="Email"` instead of a prefilled value).
4. Scrub git history (git filter-repo/BFG) or rotate everything and treat the old secrets as burned.
> Note: this function is also *orphaned* (see #6) — but rotating/removing the committed secret is required regardless.
---

## 🟠 2. Session "verification" is client-side only and the comments claim otherwise
**What:** `AuthContext` says it will "Verify user still exists in Airtable on app boot" and "Refresh role from Airtable," but the actual implementation (`api.verifySession`) just base64-decodes the JWT payload in the browser and checks `exp`. No signature check, no backend call.
**Where:** `src/context/AuthContext.jsx` (mount effect), `src/services/api.js` (`verifySession()` — `JSON.parse(atob(t.split('.')[1]))`).
**Why it matters:** Anyone can hand-craft a `som_token`/`som_user` in localStorage with `role: "admin"` and a future `exp` and get into `/os` without ever authenticating. The gate is cosmetic. The misleading comments will also fool a future maintainer into thinking auth is stronger than it is. (Real protection only exists on whatever backend endpoints check the token server-side — and those must actually verify the signature.)
**Fix:** Make `verifySession()` call a real backend endpoint (e.g. `GET /auth/verify` with the bearer token) that validates signature + expiry server-side and returns the canonical user/role; treat any non-200 as logout. Until that endpoint exists, change the comments to state the truth ("local expiry check only — not a security boundary") so no one over-trusts it.

---

## 🟠 3. Anthropic API key handled in the browser (and the endpoint it posts to doesn't exist)
**What:** `dispatchService.classifyDispatch()` reads an Anthropic key from `localStorage` (`_mos_key` or `_fm_key`) and posts it as `x-api-key` to `/.netlify/functions/claude`. The app's own header comment in `MotesartOS.jsx` says *"DO NOT call Anthropic directly from browser in production."* There is **no `claude` function** in `netlify/functions/` (only `osauth.mjs`), so this call 404s and silently falls back.
**Where:** `src/services/dispatchService.js` (`classifyDispatch`, `getApiKey`), documented in `INTEGRATION.md` ("reads the API key from localStorage: `_mos_key` … `_fm_key`").
**Why it matters:** Two problems. (a) Security: storing/forwarding a raw model API key in the browser exposes it to any XSS or a curious user; it contradicts the project's stated architecture. (b) Correctness: AI classification never actually runs, so every dispatch receipt is the canned fallback — a feature that looks implemented but is dead.
**Fix:** Move classification server-side. Add a backend route (Railway) `POST /api/mya/classify` that holds the key in server env and returns the JSON receipt; change `classifyDispatch` to call it with the user's session bearer token, and delete the `_mos_key`/`_fm_key` localStorage path. If a stopgap is needed, create the missing `netlify/functions/claude.mjs` that reads the key from Netlify env (never from the client). Either way, stop reading the key from `localStorage`.

---

## 🟠 4. No tests exist for any critical path
**What:** There is no test runner, no test files, no CI. Zero coverage.
**Where:** whole repo (`package.json` has no `test` script; no `vitest`/`jest`/`@testing-library`).
**Why it matters:** The load-bearing logic is exactly the kind that breaks silently: the auth gate, the dispatch state machine + offline queue (`dispatchService.js`), the approvals optimistic-patch-with-rollback (`useApprovals.js`), and the Travel Builder localStorage validation. A regression in any of these ships straight to production (Netlify auto-deploys `main`).
**Fix (start small):** Add Vitest (`npm i -D vitest`), a `"test": "vitest"` script, and one spec file `src/services/dispatchService.test.js` covering the pure functions first: `genDispatchId` uniqueness, `buildReceipt` shape, `loadQueue/saveQueue` round-trip, and `executeDispatch` offline branch (mock `navigator.onLine=false`). Grow from there to `useApprovals` rollback. Keep each spec a single focused task.

---

## 🟡 5. Broken/dead build & serve scaffolding
**What:** `package.json` declares `"start": "node server.js"` and dependencies `express` and `serve`, but **there is no `server.js`** and neither dep is imported anywhere. Meanwhile `dispatchService` references a `netlify/functions/claude` that also doesn't exist (see #3).
**Where:** `package.json` (`scripts.start`, `dependencies.express`, `dependencies.serve`), missing `server.js`, missing `netlify/functions/claude.*`.
**Why it matters:** `npm start` fails outright; a newcomer will waste time. Unused deps bloat installs and imply a serving strategy that isn't real. Dangling function references imply a feature that isn't wired.
**Fix:** Remove the `start` script (or repoint it to `vite preview`), and remove `express` + `serve` from `dependencies`. Re-run `npm install` to refresh `package-lock.json`. Decide #3 separately (build the function or move classify server-side).

---

## 🟡 6. Two competing auth systems; the Netlify one is orphaned and shadowed
**What:** Auth exists in two places: (a) the frontend logs in via `${VITE_API_URL}/auth/login` on Railway (JWT), and (b) `netlify/functions/osauth.mjs` exposes `/api/login` with its own hardcoded check. Nothing in the frontend calls `/api/login`, and `netlify.toml` has `force = true` on `/api/*` → Railway, which shadows the function anyway.
**Where:** `src/services/api.js` (`login()` → `/auth/login`), `netlify/functions/osauth.mjs` (`config.path = '/api/login'`), `netlify.toml` (`/api/*` redirect, `force = true`).
**Why it matters:** Dead code that *looks* live invites someone to "fix" login by editing the wrong file, and it keeps a committed secret alive (#1). It also makes the auth story ambiguous.
**Fix:** Delete `netlify/functions/osauth.mjs` entirely (after confirming nothing depends on `/api/login`), OR, if a Netlify-native login is actually wanted, make it the real path and remove the Railway `/auth/login` usage — but not both. Pick one. Given the backend already issues JWTs, deleting the function is the simpler, safer choice.

---

## 🟡 7. `MotesartOS.jsx` is a ~5,200-line monolith with ~30 inline components
**What:** One file holds the entire dashboard: Sidebar, PAAgentChat, PersonalPanel, JeanMainView, BookManagerPanel, TravelBuilderPanel (~1,200 lines alone), the FinanceMind preview stack (SmartMonth*, MTSubscriptions, CapitalOne, SafetyGate), SettingsPanel, plus mock data and the root component.
**Where:** `src/pages/MotesartOS.jsx`.
**Why it matters:** Huge blast radius (a syntax error anywhere white-screens `/os`), painful diffs/merges (the git log shows repeated "hotfix", "revert", "emergency restore" churn around Travel Builder — a symptom), and no lazy-loading so first paint pulls everything. It also makes the mobile-proof gate harder because every change touches the same file.
**Fix (incremental, one component per task):** Extract self-contained panels into `src/components/` exactly as already done for `ExecutiveTile`, `ApprovalPreviewModal`, etc. Start with the biggest and most self-contained: move `TravelBuilderPanel` → `src/components/TravelBuilderPanel.jsx` (it already owns its own `localStorage` keys and helpers). Then `BookManagerPanel`, then the FinanceMind panels. Keep each extraction behaviour-preserving and mobile-verify per CLAUDE.md.

---

## 🟡 8. Environment-variable names are inconsistent, and one is silently dead
**What:** Three different names for effectively the backend base URL: `VITE_API_URL` (most files), `VITE_API_BASE_URL` (`PianoLessonsSection.jsx`), and `FM_APP_URL` (`api.js`). `FM_APP_URL` has **no `VITE_` prefix**, so Vite never exposes it to the client bundle — `api.fm()` always resolves to a relative path against the SPA origin. There is no `.env.example` documenting any of them.
**Where:** `src/services/api.js` (`VITE_API_URL`, `FM_APP_URL`), `src/components/PianoLessonsSection.jsx` (`VITE_API_BASE_URL`), plus many `import.meta.env.VITE_API_URL` reads in `MotesartOS.jsx`.
**Why it matters:** A misconfigured or renamed env var means whole surfaces silently hit the wrong origin (or the SPA itself) and return HTML instead of JSON. The dead `FM_APP_URL` means the FinanceMind fetch helper never worked as intended.
**Fix:** Standardize on `VITE_API_URL` everywhere; replace `VITE_API_BASE_URL` in `PianoLessonsSection.jsx` and remove/repurpose `FM_APP_URL` (either delete `api.fm()` or give it a real `VITE_FM_URL`). Add a committed `.env.example` listing `VITE_API_URL` (and any others) with comments. One task.

---

## 🟡 9. API base URL is sometimes absolute, sometimes relative, sometimes hardcoded
**What:** Backend calls use three patterns: `${VITE_API_URL}/api/...` (absolute, bypasses the Netlify proxy), `/api/...` (relative, uses the proxy), and a hardcoded `https://deployable-python-codebase-som-production.up.railway.app` fallback in a few files.
**Where:** `src/services/api.js` (absolute), `src/pages/MotesartOS.jsx` (`${VITE_API_URL || ""}/api/agent`, `/api/settings`, `/api/travel/brief` with hardcoded fallback), `src/components/MyaDispatchPanel.jsx` and `PianoLessonsSection.jsx` (hardcoded Railway fallback), `netlify.toml` (`/api/*` proxy).
**Why it matters:** The Netlify proxy is only exercised when `VITE_API_URL` is empty, so it's effectively an accident which path a given call takes. Hardcoded origins defeat the point of the proxy and make environment moves (staging, new backend URL) error-prone.
**Fix:** Choose one convention. Recommended: always call relative `/api/...` and let `netlify.toml` proxy handle routing; delete `VITE_API_URL` prefixes and hardcoded Railway URLs. This centralizes the backend origin in one place (`netlify.toml`). Do it file-by-file, verifying each surface still reaches the backend.

---

## 🟡 10. `PROJECT_BRAIN.md` claims coverage it doesn't have
**What:** `PROJECT_BRAIN.md` headers say "Brain coverage verified through `027c191`" and "Repo HEAD at brain landing `8fdd7ba`," with an admitted 12-commit gap. The repo is now at `ff8710a` — ~34 commits past `8fdd7ba`. So the brain is missing the entire Travel Builder Phase C-3/C-4 line, the per-person split, and the AI-alignment brain.
**Where:** `PROJECT_BRAIN.md` (Sections 13A, 14), vs `git log 8fdd7ba..HEAD`.
**Why it matters:** The file is presented as "the single canonical state," but it is stale and FinanceMind-scoped. A future agent that trusts the header will act on a months-old picture. (To the file's credit, its own Section 13A anti-drift rule says to update the gap rather than fake coverage — that rule just hasn't been followed since.)
**Fix:** Run `git log 8fdd7ba..HEAD --oneline`, append the drifted commits to Section 13A, and correct the header to "coverage verified through `027c191`; repo HEAD `ff8710a`; ~34 undocumented commits (Travel Builder C-3/C-4 + AI-alignment brain)." Do not claim coverage you didn't verify. Better long-term: retire `PROJECT_BRAIN.md` as "canonical" and point people to `PROJECT.md` for architecture and `GAPS.md` for issues, keeping the brain for FinanceMind income rules + ADR-001 only.

---

## 🟡 11. Half-finished data layer: core dashboard is still hardcoded mock data
**What:** The top-of-file comment lists "LIVE NEEDED: Airtable fetch for brief/notifications/approvals/artist data," but `BUSINESSES` (artist rosters, briefs, todos, campaign %), `DEMO_NOTIFICATIONS`, and `PERSONAL` are all hardcoded constants. Only approvals/dispatch/executives/agent/calendar/lessons are actually backed by the API. Approvals themselves fall back to a hardcoded seed.
**Where:** `src/pages/MotesartOS.jsx` (`BUSINESSES`, `DEMO_NOTIFICATIONS`, `PERSONAL`), `src/config/approvals.js` (seed).
**Why it matters:** The dashboard *looks* live but most of it is a static prototype. Notification counts, artist stages, campaign percentages, and to-dos never change. Anyone demoing or trusting these numbers will be misled.
**Fix:** One surface at a time, replace a mock constant with a fetch + loading/fallback (mirror the `useApprovals` pattern: try backend, fall back to the constant). Start with notifications: add `GET /api/notifications` consumption and a `useNotifications` hook, keeping `DEMO_NOTIFICATIONS` as the fallback. Leave the constant in place as the offline default.

---

## ⚪ 12. Route vs. business vocabulary drift
**What:** Dispatch `ROUTES` use `finance`; the task/executive system uses `fm`. They're bridged ad-hoc by `_bizMap = { finance:'fm', pa:'os', claude:'os', ... }`. `useDispatchTasks` only accepts `som|fm|e7a|book|os` (not `pa`, `claude`, or `finance`).
**Where:** `src/services/dispatchService.js` (`ROUTES`, `_bizMap`), `src/hooks/useDispatchTasks.js` (`VALID_BIZ`).
**Why it matters:** Two overlapping taxonomies invite mis-routing and make it easy to add a route that silently maps to `os`. The `pa`/`claude` routes have no task-biz home.
**Fix:** Document the canonical mapping in one place (a `ROUTE_TO_BIZ` constant exported from `dispatchService.js`) and have both `dispatchService` and `useDispatchTasks` import it. Don't redefine the mapping inline. One task.

---

## ⚪ 13. The design-token object `T` is duplicated across files (drift risk)
**What:** The dark/gold palette `const T = {...}` is redefined independently in `MotesartOS.jsx`, `ApprovalPreviewModal.jsx`, `MyaDispatchPanel.jsx` (with *different* values, e.g. `gold: '#c9a644'` vs `#c9a84c`), and `ExecutiveTile.jsx` (as `C`).
**Where:** `src/pages/MotesartOS.jsx`, `src/components/ApprovalPreviewModal.jsx`, `src/components/MyaDispatchPanel.jsx`, `src/components/ExecutiveTile.jsx`.
**Why it matters:** Colors already disagree between panels; a theme change must be made in ≥4 places and will drift further.
**Fix:** Create `src/config/theme.js` exporting the canonical `T`, and import it everywhere; delete the local copies. Reconcile the two gold values to one during the move. One task, mechanical.

---

## ⚪ 14. `ExecutiveTile` offline copy is hardcoded to "SOM"
**What:** The offline body text reads "SOM backend is unreachable…" regardless of which executive (`FM`, `E7A`, `Book`) the tile represents.
**Where:** `src/components/ExecutiveTile.jsx` (offline `<p>` block).
**Why it matters:** Misleading when FM/E7A/Book tiles go offline; contradicts the component's own "reusable, different props" docstring.
**Fix:** Replace the literal "SOM" with the `label` prop already in scope (e.g. `` `${label} backend is unreachable…` ``). One-line change.

---

## ⚪ 15. Errors are swallowed silently in many places
**What:** Numerous `catch {}` / `catch(){}` blocks discard errors with no logging or user feedback: `saveDispatches`, `saveQueue`, `quickDispatch` ("fire-and-forget — silently ignore"), several `localStorage` reads, and best-effort task promotion in `executeDispatch`.
**Where:** `src/services/dispatchService.js` (multiple), `src/pages/MotesartOS.jsx` (localStorage getters/setters).
**Why it matters:** Real failures (quota exceeded, corrupt JSON, backend 500s) vanish. Debugging "why didn't my dispatch save?" becomes guesswork. It also hides the missing-`claude`-function 404 (#3).
**Fix:** Route swallowed errors through a single `logError(scope, err)` helper (even just `console.warn`) so failures are observable in the console; keep the user-facing behavior graceful. Add it to the fire-and-forget paths first. One task.

---

## ⚪ 16. Repo hygiene: committed `.DS_Store`, unused deps, empty PWA offline story
**What:** `./.DS_Store` and `src/.DS_Store` are committed despite `.gitignore` listing `.DS_Store` (they were added before the ignore rule). The app markets itself as an installable PWA (manifest + apple metas) but ships **no service worker**, so there's no real offline shell. `public/brand/.gitkeep` and several `logoSrc: null // TODO` placeholders indicate unfinished branding.
**Where:** `./.DS_Store`, `src/.DS_Store`, `public/manifest.json` + `index.html` (PWA metas, no SW registration), `src/config/appLaunchers.js` (TODO logos).
**Why it matters:** Minor, but `.DS_Store` in git is noise/lint; the "PWA" claim is half-true (installable, not offline-capable); TODO logos mean launcher cards render initials, not brand.
**Fix:** `git rm --cached .DS_Store src/.DS_Store` (they're already ignored going forward). Decide explicitly whether offline matters — if yes, add a minimal service worker; if no, drop the "offline" framing. Treat the logo TODOs as a backlog item, not a bug.

---

## ⚪ 17. Documentation contradicts itself on backend + Airtable base
**What:** The repo `CLAUDE.md` says "Backend: Python **Flask**" and "Airtable: SOM base (`appTN4wNd5Kgbqdwl`)." `INTEGRATION.md` and the `som-project` constitution say the OS/dispatch base is `app4GKdk1AqmiOyKx` and the backend is **FastAPI**. This repo never talks to Airtable directly, so the base ID here is informational — and wrong-looking.
**Where:** `CLAUDE.md` (repo), `INTEGRATION.md`, external `som-project` skill.
**Why it matters:** A newcomer wiring anything Airtable-adjacent will trust the wrong base ID / framework. Low impact only because the frontend doesn't use it, but it erodes doc trust.
**Fix:** Correct `CLAUDE.md` to state the frontend touches no Airtable directly (all via Railway), and if a base must be named, use the ones the backend actually uses per the constitution. Remove the Flask/FastAPI ambiguity by not asserting the backend framework in a frontend repo. (Handled in the CLAUDE.md rewrite accompanying this audit.)

---

## ⚪ 18. `INTEGRATION.md` instructs `git add -A`, which the project's own rules forbid
**What:** The deploy snippet in `INTEGRATION.md` says `git add -A`. The `som-project` build discipline explicitly bans `git add -A` ("always stage files explicitly by name").
**Where:** `INTEGRATION.md` (Deploy section).
**Why it matters:** Copy-paste deploy instructions that violate the constitution will occasionally sweep in `.DS_Store`, local env files, or half-finished work.
**Fix:** Replace `git add -A` with explicit `git add src/components/MyaDispatchPanel.jsx src/services/dispatchService.js` (the files that step actually adds). One edit.

---

## Deferred-by-design (not bugs — do not "fix" without checking)
- **Voice is intentionally staged.** `MyaDispatchPanel` VAD constants (`RMS 30 / 750ms / 45s`) and the greeting pool are live; a Phase 1.5 note in `INTEGRATION.md` says some voice/transcription bits are deliberately incomplete.
- **`appLaunchers.js` FM/Book/VitalStack entries are staged but not rendered** ("LOCK 3"). That's on purpose; don't wire them without approval.
- **`approvals.js` / mock data are seeds** meant to be replaced by Airtable fetches in a later phase (documented in-file). They are fallbacks, not accidents.
- **`PROJECT_BRAIN.md` FinanceMind blockers** (MT variance $418.49, Capital One phone bill PENDING) are open *business* items, not code defects.
