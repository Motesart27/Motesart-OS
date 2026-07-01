# Source Authority Matrix — FinanceMind

**Status:** Documentation lock only. Do not build features from this file until Denarius approves the next phase.
**Last Updated:** 2026-07-01

This matrix defines what FinanceMind may trust before any audit, migration, or backend build work continues. The core rule is simple:

- Bank/Plaid wins for whether money moved.
- Excel wins for what the transaction means.
- Airtable is a structured backend candidate until proven against Excel.
- FinanceMind and AI tools explain verified calculations; they do not create financial truth.

## Authority Overview

| Source | Contains | Reachable today | Access mode | Current authority | Limitation / risk |
|---|---|---|---|---|---|
| Bank / Plaid | Transactions, balances, deposits, withdrawals, recurring charges, money in, money out. | Unconfirmed in current repo audit. | Read-only evidence unless a verified backend bank-feed path exists. | Highest for "did money move?" exact amount/date/balance questions. | Does not know business meaning, reimbursement context, Dr. Mo terms, settlement meaning, or manual corrections. |
| ChatGPT Finances | Reference dashboard view of finances, if available to Denarius. | Unconfirmed as an export/API source. | Reference only unless official export/API path is verified. | Same category as bank evidence only when data provenance is verified. | Do not assume it can export directly to Codex, Airtable, Excel, or FinanceMind. |
| Excel master ledger: `Denarius_Financial_-_2026_v2.xlsx` | Reimbursement logic, Dr. Mo book-management terms, manually confirmed balances, settlement rules, payback notes, corrections, finance explanations, and Denarius-confirmed meanings. | Unconfirmed. Must be placed where the audit system can read it, such as connected Drive, OneDrive/SharePoint, or an uploaded audit copy. | Audit should treat as read-only until Denarius approves any write/import path. | Highest for "what does this transaction mean?" | If only local, the system cannot read it yet. Workbook location must be verified before automation is promised. |
| Airtable | Bills, bill events, income events, balances, trips, trip line items, piano students, invoices, invoice line items, reimbursements, settlements, dashboard records. | Partially known from repo docs: FinanceMind base ID `appkksRRCOGUotdl8`; table reachability still requires audit. | No writes until Denarius approves controlled update. | Backend candidate / structured mirror. Only authoritative for fields proven synced from Excel or explicitly approved by Denarius. | Must not be called source of truth until Excel comparison passes or Denarius approves migration. |
| FinanceMind app | Dashboard states, due/paid views, review flags, explanations, previews, changed-item summaries, workflow actions. | Yes, as app code in repo. Exact live data sources require Phase 0 audit. | Display/workflow layer. | Not a finance source. It can show verified calculations and review queues. | Preview state and app-only state must not become financial truth silently. |
| localStorage / snapshots | Runtime snapshots, drafts, preview state, possibly cached dashboard data. | Likely present from current architecture notes; exact keys require Phase 0 audit. | App-local runtime persistence. | App-only convenience state. | Never authoritative for money movement or business meaning. |
| Seed/static data | Hardcoded or prompt/static defaults in the app. | Likely present from older FinanceMind architecture notes; exact values require Phase 0 audit. | Read-only app defaults unless changed in code. | Not authoritative. Useful only as legacy context. | May be stale; must be reconciled with Excel and bank evidence. |
| Backend API | FinanceMind routes for bills/accounts/savings/monthly and possible Airtable reads. | Unconfirmed in current repo audit. | Depends on route and environment. | Implementation layer only. | API output is only as authoritative as the upstream source and audit status. |
| Manual uploads/imports | Uploaded Excel/CSV/export files or one-off audit inputs. | Unconfirmed. | Read-only audit input unless Denarius approves import/writeback. | Can be authoritative if Denarius identifies the file as the current verified export. | Must track file date, origin, and whether it is a copy or live master. |
| ChatGPT / Mya / Claude / Codex | Audit, comparison, explanation, build proposals, documentation, code changes after approval. | Yes as agent tools, but not finance systems. | No autonomous finance writes. | Not finance sources. | Must never decide financial truth alone, handle bank credentials, or write to Excel/Airtable/calendar/email without explicit approval. |

## Field Authority Map

