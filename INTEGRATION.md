# MYA DISPATCH — INTEGRATION SPEC
## For Claude Code — drop into Motesart OS repo

---

## FILES TO ADD

```
src/components/MyaDispatchPanel.jsx   ← main UI component (overlay panel)
src/services/dispatchService.js       ← portable dispatch logic (no React dependency)
```

Copy both files into the existing `Motesart-OS` repo at these exact paths.

---

## WIRE INTO MotesartOS.jsx

### Step 1 — Import at top of file

```jsx
import MyaDispatchPanel from "../components/MyaDispatchPanel";
```

### Step 2 — Add state (inside the main component function, near other useState calls)

```jsx
const [dispatchOpen, setDispatchOpen] = useState(false);
```

### Step 3 — Render the panel (at the bottom of the JSX return, before the closing wrapper div)

```jsx
<MyaDispatchPanel open={dispatchOpen} onClose={() => setDispatchOpen(false)} />
```

### Step 4 — Replace the PA Agent button action

Find the PA Agent button in the bottom nav. It currently looks something like:

```jsx
<div onClick={...} ...>
  <span>◆</span>
  <span>PA Agent</span>
</div>
```

Change its onClick to:

```jsx
onClick={() => setDispatchOpen(true)}
```

Keep the gold diamond icon and "PA Agent" label. The panel opens as a fullscreen overlay.

### Step 5 — Also add a floating dispatch button (the yellow circle in bottom-right)

If the yellow circle FAB exists, wire it the same way:

```jsx
onClick={() => setDispatchOpen(true)}
```

---

## ARCHITECTURAL RULES (NON-NEGOTIABLE)

1. **Mya Dispatch lives ONLY in Motesart OS** — never in FinanceMind
2. **FinanceMind is a receiver only** — reads from shared Airtable `MYA_Dispatch` table filtered to `route: finance`
3. **Dispatches originate ONLY from Motesart OS** — sub-apps receive, not originate
4. **`client_dispatch_id`** is generated on every dispatch for dedup
5. **Source tag** on every receipt: `📱 From Motesart OS — {time}`
6. **Route config is hardcoded in code** — not in Airtable (Phase 1)
7. **Voice is Phase 1.5** — button exists but is disabled

---

## AIRTABLE SETUP (existing base: app4GKdk1AqmiOyKx)

### Table: MYA_Dispatch

| Field | Type | Notes |
|-------|------|-------|
| client_dispatch_id | Single line text | PRIMARY KEY — for dedup |
| message | Long text | The dispatch message |
| route | Single select | pa, book, som, claude, os, finance |
| priority | Single select | low, normal, high, urgent |
| status | Single select | pending, routed, queued, failed |
| source | Single line text | Always "motesart-os" for now |
| ai_route | Single line text | What AI classified |
| ai_confidence | Single select | high, medium, low |
| ai_reason | Long text | Why AI chose this route |
| ai_summary | Long text | Receipt summary |
| ai_next_action | Long text | Suggested next step |
| ai_category | Single select | task, question, request, update, escalation |
| created_at | Date + time | When dispatched |

### Table: MYA_Attachments

| Field | Type | Notes |
|-------|------|-------|
| dispatch_id | Single line text | Links to client_dispatch_id |
| file_name | Single line text | Original filename |
| file_type | Single line text | MIME type |
| file_size | Number | Bytes |
| file_url | URL | After upload to storage |

---

## API KEY

The component reads the API key from localStorage:
- `_mos_key` (Motesart OS key) — checked first
- `_fm_key` (FinanceMind key) — fallback

Both apps share the same Anthropic key. Set it once in either app's settings.

---

## DEPLOY

```bash
cd ~/Downloads/Motesart-OS
# Files are already in place
git add -A
git commit -m "feat: MYA Dispatch Hub — mobile dispatch panel integrated into PA Agent"
git push origin main
# Netlify auto-deploys from main
```

Live URL: motesart-os.netlify.app

---

## WHAT THIS DOES NOT TOUCH

- FinanceMind (`index.html`) — no changes
- Railway backend — no changes yet (Airtable write comes in Phase 2)
- Auth (`osauth.mjs`) — no changes
- Other Motesart OS pages/tabs — no changes
- PWA manifest/icons — already set up Apr 11

---

## PHASE ROADMAP

### Phase 1 (THIS BUILD)
- [x] MyaDispatchPanel.jsx component
- [x] dispatchService.js module
- [x] AI classification via Anthropic
- [x] Receipt cards
- [x] Offline queue + auto-retry
- [x] `client_dispatch_id` dedup
- [x] `finance` route for FinanceMind bridge
- [ ] Wire into MotesartOS.jsx (Claude Code)
- [ ] Create Airtable tables
- [ ] Deploy

### Phase 1.5
- [ ] Voice upload + transcription (OpenAI Whisper)
- [ ] Transcript → dispatch auto-fill

### Phase 2
- [ ] Railway `POST /api/mya/dispatch` writes to Airtable
- [ ] FinanceMind "Incoming from Mya" dashboard card
- [ ] Airtable webhook → notification
