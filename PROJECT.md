# PROJECT.md — Motesart-OS (Mya Control Center)

> Repository: `github.com/Motesart27/Motesart-OS` · HEAD at audit: `ff8710a`
> Live: https://motesart-os.netlify.app/os
> This document is the architecture overview. For known issues see `GAPS.md`. For day-to-day operating rules see `CLAUDE.md`.

---

## 1. What this is, in plain language

Motesart OS is a **single-operator executive dashboard** — a private "command center" for one person, Denarius Motes, to run all of his businesses and personal life from one screen. Internally it is also called the **Mya Control Center**, after "Mya," the AI dispatcher/chief-of-staff persona that routes work.

It is a web app (a React single-page app) that Denarius logs into at `/os`. From there he can:

- See a per-business dashboard (E7A music agency, School of Motesart, FinanceMind, Book project) plus a Personal view, each with its own brief, notifications, to-dos, and — for E7A — an artist roster.
- Talk to AI "agents" in a chat panel (Mya/PA, E7A, SOM, FM, Book), each with its own system prompt.
- Use **Mya Dispatch**: type or speak a message, have it AI-classified and routed to the right "lane" (PA, Book, SOM, Personal Claude, OS, Finance), with an offline queue and receipts.
- Run backend **"Executives"** (autonomous workers) for a business and see their result.
- Review and approve/revise **content approval** items (e.g. an Instagram cover frame for an artist).
- Use several bespoke operational tools built directly into the dashboard: a **Travel Builder** (multi-leg trip budgeter/itinerary), a **Music/Piano Lessons** invoicing surface, a **FinanceMind** preview stack (Smart Month income projection, subscription reconciliation, Capital One ledger, a "Safety Gate"), a **Book Manager**, and a personal **Jean cycle tracker**.

**Audience:** exactly one privileged user (the owner/admin). There is no multi-tenant model, no public signup, no "student" or "team" surface here. Sister apps handle those:

- The **student/teacher** platform is a *different* repo (`school-of-motesart`).
- The **Book Manager** full app is a *different* repo (`book-manager`).
- The **backend/API** is a *different* repo (`Deployable-python-codebase-som`, Python on Railway).

This repo is **frontend only**. It renders UI and calls the backend over HTTP. It never touches Airtable, Anthropic, Deepgram, or ElevenLabs directly in the intended production path — those all live behind the Railway backend.

---

## 2. Tech stack and why each piece is here

| Layer | Choice | Why it appears to have been chosen |
|---|---|---|
| UI framework | **React 18.3** (`react`, `react-dom`) | Owner/agents already know React; the whole dashboard is one big component tree with local state. |
| Routing | **react-router-dom 6.22** | Two real routes (`/login`, `/os`) plus redirects. Chosen over Next.js because this is a pure SPA with no SSR needs. |
| Build tool | **Vite 5.4** (`@vitejs/plugin-react`) | Fast dev server + simple `vite build` → static `dist/`. Config is a 6-line `vite.config.js`. |
| Styling | **Inline style objects** + a shared `T` token map; **Tailwind 3.4** is installed but barely used | The luxury dark/gold look is done with JS style objects (`const T = {bg, surface, gold, ...}`) and hand-written CSS + media queries in `index.html`. Tailwind/PostCSS/autoprefixer are wired but almost no `className` utilities are used. See GAPS. |
| Charts | **Chart.js 4.4** via CDN `<script>` in `index.html` | Used by in-dashboard charts (e.g. Travel Builder / lessons). Loaded globally, not imported as a module. |
| Hosting | **Netlify** (`publish = "dist"`) | Static SPA hosting + edge redirects + Netlify Functions. |
| API proxy | **Netlify redirect** `/api/*` → Railway | Lets the frontend call `/api/...` relatively and have it proxied to the Python backend, avoiding CORS and hardcoding. |
| Serverless | **Netlify Functions** (`netlify/functions/osauth.mjs`) | One function exists (a login endpoint) — but see GAPS: it is orphaned and holds a committed password. |
| PWA | `public/manifest.json` + apple-touch metas in `index.html` | The dashboard is meant to be installed on an iPhone home screen ("Executive Command Center"), hence heavy mobile CSS and a mobile-proof shipping gate in CLAUDE.md. |
| Declared-but-unused | `express`, `serve` deps; `"start": "node server.js"` script | Leftover from a different serving strategy. There is **no `server.js`** in the repo. Dead. |

**Language:** plain JavaScript/JSX. There is no TypeScript, no `tsconfig.json`, no type checking. There is **no test runner and no ESLint config**.

---