| Field / decision type | Excel field/source | Airtable field/source | App-only field/source | Manually verified by Denarius | Winner if Excel and Airtable disagree | Winner if bank/Plaid and Excel disagree | Unconfirmed today |
|---|---|---|---|---|---|---|---|
| Transaction happened | Reference/notes only unless Excel records the event. | Possible linked bill/payment status. | Displayed status only. | When bank data is unavailable or ambiguous. | Excel for meaning, but not raw movement. | Bank/Plaid wins for whether money moved. Excel may still win for categorization/meaning. | Verified bank/Plaid feed path. |
| Amount posted | Manual correction or ledgered amount. | Bill/event/income amount. | Preview amount or UI total. | Required when bank feed and ledger differ. | Excel unless Airtable is proven synced for that field. | Bank/Plaid wins for posted amount; discrepancy goes to Denarius review. | Which Airtable amount fields are synced from Excel. |
| Transaction date / posted date | Ledger date or corrected business date. | Due date, bill event date, income event date, trip date. | Calendar/display grouping. | Required for settlement or reimbursement interpretation. | Excel unless Airtable field is proven synced. | Bank/Plaid wins for posted date; Excel can hold business-effective date. | Date semantics by Airtable table. |
| Balance | Manually confirmed balance. | Bank_Balances or dashboard balance records. | Display/cache only. | Required before live budget decisions. | Excel unless Airtable balance is proven synced. | Bank/Plaid wins for current raw balance; Excel wins for manually reconciled business balance. | Whether Airtable balances mirror Excel or bank feed. |
| Reimbursement split | Master split logic and payback notes. | Reimbursement/settlement records if present. | Review/explanation display. | Yes. | Excel wins. | Excel wins for meaning; bank/Plaid only confirms money received/sent. | Airtable reimbursement schema and sync status. |
| Responsible person / who owes whom | Excel notes and confirmed agreements. | Reimbursement/settlement/person fields if present. | Dashboard assignment only. | Yes. | Excel wins. | Excel wins for meaning. | Which Airtable person fields are approved. |
| Dr. Mo book-management terms | Excel master ledger and notes. | Airtable only if explicitly mirrored. | Explanation text only. | Yes. | Excel wins. | Excel wins for meaning. | Airtable representation of Dr. Mo terms. |
| Settlement meaning | Excel settlement rules/payback notes. | Settlement records if present. | Review labels only. | Yes. | Excel wins. | Excel wins for meaning; bank/Plaid confirms settlement movement. | Settlement table/fields in Airtable. |
| Paid/unpaid status | Excel verified status or manual correction. | Bill events/status fields. | UI status display. | Required when inconsistent. | Excel wins until Airtable is proven synced. | Bank/Plaid can prove payment moved; Excel decides whether obligation is satisfied. | Whether status is derived or manually maintained in Airtable. |
| Due dates | Excel verified due date or billing rule. | Bill event due date. | Calendar display. | When source conflict exists. | Excel wins unless Airtable field is explicitly approved. | Excel/Airtable due date is business schedule; bank/Plaid can only confirm actual movement date. | Which source currently feeds FinanceMind due dates. |
| Invoice line items / piano student records | Excel only if maintained there; otherwise Denarius-approved business record. | Piano students, invoices, invoice line items. | Draft invoice UI. | Yes for financial posting. | Excel for financial meaning unless Denarius approves Airtable operational truth. | Bank/Plaid confirms payments; Excel/approved records define invoice meaning. | Whether invoice records should sync back to Excel. |
| Trip line items | Excel only if used for trip accounting. | Trips and trip line items. | Travel Builder draft/review state. | Yes before booking/payment decisions. | Excel for financial meaning until Airtable trip accounting is approved. | Bank/Plaid confirms booked charges; Excel/approved itinerary defines meaning. | Current trip fields and sync status. |
| Review flags / explanations | May be noted in Excel. | May be dashboard/review records. | FinanceMind/Mya explanations. | Yes before action. | Excel for finance meaning; app may win only for workflow visibility. | Bank/Plaid or Excel depending on whether flag is movement or meaning. | Which review flags are persisted. |

## Tie-Break Rules

| Conflict | Rule |
|---|---|
| Bank/Plaid vs Excel on whether money moved | Bank/Plaid wins for movement, exact posted amount, posted date, and raw balance. Excel remains authority for meaning and whether the movement satisfies an agreement. |
| Bank/Plaid vs Excel on business meaning | Excel wins. Bank/Plaid does not know reimbursement splits, responsible person, Dr. Mo terms, or settlement context. |
| Excel vs Airtable | Excel wins until Airtable is proven to match Excel for the relevant field or Denarius explicitly approves Airtable as the operational source. |
| Excel silent, Airtable has data | Send to Denarius review unless the Airtable field has explicit approval as authoritative. |
| Airtable inconsistent with bank/Plaid | Bank/Plaid wins for movement. Business meaning still requires Excel or Denarius review. |
| App/localStorage/static data vs any external finance source | External verified source wins. App data is display/workflow state unless explicitly verified. |
| AI output vs any finance source | Finance source wins. AI may explain, compare, and propose actions only. |

## Phase 0 Repo Audit Checklist

Before build work resumes, confirm what FinanceMind reads today:

- Excel files or imports.
- Airtable base, tables, fields, and route usage.
- localStorage keys and snapshot shape.
- Seed/static data in app code.
- Plaid or other bank-feed integrations.
- Backend API routes and environment variables.
- Manual upload/import paths.

## Phase 1 Matrix Completion Checklist

This file must be updated after Phase 0 with:

- Every confirmed source.
- Whether each source is reachable today.
- Whether each source is read-only or writable.
- Which fields come from Excel.
- Which fields come from Airtable.
- Which fields are app-only.
- Which fields are manually verified by Denarius.
- Which source wins when Excel and Airtable disagree.
- Which source wins when bank data and Excel disagree.
- What remains unconfirmed.

## Controlled Update Rule

Do not write to Airtable, Excel, calendar, email, or bank-linked systems from an audit or build session without explicit Denarius approval. Controlled Airtable updates may only happen after Excel-first comparison, bank/Plaid comparison, Denarius review of conflicts, and an audit trail plan.
