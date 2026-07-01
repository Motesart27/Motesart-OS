# Excel Master Map — July 2026 Canonical Format

**Status:** Read-only structural map.
**Mapped:** 2026-07-01
**Canonical user-facing workbook name:** `Denarius Financial - January 2026 - Present.xlsx`
**Canonical workbook path:** `/Users/Denarius Motes/Downloads/Denarius Financial - January 2026 - Present.xlsx`
**Deprecated workbook path:** `/Users/Denarius Motes/Downloads/Motesart-OS/private/finance/Denarius_Financial_-_2026_v2.xlsx`
**OneDrive/SharePoint live-sync status:** Not confirmed. The canonical file was found as a local file in Downloads, not under `~/Library/CloudStorage`.
**Sheet mapped:** `July 26`

Important: the canonical source-of-truth decision names `Denarius Financial - January 2026 - Present.xlsx` as the master ledger. The older workbook at `/Users/Denarius Motes/Downloads/Motesart-OS/private/finance/Denarius_Financial_-_2026_v2.xlsx` is a deprecated drifting local audit copy and should no longer be used for new FinanceMind source-of-truth work.

## Workbook Sheets

- `Claude Log`
- `Dashboard`
- `Jan 26`
- `Feb 26`
- `Mar 26`
- `Apr 26`
- `May 26 `
- `June 26`
- `July 26`
- `Chart Data`
- `Template`

Sheet naming rule: month sheets run from `Jan 26` through `July 26` and follow the `MMM 26` pattern, except `May 26 ` currently includes a trailing space. Readers must normalize/strip sheet names when matching sheet names.

## Canonical July Layout

The `July 26` sheet uses a dashboard-style structure:

- Top summary and bank-balance area: rows 1-11.
- Income / expense / savings planning area: rows 13-32.
- Transaction breakdown area: rows 35-68.
- Credit-card transaction area: rows 71-82.
- Entity key / tag legend: column U, rows 2-7.

Merged label areas:

- `A1:G1`
- `A2:B2`
- `A13:B13`
- `A35:E35`
- `F36:H36`
- `F58:G58`
- `F68:G68`
- `A71:C71`
- `K71:N71`

## Summary Block Cell Map

| Area | Cells | Purpose |
|---|---:|---|
| Category selector / top label | `J1:J3` | Category labels for income and expenses. |
| Bank account balance block | `A4:B9` | Per-account starting balances. Account labels include Ma Sol, BOA Personal, Technologies, BOA Savings, and Oceanside. |
| Monthly income summary | `E3:E4` | Monthly income label and total formula. |
| Expense summary | `E6:E7`, `H5:H6` | Expense labels and formulas for expense totals. |
| Monthly savings summary | `E8:E9`, `H7:H8` | Savings labels and formulas. |
| Net remaining summary | `E10:E11`, `H9:H10` | Net remaining labels and formulas. |
| Entity key | `U2:U7` | Entity tag legend. |

Key summary formulas:

| Cell | Formula purpose |
|---|---|
| `E4` | Sums July income amount rows. |
| `H6` | Sums core expense rows from the planning area. |
| `E7` | Sums expanded expense rows from the planning area. |
| `H8` / `E9` | Sum savings deposit rows. |
| `H10` | Net remaining using monthly income, bills/expenses, and savings. |
| `E11` | Alternate net remaining formula using income, expenses, and savings. |

Verified July 2026 summary values, using label-anchored extraction rather than fixed-cell anchoring:

| Label | Verified value |
|---|---:|
| Monthly Income | 3910.73 |
| Expenses | 2559.46 |
| Monthly Savings | 1500 |
| Net Remaining | -148.73 |

## Income Section

| Columns | Header row | Meaning |
|---|---:|---|
| `A:D` | Row 14 | Income rows: date, source, amount, and an extra helper/category column. |
| `A14` | Row 14 | Date field. |
| `B14` | Row 14 | Source field. |
| `C14` | Row 14 | Amount field. |
| `D14` | Row 14 | Helper column currently labeled `Column1`. |

Observed income rows span approximately `A15:D32`.

Income source labels include music lessons, church income, cash assistance, music production, book management, and monthly carryover. The map intentionally does not reproduce dollar values.

## Expense Planning Section

| Columns | Header row | Meaning |
|---|---:|---|
| `E:F` | Row 14 | Expense planning rows: category and amount. |
| `E14` | Row 14 | Category field. |
| `F14` | Row 14 | Amount field. |