## 3. Architecture: how the pieces fit

```
                          ┌─────────────────────────────────────────────┐
   Browser (iPhone/desktop PWA)                                          │
   ┌───────────────────────────────────────────────────────────────┐    │
   │  index.html  →  src/main.jsx                                   │    │
   │    <BrowserRouter>                                             │    │
   │      <ToastProvider>            (src/components/Toast.jsx)      │    │
   │        <AuthProvider>           (src/context/AuthContext.jsx)  │    │
   │          <App/>                 (src/App.jsx)                  │    │
   │            /login → Login.jsx                                  │    │
   │            /os    → PrivateRoute → ErrorBoundary               │    │
   │                       → MotesartOS.jsx  ◄── THE WHOLE APP      │    │
   │                          (5,200-line monolith:                │    │
   │                           Sidebar, PA chat, Dispatch panel,   │    │
   │                           per-business dashboard, Travel      │    │
   │                           Builder, FinanceMind panels,        │    │
   │                           Book manager, Settings, Personal,   │    │
   │                           Piano lessons, Executives)          │    │
   └───────────────────────────────────────────────────────────────┘    │
        │ fetch()                                                        │
        │  • absolute:  ${VITE_API_URL}/api/...   (prod)                 │
        │  • relative:  /api/...  → Netlify proxy (fallback)             │
        ▼                                                                │
   ┌───────────────────────┐   netlify.toml redirect (force=true)        │
   │  Netlify (this repo)   │   /api/*  →  Railway  /api/:splat           │
   │  static dist/ + SPA    │───────────────────────────────────────────►│
   │  fallback /* → index   │                                            ▼
   └───────────────────────┘                          ┌──────────────────────────────┐
                                                       │  Railway backend (SEPARATE   │
                                                       │  repo: Deployable-python-... )│
                                                       │  deployable-python-codebase- │
                                                       │  som-production.up.railway.app│
                                                       │                              │
                                                       │  /auth/login  (JWT issue)    │
                                                       │  /api/agent   (agent chat)   │
                                                       │  /api/mya/dispatch, /voice,  │
                                                       │     /tts                     │
                                                       │  /api/dispatch(-tasks)       │
                                                       │  /api/executives/{name}/run  │
                                                       │  /api/approvals              │
                                                       │  /api/calendar, /api/settings│
                                                       │  /api/travel/brief, lessons  │
                                                       │  /health                     │
                                                       └──────────────┬───────────────┘
                                                                      ▼
                                              Airtable · Anthropic · Deepgram · ElevenLabs
                                              · Google Calendar  (all backend-side secrets)
```

