# Motesart OS — Execution Engine Context

## WHAT THIS REPO IS
Executive OS Dashboard ONLY.
URL: motesart-os.netlify.app
Route: /os (admin login required)

## WHAT THIS REPO IS NOT
- NOT the SOM student/teacher platform (that is: school-of-motesart repo)
- NOT the Book Manager (that is: book-manager repo)

## ARCHITECTURE
Frontend: React + Vite → Netlify (motesart-os)
Backend: Python Flask → Railway (deployable-python-codebase-som-production.up.railway.app)
Airtable: SOM base (appTN4wNd5Kgbqdwl)

## KEY FILES
- src/pages/MotesartOS.jsx — THE ENTIRE OS DASHBOARD
- src/pages/Login.jsx — Admin login gate

## RULES
1. Never add SOM student/teacher pages to this repo
2. Never push without Execution Engine approval
3. Agent field in /api/agent must be UPPERCASE
4. Build → Preview → Approval → Push always

## RULE 3A — MOBILE PROOF SHIPPING GATE (NON-BYPASSABLE)

No frontend change may be called **complete, shipped, green, verified, or done**
unless ALL five conditions are true:

1. Desktop check completed
2. Mobile viewport check completed at **390×844**
3. Mobile viewport check completed at **430×932** OR real phone screenshot supplied
4. Screenshot or visual proof reviewed
5. Result explicitly marked as one of:
   - `MOBILE_PASS`
   - `MOBILE_FAIL`
   - `MOBILE_NOT_TESTED`

If `MOBILE_NOT_TESTED`, the work status MUST be stated as:
> **DEPLOYED BUT NOT SHIPPED**

### Forbidden phrases (unless mobile proof exists)
`done` · `shipped` · `complete` · `green` · `verified` · `fully working` · `final`

### Required closure format for every frontend change

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

This rule cannot be waived, skipped, or satisfied by assumption.
If mobile cannot be tested, the closure block must say `DEPLOYED_NOT_SHIPPED`.