Observed expense planning rows include Ma Sol expenses, personal expense, technologies expenses, car-stash deposit, and technology-stash deposit. Several planning amounts are formulas tied to the detailed transaction blocks below.

Formula links:

- `F15` pulls from the Ma Sol transaction total at `R56`.
- `F16` pulls from the Personal transaction total at `H56`.
- `F17` pulls from the Technology transaction total at `C68`.
- `C31` pulls from the Book Management total at `H66`.

## Savings Section

| Columns | Header row | Meaning |
|---|---:|---|
| `J:K` | Rows 13-14 | Savings / stash blocks and amount fields. |

Savings areas include:

- Car Stash: `J14:K17`
- Technology Stash: `J19:K22`
- Ma Sol Stash: `J24:K27`
- Vacation Stash: `J29:K32`

Each stash area tracks starting balance, deposit, and ending balance or equivalent roll-forward formula.

## Transaction Breakdown Blocks

The canonical July sheet uses side-by-side expense blocks. The structure below is what downstream integrations should target.

| Block | Range | Header row | Columns | Budgeted / actual structure |
|---|---|---:|---|---|
| MT / Technology Transactions | `A36:D68` | 37 | `Due Date`, `Expense`, `Balance`, `Paid` | `Balance` is budgeted/expected amount. `Paid` tracks actual paid/spent amount. Remaining and total rows calculate variance. |
| Personal Transactions | `F36:I56` | 37 | `Due Date`, `Expense`, `Balance`, `Spent` | `Balance` is planned amount. `Spent` tracks actual spending. Remaining and total rows calculate variance. |
| Oceanside Transactions | `K36:N56` | 37 | `Due Date`, `Expense`, `Balance`, `Paid` | `Balance` is planned amount. `Paid` tracks actual payment. Remaining and total rows calculate variance. |
| Ma Sol Transactions | `P36:S56` | 37 | `Due Date`, `Expense`, `Balance`, `Paid` | `Balance` is planned amount. `Paid` tracks actual payment. Remaining and total rows calculate variance. |
| Book Management | `F58:I66` | 59 | `Due Date`, `Expense`, `Amount Due`, `Paid` | `Amount Due` is planned amount. `Paid` tracks actual payment. Total row calculates variance. |
| Credit Card Transactions | `A71:D82` | 72 | `Due Date`, `Capital One Transaction`, `Amount`, `Spent` | `Amount` is planned amount. `Spent` tracks actual spending. Remaining and total rows calculate variance. |

## Entity Tag Legend

| Cell | Tag |
|---|---|
| `U2` | `Key` |
| `U3` | `PC = Personal Account` |
| `U4` | `OS = Oceanside Management` |
| `U5` | `MT = Motesart Technology` |
| `U6` | `Ma Sol = Motes Audio Solutions` |
| `U7` | `CO = Capital One` |

The July workbook uses entity tags in labels and the key. It does not yet expose a normalized, dedicated entity-tag column for every transaction row. Downstream integration should preserve the visible block/entity mapping and should not infer cross-entity meaning from row labels alone without Denarius review.

## Important Formula / Calculated Fields

| Cell / range | Purpose |
|---|---|
| `I55`, `N55`, `S55` | Remaining-balance subtotals for actual/paid columns in Personal, Oceanside, and Ma Sol blocks. |
| `H56`, `M56`, `R56` | Block total formulas for Personal, Oceanside, and Ma Sol planned/balance columns. |
| `I56`, `N56` | Difference formulas for planned vs actual/paid in Personal and Oceanside. |
| `H66`, `I66` | Book Management total and variance formulas. |
| `D67`, `C68`, `D68` | Technology/MT remaining, total, and variance formulas. |
| `D81`, `C82`, `D82` | Credit Card remaining, total, and variance formulas. |

## Frozen Historical Sheets

Per the source-of-truth lock, sheets `Jan 26` through `June 26` are frozen historical record for this phase. They were not inspected or reconciled for this map.

## Integration Notes

- Treat the July sheet as the forward schema target.
- Treat Excel as the authority for transaction meaning.
- Do not modify the workbook from integration code in this phase.
- Do not write Airtable records from this map without a later approval phase.
- Preserve planned-vs-actual semantics: `Balance` / `Amount` / `Amount Due` are planned or expected fields; `Paid` / `Spent` are actual fields.
- Use the block location and entity key together when mapping rows into structured data.