### The three-layer split (mental model)
1. **Presentation (this repo):** React SPA on Netlify. Owns look, local state, and the offline dispatch queue. Holds *no* real secrets in the intended design.
2. **Proxy (this repo's `netlify.toml`):** rewrites `/api/*` to the Railway origin so the SPA can be origin-agnostic.
3. **Brains + data (other repos):** the Python backend on Railway does all AI calls, Airtable reads/writes, calendar, and auth token issuance.

### Data flow, concretely
- **Login:** `Login.jsx` → `api.login(email, pw)` → `POST ${VITE_API_URL}/auth/login` → backend returns `{ token, user }`. Token (a JWT) is stored in `localStorage.som_token`; user in `localStorage.som_user`. `AuthContext` gates `/os`.
- **Session "verification":** on boot, `AuthContext` calls `api.verifySession()`, which **only base64-decodes the JWT payload locally and checks `exp`** — it does not call the backend or verify the signature (the code comments claim otherwise; see GAPS).
- **Agent chat:** `PAAgentChat` → `POST /api/agent` with `{ agent: "PA"|"E7A"|"SOM"|"FM"|"BOOK", messages }`. The agent key is uppercased via `AGENT_API_MAP` (a hard backend contract — see CLAUDE.md rule).
- **Mya Dispatch:** `MyaDispatchPanel` → `dispatchService.executeDispatch()` → `POST /api/mya/dispatch`. Separately it tries to AI-classify the message by calling `/.netlify/functions/claude` (which does not exist in this repo — it 404s and the flow falls back). Dispatches and an offline retry queue live in `localStorage` (`_mos_dispatches`, `_mos_queue`).
- **Executives:** `useExecutiveRun("som")` → `POST /api/executives/som/run` (`{}` or `{dry_run:true}`). `useExecutiveHealth` polls `api.wake()` → `GET /health` every 60s and greys the tile out when down.
- **Approvals:** `useApprovals` → `GET /api/approvals`; if it fails, it falls back to the hardcoded seed in `src/config/approvals.js`. Approve/revise/undo are optimistic `PATCH /api/approvals/:id` with rollback-on-error.
- **Everything else on the dashboard** (business briefs, artist roster, notifications, to-dos, Personal schedule) is **hardcoded mock data** in `MotesartOS.jsx` (`BUSINESSES`, `DEMO_NOTIFICATIONS`, `PERSONAL`).

---

## 4. Key design decisions (inferred from the code)

1. **Frontend is a dumb terminal; the backend is the brain.** The header comment in `MotesartOS.jsx` is explicit: *"DO NOT call Anthropic directly from browser in production. DO NOT add features until backend proxy exists."* Secrets, AI, and Airtable are deliberately kept server-side. (The dispatch AI-classify path and the localStorage `_mos_key` API key partly violate this intent — see GAPS.)
2. **One monolith component on purpose (for now).** `MotesartOS.jsx` is ~5,200 lines and defines ~30 sub-components inline (Sidebar, PAAgentChat, TravelBuilderPanel, SmartMonthSafetyGate, BookManagerPanel, etc.). This is a solo-operator app built fast by AI pair-programming; the monolith keeps everything in one editable surface. New self-contained features (approvals modal, executive tile, toasts, piano lessons) *have* been extracted into `src/components/` — that is the intended direction of travel.
3. **Local-first, backend-optional.** Almost every surface degrades gracefully: approvals fall back to seed data, executives show "Offline," dispatch queues offline and retries, Travel Builder/Book/Jean persist entirely in `localStorage`. The app is designed to stay usable when Railway is asleep (Railway free tier sleeps — hence the "Wake servers" button on the login screen).
4. **Netlify `/api/*` proxy so the SPA is origin-agnostic.** Rather than bake the Railway URL everywhere, relative `/api/...` calls are proxied. (In practice `VITE_API_URL` is *also* used as an absolute base in many places, so both patterns coexist — an inconsistency, see GAPS.)
5. **Design system as a JS token object, not Tailwind.** `const T = {...}` centralizes the dark/gold palette and is passed around. This keeps theming in one place without a build-time CSS pipeline. Multiple components redeclare their own copy of `T` (drift risk).
6. **Governance encoded in docs, not code.** The repo carries an unusually heavy "brain" layer: `CLAUDE.md` (repo law incl. a non-bypassable mobile-proof shipping gate), `PROJECT_BRAIN.md` (state), `INTEGRATION.md` (dispatch spec), `docs/CHATGPT_RESYNC.md`, and `project-brain/ai-alignment-fable-maximization.md`. Multiple AI agents (Claude Code, Codex, ChatGPT) and the owner coordinate through these files. This is a core, load-bearing part of the project's process even though it is not executable.
7. **"Federation, not unification."** Per the `som-project` skill/constitution: Mya routes but carries no domain expertise; each business has (or will have) its own backend "Executive." This repo is the Mya/OS surface only; it deliberately does not contain SOM student pages or the Book app.

---

## 5. Critical paths — what is load-bearing vs. safe to touch

### Load-bearing (change only with care and verification)
- **`src/pages/MotesartOS.jsx`** — literally the entire dashboard. A crash here white-screens `/os` (caught by `ErrorBoundary` into a "Something went wrong" page). Everything routes through it.
- **`src/context/AuthContext.jsx` + `src/services/api.js`** — the auth gate and the single HTTP client. Break these and nothing loads or every call 401s. Note `api.js` is the *contract surface* with the backend: endpoint paths and shapes here must match Railway.
- **`netlify.toml`** — the `/api/*` proxy and SPA fallback. Remove the fallback and every deep link 404s; remove the proxy and relative `/api` calls break.
- **`src/services/dispatchService.js`** — dispatch flow, offline queue, and the localStorage schema (`_mos_dispatches`, `_mos_queue`). Also the `ROUTES` map is a product contract.
- **Backend endpoint contracts** — the string paths and JSON shapes in `api.js`, `dispatchService.js`, `useExecutiveRun.js`, `PianoLessonsSection.jsx`. These are a contract with the *other* repo (Railway). Changing a path or field here silently breaks a live integration.
- **`AGENT_API_MAP`** (uppercase agent codes) — a hard backend contract (`/api/agent` rejects non-uppercase; CLAUDE.md rule 3).

### Safe-ish to change (self-contained, local, or mock)
- **Mock data** in `MotesartOS.jsx`: `BUSINESSES`, `DEMO_NOTIFICATIONS`, `PERSONAL`. Editing text/todos is cosmetic.
- **Extracted components**: `Toast.jsx`, `ErrorBoundary.jsx`, `ExecutiveTile.jsx`, `AppLauncherCard.jsx`, `ApprovalPreviewModal.jsx`, `ActiveTasksSection.jsx`, `JeanCycleTracker.jsx` — well-scoped, low blast radius.
- **Config seeds**: `src/config/approvals.js`, `src/config/appLaunchers.js`. Documented as data-shape-only, meant to be swapped for backend fetches later.
- **Styling tokens** inside a single component (but watch for duplicated `T` maps).

### Special rule (from the repo's own CLAUDE.md)
No frontend change may be called "done/shipped/green/verified" without a **mobile-proof gate**: desktop check + mobile at 390×844 + mobile at 430×932 (or a real phone screenshot) + a reviewed screenshot + an explicit `MOBILE_PASS | MOBILE_FAIL | MOBILE_NOT_TESTED`. If mobile is untested, status must be stated as **DEPLOYED_NOT_SHIPPED**. Treat this as binding.

---

## 6. Surprising / non-obvious things that will trip you up

1. **The whole app is one file.** If an edit "doesn't take," you're probably editing an extracted component that the monolith doesn't use, or vice versa. Search `MotesartOS.jsx` first.
2. **`osauth.mjs` looks like the login path but isn't the one used.** The frontend logs in via `${VITE_API_URL}/auth/login` on Railway. The Netlify function at `/api/login` is orphaned *and* is shadowed by the `force=true` `/api/*` → Railway proxy. It also contains a **hardcoded email + password + HMAC secret committed to git** (see GAPS — high severity).
3. **"Session verification" doesn't verify anything server-side.** `AuthContext`/`api.verifySession` only base64-decode the JWT and check expiry in the browser. The comments say it re-checks Airtable; it does not.
4. **Dispatch AI classification points at a Netlify function that doesn't exist.** `dispatchService.classifyDispatch` fetches `/.netlify/functions/claude`; there is no such function in the repo, so it 404s and silently falls back to a canned receipt. The actual dispatch still posts to `/api/mya/dispatch`.
5. **Environment variable names are inconsistent.** Code reads `VITE_API_URL` (most places), `VITE_API_BASE_URL` (`PianoLessonsSection.jsx`), and `FM_APP_URL` (`api.js` — note: **no `VITE_` prefix, so Vite never exposes it** → `api.fm()` is effectively dead). There is no `.env` / `.env.example` committed.
6. **API base is sometimes absolute, sometimes relative.** Some fetches use `${VITE_API_URL}/api/...` (absolute, bypassing the Netlify proxy), others use `/api/...` (relative, using the proxy), others hardcode the full Railway URL as a fallback. All three "work" in prod but the proxy is only exercised when `VITE_API_URL` is empty.
7. **Route vocabulary ≠ business vocabulary.** Dispatch `ROUTES` use `finance`; the task/biz system uses `fm`. `dispatchService` bridges them with a `_bizMap`. `useDispatchTasks` only accepts `som|fm|e7a|book|os`.
8. **`PROJECT_BRAIN.md` is deliberately stale and says so.** It documents state up to SHA `027c191` and openly admits a 12-commit gap; the repo is now ~34 commits past its landing SHA `8fdd7ba`. Trust it for *income rules and ADR-001*, not for current build state. It is a FinanceMind-scoped doc, not a whole-repo doc.
9. **`ExecutiveTile` offline copy is hardcoded to "SOM backend"** even when the tile represents FM/E7A/Book. Cosmetic but misleading.
10. **`"npm start"` is dead.** It runs `node server.js`, which doesn't exist. Use `npm run dev` (Vite) or `npm run build` + a static server / `npm run preview`.
11. **Two of Denarius's real credentials are in git history**: the login email is prefilled in `Login.jsx`, and `osauth.mjs` has a real password string. Rotate before this repo is ever shared.
12. **Chart.js is a global from a CDN `<script>`**, not an npm import — code assumes `window.Chart` exists.

---

## 7. Where to look first (orientation checklist)
- Read `CLAUDE.md` (repo law + the mobile-proof gate).
- Skim `src/App.jsx` → `src/pages/MotesartOS.jsx` top comment + the `MotesartOS()` function (~line 4480) to see how tabs/businesses compose.
- Read `src/services/api.js` and `src/services/dispatchService.js` — the two files that define the backend contract.
- Check `GAPS.md` before "fixing" anything — several oddities are intentional or are known, deferred issues.
- Ignore `PROJECT_BRAIN.md` for current build truth; use it only for FinanceMind income rules and ADR-001.
