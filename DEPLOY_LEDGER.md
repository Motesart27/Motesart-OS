# Deploy Ledger

## 2026-07-12 — MOSV2-A

- **Workstream:** MOSV2-A
- **Phase:** A — Graphite Foundation
- **PR:** #9
- **Feature branch:** `feat/mosv2-a-foundation`
- **Approved cure SHA:** `ec85c16deb7d7fe3c8b2df6dfca2343268d8d8ca`
- **Merge/main SHA:** `60d19cfafb58b258a9d4b052175ffdd8aba35699`
- **Rollback SHA:** `dab30c952e8f091aa2a39175539cd0c545c0fdba`
- **Preview:** https://deploy-preview-9--motesart-os.netlify.app/v2
- **Design QA:** READY FOR APPROVAL — Round 3
- **Approval:** Denarius Motes, July 12, 2026
- **Bundle:** Phase A v2 chunks 5.60 kB gzip
- **Feature flag:** `VITE_MOS_V2`
- **Production value:** `false`
- **Deploy Preview value:** `true`
- **Status:** PHASE A COMPLETE
- **Follow-up:** F-1 pre-existing deprecated `apple-mobile-web-app-capable` shell meta; add the recommended `mobile-web-app-capable` tag in a separate approved workstream

## 2026-07-12 — SOM-AUTH-401

- **Workstream:** SOM-AUTH-401
- **System:** School of Motesart backend
- **Incident:** Authentication failure plus false-negative health monitoring
- **Initial symptom:** `POST /auth/login` returned 401
- **Authentication root cause:** Stale or malformed `MASTER_LOGIN_PASSWORD` state loaded at backend startup
- **Monitoring root cause:** Runtime shell route registry was not the authoritative deployed endpoint contract
- **Resolution:**
  - Rotated `MASTER_LOGIN_PASSWORD`
  - Applied the Railway variable change
  - Restarted/redeployed the backend
  - Replaced route-registry checks with canonical in-process OpenAPI validation
  - Removed temporary runtime topology diagnostics
- **Login:** PASS
- **Authenticated hard refresh:** PASS
- **`/auth/verify` flow:** PASS
- **`/health`:** HTTP 200, overall GREEN
- **Required route checks:** GREEN
- **Airtable:** GREEN
- **Optional calendar:** GREEN and non-blocking
- **`MASTER_LOGIN_EMAIL`:** Unchanged
- **`JWT_SECRET`:** Unchanged
- **Frontend API target:** Unchanged and correct
- **Final backend main SHA:** `0c0ea198a6b778c67af775e945fce08f9e3119c4`
- **Closure authority:** Denarius Motes
- **Closure date:** July 12, 2026
- **Status:** SOM-AUTH-401 CLOSED
