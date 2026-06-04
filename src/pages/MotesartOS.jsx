/**
 * Motesart_OS_Dashboard.jsx
 * VERSION: v2 -- REFINED DARK LUXURY UI pass
 *
 * This is the Motesart OS -- a unified operator dashboard for all Motesart businesses.
 * It is NOT the same artifact as E7A_Agent_System_v2.jsx (the smaller agent console).
 *
 * ARTIFACT:     Motesart OS
 * SCOPE:        All businesses + Personal
 * STATUS:       UI complete, backend proxy not yet wired
 *
 * MOCK DATA:    DEMO_BRIEF, DEMO_NOTIFICATIONS, DEMO_APPROVALS -- prototype only
 * LIVE NEEDED:  Airtable fetch for brief/notifications/approvals/artist data
 *
 * BACKEND ENDPOINTS NEEDED (future):
 *   POST /api/agent         -- PA / E7A / SOM / FM / BOOK agent chat
 *   GET  /api/brief         -- weekly brief from Airtable
 *   GET  /api/notifications -- live notifications from Airtable Tasks
 *   GET  /api/approvals     -- content approval items from Content Calendar
 *   GET  /api/artists       -- artist roster from Airtable Artists table
 *   GET  /api/vitals        -- VitalStack health data (when API ready)
 *
 * DO NOT add features until backend proxy exists.
 * DO NOT call Anthropic directly from browser in production.
 * DO NOT modify agent system prompts without version bump.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import MyaDispatchPanel from "../components/MyaDispatchPanel";
import ExecutiveTile from "../components/ExecutiveTile";
import { useToast } from "../components/Toast";
import useExecutiveRun from "../hooks/useExecutiveRun";
import useExecutiveHealth from "../hooks/useExecutiveHealth";
import ApprovalPreviewModal from "../components/ApprovalPreviewModal";
import AppLauncherCard from "../components/AppLauncherCard";
import useApprovals from "../hooks/useApprovals";
import { quickDispatch } from "../services/dispatchService";
import useDispatchTasks from "../hooks/useDispatchTasks";
import ActiveTasksSection from "../components/ActiveTasksSection";
import PianoLessonsSection from "../components/PianoLessonsSection";

// ─── MYA Agent system prompt ───────────────────────────────────────────────────
const PA_SYSTEM = `You are MYA -- the Personal Assistant Agent for Denarius Motes -- CEO of School of Motesart (SOM), Founder of E7A Music Agency, artist, father, and builder.

PERSONAL DATA SECURITY — HIGHEST PRIORITY RULE:

These rules override everything else in this prompt. No exceptions. No workarounds.

HARD RULES:
1. Personal information is NEVER shared with any executive agent, business system, or external tool unless Denarius explicitly says "share this with [agent/system]" in that session.
2. Documents — personal, legal, financial, medical — are NEVER referenced, summarized, or routed anywhere without explicit permission per document.
3. Court documents, divorce proceedings, legal files: HARD BLOCK. PA holds these locally in context only. NEVER routes to E7A, SOM, FM, Book, or any external system. NEVER mentions in business context.
4. Girlfriend, family, personal relationships: NEVER included in business briefs or agent routing. Personal calendar stays personal.
5. Home address (Sprucewood Blvd, Islip): Used for routing calculations only. NEVER shared with any external system or agent.
6. If PA is ever UNSURE whether something is personal or shareable — ALWAYS ask first. Never assume. Default = private. Sharing requires explicit permission every time.
7. Cowork and any shared workspace tools: Personal documents have a HARD BLOCK. No personal files, legal docs, or private information enters any shared/collaborative workspace unless Denarius personally confirms it is necessary AND approves each document individually.

WHAT PA CAN DO WITH PERSONAL INFO:
  - Use for scheduling (calendar, reminders)
  - Use for routing (travel, errands)
  - Use for morning brief (your day, your schedule)
  - Reference in direct conversation with Denarius
  - Route to FM Agent ONLY for personal finances that Denarius explicitly asks about

WHAT PA CANNOT DO:
  - Share personal info with E7A, SOM, Book agents
  - Include personal life in business reports
  - Route legal/court documents anywhere
  - Mention personal relationships in any business context
  - Auto-populate personal data into any shared system

LEGAL INTELLIGENCE — GENERAL GUIDANCE ONLY:

IMPORTANT DISCLAIMER:
PA provides general legal context for organization and preparation purposes only. This is NOT legal advice. For all legal strategy, filing decisions, and courtroom positions, always defer to a licensed attorney. When in doubt, PA says: "Confirm this with your attorney."

JURISDICTIONS PA IS VERSED IN:
  New York Family Law (active — primary jurisdiction)
  California Family Law (reference)
  Delaware Business Law (Ma Sol entity)

NEW YORK FAMILY LAW — GENERAL AWARENESS:
  - Equitable distribution state (fair, not always 50/50)
  - Financial disclosure typically required
  - Child support calculated on income percentage basis
  - Custody: legal custody vs physical custody are separate
  - Best interests of child is the court standard
  - Temporary orders can be requested at hearings
  - Document everything — dates, communications, payments

ACTIVE LEGAL MATTERS:
  Case 1: Divorce — ACTIVE
    Court date: Monday April 13, 10AM
    Status: Preparing for appearance
    Priority: CRITICAL — 3 days away
    PA role: Document organization, prep support, deadline awareness, checklist management

  Case 2: Child Custody — ANTICIPATED
    Status: Expected to follow divorce proceedings
    PA role: Begin organizing relevant documentation, track all child-related expenses and dates, note stability factors (home, school, routine)

PA LEGAL SUPPORT RULES:
1. Flag ALL legal deadlines immediately — no exceptions
2. Never give strategic legal advice as fact
3. Always add "confirm with your attorney" to any legal guidance
4. Court documents: HARD BLOCK — never share with any agent or external system
5. Help organize, prepare, and brief — never conclude
6. For custody: document everything now (school pickups, activities, expenses, time spent)
7. If asked a specific legal question PA cannot answer with certainty — say so immediately

COURT PREP SUPPORT (Apr 13):
PA can help with:
  - Document checklist tracking
  - Talking points organization
  - Timeline building
  - Question preparation for attorney
  - Day-of logistics (leave time, what to bring)

EMAIL WORKFLOW (COMING SOON):
PA will draft emails for legal matters.
Rule: PA drafts → Denarius reviews → Denarius says "send it" → PA sends. PA NEVER auto-sends any email.

BILL PAYMENT WORKFLOW (COMING SOON):
PA presents bills for approval each morning.
Rule: PA shows list → Denarius approves each one → PA marks as approved → Denarius executes payment. PA NEVER moves money or submits payments.

Your role is TIME CONTROL and LIFE COORDINATION. You protect Denarius's time, energy, and integrity so the businesses can run.

IDENTITY
Denarius Motes. Direct, precise, pleasant, high-standard. Music and tech are his energy sources.
Keep responses concise, structured, and scannable.
All communications must reflect: pleasant, kind, forgiving, direct, precise. CEO level. Never aggressive or vague.

BUSINESSES YOU OVERSEE
- E7A (Elarte7 Agency): Music agency. Artists: Velvet Room (Pre-Release, Soft Spot EP), Avery Reid (Think Tank Phase 1 complete), Kayliah (DePaul legal deal active).
- SOM (School of Motesart): Music education platform. Motesart Converter in development.
- FinanceMind: Financial intelligence app. Sunday finance review is a standing trigger.

SCHEDULE KNOWLEDGE
Sunday: Church 10AM-3PM protected. Evening = finance review trigger.
Tuesday: Piano with Luke 12:20PM. Lesson with Renee Taylor 6PM-7PM EST.
Mon-Thu: Daughter call ~7PM. Saturday ~1-3PM.
Hard locked: Friday evenings, Saturday evenings, 12AM-7AM sleep window.

ESCALATION RULES
Interrupt immediately: anything blocking today, payment issues, security threats.
Batch for briefing: standard post approvals, non-urgent questions after hours.
NEVER without approval: any spend over $20, release posts, deleting important items, financial transactions.

RESPONSE FORMAT
- Lead with the direct answer
- Use short structured sections when needed
- Flag urgency: HIGH / MEDIUM / LOW
- When routing to an executive, say: "Routing to [Business] Executive:" then state the directive
- Keep it tight -- Denarius is a fast mover

LIVE CALENDAR CONTEXT (Week of Apr 7-17, 2026)
Reference this data when asked about schedule, bills, upcoming events, or "what's this week."
─────────────────────────────────────────────
TODAY APR 9: Daily Meditation 6:30AM | iCloud $9.99 due tomorrow
APR 10: Child Support Kadence due | Herbs Check 12PM PT
APR 11: Global Buyout due
APR 13: ChatGPT $21.75 + Student Loan $5 due | COURT FOLLOW UP DIVORCE 10AM
APR 14: Google Workspace + CamScanner + NW Registered Agent $39 + Mastercard all due | Jean Class 6-9PM
APR 16: Splice $14.11 + Gmail Storage $3.25 due
APR 17: Dropbox $21.74 due
─────────────────────────────────────────────
TOTAL BILLS THIS WINDOW: ~$119.59
FLAG: Court follow-up Apr 13 is HIGH priority. Child Support Apr 10 is HIGH priority.
NOTE: This is static context. When /api/calendar/brief endpoint is live, this block will be replaced with real-time data.

FM COMMAND CHAIN (LIVE):
When user asks about finances, bills, income, savings or anything money-related:
1. You are the first line — acknowledge the request
2. Route to FM Agent with context
3. FM Agent calls FM App at: https://web-production-f6963.up.railway.app
   Available endpoints:
   GET /api/summary  — full financial snapshot
   GET /api/bills    — bill status and due dates
   GET /api/income   — recent income entries
   GET /api/health   — FM system status
4. FM Agent returns real data up the chain to you
5. You deliver the answer to Denarius

For immediate finance questions you can handle directly, use the financial context already in FM_SYSTEM.
For live data requests, route through FM Agent.

EXCEL SYNC TRIGGER:
When user says anything like: "sync finances", "update FM", "I updated my Excel", "refresh my numbers", "pull latest data"
PA Agent should:
1. Acknowledge: "Syncing FM App with your Excel..."
2. Route to FM Agent with mode: "execute"
3. FM Agent calls POST /api/sync on FM App: https://web-production-f6963.up.railway.app/api/sync
4. Return sync result to Denarius
This keeps FM App always current with the Excel master file.

MORNING CFO BRIEF (highest priority output):
Every morning when Denarius opens the OS or asks "good morning", "morning brief", "what's my day", "CFO brief", or "how are we looking" — deliver this exact 5-point brief:

FORMAT:
📅 TODAY: [date] — [day of week]
💰 SAFE TO SPEND: $[balance - bills due in 7 days - $100 floor]
⚠️ DUE THIS WEEK: [list bills due in next 7 days with amounts]
🔒 INCOME EXPECTED: [locked income this week]
🎯 ONE ACTION: [single most important financial action today]

SAFE TO SPEND CALCULATION:
  Take current net balance
  Subtract all bills due in next 7 days
  Subtract $100 cash floor (minimum reserve)
  Result = safe to spend
  If negative = DEFICIT WARNING — flag immediately

INCOME CONFIDENCE TIERS:
When reporting income always classify as:
  🔒 LOCKED — confirmed, already received
  📅 LIKELY — scheduled, high probability
  ❓ UNCERTAIN — possible but not confirmed

Example classifications for Denarius:
  Church NJ (confirmed service) = LIKELY
  Church WU (confirmed service) = LIKELY
  Lesson (scheduled student) = LIKELY
  Lesson (unconfirmed student) = UNCERTAIN
  Carryover = LOCKED

Apply this logic to all income statements.
Never treat unconfirmed church gigs as locked income.

ROUTING & TRAVEL INTELLIGENCE:

Apps: Denarius uses Waze as primary navigation (traffic dodge, ETA accuracy). Uses Google Maps for route planning and visual layout. PA should reference both when planning travel.

Home base: Sprucewood Blvd, Islip, NY 11751

ROUTING RULES:
1. Always calculate from Sprucewood Blvd, Islip
2. Lead with Waze for live traffic ETA
3. Use Google Maps for multi-stop route order
4. Factor in: gas efficiency, traffic windows, errand clustering (combine nearby stops)
5. For morning errands: leave before 8AM to beat LI traffic on Sunrise Hwy
6. Midas Bay Shore: 1743 Sunrise Hwy — ~10 min from home
7. CVS Central Islip: ~8 min from home
8. Aldi: walking distance / down the street

TOMORROW'S OPTIMIZED ROUTE (Apr 10):
  Depart home: 7:55 AM
  Stop 1: Midas Bay Shore (1743 Sunrise Hwy) — drop car
  Stop 2: CVS Central Islip — while car is in shop
  Stop 3: Aldi — grocery run, then home
  Car pickup: target 10:30-11AM
  Back home by: 11:15AM
  Buffer before Debbie lesson (12PM): 45 min
  Girlfriend departs: 1PM — reminder set

ROAD TRIP AWARENESS:
  When a road trip is mentioned — PA should:
  1. Ask: destination, date, who is going
  2. Calculate drive time via Waze estimate
  3. Flag best departure window (avoid rush hours)
  4. Suggest fuel stop intervals
  5. Route to FM Agent for trip budget estimate

PERSONAL HOUSEHOLD:
  Girlfriend leaves at 1PM on Apr 10 — reminder set.
  PA manages household schedule around this.

FM CONVERSATION AWARENESS:
When user switches to FM tab and has a conversation, PA is always listening in the background. After FM conversation, PA summarizes key points and flags any action items that need PA attention. User can speak directly to FM Executive at any time. PA picks up context automatically.

SMART TASK SCHEDULING:
When a task comes in via the schedule input:
1. Acknowledge the task
2. Check calendar context you have
3. Suggest the most logical open slot:
   - Avoid: meditation time (6:30-7:30AM)
   - Avoid: known lesson times
   - Avoid: court date (Apr 13 10AM)
   - Prefer: morning slots for errands
   - Prefer: afternoon for production/creative
   - Prefer: evening for admin/planning
4. State the proposed time clearly
5. Ask: "Want me to add this to your calendar?"
6. WAIT for yes/no before doing anything
7. Never add to calendar without explicit yes`;

const E7A_SYSTEM = `You are the E7A Executive Agent -- President and COO of Elarte7 Music Agency, reporting to Denarius Motes via the PA Agent.

ACTIVE ROSTER
- Velvet Room: AI R&B artist. Hybrid Mystique. Mode: Build. Campaign: Soft Spot EP. ASCAP pending.
- Avery Reid: Human artist. Gospel-first. NY Metro. Phase 1 complete 85%+.
- Kayliah: Human artist (Denarius daughter). DePaul license. Masters retained.

OPERATING MODES: Build / Execution / Intelligence
APPROVAL GATES: Gate 1 Strategy / Gate 2 Content / Gate 3 Performance

When receiving instructions: confirm received, state action, flag blockers. Keep it executive-level.`;

const SOM_SYSTEM = `You are the SOM Executive Agent -- COO of School of Motesart, reporting to Denarius Motes via the PA Agent.

ACTIVE BUILDS
Motesart Converter: Core tech product. Current phase: Architecture. Primary build priority.
Platform infrastructure: Being built alongside the Converter. Claude Code is the build tool.
Student/curriculum layer: Not yet active -- comes after Converter is stable.

BUILD ORDER: Converter architecture -- platform backend -- curriculum -- student experience -- marketing.
Standard of excellence: SOM reflects Denarius personal artistic standard. Never generic output.
Motesart = capital M, lowercase a only. This rule is non-negotiable in all outputs.

When receiving instructions: confirm received, state action, flag any Claude Code session requirements.`;

const FM_SYSTEM = `You are FinanceMind — the financial executive agent for Denarius Motes. You operate inside the Motesart OS command chain:

Denarius → PA Agent → FM Agent (you) → FM App (Excel)

YOUR ROLE:
You are not a generic finance bot. You are the CFO of Denarius Motes' personal and business finances. You speak numbers-first, direct, and strategic. No fluff. No generic advice. Real numbers, real decisions, real flags.

COMMAND STRUCTURE:
- You report to PA Agent and directly to Denarius
- You oversee all financial data from FM App (Excel)
- You escalate RED flags immediately without being asked
- You approve or flag purchases over $20

PERSONAL FINANCIAL PICTURE (Q1 2026 LIVE DATA):
YTD Income:    $13,198.55
YTD Expenses:  $12,441.10
Net Balance:   +$757.45 (THIN — 94.27% expense ratio)
Jan: -$543.57 deficit
Feb: -$205.66 deficit
Mar: +$1,506.68 surplus (strong month)

EXPENSE CATEGORIES (YTD):
- Personal Expense:        $6,227.18
- Monthly (MT):            $2,293.53
- Other (Jean/Car/CapOne): $2,930.21
- Monthly (Ma Sol):        $942.18
- Monthly (OS/SOM):        $48.00

SAVINGS GOALS (ACTIVE):
- Car Stash:        $6,000 goal / $4,800 current — close
- Jean:             $5,000 goal / $0 deposited — not started
- Swiss Flight:     $328.52 set aside
- Vacation Stash:   $4,000 goal / $0 — not started
- Technology Stash: $300/mo goal / $0 — not started
- Ma Sol Stash:     No goal / $0 — needs attention

RECURRING BILLS (FROM CALENDAR):
Weekly/Monthly obligations tracked:
- Child Support (Kadence): due 11th
- Global Buyout: personal, due 12th
- ChatGPT: $21.75, due 14th
- Student Loan (MT): $5.00, due 14th
- Google Workspace: $9.99, due 15th
- CamScanner: $5.43, due 15th
- NW Registered Agent (Ma Sol): $39, due 15th
- Mastercard: due 15th
- Splice: $14.11, due 17th
- Gmail Storage: $3.25, due 17th
- Dropbox: $21.74, due 18th
- iCloud: $9.99, due 10th

BUSINESS STRUCTURE:
- School of Motesart (SOM): music education platform, tech infrastructure active, revenue building
- E7A Music Agency: artist management, campaigns active
- Ma Sol: registered entity, separate stash needed
- All businesses in growth phase — expenses currently funded from personal

FINANCIAL FLAGS (ALWAYS WATCH):
1. Expense ratio above 90% = RED — currently at 94.27%
2. Any month with negative net = flag to PA
3. Savings stashes at $0 when goals exist = flag
4. Any purchase over $20 = needs approval check
5. Ma Sol stash at $0 = needs funding plan

CREDIT AWARENESS:
- Monitor credit score direction
- Flag any action that could impact credit
- Business credit building is a future priority

INTELLIGENCE RULES:
1. When asked "how are we doing" — give the 3-number summary: income, expenses, net. Then flag the top issue.
2. When asked about a purchase — compare to current net balance and flag if it pushes ratio over 95%
3. When asked about savings — show gap between goal and current balance, suggest deposit amount
4. When routing to FM App — say "Checking FM App..." then report as if you read the live Excel data
5. Always end with one specific action recommendation

TONE: Direct. Numbers-first. Executive. Never generic.
Example good response: "Net is +$757 YTD but ratio is 94%. Car stash is $1,200 from goal. Recommend $300 toward Technology Stash this month before discretionary spend."
Example bad response: "Great question! Managing finances can be challenging..."

SYNC PROTOCOL:
- When sync is requested, call POST /api/sync on FM App: https://web-production-f6963.up.railway.app/api/sync
- After sync completes, call GET /api/summary to get updated snapshot
- Report what changed: income total, expense total, bill count, any warnings
- If sync fails, report the error and suggest: "Check OneDrive connection or re-upload Excel"`;

// FinanceMind Smart Month Engine — pure helpers.
function countWeekdaysInMonth(year, monthIndex, weekday) {
  let count = 0;
  for (let day = new Date(year, monthIndex, 1); day.getMonth() === monthIndex; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === weekday) count += 1;
  }
  return count;
}

function getNextMonthTargetDate(referenceDate = new Date()) {
  return {
    year: referenceDate.getFullYear() + (referenceDate.getMonth() === 11 ? 1 : 0),
    monthIndex: (referenceDate.getMonth() + 1) % 12,
  };
}

function generateRecurringIncomeForMonth(year, monthIndex) {
  const tuesdayCount = countWeekdaysInMonth(year, monthIndex, 2);
  const sundayCount = countWeekdaysInMonth(year, monthIndex, 0);
  return [
    { source: "Renee", category: "music lessons", weeklyAmount: 125, weekday: 2, occurrenceCount: tuesdayCount, projectedTotal: 125 * tuesdayCount, notes: "Weekly Tuesday lesson income." },
    { source: "Evelyn", category: "music lessons", weeklyAmount: 75, weekday: 2, occurrenceCount: tuesdayCount, projectedTotal: 75 * tuesdayCount, notes: "Weekly Tuesday lesson income." },
    { source: "Debbie", category: "music lessons", weeklyAmount: 85, weekday: 2, occurrenceCount: tuesdayCount, projectedTotal: 85 * tuesdayCount, notes: "Weekly Tuesday lesson income." },
    { source: "Church (NJ)", category: "church", weeklyAmount: 400, weekday: 0, occurrenceCount: sundayCount, projectedTotal: 400 * sundayCount, notes: "Active weekly Sunday church income." },
    { source: "Church (WU)", category: "church", weeklyAmount: 300, weekday: 0, occurrenceCount: sundayCount, projectedTotal: 300 * sundayCount, notes: "Active weekly Sunday church income." },
  ];
}

function generateMonthSummary(year, monthIndex) {
  const rows = generateRecurringIncomeForMonth(year, monthIndex);
  const projectedLessonIncome = rows.filter(r => r.category === "music lessons").reduce((sum, r) => sum + r.projectedTotal, 0);
  const projectedChurchIncome = rows.filter(r => r.category === "church").reduce((sum, r) => sum + r.projectedTotal, 0);
  return {
    monthLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, monthIndex, 1)),
    tuesdayCount: countWeekdaysInMonth(year, monthIndex, 2),
    sundayCount: countWeekdaysInMonth(year, monthIndex, 0),
    projectedLessonIncome,
    projectedChurchIncome,
    projectedTotalIncome: projectedLessonIncome + projectedChurchIncome,
  };
}

const MT_SUBSCRIPTIONS_CURRENT = [
  { name: "Eleven Labs", amount: 23.93 },
  { name: "United Masters", amount: 19.99 },
  { name: "Suno", amount: 32.66 },
  { name: "Notion", amount: 24 },
  { name: "Airtable x2", amount: 58.5 },
  { name: "Railway", amount: 20 },
  { name: "Buffer", amount: 13 },
  { name: "Blu Host", amount: 3.25 },
  { name: "Kits AI", amount: 30 },
  { name: "eCredible", amount: 9.95 },
];
const MT_SUBSCRIPTIONS_EXPECTED_TOTAL = 653.77;
// Live value intentionally unchanged. Smart Month preview handles updated projected baseline.
const SMART_MONTH_LIVE_INCOME_STALE = 3428;
const SMART_MONTH_MAY_2026_PREVIEW_BASELINE = 4123;

function getMTSubscriptionsTotal() {
  return Number(MT_SUBSCRIPTIONS_CURRENT.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
}

const CAPITAL_ONE_TRANSACTIONS_PREVIEW = [
  { name: "Phone Bill", amount: null },
  { name: "Zapier", amount: 10 },
  { name: "Claude", amount: 100 },
  { name: "Netlify", amount: 21.77 },
];

function getCapitalOneSpentTotal() {
  return Number(CAPITAL_ONE_TRANSACTIONS_PREVIEW.reduce((sum, item) => sum + (typeof item.amount === "number" ? item.amount : 0), 0).toFixed(2));
}

function SmartMonthAlignmentCheckPanel() {
  const fmt = (value) => "$" + value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const maySummary = generateMonthSummary(2026, 4);
  const mtVariance = Number((MT_SUBSCRIPTIONS_EXPECTED_TOTAL - getMTSubscriptionsTotal()).toFixed(2));
  const phoneBillPending = CAPITAL_ONE_TRANSACTIONS_PREVIEW.some(item => item.name === "Phone Bill" && typeof item.amount !== "number");
  return (
    <div id="alignment-check" style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.red}`, borderRadius: "0 12px 12px 0", padding: "13px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: T.red, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Smart Month Alignment Check</span>
        <Badge text="Preview Gate" color={T.red} dim={T.redDim} />
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted }}>Preview only — live budget not updated</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
        {[["Live income baseline", fmt(SMART_MONTH_LIVE_INCOME_STALE), T.amber], ["May 2026 preview baseline", "~" + fmt(SMART_MONTH_MAY_2026_PREVIEW_BASELINE), T.green], ["MT variance", fmt(mtVariance) + " unresolved", T.red], ["Capital One", phoneBillPending ? "Phone Bill pending" : "Phone Bill set", phoneBillPending ? T.amber : T.green]].map(([label, value, color]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px" }}>
            <div style={{ fontSize: 8, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 14, color, fontWeight: 800, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 5, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        <div>May 2026 baseline note: Debbie is included in preview only. Church WU is included in preview only.</div>
        <div>Smart Month helper count for May 2026: {maySummary.tuesdayCount} Tuesdays and {maySummary.sundayCount} Sundays.</div>
        <div style={{ color: T.red }}>Decision: Do not apply until missing MT items and Phone Bill amount are confirmed.</div>
      </div>
    </div>
  );
}

function SmartMonthPreviewPanel() {
  const target = getNextMonthTargetDate();
  const summary = generateMonthSummary(target.year, target.monthIndex);
  const rows = generateRecurringIncomeForMonth(target.year, target.monthIndex);
  const bySource = Object.fromEntries(rows.map(row => [row.source, row]));
  const fmt = (value) => "$" + value.toLocaleString();
  const incomeRows = [
    ["Renee", bySource.Renee.projectedTotal],
    ["Evelyn", bySource.Evelyn.projectedTotal],
    ["Debbie", bySource.Debbie.projectedTotal],
    ["Church NJ", bySource["Church (NJ)"].projectedTotal],
    ["Church WU", bySource["Church (WU)"].projectedTotal],
  ];
  return (
    <div id="smart-month-preview" style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.green}`, borderRadius: "0 12px 12px 0", padding: "13px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: T.green, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Smart Month Preview</span>
        <Badge text={summary.monthLabel} color={T.green} dim={T.greenDim} />
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted }}>Preview only — not applied yet.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 10 }}>
        {[["Tuesdays", summary.tuesdayCount], ["Sundays", summary.sundayCount], ["Lessons", fmt(summary.projectedLessonIncome)], ["Church", fmt(summary.projectedChurchIncome)], ["Total", fmt(summary.projectedTotalIncome)]].map(([label, value]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 8, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 15, color: label === "Total" ? T.green : T.white, fontWeight: 700, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
        {incomeRows.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
            <span style={{ color: T.muted }}>{label}</span>
            <span style={{ color: T.white, fontWeight: 700 }}>{fmt(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapitalOneLedgerPreviewPanel() {
  const fmt = (value) => "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const spentTotal = getCapitalOneSpentTotal();
  return (
    <div id="capone-preview" style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.blue}`, borderRadius: "0 12px 12px 0", padding: "13px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: T.blue, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Capital One Ledger Preview</span>
        <Badge text={fmt(spentTotal)} color={T.blue} dim={T.blueDim} />
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted }}>Preview only — transaction ledger not applied yet.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
        {CAPITAL_ONE_TRANSACTIONS_PREVIEW.map(item => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
            <span style={{ color: T.muted }}>{item.name}</span>
            <span style={{ color: typeof item.amount === "number" ? T.white : T.amber, fontWeight: 700 }}>{typeof item.amount === "number" ? fmt(item.amount) : "Pending Amount"}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6, marginTop: 10 }}>
        {[["Spent Balance", fmt(spentTotal), T.blue], ["Due Date", "Pending", T.amber]].map(([label, value, color]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px" }}>
            <div style={{ fontSize: 8, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 15, color, fontWeight: 800, marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MTSubscriptionsPreviewPanel() {
  const fmt = (value) => "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const itemizedTotal = getMTSubscriptionsTotal();
  const variance = Number((MT_SUBSCRIPTIONS_EXPECTED_TOTAL - itemizedTotal).toFixed(2));
  return (
    <div id="mt-preview" style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.amber}`, borderRadius: "0 12px 12px 0", padding: "13px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: T.amber, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>MT Subscriptions Preview</span>
        <Badge text="Reconciliation" color={T.amber} dim={T.amberDim} />
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.muted }}>Preview only — not applied to live budget yet.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>
        {MT_SUBSCRIPTIONS_CURRENT.map(item => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
            <span style={{ color: T.muted }}>{item.name}</span>
            <span style={{ color: T.white, fontWeight: 700 }}>{fmt(item.amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6, marginTop: 10 }}>
        {[["Itemized Total", itemizedTotal, T.white], ["Expected Sheet Total", MT_SUBSCRIPTIONS_EXPECTED_TOTAL, T.amber], ["Unaccounted Difference", variance, T.red]].map(([label, value, color]) => (
          <div key={label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 9px" }}>
            <div style={{ fontSize: 8, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 15, color, fontWeight: 800, marginTop: 3 }}>{fmt(value)}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, background: T.redDim, border: `1px solid ${T.red}30`, borderRadius: 7, padding: "8px 10px", fontSize: 11, color: T.red, lineHeight: 1.5 }}>
        Sheet total is higher than itemized subscriptions. Missing MT items must be identified before applying to live budget.
      </div>
    </div>
  );
}

// Preview-only income sources — confirmed via Smart Month engine, no previewOnly flag on row objects yet.
const PREVIEW_ONLY_INCOME_SOURCES = ["Debbie", "Church (WU)"];

function SmartMonthSafetyGate() {
  const fmtAmt = (v) => "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const mtItemized = getMTSubscriptionsTotal();
  const mtVariance = Number((MT_SUBSCRIPTIONS_EXPECTED_TOTAL - mtItemized).toFixed(2));
  const mtVarianceBlocked = mtVariance !== 0;

  const capOnePendingItems = CAPITAL_ONE_TRANSACTIONS_PREVIEW.filter(
    (item) => item.status === "pending" || item.amount === null
  );
  const capOneBlocked = capOnePendingItems.length > 0;

  const incomeStale = SMART_MONTH_LIVE_INCOME_STALE !== SMART_MONTH_MAY_2026_PREVIEW_BASELINE;
  const incomeDriftPct = Math.abs(SMART_MONTH_MAY_2026_PREVIEW_BASELINE - SMART_MONTH_LIVE_INCOME_STALE) / SMART_MONTH_LIVE_INCOME_STALE;
  const incomeDriftReview = incomeDriftPct > 0.05;

  const previewOnlyFireCount = PREVIEW_ONLY_INCOME_SOURCES.length;
  const previewOnlyReview = previewOnlyFireCount > 0;

  const pausedSubscriptions = MT_SUBSCRIPTIONS_CURRENT.filter((s) => s.status === "paused" && s.status !== "cancelled");
  const pausedReview = pausedSubscriptions.length > 0;

  const checks = [
    {
      id: "mt-variance",
      level: mtVarianceBlocked ? "blocked" : "pass",
      label: "MT itemized vs. sheet total",
      detail: mtVarianceBlocked
        ? `${fmtAmt(mtVariance)} variance unresolved`
        : "Reconciled",
      link: { label: "MT Preview", panelId: "mt-preview" },
    },
    {
      id: "capone-pending",
      level: capOneBlocked ? "blocked" : "pass",
      label: "Capital One transaction amounts",
      detail: capOneBlocked
        ? `${capOnePendingItems.length} pending amount${capOnePendingItems.length > 1 ? "s" : ""}`
        : "All amounts set",
      link: { label: "Capital One", panelId: "capone-preview" },
    },
    // TODO: user-required confirmation outstanding > 7 days — no confirmationAt timestamp field exists yet
    {
      id: "income-stale",
      level: incomeStale ? "review" : "pass",
      label: "Live income baseline",
      detail: incomeStale
        ? `$${SMART_MONTH_LIVE_INCOME_STALE.toLocaleString()} stale (preview ~$${SMART_MONTH_MAY_2026_PREVIEW_BASELINE.toLocaleString()})`
        : "Current",
      link: { label: "Alignment Check", panelId: "alignment-check" },
    },
    {
      id: "income-drift",
      level: incomeDriftReview ? "review" : "pass",
      label: "Preview vs. live income drift",
      detail: incomeDriftReview
        ? `${(incomeDriftPct * 100).toFixed(1)}% drift (threshold 5%)`
        : `${(incomeDriftPct * 100).toFixed(1)}% drift — within range`,
      link: { label: "SM Preview", panelId: "smart-month-preview" },
    },
    {
      id: "preview-only-sources",
      level: previewOnlyReview ? "review" : "pass",
      label: "Preview-only income sources",
      detail: previewOnlyReview
        ? `${PREVIEW_ONLY_INCOME_SOURCES.join(", ")} — preview only`
        : "All sources confirmed",
      link: { label: "SM Preview", panelId: "smart-month-preview" },
    },
    {
      id: "paused-subs",
      level: pausedReview ? "review" : "pass",
      label: "Paused subscriptions",
      detail: pausedReview
        ? `${pausedSubscriptions.length} paused subscription${pausedSubscriptions.length > 1 ? "s" : ""}`
        : "No paused subscriptions",
      link: { label: "MT Preview", panelId: "mt-preview" },
    },
  ];

  const blockedChecks  = checks.filter((c) => c.level === "blocked");
  const reviewChecks   = checks.filter((c) => c.level === "review");
  const passingChecks  = checks.filter((c) => c.level === "pass");

  const overallVerdict = blockedChecks.length > 0 ? "BLOCKED" : reviewChecks.length > 0 ? "NEEDS REVIEW" : "READY";
  const verdictColor   = overallVerdict === "BLOCKED" ? T.red : overallVerdict === "NEEDS REVIEW" ? T.amber : T.green;
  const verdictDim     = overallVerdict === "BLOCKED" ? T.redDim : overallVerdict === "NEEDS REVIEW" ? T.amberDim : T.greenDim;
  const cardTint       = overallVerdict === "BLOCKED" ? `${T.red}0d` : overallVerdict === "NEEDS REVIEW" ? `${T.amber}0d` : `${T.green}0d`;
  const borderTint     = overallVerdict === "BLOCKED" ? `${T.red}44` : overallVerdict === "NEEDS REVIEW" ? `${T.amber}44` : `${T.green}44`;

  const summaryText = `${blockedChecks.length} blocking · ${reviewChecks.length} review · ${passingChecks.length} passing`;

  const orderedChecks = [...blockedChecks, ...reviewChecks, ...passingChecks];

  const rowIcon  = (level) => level === "blocked" ? "✗" : level === "review" ? "⚠" : "✓";
  const rowColor = (level) => level === "blocked" ? T.red : level === "review" ? T.amber : T.green;

  if (checks.length === 0) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "0 12px 12px 0", padding: "13px 16px", marginBottom: 18, color: T.muted, fontSize: 11 }}>
        No checks configured
      </div>
    );
  }

  return (
    <>
      <style>{`
        #sg-details[open] .sg-chevron { transform: rotate(90deg); }
        #sg-details summary { list-style: none; cursor: pointer; user-select: none; }
        #sg-details summary::-webkit-details-marker { display: none; }
      `}</style>
      <details id="sg-details" style={{ background: cardTint, border: `1px solid ${borderTint}`, borderLeft: `3px solid ${verdictColor}`, borderRadius: "0 12px 12px 0", marginBottom: 18, overflow: "hidden" }}>
        <summary style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: verdictColor, flexShrink: 0, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: verdictColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Smart Month Safety Gate
          </span>
          <span className="sg-summary-count" style={{ fontFamily: "monospace", fontSize: 9, color: T.muted, letterSpacing: "0.04em" }}>
            {summaryText}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <Badge text={overallVerdict} color={verdictColor} dim={verdictDim} />
            <span
              className="sg-chevron"
              style={{ fontSize: 10, color: T.muted, display: "inline-block", transition: "transform 0.15s ease" }}
            >▶</span>
          </span>
        </summary>
        <div style={{ padding: "0 16px 13px 16px", borderTop: `1px solid ${T.border}` }}>
          <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
            {orderedChecks.map((check) => (
              <div
                key={check.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.018)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 11,
                }}
              >
                <span style={{ color: rowColor(check.level), fontWeight: 700, fontSize: 12, flexShrink: 0, width: 14, textAlign: "center" }}>
                  {rowIcon(check.level)}
                </span>
                <span style={{ color: T.white, flex: 1 }}>{check.label}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: rowColor(check.level), flexShrink: 0 }}>
                  {check.detail}
                </span>
                {check.link && (
                  <a
                    href={`#${check.link.panelId}`}
                    onClick={(e) => { e.preventDefault(); document.getElementById(check.link.panelId)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    style={{ fontSize: 9, color: T.muted, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    → {check.link.label}
                  </a>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: T.muted, fontStyle: "italic" }}>
            Do not apply to live budget until verdict is READY.
          </div>
        </div>
      </details>
    </>
  );
}

const BOOK_SYSTEM = `You are the Book Project Executive Agent -- Project Director for the Motes Family Book Project, reporting to Denarius Motes via the PA Agent.

PROJECT STATUS
Author: Dr. Roscoe Motes (Denarius father). Manuscript: Complete.
Platform/site: Not yet built. Scoping needed under OSHA site management.
Publishing path: Not yet decided -- self-publishing vs. traditional vs. hybrid.

PRINCIPLES
Dr. Roscoe Motes is the author. Denarius is publisher and platform strategist. Respect that distinction always.
Family first. His comfort matters more than speed.
Legacy asset -- build to last, not rushed to market.

When receiving instructions: confirm received, state action, flag Dr. Roscoe Motes impact.`;



const T = {
  bg:       "#070709",
  surface:  "#0c0c10",
  card:     "#111116",
  cardHi:   "#17171e",
  border:   "rgba(255,255,255,0.055)",
  borderHi: "rgba(201,168,76,0.28)",
  gold:     "#c9a84c",
  goldDim:  "rgba(201,168,76,0.10)",
  white:    "#f0ede8",
  muted:    "#52525e",
  dim:      "#1c1c22",
  green:    "#4caf7d",
  greenDim: "rgba(76,175,125,0.12)",
  blue:     "#5a8fc9",
  blueDim:  "rgba(90,143,201,0.12)",
  red:      "#c95a5a",
  redDim:   "rgba(201,90,90,0.12)",
  amber:    "#c9914c",
  amberDim: "rgba(201,145,76,0.12)",
};

const BUSINESSES = [
  {
    id: "e7a", name: "E7A", full: "Elarte7 Agency",
    color: T.gold, dim: T.goldDim, icon: "◈", notifications: 3,
    appUrl: null,
    brief: "Gate 2 content approval needed Thursday. ASCAP registration is a hard block on Soft Spot launch. Avery Phase 2 scope definition overdue.",
    todos: [
      { id: "e1", text: "Register ASCAP for Soft Spot", done: false },
      { id: "e2", text: "Gate 2 content approval by Thursday", done: false },
      { id: "e3", text: "Define Avery Phase 2 scope", done: false },
      { id: "e4", text: "Build Airtable core 5 tables", done: false },
    ],
    artists: [
      {
        id: "vr", name: "Velvet Room", stage: "Pre-Release", mode: "Build", color: "#c95a84",
        calendar: [
          { date: "Apr 10", item: "Post 1 -- Mood Visual", status: "planned" },
          { date: "Apr 12", item: "Post 2 -- Primary Reel", status: "planned" },
          { date: "Apr 14", item: "Post 3 -- Quote", status: "planned" },
        ],
        campaign: { name: "Soft Spot EP", status: "Loading", gate: "Gate 1", pct: 40 },
        finances: { used: "$0 spent", allocated: "$500", notes: "ASCAP pending" },
      },
      {
        id: "ar", name: "Avery Reid", stage: "Think Tank", mode: "Build", color: T.blue,
        calendar: [{ date: "Apr 15", item: "Phase 2 scope definition", status: "pending" }],
        campaign: { name: "Phase 2 TBD", status: "Defining", gate: "Phase 1 Complete", pct: 85 },
        finances: { used: "$0 spent", allocated: "TBD", notes: "Phase 2 budget TBD" },
      },
      {
        id: "ka", name: "Kayliah", stage: "Legal Active", mode: "Hold", color: T.amber,
        calendar: [{ date: "TBD", item: "Artist DNA build", status: "pending" }],
        campaign: { name: "DePaul Deal Active", status: "Legal", gate: "Contract Review", pct: 20 },
        finances: { used: "N/A", allocated: "N/A", notes: "DePaul license terms apply" },
      },
    ],
  },
  {
    id: "som", name: "SOM", full: "School of Motesart",
    color: T.blue, dim: T.blueDim, icon: "◎", notifications: 1, exec: "SOM",
    appUrl: "https://school-of-motesart.netlify.app",
    converterUrl: "https://motesart-converter.netlify.app",
    brief: "Motesart Converter architecture is the active build priority. Platform infrastructure being built in parallel. Curriculum layer comes after Converter is stable. Next Claude Code session needed.",
    todos: [
      { id: "s1", text: "Schedule Converter build session", done: false },
      { id: "s2", text: "Define curriculum layer structure", done: false },
      { id: "s3", text: "Platform infrastructure audit", done: false },
    ],
    artists: [],
  },
  {
    id: "fm", name: "FinanceMind", full: "FinanceMind",
    color: T.green, dim: T.greenDim, icon: "△", notifications: 2, exec: "FM",
    appUrl: "https://web-production-f6963.up.railway.app",
    brief: "Sunday finance review pending. Credit monitoring active and trending up. No spend over $20 without approval. Connect all business accounts when FinanceMind integration is ready.",
    todos: [
      { id: "f1", text: "Complete Sunday finance review", done: false },
      { id: "f2", text: "Book Southwest flights — Chicago Jun 12 + Jun 15", done: false },
      { id: "f3", text: "Fund vacation stash — currently $0", done: false },
    ],
    artists: [],
  },
  {
    id: "book", name: "Book", full: "Motes Family Book",
    color: T.amber, dim: T.amberDim, icon: "◇", notifications: 1, exec: "BOOK",
    appUrl: "https://motesart-book-manager.netlify.app",
    brief: "Dr. Roscoe Motes has completed the manuscript. Platform and site structure not yet built. Publishing path not yet decided. Needs scoping session.",
    todos: [
      { id: "b1", text: "File U.S. Copyright registration", done: false },
      { id: "b2", text: "Purchase ISBN", done: false },
      { id: "b3", text: "Scope publishing platform", done: false },
    ],
    artists: [],
  },
];

const PERSONAL = {
  id: "personal",
  name: "Personal",
  full: "Denarius Motes",
  color: T.green,
  dim: T.greenDim,
  icon: "◉",
  notifications: 1,
  brief: "Personal health, schedule, family, and wellbeing. VitalStack connection pending. Sunday finance review trigger active. Daughter calls Mon-Thu 7PM, Saturday 1-3PM.",
  health: {
    vitalstack: { status: "pending", note: "VitalStack API connection not yet wired. Data will display here once endpoint is live." },
    lastCheckin: "Not yet logged",
    metrics: [
      { label: "Herbs / Supplements", value: "Log via VitalStack", status: "pending" },
      { label: "Workout", value: "Not yet logged this week", status: "pending" },
      { label: "Sleep", value: "Not yet logged", status: "pending" },
      { label: "Overall Wellbeing", value: "Not yet logged", status: "pending" },
    ],
  },
  schedule: {
    recurring: [
      { day: "Sunday",    time: "10AM-3PM",  item: "Church -- protected block" },
      { day: "Sunday",    time: "Evening",   item: "Finance review trigger" },
      { day: "Tuesday",   time: "12:20PM",   item: "Piano lesson with Luke" },
      { day: "Tuesday",   time: "6-7PM",     item: "Lesson with Renee Taylor" },
      { day: "Mon-Thu",   time: "~7PM",      item: "Daughter call" },
      { day: "Saturday",  time: "~1-3PM",    item: "Daughter call (loose)" },
      { day: "Fri + Sat", time: "Evening",   item: "Personal time -- locked" },
    ],
  },
  goals: [
    { label: "Credit score trending up", status: "active" },
    { label: "Weekly workout consistency", status: "active" },
    { label: "Daily herb/supplement stack", status: "active" },
    { label: "Sleep window 12AM-7AM protected", status: "active" },
  ],
};

const DEMO_NOTIFICATIONS = [
  { id: 1, biz: "E7A",         level: "high",   text: "ASCAP registration required before Soft Spot distribution", time: "Now" },
  { id: 2, biz: "E7A",         level: "high",   text: "Gate 2 content approval needed -- Thursday 2PM window",      time: "2h" },
  { id: 3, biz: "FinanceMind", level: "medium", text: "Sunday finance review not yet completed",                   time: "3h" },
  { id: 4, biz: "E7A",         level: "medium", text: "Airtable core 5 tables not yet built",                     time: "4h" },
  { id: 5, biz: "FinanceMind", level: "low",    text: "Credit score update available",                            time: "1d" },
  { id: 6, biz: "SOM",  level: "low",    text: "Motesart Converter -- next build session due",            time: "1d" },
  { id: 7, biz: "Book", level: "medium", text: "Book project platform not yet scoped -- publishing path TBD", time: "2d" },
];

const LEVEL_C = {
  high:   { base: T.red,   dim: T.redDim },
  medium: { base: T.amber, dim: T.amberDim },
  low:    { base: T.muted, dim: "rgba(82,82,94,0.15)" },
};

const STATUS_C = { planned: T.blue, pending: T.amber, done: T.green };

function Pip({ color }) {
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function Badge({ text, color, dim }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 3,
      background: dim || "rgba(255,255,255,0.07)",
      color: color || T.muted,
      border: `1px solid ${color || T.muted}22`,
    }}>{text}</span>
  );
}

function AnimatedNumber({ value, duration = 800, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const num = typeof value === "number" ? value : parseInt(value, 10);
    if (isNaN(num)) { setDisplay(value); return; }
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * num));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    }
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{display}{suffix}</span>;
}

function Bar({ pct, color }) {
  return (
    <div style={{ height: 3, background: T.dim, borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`, background: color || T.gold, borderRadius: 2,
        animation: "barFillIn 0.9s cubic-bezier(0.22,1,0.36,1) both",
      }} />
    </div>
  );
}

function NotifDot({ count, color }) {
  if (!count) return null;
  return (
    <span style={{
      minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
      background: color || T.red, color: "#fff",
      fontSize: 9, fontWeight: 800,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{count}</span>
  );
}

function ArtistPanel({ artist, onClose }) {
  const [tab, setTab] = useState("calendar");
  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "min(340px, 100dvw)",
      background: T.surface, borderLeft: `1px solid ${T.border}`,
      zIndex: 200, display: "flex", flexDirection: "column",
      boxShadow: "-12px 0 48px rgba(0,0,0,0.7)",
    }}>
      <div style={{ padding: "16px 18px", paddingTop: "max(16px, env(safe-area-inset-top))", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Pip color={artist.color} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.white, flex: 1 }}>{artist.name}</span>
        <Badge text={artist.stage} color={artist.color} dim={`${artist.color}18`} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, marginLeft: 8, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
        {["calendar", "campaign", "finances"].map(s => (
          <button key={s} onClick={() => setTab(s)} style={{
            flex: 1, padding: "9px 4px", background: "none", border: "none",
            borderBottom: tab === s ? `2px solid ${artist.color}` : "2px solid transparent",
            color: tab === s ? artist.color : T.muted,
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", cursor: "pointer",
          }}>{s}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        {tab === "calendar" && (
          <div style={{ display: "grid", gap: 8 }}>
            {artist.calendar.map((c, i) => (
              <div key={i} style={{ background: T.card, borderRadius: 12, padding: "10px 14px", border: `1px solid ${T.border}`, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>{c.date}</span>
                  <Pip color={STATUS_C[c.status] || T.muted} />
                </div>
                <span style={{ fontSize: 13, color: T.white }}>{c.item}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "campaign" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ background: T.card, borderRadius: 12, padding: 14, border: `1px solid ${T.border}`, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Campaign</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 8, letterSpacing: "-0.02em" }}>{artist.campaign.name}</div>
              <Badge text={artist.campaign.status} color={artist.color} dim={`${artist.color}15`} />
            </div>
            <div style={{ background: T.card, borderRadius: 12, padding: 14, border: `1px solid ${T.border}`, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Progress</span>
                <span style={{ fontSize: 11, color: artist.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={artist.campaign.pct} suffix="%" /></span>
              </div>
              <Bar pct={artist.campaign.pct} color={artist.color} />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>{artist.campaign.gate}</div>
            </div>
          </div>
        )}
        {tab === "finances" && (
          <div style={{ background: T.card, borderRadius: 12, padding: 14, border: `1px solid ${T.border}`, display: "grid", gap: 12, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            {[["Budget Used", artist.finances.used], ["Allocated", artist.finances.allocated], ["Notes", artist.finances.notes]].map(([label, val], i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: T.white }}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({ activeBiz, onSelect, open, onToggle, onPAOpen, onDispatchOpen, onSelectPersonal, onPersonalActive, onTravelBuilderOpen, onMusicLessonsOpen, onSettingsOpen }) {
  return (
    <div className="os-sidebar" style={{
      width: open ? 210 : 52, flexShrink: 0,
      background: T.surface, borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column",
      transition: "width 0.22s ease", overflow: "hidden",
    }}>
      <div style={{ padding: open ? "18px 16px 14px" : "18px 10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          background: T.goldDim, border: `1px solid ${T.borderHi}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, color: T.gold, fontWeight: 900 }}>M</span>
        </div>
        {open && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.white, letterSpacing: "0.03em" }}>Motesart</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>OS Command</div>
          </div>
        )}
      </div>

      <button onClick={onToggle} style={{
        background: "none", border: "none", borderBottom: `1px solid ${T.border}`,
        padding: "8px", cursor: "pointer", color: T.muted, fontSize: 12,
        display: "flex", alignItems: "center", justifyContent: open ? "flex-end" : "center",
        paddingRight: open ? 14 : 8,
      }}>{open ? "<<" : ">>"}</button>

      <div style={{ flex: 1, padding: "8px 6px" }}>
        {open && <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, padding: "4px 8px 8px" }}>Businesses</div>}
        {BUSINESSES.map(b => (
          <button key={b.id} onClick={() => onSelect(b.id)} style={{
            width: "100%",
            background: activeBiz === b.id ? b.dim : "transparent",
            border: activeBiz === b.id ? `1px solid ${b.color}30` : "1px solid transparent",
            borderRadius: 8, padding: open ? "9px 10px" : "9px",
            cursor: "pointer", display: "flex", alignItems: "center",
            gap: 9, marginBottom: 3, transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
            justifyContent: open ? "flex-start" : "center",
            boxShadow: activeBiz === b.id ? `inset 0 0 0 1px ${b.color}18` : "none",
          }}>
            <span style={{ fontSize: 13, color: activeBiz === b.id ? b.color : T.muted, flexShrink: 0 }}>{b.icon}</span>
            {open && (
              <>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: activeBiz === b.id ? T.white : T.muted }}>{b.name}</div>
                  <div style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{b.full}</div>
                </div>
                <NotifDot count={b.notifications} color={b.color} />
              </>
            )}
          </button>
        ))}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          {open && <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, padding: "0 8px 8px" }}>Shortcuts</div>}
          <button type="button" onClick={onTravelBuilderOpen} style={{
            width: "100%", background: T.goldDim, border: `1px dashed ${T.gold}70`,
            borderRadius: 8, padding: open ? "7px 9px" : "8px",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            justifyContent: open ? "flex-start" : "center",
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: T.gold, color: "#111",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800,
            }}>✈</span>
            {open && (
              <>
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.gold }}>Travel Builder</div>
                  <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.08em" }}>→ FM TAB</div>
                </div>
                <span style={{ fontSize: 12, color: T.gold }}>›</span>
              </>
            )}
          </button>
          <button type="button" onClick={onMusicLessonsOpen} style={{
            width: "100%", marginTop: 6, background: "rgba(184,56,56,0.10)", border: `1px dashed rgba(184,56,56,0.70)`,
            borderRadius: 8, padding: open ? "7px 9px" : "8px",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            justifyContent: open ? "flex-start" : "center",
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: "rgba(184,56,56,0.22)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800,
            }}>♪</span>
            {open && (
              <>
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#E8C8C8" }}>Music Lessons</div>
                  <div style={{ fontSize: 9, color: "#cc9a9a", letterSpacing: "0.08em" }}>→ FM TAB</div>
                </div>
                <span style={{ fontSize: 12, color: "#B83838" }}>›</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ padding: "8px 6px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={() => onSelectPersonal()} style={{
          width: "100%", background: onPersonalActive ? T.greenDim : "transparent",
          border: onPersonalActive ? `1px solid ${T.green}35` : "1px solid transparent",
          borderRadius: 8, padding: open ? "9px 10px" : "9px",
          cursor: "pointer", display: "flex", alignItems: "center",
          gap: 9, justifyContent: open ? "flex-start" : "center",
        }}>
          <span style={{ fontSize: 13, color: onPersonalActive ? T.green : T.muted, flexShrink: 0 }}>◉</span>
          {open && <span style={{ fontSize: 12, fontWeight: 700, color: onPersonalActive ? T.green : T.muted }}>Personal</span>}
          {open && <NotifDot count={1} color={T.green} />}
        </button>
        <button onClick={onDispatchOpen} style={{
          width: "100%", background: T.goldDim, border: `1px solid ${T.borderHi}`,
          borderRadius: 8, padding: open ? "9px 10px" : "9px",
          cursor: "pointer", display: "flex", alignItems: "center",
          gap: 9, justifyContent: open ? "flex-start" : "center",
        }}>
          <span style={{ fontSize: 13, color: T.gold, flexShrink: 0 }}>◆</span>
          {open && <span style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>MYA</span>}
        </button>
        {/* Phase 3B — Dispatch panel entry */}
        <button onClick={onDispatchOpen} style={{
          width: "100%", background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 8, padding: open ? "9px 10px" : "9px",
          cursor: "pointer", display: "flex", alignItems: "center",
          gap: 9, justifyContent: open ? "flex-start" : "center",
        }}>
          <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>◈</span>
          {open && <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>Dispatch</span>}
        </button>
        <button onClick={onSettingsOpen} style={{
          width: "100%", background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 8, padding: open ? "9px 10px" : "9px",
          cursor: "pointer", display: "flex", alignItems: "center",
          gap: 9, justifyContent: open ? "flex-start" : "center",
        }}>
          <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>⚙</span>
          {open && <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>Settings</span>}
        </button>
      </div>
    </div>
  );
}


// ─── PA Agent Chat Panel ──────────────────────────────────────────────────────
function PAAgentChat({ onClose, activeBiz }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Good morning. MYA active. I have your briefing ready — 3 items need your attention today for E7A, 2 for FinanceMind. What would you like to address first, or do you have an instruction for one of the executives?",
      agent: "MYA"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState("MYA");
  const AGENT_SYSTEMS = { MYA: PA_SYSTEM, E7A: E7A_SYSTEM, SOM: SOM_SYSTEM, FM: FM_SYSTEM, BOOK: BOOK_SYSTEM };
  const AGENT_LABELS = { MYA: "Personal Assistant", E7A: "E7A Agency", SOM: "School of Motesart", FM: "FinanceMind", BOOK: "Book Project" };
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for schedule-task events from PersonalPanel
  useEffect(() => {
    function handleScheduleTask(e) {
      const task = e.detail;
      if (task) {
        quickDispatch(task, 'pa', 'fm-executive');
        setActiveAgent("MYA");
        setInput(`Schedule this task for me: ${task}. Check my calendar for availability and suggest the best time. Ask me before adding it.`);
        setTimeout(() => {
          document.querySelector("[data-pa-send]")?.click();
        }, 50);
      }
    }
    window.addEventListener("pa-schedule-task", handleScheduleTask);
    return () => window.removeEventListener("pa-schedule-task", handleScheduleTask);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    const agentLabel = activeAgent;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
         agent: AGENT_API_MAP[activeAgent] || "PA",
          messages: history.filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          typeof errBody.detail === "string"
            ? errBody.detail
            : Array.isArray(errBody.detail)
              ? errBody.detail.map(d => d.msg || JSON.stringify(d)).join("; ")
              : "Agent request failed";
        throw new Error(msg);
      }

      const data = await res.json();
      const reply = data.reply || "No response from agent.";

      // Route suggestion from backend (soft -- user still controls active agent)
      if (data.route_suggestion && data.route_suggestion !== activeAgent && activeAgent === "MYA") {
        setActiveAgent(data.route_suggestion);
      }

      setMessages(prev => [...prev, { role: "assistant", content: reply, agent: agentLabel }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Agent unavailable. " + (err.message || "Try again."), agent: agentLabel }]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }
const AGENT_API_MAP = {
  MYA: "PA",
  PA: "PA",
  E7A: "E7A",
  SOM: "SOM",
  FM: "FM",
  BOOK: "BOOK",
};
  const agentColorMap = { MYA: T.blue, E7A: T.gold, SOM: T.blue, FM: T.green, BOOK: T.amber };
  const agentColor = agentColorMap[activeAgent] || T.gold;

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "min(380px, 100dvw)",
      background: T.surface, borderLeft: `1px solid ${T.border}`,
      zIndex: 300, display: "flex", flexDirection: "column",
      boxShadow: "-12px 0 48px rgba(0,0,0,0.75)",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", paddingTop: "max(14px, env(safe-area-inset-top))", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.bg }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: T.white, flex: 1, letterSpacing: "-0.01em" }}>
          {activeAgent === "MYA" ? "MYA" : activeAgent + " Executive"}
        </span>
        <Badge text={AGENT_LABELS[activeAgent] || activeAgent} color={agentColor} dim={`${agentColor}15`} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, marginLeft: 4, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      {/* Agent switcher */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <div style={{ overflowX: "auto", display: "flex" }}>
        {["MYA", "E7A", "SOM", "FM", "BOOK"].map(agent => {
          const agentColors = { MYA: T.blue, E7A: T.gold, SOM: T.blue, FM: T.green, BOOK: T.amber };
          const col = agentColors[agent] || T.gold;
          return (
            <button key={agent} onClick={() => setActiveAgent(agent)} style={{
              flexShrink: 0, padding: "8px 10px", background: "none", border: "none",
              borderBottom: activeAgent === agent ? `2px solid ${col}` : "2px solid transparent",
              color: activeAgent === agent ? col : T.muted,
              fontSize: 10, fontWeight: 700, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
            }}>{agent}</button>
          );
        })}
      </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ fontSize: 9, color: m.agent === "E7A" ? T.gold : m.agent === "MYA" ? T.blue : T.blue, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, paddingLeft: 2 }}>
                {m.agent === "MYA" ? "MYA" : (m.agent || "MYA") + " Executive"}
              </div>
            )}
            <div style={{
              maxWidth: "88%",
              background: m.role === "user" ? T.goldDim : T.card,
              border: `1px solid ${m.role === "user" ? T.borderHi : T.border}`,
              borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              padding: "10px 13px",
              fontSize: 13, color: T.white, lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 9, color: agentColor, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{activeAgent === "MYA" ? "MYA" : activeAgent + " Executive"}</div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px 12px 12px 2px", padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: agentColor, opacity: 0.6, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Brief me", "What is urgent?", "Route to E7A", "SOM status", "Finance review", "Book project status", "VitalStack sync"].map(cmd => (
          <button key={cmd} onClick={() => { setInput(cmd); }} style={{
            background: T.dim, border: `1px solid ${T.border}`,
            color: T.muted, borderRadius: 4, padding: "3px 8px",
            cursor: "pointer", fontSize: 10, fontWeight: 600,
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold + "50"; e.currentTarget.style.color = T.gold; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >{cmd}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.bg, display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={activeAgent === "MYA" ? "Message MYA..." : `Send instruction to ${activeAgent} Executive...`}
          rows={2}
          style={{
            flex: 1, background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: "8px 12px", color: T.white,
            fontSize: 13, resize: "none", fontFamily: "inherit",
            outline: "none", lineHeight: 1.5,
          }}
          onFocus={e => { e.target.style.borderColor = agentColor + "50"; }}
          onBlur={e => { e.target.style.borderColor = T.border; }}
        />
        <button data-pa-send onClick={send} disabled={loading || !input.trim()} style={{
          background: loading || !input.trim() ? T.dim : T.goldDim,
          border: `1px solid ${loading || !input.trim() ? T.border : T.borderHi}`,
          color: loading || !input.trim() ? T.muted : T.gold,
          borderRadius: 8, padding: "8px 14px", cursor: loading || !input.trim() ? "default" : "pointer",
          fontSize: 12, fontWeight: 700, transition: "all 0.15s", flexShrink: 0,
        }}>Send</button>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(0.8);opacity:0.4} 50%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}


// ─── Personal Panel (Redesigned) ─────────────────────────────────────────────
function PersonalPanel({ onClose, onScheduleTask }) {
  const [tab, setTab] = useState("health");
  const [taskInput, setTaskInput] = useState("");
  const tabs = ["health", "schedule", "goals", "jean"];
  const JEAN_PURPLE = "#C084FC";

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "min(380px, 100dvw)",
      background: T.surface, borderLeft: `1px solid ${T.border}`,
      zIndex: 200, display: "flex", flexDirection: "column",
      boxShadow: "-12px 0 48px rgba(0,0,0,0.7)",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", paddingTop: "max(14px, env(safe-area-inset-top))", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.bg }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.white, flex: 1 }}>Personal</span>
        <Badge text="Denarius Motes" color={T.green} dim={T.greenDim} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, marginLeft: 4, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px 4px", background: "none", border: "none",
            borderBottom: tab === t ? `2px solid ${t === "jean" ? JEAN_PURPLE : T.green}` : "2px solid transparent",
            color: tab === t ? (t === "jean" ? JEAN_PURPLE : T.green) : T.muted,
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: "calc(16px + env(safe-area-inset-bottom))", display: "grid", gap: 10, alignContent: "start" }}>

        {/* ── HEALTH TAB ── */}
        {tab === "health" && (<>
          <div style={{ background: T.goldDim, border: `1px solid ${T.gold}30`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>VitalStack — Connection Pending</div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>Herbs, supplements, workouts, and wellbeing metrics will sync automatically once the VitalStack API endpoint is live.</div>
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Weekly Metrics</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {PERSONAL.health.metrics.map((m, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: i < PERSONAL.health.metrics.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.muted }}>{m.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, color: T.muted }}>Pending</span>
              </div>
            ))}
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Last MYA Check-in</span>
            <span style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>Not yet logged</span>
          </div>
        </>)}

        {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (<>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, padding: "0 2px 4px" }}>Recurring protected blocks — MYA will never schedule over these.</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {PERSONAL.schedule.recurring.map((s, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: i < PERSONAL.schedule.recurring.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", gap: 14 }}>
                <div style={{ minWidth: 72, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>{s.day}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{s.time}</div>
                </div>
                <span style={{ fontSize: 12, color: s.item.includes("locked") ? T.red : T.white, lineHeight: 1.5 }}>{s.item}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* ── GOALS TAB ── */}
        {tab === "goals" && (<>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, padding: "0 2px 4px" }}>Standing personal goals. MYA tracks these weekly.</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {PERSONAL.goals.map((g, i) => (
              <div key={i} style={{ padding: "11px 14px", borderBottom: i < PERSONAL.goals.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T.white, flex: 1 }}>{g.label}</span>
                <Badge text="Active" color={T.green} dim={T.greenDim} />
              </div>
            ))}
          </div>
          <div style={{ background: T.goldDim, border: `1px solid ${T.gold}30`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: T.gold, lineHeight: 1.6 }}>
              When VitalStack is connected, goal completion will be tracked automatically from your health data.
            </div>
          </div>
        </>)}

        {/* ── JEAN TAB ── */}
        {tab === "jean" && (<>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0 6px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: JEAN_PURPLE }} />
            <div>
              <div style={{ fontSize: 16, color: T.white, fontWeight: 700, letterSpacing: "-0.01em" }}>Jean</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Class every Tuesday 6–9PM</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Upcoming Classes</div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {[{ day: "Tue Apr 15", time: "6–9PM" }, { day: "Tue Apr 22", time: "6–9PM" }, { day: "Tue Apr 29", time: "6–9PM" }].map((c, i) => (
              <div key={i} style={{ padding: "10px 14px", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", display: "flex", gap: 14 }}>
                <div style={{ minWidth: 72 }}>
                  <div style={{ fontSize: 11, color: JEAN_PURPLE, fontWeight: 700 }}>{c.day}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{c.time}</div>
                </div>
                <span style={{ fontSize: 12, color: T.white }}>Jean Class</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Quick Actions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {["+ Add task", "+ Add reminder", "+ Add note"].map(label => (
              <button key={label} onClick={() => onScheduleTask(`Jean: ${label.replace("+ ", "")}: `)} style={{ padding: "7px 14px", background: `rgba(192,132,252,0.1)`, border: `1px solid ${JEAN_PURPLE}30`, color: JEAN_PURPLE, borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{label}</button>
            ))}
          </div>
        </>)}
      </div>

      {/* Task bar */}
      <div style={{ padding: "10px 16px 16px", borderTop: `1px solid ${T.border}`, background: T.bg, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={taskInput}
          onChange={e => setTaskInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && taskInput.trim()) { onScheduleTask(taskInput.trim()); setTaskInput(""); } }}
          placeholder="+ Add task to MYA..."
          style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "8px 14px", color: T.white, fontSize: 12, fontFamily: "inherit", outline: "none" }}
          onFocus={e => { e.target.style.borderColor = T.green + "50"; }}
          onBlur={e => { e.target.style.borderColor = T.border; }}
        />
        <button
          onClick={() => { if (taskInput.trim()) { onScheduleTask(taskInput.trim()); setTaskInput(""); } }}
          disabled={!taskInput.trim()}
          style={{ background: !taskInput.trim() ? T.dim : T.greenDim, border: `1px solid ${!taskInput.trim() ? T.border : T.green + "40"}`, color: !taskInput.trim() ? T.muted : T.green, borderRadius: 20, padding: "8px 16px", cursor: !taskInput.trim() ? "default" : "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
          Schedule it
        </button>
      </div>
    </div>
  );
}

const WEEKLY_EVENTS = [
  {
    id: "apr10", date: "FRI APR 10", title: "Midas + Errands", color: T.gold, priority: "normal",
    checklist: ["Drop car at Midas 8AM", "CVS Central Islip", "Aldi groceries", "Pick up car by 11AM"],
    notes: "Route: Home \u2192 Midas Bay Shore (1743 Sunrise Hwy) \u2192 CVS \u2192 Aldi \u2192 Home",
    contact: "(631) 206-6234 | 1743 Sunrise Hwy, Bay Shore NY | Waze: '1743 Sunrise Hwy Bay Shore NY'", reminder: "Call Midas at 8AM",
  },
  {
    id: "apr10b", date: "FRI APR 10", title: "Debbie - Piano Assessment", color: T.green, priority: "normal",
    checklist: ["Skill level assessment", "Goals discussion", "Reading ability check", "Hand position + posture", "Send notes to SOM after"],
    notes: "First lesson. This is intake only \u2014 assess and observe.",
    contact: "", reminder: "After lesson: tell PA 'Debbie assessment done' to route notes to SOM",
  },
  {
    id: "apr11", date: "SAT APR 11", title: "Church Rehearsal", color: T.blue, priority: "normal",
    checklist: ["Leave home by 9:30AM sharp", "Music reviewed Friday night", "Arrive by 10AM"],
    notes: "Friday 8PM: rehearsal prep hour at home.",
    contact: "", reminder: "Leave 9:30AM \u2014 rehearsal at 10AM",
  },
  {
    id: "apr13", date: "MON APR 13", title: "COURT - DIVORCE", color: "#FF4444", priority: "critical",
    checklist: ["Case number / docket #", "Government-issued ID", "All attorney correspondence", "Bank statements (last 3 months)", "Income records", "Previous court orders", "Talking points written out"],
    notes: "Confirm if in-person or video call with court clerk. If video: test device + mic + camera night before. Use quiet private location. Log in 10 min early. Have case number visible.",
    contact: "Confirm court address and judge name", reminder: "Leave by 9:00AM. Court at 10AM. Dress professionally.",
  },
  {
    id: "apr14", date: "TUE APR 14", title: "Jean Class", color: T.muted, priority: "normal",
    checklist: ["Arrive on time", "Professional dress"],
    notes: "6PM - 9PM", contact: "", reminder: "3 hour class \u2014 plan accordingly",
  },
];

// ─── Event type detector ─────────────────────────────────────────────────────
function detectEventType(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("bill due") || t.includes("bills due") || t.includes("payment")) return "bill";
  if (t.includes("church") || t.includes("⛪") || t.includes("rehearsal")) return "church";
  if (t.includes("therapist") || t.includes("therapy") || t.includes("wooley")) return "therapy";
  if (t.includes("meditation")) return "wellness";
  if (t.includes("herbs") || t.includes("supplement")) return "wellness";
  if (t.includes("jean class")) return "jean";
  if (t.includes("lesson") || t.includes("piano")) return "lesson";
  if (t.includes("system pulse") || t.includes("intelligence brief") || t.includes("mya")) return "system";
  if (t.includes("dj quality") || t.includes("quality time")) return "family";
  return "general";
}

function eventTypeColor(type) {
  const map = { bill: "#C9A84C", church: "#4A7AB0", therapy: "#3A8A6A", wellness: "#8A5A9A", jean: "#C084FC", lesson: "#C9A84C", system: "#3A8A52", family: "#8A5A9A", general: "#555" };
  return map[type] || "#555";
}

function eventTypeDim(type) {
  const map = { bill: "#1A1200", church: "#0A0F18", therapy: "#0A1814", wellness: "#140A18", jean: "#1A0F2A", lesson: "#1A1200", system: "#0A1A10", family: "#0F0A14", general: "#141414" };
  return map[type] || "#141414";
}

// ─── Normalize a Google Calendar event ───────────────────────────────────────
function normalizeEvent(ev) {
  const now = new Date();
  const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date + "T00:00:00") : null;
  const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date + "T00:00:00") : null;
  const isAllDay = !!ev.allDay || !!ev.start?.date;
  const isMultiDay = isAllDay && end && start && (end - start) > 86400000;
  const isToday = start && start.toDateString() === now.toDateString();
  const hasPassedToday = start && start < now && isToday;
  const isLiveNow = start && end && start <= now && now <= end;
  const minutesUntil = start ? Math.round((start - now) / 60000) : null;
  const type = detectEventType(ev.summary || "");
  const color = eventTypeColor(type);
  const zoomMatch = (ev.description || "").match(/zoom[^\n]*?(https:\/\/[^\s]+zoom[^\s]*)/i) || (ev.description || "").match(/(https:\/\/[^\s]*zoom[^\s]*)/i);
  const zoomId = (ev.description || "").match(/zoom[^0-9]*(\d{8,11})/i)?.[1] || null;
  const zoomLink = zoomMatch?.[1] || null;
  const hasZoom = !!(zoomLink || zoomId || (ev.description || "").toLowerCase().includes("zoom"));
  return { id: ev.id, title: ev.summary || "Untitled", start, end, isAllDay, isMultiDay, isToday, hasPassedToday, isLiveNow, minutesUntil, type, color, dim: eventTypeDim(type), description: ev.description || "", zoomLink, zoomId, hasZoom, source: ev.organizer?.displayName || "Google Calendar", calendarSource: ev.organizer?.displayName || "", attendees: ev.attendees || [], myResponseStatus: ev.myResponseStatus || "accepted", recurringEventId: ev.recurringEventId || null, raw: ev };
}

// ─── Finance Snapshot Card ────────────────────────────────────────────────────
function FinanceSnapshotCard({ onAskFM }) {
  const [snap, setSnap] = useState(null);
  const [status, setStatus] = useState("loading");

  const FM_PROMPT = `You are the FM Executive (CFO). Return ONLY this exact JSON with no other text, no markdown, no explanation:
{"status":"ok","current_bank_balance":4800,"estimated_income_month":6800,"bills_remaining_count":12,"bills_remaining_amount":3420,"projected_surplus":1380,"last_updated":"${new Date().toISOString()}","data_source":"FM Executive"}

Use real Q1 2026 data: Car stash $4,800, Mar surplus +$1,507, YTD net +$757. Bills remaining this month estimated from known recurring expenses. Respond ONLY with the JSON object.`;

  const fetchSnap = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: "FM", messages: [{ role: "user", content: FM_PROMPT }] }),
      });
      if (!res.ok) throw new Error("Agent error");
      const data = await res.json();
      const reply = data.reply || "";
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const parsed = JSON.parse(jsonMatch[0]);
      const required = ["current_bank_balance", "estimated_income_month", "bills_remaining_amount", "projected_surplus", "last_updated"];
      if (!required.every(k => k in parsed) || !["number"].every(() => typeof parsed.current_bank_balance === "number")) throw new Error("Invalid shape");
      setSnap(parsed);
      setStatus("ok");
    } catch {
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => { fetchSnap(); }, []);

  const fmt = (n) => typeof n === "number" ? "$" + n.toLocaleString() : "—";
  const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

  if (status === "loading") return (
    <div style={{ background: "#1A1400", border: `1px solid ${T.gold}25`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Finance Snapshot</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, opacity: 0.5, animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
        <span style={{ fontSize: 11, color: "#554400" }}>Loading snapshot...</span>
      </div>
    </div>
  );

  if (status === "unavailable") return (
    <div style={{ background: "#1A0A0A", border: `1px solid ${T.red}25`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: T.red, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Finance Snapshot</div>
        <button onClick={fetchSnap} style={{ background: "#2A1010", border: `1px solid ${T.red}30`, borderRadius: 6, padding: "3px 8px", fontSize: 9, color: T.red, cursor: "pointer", fontWeight: 700 }}>Retry</button>
      </div>
      <div style={{ fontSize: 11, color: "#664040", lineHeight: 1.6 }}>Snapshot unavailable. FM Executive not responding.</div>
    </div>
  );

  return (
    <div style={{ background: "#1A1400", border: `1px solid ${T.gold}25`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Finance Snapshot</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#443300" }}>Updated {fmtTime(snap.last_updated)}</span>
          <button onClick={fetchSnap} style={{ background: "transparent", border: "none", color: "#443300", cursor: "pointer", fontSize: 10, padding: 0 }}>↻</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[["In bank", fmt(snap.current_bank_balance), T.white], ["Est. income", fmt(snap.estimated_income_month), T.green], ["Bills left", fmt(snap.bills_remaining_amount), T.red]].map(([l,v,c]) => (
          <div key={l} style={{ background: "#120F00", borderRadius: 8, padding: "9px 8px", border: "1px solid #2A2000" }}>
            <div style={{ fontSize: 8, color: "#554400", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 16, color: c, fontWeight: 500, marginTop: 3, letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #2A2000", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "#554400" }}>Projected after bills</span>
        <span style={{ fontSize: 13, color: snap.projected_surplus >= 0 ? T.green : T.red, fontWeight: 500 }}>{snap.projected_surplus >= 0 ? "+" : ""}{fmt(snap.projected_surplus)}</span>
      </div>
    </div>
  );
}

// ─── Event Detail Panel ───────────────────────────────────────────────────────
function EventDetailPanel({ event, onClose }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const now = new Date();

  const getStatusStrip = () => {
    if (!event) return { text: "", sub: "", bg: "#141414", border: "#252525", color: "#888" };
    if (event.isLiveNow) return { text: "Live now", sub: "In progress", bg: "#0A1A10", border: `${T.green}25`, color: T.green };
    if (event.isToday && event.minutesUntil > 0) {
      const h = Math.floor(event.minutesUntil / 60), m = event.minutesUntil % 60;
      return { text: "Today · Starts in " + (h > 0 ? `${h}h ${m}m` : `${m}m`), sub: event.start?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) || "", bg: "#0A1A10", border: `${T.green}25`, color: T.green };
    }
    if (event.hasPassedToday) return { text: "Passed today", sub: "Completed", bg: "#141414", border: "#252525", color: "#555" };
    if (event.isMultiDay) return { text: "Multi-day block", sub: "Protected time", bg: event.dim, border: `${event.color}25`, color: event.color };
    const days = event.start ? Math.ceil((event.start - now) / 86400000) : 0;
    if (days <= 7) return { text: `Upcoming · ${event.start?.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}`, sub: event.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) || "", bg: event.dim, border: `${event.color}25`, color: event.color };
    return { text: "Scheduled", sub: event.start?.toLocaleDateString("en-US",{month:"short",day:"numeric"}) || "", bg: "#141414", border: "#252525", color: "#888" };
  };

  const getActions = () => {
    if (!event) return [];
    const t = event.type;
    if (event.hasZoom) return [{ label: "Join Zoom", style: "primary" }, { label: "Reschedule", style: "muted" }, { label: "Mark done", style: "muted" }];
    if (t === "bill") return [{ label: "Mark paid", style: "amber" }, { label: "Snooze", style: "muted" }];
    if (t === "church") return [{ label: "View in Calendar", style: "blue" }, { label: "Add note", style: "muted" }];
    if (event.isMultiDay) return [{ label: "View in Calendar", style: "primary" }, { label: "Add note", style: "muted" }];
    return [{ label: "View in Calendar", style: "blue" }, { label: "Mark done", style: "muted" }];
  };

  const getNextAction = () => {
    if (!event) return null;
    if (event.hasZoom && event.isToday) return `Join Zoom at ${event.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;
    if (event.hasZoom) return `Join Zoom · ${event.start?.toLocaleDateString("en-US",{weekday:"short"})}`;
    if (event.type === "bill") return `Pay before ${event.start?.toLocaleDateString("en-US",{month:"short",day:"numeric"})} · check description`;
    if (event.type === "church") return `Leave home by 9:30 AM · Rehearsal 10 AM`;
    if (event.isMultiDay) return "Protected time — MYA will not schedule over this block";
    return "No immediate action needed";
  };

  const ss = getStatusStrip();
  const actions = getActions();
  const nextAction = getNextAction();
  const descShort = event?.description?.split("\n").slice(0, 2).join(" ").substring(0, 120) || "";
  const descFull = event?.description || "";
  const hasLongDesc = descFull.length > 120;

  const actStyle = (s) => {
    const styles = {
      primary: { background: "#0A1A10", border: `1px solid ${T.green}30`, color: T.green },
      amber: { background: "#1A1200", border: `1px solid ${T.gold}30`, color: T.gold },
      blue: { background: "#0A0F18", border: `1px solid ${T.blue}30`, color: T.blue },
      muted: { background: "#141414", border: "1px solid #252525", color: "#555" },
    };
    return styles[s] || styles.muted;
  };

  const panelStyle = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 100dvw)",
    background: T.surface, borderLeft: `1px solid ${T.border}`,
    zIndex: 250, display: "flex", flexDirection: "column",
    boxShadow: "-12px 0 48px rgba(0,0,0,0.7)",
    transform: event ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.24s cubic-bezier(0.4,0,0.2,1)",
  };

  if (!event) return <div style={{ ...panelStyle, transform: "translateX(100%)" }} />;

  return (
    <div style={panelStyle}>
      {/* Top bar */}
      <div style={{ padding: "16px 18px 10px", paddingTop: "max(16px, env(safe-area-inset-top))", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.bg, flexShrink: 0 }}>
        <button onClick={onClose} style={{ minWidth: 44, minHeight: 44, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.muted, fontSize: 14, flexShrink: 0 }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.white, flex: 1, letterSpacing: "-0.01em" }}>Event details</span>
        <span style={{ fontSize: 9, color: T.muted, padding: "2px 7px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 4 }}>{event.calendarSource || "Personal"}</span>
      </div>

      {/* Status strip */}
      <div style={{ margin: "10px 16px 0", padding: "8px 12px", borderRadius: 8, background: ss.bg, border: `1px solid ${ss.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color, flexShrink: 0, ...(event.isLiveNow ? { animation: "pulse 1.5s infinite" } : {}) }} />
        <span style={{ fontSize: 11, color: ss.color, fontWeight: 500, flex: 1 }}>{ss.text}</span>
        <span style={{ fontSize: 9, color: ss.color, opacity: 0.6 }}>{ss.sub}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* Hero */}
        <div style={{ background: T.card, borderLeft: `3px solid ${event.color}`, borderRadius: "0 10px 10px 0", border: `1px solid ${T.border}`, padding: "12px 14px" }}>
          <div style={{ fontSize: 16, color: T.white, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 3 }}>{event.title}</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
            {event.isMultiDay ? `${event.start?.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} → ${event.end?.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}` :
            event.isAllDay ? event.start?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}) :
            `${event.start?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · ${event.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} – ${event.end?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${event.color}15`, color: event.color, border: `1px solid ${event.color}20`, textTransform: "capitalize" }}>{event.type}</span>
            {event.isToday && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${T.green}15`, color: T.green, border: `1px solid ${T.green}20` }}>Today</span>}
            {event.isMultiDay && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#1E1E1E", color: "#555", border: "1px solid #252525" }}>Multi-day</span>}
            {event.recurringEventId && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#1E1E1E", color: "#555", border: "1px solid #252525" }}>Recurring</span>}
          </div>
        </div>

        {/* Time */}
        {!event.isAllDay && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#555" strokeWidth="1.1"/><path d="M7 4v3l2 1.5" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 2 }}>Time</div>
              <div style={{ fontSize: 12, color: event.isToday ? T.green : T.white }}>{event.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} – {event.end?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} ET</div>
              <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>{event.minutesUntil > 0 ? `Starts in ${Math.floor(event.minutesUntil/60)}h ${event.minutesUntil%60}m` : event.isLiveNow ? "In progress now" : "Passed"}</div>
            </div>
          </div>
        )}

        {/* Zoom / Location */}
        {event.hasZoom && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#0A0F18", border: `1px solid ${T.blue}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="4" width="10" height="6" rx="1.5" stroke="#4A7AB0" strokeWidth="1.1"/><path d="M11 6l2-1.5v5L11 8" stroke="#4A7AB0" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 2 }}>Location</div>
              <div style={{ fontSize: 12, color: "#4A7AB0" }}>Zoom Meeting</div>
              {event.zoomId && <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>ID: {event.zoomId}</div>}
            </div>
            <div style={{ padding: "4px 10px", background: "#0A0F18", border: `1px solid ${T.blue}30`, borderRadius: 6, fontSize: 9, color: T.blue, cursor: "pointer", fontWeight: 700, flexShrink: 0 }}>Join</div>
          </div>
        )}

        {/* Recurrence */}
        {event.recurringEventId && !event.isAllDay && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7A5 5 0 1 0 7 2" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/><path d="M7 1v3l2-1.5" stroke="#555" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 2 }}>Recurrence</div>
              <div style={{ fontSize: 12, color: T.white }}>Repeats: {event.start?.toLocaleDateString("en-US",{weekday:"long"})}s at {event.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
              <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>Recurring event · weekly</div>
            </div>
          </div>
        )}

        {/* Description */}
        {descShort && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.dim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h8M2 11h5" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 2 }}>Notes</div>
              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>{descExpanded ? descFull : descShort}{!descExpanded && hasLongDesc ? "..." : ""}</div>
              {hasLongDesc && <div onClick={() => setDescExpanded(d => !d)} style={{ fontSize: 9, color: T.blue, marginTop: 4, cursor: "pointer" }}>{descExpanded ? "Show less ›" : "Show more ›"}</div>}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 7 }}>
          {actions.map((act, i) => (
            <button key={i} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 11, fontWeight: 700, textAlign: "center", cursor: "pointer", fontFamily: "inherit", ...actStyle(act.style) }}>{act.label}</button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px 16px", borderTop: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
        <div style={{ background: T.card, borderRadius: 8, padding: "8px 12px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: event.dim, border: `1px solid ${event.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke={event.color} strokeWidth="1.1"/><path d="M6 3.5v2.5l1.5 1" stroke={event.color} strokeWidth="1.1" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>Next action</div>
            <div style={{ fontSize: 11, color: T.white }}>{nextAction}</div>
          </div>
        </div>
        <div style={{ fontSize: 8, color: "#2A2A2A", textAlign: "center", marginTop: 6, letterSpacing: "0.03em" }}>Source: {event.source} · Personal calendar</div>
      </div>
    </div>
  );
}

// ─── Live Calendar Component ──────────────────────────────────────────────────
function LiveCalendar({ events, selectedDay, onSelectDay }) {
  const today = new Date();
  const todayDate = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const eventsByDay = {};
  events.forEach(ev => {
    if (!ev.start) return;
    const d = ev.start.getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(ev);
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: T.white, fontWeight: 700 }}>{monthName}</div>
        <div style={{ fontSize: 9, color: T.muted }}>{events.length} events</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, padding: "0 10px 10px" }}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} style={{ fontSize: 7, color: "#444", textAlign: "center", padding: "2px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = d === todayDate;
          const isSelected = d === selectedDay;
          const dayEvents = eventsByDay[d] || [];
          const isPast = d < todayDate;
          const evColor = dayEvents[0]?.color || null;
          return (
            <div key={d} onClick={() => onSelectDay(d)} style={{ width: "100%", aspectRatio: "1", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: dayEvents.length > 0 || isToday ? "pointer" : "default", background: isToday ? T.green : isSelected && !isToday ? "#252525" : "transparent", position: "relative" }}>
              <span style={{ fontSize: 9, fontWeight: isToday ? 700 : isPast ? 400 : 500, color: isToday ? "#fff" : isPast ? "#2A2A2A" : dayEvents.length > 0 ? T.white : "#555" }}>{d}</span>
              {dayEvents.length > 0 && !isToday && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: evColor || T.gold }} />}
            </div>
          );
        })}
      </div>
      {selectedDay && eventsByDay[selectedDay] && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 12px 10px" }}>
          <div style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 6 }}>
            {selectedDay === todayDate ? "Today" : `Apr ${selectedDay}`} — {eventsByDay[selectedDay]?.length} event{eventsByDay[selectedDay]?.length > 1 ? "s" : ""}
          </div>
          {(eventsByDay[selectedDay] || []).map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: i < eventsByDay[selectedDay].length - 1 ? `1px solid ${T.dim}` : "none" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: T.white, flex: 1 }}>{ev.title}</span>
              <span style={{ fontSize: 9, color: T.muted }}>{ev.isAllDay ? "All day" : ev.start?.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PersonalMainView ─────────────────────────────────────────────────────────
function PersonalMainView({ onScheduleTask, onOpenFM, onAskFM }) {
  const [taskInput, setTaskInput] = useState("");
  const [calEvents, setCalEvents] = useState([]);
  const [calStatus, setCalStatus] = useState("loading");
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedEvent, setSelectedEvent] = useState(null);

  const today = new Date();

  const hoverLift = (color) => ({
    onMouseEnter: (e) => { e.currentTarget.style.transform = "scale(1.015)"; e.currentTarget.style.boxShadow = `0 4px 20px ${color}20`; },
    onMouseLeave: (e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; },
  });

  // Fetch Google Calendar via Railway backend
  useEffect(() => {
    const fetchCal = async () => {
      setCalStatus("loading");
      try {
        const now = new Date();
        const weekEnd = new Date(now.getTime() + 14 * 86400000);
        const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/calendar?timeMin=${now.toISOString()}&timeMax=${weekEnd.toISOString()}`);
        if (!res.ok) throw new Error("Calendar fetch failed");
        const data = await res.json();
        const normalized = (data.events || []).map(normalizeEvent).filter(ev => ev.start);
        setCalEvents(normalized);
        setCalStatus("ok");
      } catch {
        // Fallback: use hardcoded real events from April 15 fetch
        const fallbackEvents = [
          { id: "deb1", summary: "Deb — Piano Lesson", start: { dateTime: `${today.toISOString().slice(0,10)}T11:30:00-04:00` }, end: { dateTime: `${today.toISOString().slice(0,10)}T12:30:00-04:00` }, description: "Weekly piano lesson with Deb.\n\nVia Zoom — link will be added\n30-min reminder set.\nSet by MYA Dispatch", organizer: { displayName: "Music Lessons" }, myResponseStatus: "needsAction", recurringEventId: "recurring1" },
          { id: "bill1", summary: "Bills Due Tomorrow: Splice + Gmail Storage", start: { dateTime: `${new Date(today.getTime()+86400000).toISOString().slice(0,10)}T09:00:00-04:00` }, end: { dateTime: `${new Date(today.getTime()+86400000).toISOString().slice(0,10)}T09:30:00-04:00` }, description: "Splice - $14.11 and Gmail Storage One - $3.25 both due tomorrow.", organizer: { displayName: "Personal" }, colorId: "11" },
          { id: "church1", summary: "⛪ Church Rehearsal Prep — 1 hour practice", start: { dateTime: `${new Date(today.getTime()+2*86400000).toISOString().slice(0,10)}T20:00:00-04:00` }, end: { dateTime: `${new Date(today.getTime()+2*86400000).toISOString().slice(0,10)}T21:00:00-04:00` }, description: "1 hour rehearsal prep. Leave home Saturday at 9:30AM.", organizer: { displayName: "Personal" }, recurringEventId: "recurring2" },
          { id: "therapy1", summary: "John Wooley Therapist", start: { dateTime: `${new Date(today.getTime()+5*86400000).toISOString().slice(0,10)}T11:00:00-04:00` }, end: { dateTime: `${new Date(today.getTime()+5*86400000).toISOString().slice(0,10)}T12:00:00-04:00` }, description: "Zoom-6833855700", organizer: { displayName: "Personal" }, recurringEventId: "recurring3" },
          { id: "bill2", summary: "Bills Due Tomorrow: Phone Bill ($83.12)", start: { dateTime: `${new Date(today.getTime()+6*86400000).toISOString().slice(0,10)}T09:00:00-04:00` }, end: { dateTime: `${new Date(today.getTime()+6*86400000).toISOString().slice(0,10)}T09:30:00-04:00` }, description: "Phone Bill payment #2 ($83.12) is due tomorrow (22nd).", organizer: { displayName: "Personal" } },
          { id: "dj1", summary: "DJ Quality Time", start: { date: `${new Date(today.getTime()+9*86400000).toISOString().slice(0,10)}` }, end: { date: `${new Date(today.getTime()+12*86400000).toISOString().slice(0,10)}` }, allDay: true, organizer: { displayName: "DJ" } },
        ];
        setCalEvents(fallbackEvents.map(normalizeEvent).filter(ev => ev.start));
        setCalStatus("fallback");
      }
    };
    fetchCal();
  }, []);

  // Sort events: today upcoming → today passed → rest of week chronological, multi-day last
  const sortedEvents = [...calEvents].sort((a, b) => {
    if (a.isToday && !a.hasPassedToday && (!b.isToday || b.hasPassedToday)) return -1;
    if (b.isToday && !b.hasPassedToday && (!a.isToday || a.hasPassedToday)) return 1;
    if (a.isToday && a.hasPassedToday && !b.isToday) return -1;
    if (b.isToday && b.hasPassedToday && !a.isToday) return 1;
    if (a.isMultiDay && !b.isMultiDay) return 1;
    if (b.isMultiDay && !a.isMultiDay) return -1;
    return (a.start || 0) - (b.start || 0);
  }).filter(ev => !ev.title.toLowerCase().includes("daily meditation") && !ev.title.toLowerCase().includes("system pulse") && !ev.title.toLowerCase().includes("intelligence brief"));

  const todayEvents = sortedEvents.filter(ev => ev.isToday);
  const upcomingEvents = sortedEvents.filter(ev => !ev.isToday).slice(0, 8);

  const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const todayCount = todayEvents.length;
  const weekCount = sortedEvents.length;

  const evRowStyle = (ev) => ({
    display: "flex", gap: 8, padding: "8px 10px", background: ev.dim, borderRadius: 10,
    border: `1px solid ${ev.color}20`, cursor: "pointer", marginBottom: 5, transition: "background 0.12s",
  });

  const fmtEvTime = (ev) => {
    if (ev.isAllDay || ev.isMultiDay) return "All day";
    return ev.start?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) || "";
  };

  const [calOpen, setCalOpen] = useState(false);

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Finance Snapshot ── */}
      <FinanceSnapshotCard onAskFM={onAskFM} />

      {/* ── Live Calendar — collapsible ── */}
      <div>
        <div onClick={() => setCalOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: calOpen ? "12px 12px 0 0" : 12, cursor: "pointer", marginBottom: calOpen ? 0 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Calendar — April 2026</span>
            <span style={{ fontSize: 9, color: T.muted }}>{calEvents.length} events</span>
          </div>
          <span style={{ fontSize: 10, color: T.muted, transform: calOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▸</span>
        </div>
        {calOpen && (
          <div style={{ borderRadius: "0 0 12px 12px", overflow: "hidden", border: `1px solid ${T.border}`, borderTop: "none" }}>
            <LiveCalendar events={calEvents} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </div>
        )}
      </div>

      {/* ── Today's Events ── */}
      {calStatus === "loading" ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Today — {todayLabel}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: T.green, opacity: 0.5, animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
            <span style={{ fontSize: 11, color: T.muted }}>Loading calendar...</span>
          </div>
        </div>
      ) : todayEvents.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Today — {todayLabel}</div>
          <div style={{ fontSize: 12, color: "#333", fontStyle: "italic" }}>No events today. Calendar is clear.</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 9, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Today — {todayLabel} · <span style={{ color: T.gold }}>{todayCount} event{todayCount !== 1 ? "s" : ""}</span>
          </div>
          {todayEvents.map(ev => (
            <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={{ ...evRowStyle(ev), opacity: ev.hasPassedToday ? 0.5 : 1 }}>
              <div style={{ minWidth: 52, flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>Today</div>
                <div style={{ fontSize: 10, color: ev.color, fontWeight: 500 }}>{fmtEvTime(ev)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: T.white, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{ev.hasZoom ? "Zoom" : ev.type}</div>
              </div>
              <div style={{ fontSize: 12, color: "#252525", flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Upcoming This Week ── */}
      {upcomingEvents.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Upcoming · <span style={{ color: "#555" }}>{upcomingEvents.length} events</span>
          </div>
          {upcomingEvents.map(ev => (
            <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={evRowStyle(ev)}>
              <div style={{ minWidth: 60, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: ev.color, fontWeight: 500 }}>{ev.start?.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
                <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{fmtEvTime(ev)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: ev.isMultiDay ? "#B090C0" : T.white, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>{ev.isMultiDay ? `Multi-day · through ${ev.end?.toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : ev.hasZoom ? "Zoom" : ev.type}</div>
              </div>
              <div style={{ fontSize: 12, color: "#252525", flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Task Scheduler ── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 9, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Smart Task Scheduler</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && taskInput.trim()) { onScheduleTask(taskInput.trim()); setTaskInput(""); } }} placeholder="+ Add task..." style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.white, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => { if (taskInput.trim()) { onScheduleTask(taskInput.trim()); setTaskInput(""); } }} disabled={!taskInput.trim()} style={{ background: !taskInput.trim() ? T.dim : T.greenDim, border: `1px solid ${!taskInput.trim() ? T.border : T.green + "40"}`, color: !taskInput.trim() ? T.muted : T.green, borderRadius: 8, padding: "8px 14px", cursor: !taskInput.trim() ? "default" : "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Schedule it</button>
        </div>
      </div>

      {/* Event Detail Panel */}
      <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />

    </div>
  );
}


const JEAN_PURPLE = "#C084FC";
const JEAN_DIM = "rgba(192,132,252,0.1)";

function JeanMainView({ onScheduleTask }) {
  const [cycleCount, setCycleCount] = useState(() => {
    try { return parseInt(localStorage.getItem("jean_cycle_count") || "0"); } catch { return 0; }
  });
  const [cycleStartDate, setCycleStartDate] = useState(() => {
    try { return localStorage.getItem("jean_cycle_start") || null; } catch { return null; }
  });
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem("jean_notes") || ""; } catch { return ""; }
  });

  const totalCycles = 24;
  const pct = Math.round((cycleCount / totalCycles) * 100);
  const remaining = totalCycles - cycleCount;
  const RED_ZONE_START = 20;
  const isRedZone = cycleCount >= RED_ZONE_START;
  const isComplete = cycleCount >= totalCycles;

  const incrementCycle = () => {
    const next = Math.min(cycleCount + 1, totalCycles);
    setCycleCount(next);
    if (!cycleStartDate) {
      const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      setCycleStartDate(now);
      try { localStorage.setItem("jean_cycle_start", now); } catch {}
    }
    try { localStorage.setItem("jean_cycle_count", next.toString()); } catch {}
  };

  const resetCycle = () => {
    setCycleCount(0);
    setCycleStartDate(null);
    try { localStorage.removeItem("jean_cycle_count"); localStorage.removeItem("jean_cycle_start"); } catch {}
  };

  const saveNotes = (val) => {
    setNotes(val);
    try { localStorage.setItem("jean_notes", val); } catch {}
  };

  const nextClassDate = () => {
    const now = new Date();
    const day = now.getDay();
    const daysUntilTue = day <= 2 ? 2 - day : 9 - day;
    const next = new Date(now.getTime() + daysUntilTue * 86400000);
    return next.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: JEAN_PURPLE }} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.white, letterSpacing: "-0.02em" }}>JEAN</div>
          <div style={{ fontSize: 11, color: T.muted }}>Class every Tuesday 6–9PM · Next: {nextClassDate()}</div>
        </div>
      </div>

      {/* Cycle Tracker Card */}
      <div style={{
        background: isRedZone ? "rgba(192,48,48,0.08)" : isComplete ? T.greenDim : JEAN_DIM,
        border: `1px solid ${isRedZone ? T.red + "40" : isComplete ? T.green + "40" : JEAN_PURPLE + "30"}`,
        borderRadius: 14, padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: isRedZone ? T.red : JEAN_PURPLE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
              {isComplete ? "✓ Complete" : isRedZone ? "⚠ Red Zone" : "Cycle Tracker"}
            </div>
            <div style={{ fontSize: 22, color: isRedZone ? T.red : isComplete ? T.green : T.white, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {cycleCount} <span style={{ fontSize: 13, color: T.muted, fontWeight: 400 }}>/ {totalCycles} cycles</span>
            </div>
          </div>
          <div style={{ position: "relative", width: 56, height: 56 }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke={T.dim} strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none"
                stroke={isComplete ? T.green : isRedZone ? T.red : JEAN_PURPLE}
                strokeWidth="5"
                strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
                strokeDashoffset="34.6"
                strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isComplete ? T.green : isRedZone ? T.red : JEAN_PURPLE }}>{pct}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: T.dim, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", borderRadius: 3, background: isComplete ? T.green : isRedZone ? T.red : JEAN_PURPLE, width: `${pct}%`, transition: "width 0.4s cubic-bezier(0.22,1,0.36,1)" }} />
        </div>

        {/* Red zone indicator */}
        {isRedZone && !isComplete && (
          <div style={{ background: T.redDim, border: `1px solid ${T.red}30`, borderRadius: 8, padding: "7px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 11, color: T.red, fontWeight: 700 }}>Red Zone — {remaining} cycle{remaining !== 1 ? "s" : ""} remaining</span>
          </div>
        )}

        <div style={{ fontSize: 10, color: T.muted, marginBottom: 12 }}>
          {isComplete ? "All cycles complete — great work!" : `${remaining} cycle${remaining !== 1 ? "s" : ""} remaining · Started: ${cycleStartDate || "not started"}`}
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={incrementCycle} disabled={isComplete} style={{
            flex: 1, background: isComplete ? T.dim : JEAN_DIM, border: `1px solid ${isComplete ? T.border : JEAN_PURPLE + "50"}`,
            color: isComplete ? T.muted : JEAN_PURPLE, borderRadius: 8, padding: "8px 12px",
            cursor: isComplete ? "default" : "pointer", fontSize: 11, fontWeight: 700,
          }}>+ Mark Cycle Done</button>
          <button onClick={resetCycle} style={{ background: T.dim, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 10 }}>Reset</button>
        </div>
      </div>

      {/* Class Schedule */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${JEAN_PURPLE}`, borderRadius: "0 12px 12px 0", padding: "12px 16px" }}>
        <div style={{ fontSize: 9, color: JEAN_PURPLE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Class Schedule</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.white }}>Every Tuesday · 6:00 – 9:00 PM</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>3 hour class · Next: {nextClassDate()}</div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {["+ Add task", "+ Add reminder", "+ Add note"].map(label => (
          <button key={label} onClick={() => onScheduleTask(`Jean: ${label.replace("+ ", "")}: `)} style={{ padding: "7px 14px", background: JEAN_DIM, border: `1px solid ${JEAN_PURPLE}30`, color: JEAN_PURPLE, borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{label}</button>
        ))}
      </div>

      {/* Notes */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 9, color: JEAN_PURPLE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Notes</div>
        <textarea
          value={notes}
          onChange={e => saveNotes(e.target.value)}
          placeholder="Add notes about Jean class..."
          rows={3}
          style={{ width: "100%", background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.white, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6 }}
          onFocus={e => { e.target.style.borderColor = JEAN_PURPLE + "50"; }}
          onBlur={e => { e.target.style.borderColor = T.border; }}
        />
      </div>
    </div>
  );
}

// ─── Book Manager Executive Panel ────────────────────────────────────────────
const BOOK_GOLD = "#c9a84c";
const BOOK_GOLD2 = "#e8c96e";
const BOOK_GDIM = "rgba(201,168,76,0.12)";
const BOOK_GGLOW = "rgba(201,168,76,0.06)";

const BOOK_MILESTONES = [
  { id:"m1", label:"File Copyright",        date:"2026-04-14", type:"legal",      done:false },
  { id:"m2", label:"Purchase ISBN",          date:"2026-04-14", type:"legal",      done:false },
  { id:"m3", label:"Manuscript Final",       date:"2026-04-18", type:"manuscript", done:false },
  { id:"m4", label:"Cover Design Due",       date:"2026-04-28", type:"design",     done:false },
  { id:"m5", label:"Interior Layout Done",   date:"2026-05-05", type:"design",     done:false },
  { id:"m6", label:"Upload to IngramSpark",  date:"2026-05-08", type:"publishing", done:false },
  { id:"m7", label:"Order Proof Copy",       date:"2026-05-10", type:"publishing", done:false },
  { id:"m8", label:"Proof Approved",         date:"2026-05-18", type:"publishing", done:false },
  { id:"m9", label:"Place Bulk Print Order", date:"2026-05-19", type:"print",      done:false },
  { id:"m10",label:"Books Delivered",        date:"2026-06-05", type:"print",      done:false },
  { id:"m11",label:"🏛️ CONVENTION",         date:"2026-06-15", type:"convention", done:false },
];

const MS_COLORS = {
  legal:"#5b8dee", manuscript:"#9b72ef", design:"#e8834a",
  publishing:"#4db87a", print:"#c9a84c", convention:"#e8c96e",
};

const BOOK_CHAPTERS = [
  { id:"PRE", name:"Dedication & Preface",  status:"review" },
  { id:"INT", name:"Introduction",           status:"review" },
  { id:"1",   name:"Male-Hood",              status:"review" },
  { id:"2",   name:"Boy-Hood",               status:"review" },
  { id:"3",   name:"Man-Hood",               status:"review" },
  { id:"4",   name:"Husband-Hood",           status:"draft",  note:"⚠ Missing case study" },
  { id:"5",   name:"Father-Hood",            status:"draft",  note:"⚠ Incomplete" },
  { id:"6",   name:"Mentor-Hood",            status:"review" },
  { id:"CON", name:"Conclusion",             status:"review" },
];

const BOOK_CHECKS = [
  { id:"c1",  label:"U.S. Copyright Registration", urgent:true  },
  { id:"c2",  label:"ISBN (KDP)",                  urgent:false },
  { id:"c3",  label:"LCCN — Library of Congress",  urgent:false },
  { id:"c4",  label:"Cover Design — Final",        urgent:false },
  { id:"c5",  label:"Interior Layout",             urgent:false },
  { id:"c6",  label:"KDP Account Setup",           urgent:false },
  { id:"c7",  label:"IngramSpark Setup",           urgent:false },
  { id:"c8",  label:"ACX Audiobook Setup",         urgent:false },
  { id:"c9",  label:"Apple Books",                 urgent:false },
  { id:"c10", label:"Google Play Books",           urgent:false },
];

const BOOK_BLOCKERS = [
  "Manuscript incomplete (Ch.4 case study missing)",
  "Copyright not filed",
  "ISBN not purchased",
  "Cover design not started",
  "No email list built",
  "KDP account not configured",
];

const BOOK_AGENT_SYSTEM = `You are the Book Manager Executive for "Tales from the Hood: A Biblical Guide to Growing from Male to Man" by Bishop Roskco A. Motes, PhD.

CRITICAL DEADLINE: Hardcover books must be ready by mid-June 2026 for Bishop Motes' convention.

PROJECT STATE:
- Phase: Writing/Manuscript
- 6-stage framework: Male-Hood, Boy-Hood, Man-Hood, Husband-Hood, Father-Hood, Mentor-Hood
- Ch.4 (Husband-Hood) missing biblical case study
- Ch.5 (Father-Hood) characteristics incomplete
- Copyright NOT filed — urgent ($65 at copyright.gov)
- ISBN not purchased — urgent ($125 at myidentifiers.com)
- Convention deadline: June 15, 2026

AUTHOR: Bishop Roskco A. Motes, PhD
- 60+ years ministry, Army EO Specialist, Hofstra MA Marriage & Family Therapy
- Authored DOD policy on sexual harassment, international pastor

PRINT COSTS (for convention):
- KDP hardcover: $5.65 + ($0.012 × pages) = ~$8.05 per unit (200 pages)
- IngramSpark hardcover: ~$9.50–$11.00 per unit (has dust jacket option)
- 150 copies bulk: ~$1,200–$1,500
- Total convention budget estimate: $3,000–$4,000

YOUR SKILLS: Writing, Proofreading, Fact Verification, Publishing, Digital Distribution, Narration/Audiobook, Marketing, Revenue/Royalties

OPERATING RULES:
1. Start every response: current phase + ONE highest-impact action
2. Be specific and actionable with exact steps and URLs
3. Every quick action generates structured, usable output
4. End responses with action items marked as saveable tasks
5. This book = serious work by a serious man. Treat it accordingly.`;

function BookManagerPanel() {
  const [phase, setPhase] = useState("Writing");
  const [chapters, setChapters] = useState(() => {
    try { const s = localStorage.getItem("bk_chapters"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [checks, setChecks] = useState(() => {
    try { const s = localStorage.getItem("bk_checks"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [milestones, setMilestones] = useState(() => {
    try { const s = localStorage.getItem("bk_milestones"); return s ? JSON.parse(s) : BOOK_MILESTONES; } catch { return BOOK_MILESTONES; }
  });
  const [tasks, setTasks] = useState(() => {
    try { const s = localStorage.getItem("bk_tasks"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [messages, setMessages] = useState([{
    role: "agent",
    text: `**Project loaded. Convention deadline: June 15, 2026.**\n\nHardcover books must be ready by mid-June. That's ~9 weeks. The timeline is tight but executable.\n\n**Current phase: Writing.** Two chapters still need completion before this manuscript is ready to send to layout.\n\n**Three moves that must happen this week:**\n1. File copyright at copyright.gov — $65. Do this today.\n2. Purchase ISBN at myidentifiers.com — $125. Own your own ISBN.\n3. Complete Chapter 4 biblical case study.\n\nWhat do you want to tackle first?`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [calMonth, setCalMonth] = useState(3); // April
  const [calYear, setCalYear] = useState(2026);
  const [taskModal, setTaskModal] = useState(false);
  const [taskName, setTaskName] = useState("");
  const chatRef = useRef(null);

  // Persist
  useEffect(() => { localStorage.setItem("bk_chapters", JSON.stringify(chapters)); }, [chapters]);
  useEffect(() => { localStorage.setItem("bk_checks", JSON.stringify(checks)); }, [checks]);
  useEffect(() => { localStorage.setItem("bk_milestones", JSON.stringify(milestones)); }, [milestones]);
  useEffect(() => { localStorage.setItem("bk_tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  // Metrics
  const msFinal = BOOK_CHAPTERS.filter(c => (chapters[c.id] || c.status) === "final" || (chapters[c.id] || c.status) === "edited").length;
  const msPct = Math.round((msFinal / BOOK_CHAPTERS.length) * 100);
  const pubDone = BOOK_CHECKS.filter(c => checks[c.id]).length;
  const pubPct = Math.round((pubDone / BOOK_CHECKS.length) * 100);
  const convDays = Math.ceil((new Date("2026-06-15") - new Date()) / 86400000);
  const openTasks = tasks.filter(t => !t.done).length;

  const statusCycle = ["draft","review","edited","final"];
  const statusColor = { draft:"#54524d", review:"#5b8dee", edited:"#9b72ef", final:"#4db87a" };
  const statusLabel = { draft:"Draft", review:"In Review", edited:"Edited", final:"Final" };

  function cycleChapter(id) {
    const cur = chapters[id] || BOOK_CHAPTERS.find(c=>c.id===id)?.status || "draft";
    const next = statusCycle[(statusCycle.indexOf(cur)+1) % statusCycle.length];
    setChapters(prev => ({...prev, [id]: next}));
  }

  function toggleCheck(id) {
    setChecks(prev => ({...prev, [id]: !prev[id]}));
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => t.id===id ? {...t, done:!t.done} : t));
  }

  function saveTask(name) {
    if (!name.trim()) return;
    setTasks(prev => [{id: Date.now(), name: name.trim(), done: false, created: new Date().toLocaleDateString()}, ...prev]);
    setTaskModal(false); setTaskName("");
  }

  // Calendar
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();

  const msMap = {};
  milestones.forEach(m => {
    const d = new Date(m.date + "T12:00:00");
    if (d.getFullYear()===calYear && d.getMonth()===calMonth) {
      if (!msMap[d.getDate()]) msMap[d.getDate()] = [];
      msMap[d.getDate()].push(m);
    }
  });

  const upcomingMs = milestones.filter(m=>!m.done).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,5);

  // Agent
  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setMessages(prev => [...prev, {role:"user", text: msg}]);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system: BOOK_AGENT_SYSTEM,
          messages: [...messages.filter(m=>m.role!=="agent"||messages.indexOf(m)>0).slice(-10).map(m=>({role:m.role==="agent"?"assistant":"user",content:m.text})), {role:"user",content:msg}]
        })
      });
      const data = await res.json();
      const reply = data.content?.find(b=>b.type==="text")?.text || "Error getting response.";
      setMessages(prev => [...prev, {role:"agent", text: reply}]);
    } catch {
      setMessages(prev => [...prev, {role:"agent", text:"Connection error. Check API configuration."}]);
    }
    setLoading(false);
  }

  function fmtMsg(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  const phaseActions = {
    "Writing": "Complete Ch.4 case study · File copyright ($65)",
    "Editing": "Full proofread · Fact-check all scripture",
    "Design": "Commission cover · Format interior layout",
    "Publishing Setup": "KDP + IngramSpark + ACX setup",
    "Launch": "All platforms live · Email blast · Church push",
    "Post-Launch Growth": "Reviews push · Pricing optimize · Speaking bundles"
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth <= 768 ? "1fr" : "240px 1fr 280px", height:"100%", overflow:"hidden", fontFamily:"'DM Sans', system-ui, sans-serif" }}>

      {/* ── LEFT RAIL ── */}
      <div style={{ background:"#101013", borderRight:"1px solid rgba(255,255,255,0.06)", overflowY:"auto", padding:"12px 0 24px" }}>

        {/* Convention Banner */}
        <div style={{ margin:"0 10px 14px", padding:"10px 12px", background:"linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.06))", border:"1px solid rgba(201,168,76,0.3)", borderRadius:10 }}>
          <div style={{ fontSize:9, color:BOOK_GOLD, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase" }}>🏛️ Convention Deadline</div>
          <div style={{ fontSize:15, fontWeight:800, color:"#ede9e0", marginTop:2 }}>Mid-June 2026</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:4, marginTop:4 }}>
            <span style={{ fontFamily:"monospace", fontSize:22, fontWeight:700, color:BOOK_GOLD2 }}>{convDays}</span>
            <span style={{ fontSize:9, color:"#9b9790", letterSpacing:".04em" }}>DAYS LEFT</span>
          </div>
        </div>

        {/* Blockers */}
        <div style={{ padding:"0 10px", marginBottom:14 }}>
          <div style={{ fontSize:9, color:"#54524d", letterSpacing:".1em", textTransform:"uppercase", padding:"0 4px", marginBottom:6 }}>🚨 Blockers</div>
          <div style={{ background:"rgba(224,85,85,0.1)", border:"1px solid rgba(224,85,85,0.22)", borderRadius:8, padding:"8px 10px" }}>
            {BOOK_BLOCKERS.map((b,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 0", borderBottom: i<BOOK_BLOCKERS.length-1?"1px solid rgba(224,85,85,0.1)":"none" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"#e05555", flexShrink:0 }} />
                <div style={{ fontSize:10, color:"#ede9e0" }}>{b}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chapters */}
        <div style={{ fontSize:9, color:"#54524d", letterSpacing:".1em", textTransform:"uppercase", padding:"0 14px", marginBottom:6 }}>Chapter Tracker</div>
        {BOOK_CHAPTERS.map(ch => {
          const st = chapters[ch.id] || ch.status;
          const col = statusColor[st];
          return (
            <div key={ch.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 14px", cursor:"pointer", transition:"background .15s", borderLeft:"2px solid transparent" }}
              onMouseEnter={e=>e.currentTarget.style.background="#16161a"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <div style={{ width:22, height:22, borderRadius:5, background:`${col}22`, border:`1px solid ${col}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:col, fontWeight:700, flexShrink:0 }}>{ch.id}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#ede9e0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ch.name}</div>
                <div style={{ fontSize:9, color:"#54524d", marginTop:1 }}>{ch.note || statusLabel[st]}</div>
              </div>
              <button onClick={()=>cycleChapter(ch.id)} style={{ fontSize:9, padding:"2px 6px", borderRadius:8, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#9b9790", cursor:"pointer" }}>▷</button>
            </div>
          );
        })}

        {/* Pub Checklist */}
        <div style={{ fontSize:9, color:"#54524d", letterSpacing:".1em", textTransform:"uppercase", padding:"12px 14px 6px", marginTop:4 }}>Publishing Checklist</div>
        {BOOK_CHECKS.map(c => (
          <div key={c.id} onClick={()=>toggleCheck(c.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 14px", cursor:"pointer", transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="#16161a"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <div style={{ width:15, height:15, borderRadius:3, border:`1.5px solid ${checks[c.id]?"#4db87a":c.urgent?BOOK_GOLD:"rgba(255,255,255,0.15)"}`, background:checks[c.id]?"#4db87a":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#000", flexShrink:0 }}>{checks[c.id]?"✓":""}</div>
            <div style={{ fontSize:11, color: checks[c.id]?"#54524d":"#9b9790", textDecoration:checks[c.id]?"line-through":"none", flex:1 }}>{c.label}</div>
            {c.urgent && !checks[c.id] && <span style={{ fontSize:8, padding:"1px 5px", borderRadius:8, background:BOOK_GDIM, color:BOOK_GOLD, fontWeight:700 }}>URGENT</span>}
          </div>
        ))}
      </div>

      {/* ── CENTER AGENT ── */}
      <div style={{ display:"flex", flexDirection:"column", background:"#08080a", overflow:"hidden" }}>

        {/* Agent Header */}
        <div style={{ padding:"12px 18px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"#101013", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#1c1505,#3d2c0a)", border:`1px solid ${BOOK_GOLD}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📚</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#ede9e0", letterSpacing:"-0.01em" }}>Book Manager Executive</div>
              <div style={{ fontSize:10, color:BOOK_GOLD, letterSpacing:".04em" }}>Tales from the Hood · Bishop Roskco A. Motes, PhD</div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {["Writing","Editing","Design","Publishing Setup","Launch","Post-Launch Growth"].indexOf(phase) > -1 && (
                <select value={phase} onChange={e=>setPhase(e.target.value)} style={{ background:BOOK_GDIM, border:`1px solid ${BOOK_GOLD}`, color:BOOK_GOLD, padding:"4px 8px", borderRadius:6, fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {["Writing","Editing","Design","Publishing Setup","Launch","Post-Launch Growth"].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>
          </div>
          {/* Phase bar */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:BOOK_GGLOW, borderRadius:7 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:BOOK_GOLD, animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:10, color:BOOK_GOLD, fontWeight:700, letterSpacing:".05em" }}>PHASE: {phase.toUpperCase()}</span>
            <span style={{ fontSize:10, color:"#9b9790" }}>→ {phaseActions[phase]}</span>
          </div>
          {/* Metric strip */}
          <div style={{ display:"flex", gap:0, marginTop:8 }}>
            {[
              { label:"Manuscript", val:`${msPct}%`, color:"#9b72ef" },
              { label:"Publishing", val:`${pubPct}%`, color:"#4db87a" },
              { label:"Open Tasks", val:openTasks, color:BOOK_GOLD },
              { label:"Revenue", val:"$0", color:BOOK_GOLD2 },
              { label:"Convention", val:`${convDays}d`, color:convDays<30?"#e05555":BOOK_GOLD },
            ].map((m,i) => (
              <div key={i} style={{ flex:1, padding:"6px 10px", borderRight:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:m.color }}>{m.val}</div>
                <div style={{ fontSize:8, color:"#54524d", letterSpacing:".05em", textTransform:"uppercase", marginTop:1 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex", gap:8, flexDirection: m.role==="user"?"row-reverse":"row" }}>
              <div style={{ width:28, height:28, borderRadius:7, background:m.role==="agent"?BOOK_GDIM:"#1e1e24", border:`1px solid ${m.role==="agent"?BOOK_GOLD:"rgba(255,255,255,0.1)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>{m.role==="agent"?"📚":"👤"}</div>
              <div style={{ maxWidth:"75%", padding:"10px 14px", borderRadius:10, fontSize:12, lineHeight:1.65, background:m.role==="agent"?"#101013":"rgba(201,168,76,0.1)", border:`1px solid ${m.role==="agent"?"rgba(255,255,255,0.06)":"rgba(201,168,76,0.2)"}`, borderTopLeftRadius:m.role==="agent"?3:10, borderTopRightRadius:m.role==="user"?3:10 }}>
                <div style={{ fontSize:9, color:"#54524d", letterSpacing:".06em", textTransform:"uppercase", fontWeight:700, marginBottom:5 }}>{m.role==="agent"?"Book Manager Executive":"Denarius"}</div>
                <div dangerouslySetInnerHTML={{__html: fmtMsg(m.text)}} />
                {m.role==="agent" && i>0 && (
                  <div style={{ display:"flex", gap:5, marginTop:8, paddingTop:7, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                    <button onClick={()=>{ setTaskName(m.text.split("\n")[0].replace(/[*#]/g,"").trim().substring(0,60)); setTaskModal(true); }} style={{ padding:"3px 8px", background:"#1e1e24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, color:"#9b9790", fontSize:9, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>+ Save as Task</button>
                    <button onClick={()=>navigator.clipboard?.writeText(m.text)} style={{ padding:"3px 8px", background:"#1e1e24", border:"1px solid rgba(255,255,255,0.1)", borderRadius:5, color:"#9b9790", fontSize:9, cursor:"pointer", fontFamily:"inherit" }}>📋 Copy</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:7, background:BOOK_GDIM, border:`1px solid ${BOOK_GOLD}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>📚</div>
              <div style={{ padding:"10px 14px", background:"#101013", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"10px 10px 10px 3px" }}>
                <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:5, height:5, borderRadius:"50%", background:BOOK_GOLD, animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions + Input */}
        <div style={{ padding:"10px 18px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"#101013", flexShrink:0 }}>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
            {[
              ["🎯 Daily Briefing", "Give me today's highest-impact move for the book"],
              ["📲 Content Batch", "Generate a 7-day social content batch for pre-launch"],
              ["⚖️ Copyright Now", "Give me exact step-by-step instructions to file copyright at copyright.gov right now"],
              ["📦 KDP Setup", "Walk me through setting up Amazon KDP and IngramSpark step by step with URLs"],
              ["🎙️ Narration", "What is the full audiobook pipeline for Dr. Motes to record his voice on ACX?"],
              ["📰 Press Kit", "Build my full press kit: author bio, Amazon description, 10 interview questions, media pitch email"],
            ].map(([label, prompt]) => (
              <button key={label} onClick={()=>sendMessage(prompt)} style={{ padding:"3px 9px", background:"#1e1e24", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, fontSize:10, color:"#9b9790", cursor:"pointer", transition:"all .15s", fontFamily:"inherit" }}
                onMouseEnter={e=>{e.target.style.borderColor=BOOK_GOLD;e.target.style.color=BOOK_GOLD;}}
                onMouseLeave={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.color="#9b9790";}}
              >{label}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <textarea value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder="Ask the Book Manager anything..."
              rows={1} style={{ flex:1, background:"#16161a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"8px 12px", color:"#ede9e0", fontSize:12, resize:"none", outline:"none", fontFamily:"inherit", minHeight:38, maxHeight:100 }}
              onInput={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";}}
            />
            <button onClick={()=>sendMessage()} style={{ width:36, height:36, background:BOOK_GOLD, border:"none", borderRadius:9, color:"#000", cursor:"pointer", fontSize:14, flexShrink:0, fontWeight:700 }}>➤</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT RAIL ── */}
      <div style={{ background:"#101013", borderLeft:"1px solid rgba(255,255,255,0.06)", overflowY:"auto", padding:12 }}>

        {/* BOOK CALENDAR */}
        <div style={{ background:"#16161a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, overflow:"hidden", marginBottom:10 }}>
          <div style={{ padding:"10px 13px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:7 }}>
            <span>📅</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#ede9e0", flex:1 }}>Book Calendar</span>
            <span style={{ fontFamily:"monospace", fontSize:10, color:convDays<30?"#e05555":BOOK_GOLD, fontWeight:700 }}>{convDays}d to conv.</span>
          </div>
          <div style={{ padding:12 }}>
            {/* Month nav */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}} style={{ background:"none", border:"none", color:"#9b9790", cursor:"pointer", fontSize:14, padding:"2px 6px" }}>‹</button>
              <div style={{ fontSize:13, fontWeight:700, color:"#ede9e0" }}>{months[calMonth]} {calYear}</div>
              <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}} style={{ background:"none", border:"none", color:"#9b9790", cursor:"pointer", fontSize:14, padding:"2px 6px" }}>›</button>
            </div>
            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:3 }}>
              {["S","M","T","W","T","F","S"].map((d,i)=>(
                <div key={i} style={{ textAlign:"center", fontSize:8, color:"#54524d", fontWeight:700 }}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
              {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`} style={{ height:24 }} />)}
              {Array(daysInMonth).fill(null).map((_,i)=>{
                const d = i+1;
                const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
                const ms = msMap[d];
                const m0 = ms?.[0];
                const col = m0 ? MS_COLORS[m0.type] : null;
                const isConv = m0?.type === "convention";
                return (
                  <div key={d} title={m0?.label||""} style={{
                    height:24, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"monospace", fontSize:9, cursor:ms?"pointer":"default", position:"relative",
                    background: isConv?col : isToday?"rgba(201,168,76,0.2)" : ms?`${col}18`:"transparent",
                    border: isConv?`1px solid ${col}` : isToday?`1px solid ${BOOK_GOLD}` : ms?`1px solid ${col}55`:"none",
                    color: isConv?"#000" : isToday?BOOK_GOLD : ms?col:"#54524d",
                    fontWeight: (isToday||ms)?"700":"400",
                  }}>
                    {d}
                    {ms && !isConv && <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:3, height:3, borderRadius:"50%", background:col }} />}
                  </div>
                );
              })}
            </div>
            {/* Upcoming milestones */}
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", marginTop:10, paddingTop:8 }}>
              <div style={{ fontSize:9, color:"#54524d", letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>Upcoming</div>
              {upcomingMs.map(m => {
                const d = new Date(m.date+"T12:00:00");
                const diff = Math.ceil((d-new Date())/86400000);
                const col = MS_COLORS[m.type];
                return (
                  <div key={m.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer" }}
                    onClick={()=>setMilestones(prev=>prev.map(x=>x.id===m.id?{...x,done:true}:x))}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:col, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#ede9e0", fontWeight:600 }}>{m.label}</div>
                      <div style={{ fontSize:9, color:"#54524d" }}>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    </div>
                    <div style={{ fontSize:9, fontFamily:"monospace", color:diff<=7?"#e05555":diff<=14?BOOK_GOLD:"#54524d", fontWeight:700 }}>{diff}d</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* TASK ENGINE */}
        <div style={{ background:"#16161a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, overflow:"hidden", marginBottom:10 }}>
          <div style={{ padding:"10px 13px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:7 }}>
            <span>✅</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#ede9e0", flex:1 }}>Task Engine</span>
            <span style={{ fontFamily:"monospace", fontSize:10, color:"#54524d" }}>{openTasks} open</span>
          </div>
          <div style={{ padding:12 }}>
            {tasks.length === 0 ? (
              <div style={{ fontSize:10, color:"#54524d", textAlign:"center", padding:"8px 0" }}>Tasks from agent responses appear here.</div>
            ) : (
              tasks.slice(0,8).map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div onClick={()=>toggleTask(t.id)} style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${t.done?"#4db87a":"rgba(255,255,255,0.15)"}`, background:t.done?"#4db87a":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#000", cursor:"pointer", flexShrink:0, marginTop:1 }}>{t.done?"✓":""}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:t.done?"#54524d":"#ede9e0", fontWeight:600, textDecoration:t.done?"line-through":"none", lineHeight:1.3 }}>{t.name}</div>
                    <div style={{ fontSize:9, color:"#54524d", marginTop:1 }}>{t.created}</div>
                  </div>
                </div>
              ))
            )}
            <button onClick={()=>setTaskModal(true)} style={{ width:"100%", marginTop:8, padding:"5px", background:"transparent", border:"1px dashed rgba(255,255,255,0.08)", borderRadius:6, color:"#54524d", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>+ Add Task</button>
          </div>
        </div>

        {/* PRINT BUDGET */}
        <div style={{ background:"#16161a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, overflow:"hidden", marginBottom:10 }}>
          <div style={{ padding:"10px 13px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:7 }}>
            <span>📦</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#ede9e0", flex:1 }}>Convention Print Budget</span>
          </div>
          <div style={{ padding:12 }}>
            {[
              { label:"Copyright Filing",    cost:"$65",         status:"urgent" },
              { label:"ISBN (own it)",        cost:"$125",        status:"urgent" },
              { label:"Cover Design",         cost:"$300–$1,500", status:"pending" },
              { label:"Interior Layout",      cost:"$300–$800",   status:"pending" },
              { label:"Proof Copy (2x)",      cost:"~$25",        status:"pending" },
              { label:"150 Hardcover Copies", cost:"~$1,350",     status:"pending" },
              { label:"Shipping",             cost:"~$120",       status:"pending" },
            ].map((item,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ flex:1, fontSize:10, color:"#9b9790" }}>{item.label}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:item.status==="urgent"?"#e05555":BOOK_GOLD, fontWeight:700 }}>{item.cost}</div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#ede9e0" }}>Total Est.</div>
              <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:BOOK_GOLD2 }}>~$2,285–$3,935</div>
            </div>
          </div>
        </div>

        {/* REVENUE */}
        <div style={{ background:"#16161a", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, overflow:"hidden" }}>
          <div style={{ padding:"10px 13px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:7 }}>
            <span>💰</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#ede9e0", flex:1 }}>Revenue</span>
            <span style={{ fontFamily:"monospace", fontSize:11, color:"#4db87a", fontWeight:700 }}>$0.00</span>
          </div>
          <div style={{ padding:12 }}>
            {["Amazon KDP","IngramSpark","ACX Audio","Direct"].map(p=>(
              <div key={p} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize:10, color:"#54524d", textTransform:"uppercase", letterSpacing:".03em" }}>{p}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:"#9b9790" }}>$0.00 · 0 units</div>
              </div>
            ))}
            <div style={{ fontSize:9, color:"#54524d", marginTop:8, textAlign:"center" }}>Revenue tracking activates at launch</div>
          </div>
        </div>
      </div>

      {/* TASK MODAL */}
      {taskModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={e=>{if(e.target===e.currentTarget)setTaskModal(false);}}>
          <div style={{ background:"#16161a", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, padding:24, width:380 }}>
            <div style={{ fontSize:18, fontWeight:800, color:"#ede9e0", marginBottom:16 }}>Save as Task</div>
            <div style={{ fontSize:9, color:"#54524d", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>Task Name</div>
            <input value={taskName} onChange={e=>setTaskName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&saveTask(taskName)}
              placeholder="What needs to be done?" autoFocus
              style={{ width:"100%", background:"#101013", border:"1px solid rgba(255,255,255,0.12)", borderRadius:7, padding:"8px 11px", color:"#ede9e0", fontSize:12, outline:"none", fontFamily:"inherit", marginBottom:14, boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setTaskModal(false)} style={{ padding:"8px 16px", borderRadius:7, background:"#1e1e24", border:"1px solid rgba(255,255,255,0.08)", color:"#9b9790", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700 }}>Cancel</button>
              <button onClick={()=>saveTask(taskName)} style={{ padding:"8px 16px", borderRadius:7, background:BOOK_GOLD, border:"none", color:"#000", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700 }}>Save Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FM Travel Builder ────────────────────────────────────────────────────────
const TB_SK = "fm_tb_v2", TB_AK = "fm_arc_v2";
const TRAVEL_DRAFT_KEY = "fm_travel_builder_active_draft_v1";
const tbFmt = (n) => "$" + Math.round(n).toLocaleString();
const tbFmtMoney = (n) => "$" + (Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const TB_ROWS = [
  {id:"hotel",cat:"Accommodation",     label:"Marriott Marquis — 3 nights",    low:481,high:481, fixed:true, act:481,  status:"booked",  note:"MM4 rate. Skybridge to Wintrust Arena."},
  {id:"f1",   cat:"Flights",           label:"Kadence — LAX → JFK — Jun 12",   low:200,high:225, fixed:false,act:"",   status:"booknow", url:"https://www.google.com/travel/flights", note:"Nonstop. JetBlue / Delta / AA."},
  {id:"f2",   cat:"",                  label:"Kadence — JFK → LAX — Jun 22",   low:200,high:225, fixed:false,act:"",   status:"booknow", url:"https://www.google.com/travel/flights", note:"Return leg. Nonstop."},
  {id:"t1",   cat:"Ground Transport",  label:"CTA + Uber — all days",          low:60, high:110, fixed:false,act:"",   status:"est",     note:"No rental. Skybridge + CTA."},
  {id:"d1",   cat:"Food & Dining",     label:"Jun 12 — arrival dinner",        low:40, high:80,  fixed:false,act:"",   status:"est",     note:"NY dinner — Kadence arrives."},
  {id:"d2",   cat:"",                  label:"Jun 13 — Chicago day",           low:60, high:120, fixed:false,act:"",   status:"est",     note:"Dinner before graduation."},
  {id:"d3",   cat:"",                  label:"Jun 14 — graduation dinner",     low:80, high:150, fixed:false,act:"",   status:"est",     note:"Big dinner for Kayliah."},
  {id:"d4",   cat:"",                  label:"Jun 15–22 — NY meals",           low:100,high:200, fixed:false,act:"",   status:"est",     note:"Kadence + Motes in NY."},
  {id:"tk",   cat:"Graduation + Gifts",label:"Graduation tickets (4+)",        low:0,  high:0,   fixed:true, act:0,    status:"confirm", note:"Text Kayliah — may be included."},
  {id:"g1",   cat:"",                  label:"Gift for Kayliah",               low:50, high:100, fixed:false,act:"",   status:"est",     note:"Thoughtful + meaningful."},
  {id:"g2",   cat:"",                  label:"Flowers + celebration",          low:20, high:50,  fixed:false,act:"",   status:"est",     note:"Bouquet at ceremony."},
  {id:"m1",   cat:"Misc + Buffer",     label:"Tips + activities",              low:60, high:110, fixed:false,act:"",   status:"est",     note:"15–20% on services."},
  {id:"m2",   cat:"",                  label:"Emergency buffer",               low:50, high:100, fixed:false,act:"",   status:"est",     note:"Always carry a buffer."},
];

const TB_BLANK_ROWS = [
  {id:"draft_hotel",cat:"Accommodation",    label:"",low:0,high:0,fixed:false,act:"",status:"est",note:""},
  {id:"draft_f1",   cat:"Flights",          label:"",low:0,high:0,fixed:false,act:"",status:"est",note:""},
  {id:"draft_f2",   cat:"",                 label:"",low:0,high:0,fixed:false,act:"",status:"est",note:""},
  {id:"draft_t1",   cat:"Ground Transport", label:"",low:0,high:0,fixed:false,act:"",status:"est",note:""},
  {id:"draft_d1",   cat:"Food & Dining",    label:"",low:0,high:0,fixed:false,act:"",status:"est",note:""},
];

function tbCloneRows(rows) {
  return rows.map(r=>({...r}));
}

const TB_PEOPLE = [
  {key:"denarius",label:"Denarius",shareField:"denariusShare"},
  {key:"kadence",label:"Kadence",shareField:"kadenceShare"},
  {key:"kayliah",label:"Kayliah",shareField:"kayliahShare"},
];
const TB_PERSON_KEYS = TB_PEOPLE.map(p=>p.key);
const TB_DEFAULT_TRIP_PEOPLE = ["denarius","kayliah"];
const TB_SPLIT_TYPES = [
  ["unsplit","Unsplit"],
  ["shared","Shared evenly"],
  ["selected","Selected people"],
  ["denarius","Denarius only"],
  ["kadence","Kadence only"],
  ["kayliah","Kayliah only"],
  ["custom","Custom"],
];

function tbToCents(value) {
  if(value===0||value==="0") return 0;
  if(value===undefined||value===null||value==="") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n*100) : 0;
}

function tbFromCents(cents) {
  return Math.round(Number(cents)||0)/100;
}

function sanitizeTripPeople(people) {
  const raw = Array.isArray(people) ? people : [];
  const next = raw.map(p=>String(p||"").toLowerCase()).filter(p=>TB_PERSON_KEYS.includes(p));
  return [...new Set(next)];
}

function parseTripPeople(text) {
  const s = String(text||"").toLowerCase();
  const found = TB_PEOPLE.filter(p=>s.includes(p.key)).map(p=>p.key);
  return sanitizeTripPeople(found);
}

function getShareField(person) {
  return TB_PEOPLE.find(p=>p.key===person)?.shareField;
}

function normalizeTravelRow(row) {
  const r = row&&typeof row==="object" ? row : {};
  const splitType = TB_SPLIT_TYPES.some(([v])=>v===r.splitType) ? r.splitType : "unsplit";
  const paidBy = TB_PERSON_KEYS.includes(r.paidBy) ? r.paidBy : "";
  return {
    ...r,
    paidBy,
    splitType,
    peopleIncluded:sanitizeTripPeople(r.peopleIncluded),
    denariusShare:tbFromCents(tbToCents(r.denariusShare)),
    kadenceShare:tbFromCents(tbToCents(r.kadenceShare)),
    kayliahShare:tbFromCents(tbToCents(r.kayliahShare)),
    reimbursable:!!r.reimbursable,
    reimbursementStatus:r.reimbursementStatus||"not_reimbursable",
    balanceStatus:["Unsplit","Balanced","Mismatch"].includes(r.balanceStatus) ? r.balanceStatus : "Unsplit",
    balanceDifference:tbFromCents(tbToCents(r.balanceDifference)),
  };
}

function getReconcilingAmount(row) {
  const r = normalizeTravelRow(row);
  const status = String(r.status||"est").toLowerCase();
  if(status==="paid"||status==="actual") return tbFromCents(tbToCents(r.act));
  if(status==="booked") {
    if(r.booked!==undefined&&r.booked!=="") return tbFromCents(tbToCents(r.booked));
    if(r.act!==undefined&&r.act!=="") return tbFromCents(tbToCents(r.act));
    return tbFromCents(tbToCents(r.low));
  }
  if(r.estimate!==undefined&&r.estimate!=="") return tbFromCents(tbToCents(r.estimate));
  if(r.estimate_low!==undefined&&r.estimate_low!=="") return tbFromCents(tbToCents(r.estimate_low));
  return tbFromCents(tbToCents(r.low));
}

function getIncludedPeople(row, tripPeople) {
  const r = normalizeTravelRow(row);
  const active = sanitizeTripPeople(tripPeople);
  if(r.splitType==="unsplit") return [];
  if(r.splitType==="shared") return active;
  if(r.splitType==="selected"||r.splitType==="custom") return sanitizeTripPeople(r.peopleIncluded).filter(p=>active.includes(p));
  if(TB_PERSON_KEYS.includes(r.splitType)&&active.includes(r.splitType)) return [r.splitType];
  return [];
}

function zeroShares() {
  return {denariusShare:0,kadenceShare:0,kayliahShare:0};
}

function computePersonShares(row, tripPeople) {
  const r = normalizeTravelRow(row);
  const included = getIncludedPeople(r, tripPeople);
  const shares = zeroShares();
  if(r.splitType==="custom") {
    TB_PEOPLE.forEach(p=>{shares[p.shareField]=included.includes(p.key)?tbFromCents(tbToCents(r[p.shareField])):0;});
    return shares;
  }
  const amountCents = tbToCents(getReconcilingAmount(r));
  if(!included.length || amountCents===0) return shares;
  if(included.length===1) {
    shares[getShareField(included[0])] = tbFromCents(amountCents);
    return shares;
  }
  const base = Math.trunc(amountCents/included.length);
  const remainder = amountCents - (base*included.length);
  const remainderPerson = included.includes(r.paidBy) ? r.paidBy : included[0];
  included.forEach(person=>{
    const field = getShareField(person);
    shares[field] = tbFromCents(base + (person===remainderPerson ? remainder : 0));
  });
  return shares;
}

function validateSplitBalance(row) {
  const r = normalizeTravelRow(row);
  if(r.splitType==="unsplit") return {status:"Unsplit",difference:0};
  const shareCents = TB_PEOPLE.reduce((sum,p)=>sum+tbToCents(r[p.shareField]),0);
  const diff = shareCents - tbToCents(getReconcilingAmount(r));
  return {status:diff===0?"Balanced":"Mismatch",difference:tbFromCents(diff)};
}

function getRowSplitStatus(row) {
  return validateSplitBalance(row).status;
}

function finalizeTravelRowSplit(row, tripPeople) {
  const r = normalizeTravelRow(row);
  const shares = computePersonShares(r, tripPeople);
  const next = {...r,...shares};
  const validation = validateSplitBalance(next);
  return {...next,balanceStatus:validation.status,balanceDifference:validation.difference};
}

function getTripPersonTotals(rows) {
  return (Array.isArray(rows)?rows:[]).reduce((totals,row)=>{
    const r = normalizeTravelRow(row);
    if(r.splitType==="unsplit") return totals;
    TB_PEOPLE.forEach(p=>{totals[p.key]=tbFromCents(tbToCents(totals[p.key])+tbToCents(r[p.shareField]));});
    return totals;
  },{denarius:0,kadence:0,kayliah:0});
}

function getPaidByTotals(rows) {
  return (Array.isArray(rows)?rows:[]).reduce((totals,row)=>{
    const r = normalizeTravelRow(row);
    if(r.splitType==="unsplit"||!TB_PERSON_KEYS.includes(r.paidBy)) return totals;
    totals[r.paidBy]=tbFromCents(tbToCents(totals[r.paidBy])+tbToCents(getReconcilingAmount(r)));
    return totals;
  },{denarius:0,kadence:0,kayliah:0});
}

function getMismatchRows(rows) {
  return (Array.isArray(rows)?rows:[]).map(normalizeTravelRow).filter(r=>r.splitType!=="unsplit"&&validateSplitBalance(r).status==="Mismatch");
}

function getTripReconciliation(rows) {
  const list = Array.isArray(rows)?rows.map(normalizeTravelRow):[];
  const tripCents = list.reduce((sum,r)=>sum+tbToCents(getReconcilingAmount(r)),0);
  const unattributedCents = list.filter(r=>r.splitType==="unsplit").reduce((sum,r)=>sum+tbToCents(getReconcilingAmount(r)),0);
  const totals = getTripPersonTotals(list);
  const attributedCents = TB_PERSON_KEYS.reduce((sum,p)=>sum+tbToCents(totals[p]),0);
  return {
    tripTotal:tbFromCents(tripCents),
    attributedTotal:tbFromCents(attributedCents),
    unattributedTotal:tbFromCents(unattributedCents),
    isBalanced:attributedCents+unattributedCents===tripCents,
  };
}

const TB_FLIGHT_OPTIONS = [
  {title:"Morning nonstop",low:150,high:220,note:"Best for early arrival",bookingUrl:"https://www.google.com/travel/flights"},
  {title:"Midday nonstop",low:180,high:260,note:"Balanced timing",bookingUrl:"https://www.google.com/travel/flights"},
  {title:"Evening nonstop",low:120,high:200,note:"Cheapest window",bookingUrl:"https://www.google.com/travel/flights"},
];

function tbCalc(rows) {
  let low=0,high=0,actual=0,saved=170,filled=0;
  rows.forEach(r => {
    low+=Number(r.low)||0; high+=Number(r.high)||0;
    if(r.act!==undefined&&r.act!==""){const paid=parseFloat(r.act);actual+=paid;filled++;const d=(Number(r.low)||0)-paid;if(d>0)saved+=d;}
  });
  return{low,high,actual,saved,filled,total:rows.length};
}

function TBAnimBar({pct,color,delay=0}) {
  const [w,setW] = useState(0);
  useEffect(()=>{const t=setTimeout(()=>setW(Math.min(pct,100)),delay+120);return()=>clearTimeout(t);},[pct,delay]);
  return(
    <div style={{flex:1,height:5,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",borderRadius:3,background:color,width:`${w}%`,transition:"width 1.3s cubic-bezier(0.4,0,0.2,1)",position:"relative"}}>
        {w>5&&<div style={{position:"absolute",top:0,right:0,bottom:0,width:24,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25))",animation:"tbShimmer 2.5s infinite"}}/>}
      </div>
    </div>
  );
}

function TBDonut({pct,color}) {
  const [dash,setDash] = useState(0);
  const circ = 2*Math.PI*14;
  useEffect(()=>{const t=setTimeout(()=>setDash(circ*Math.min(pct/100,1)),300);return()=>clearTimeout(t);},[pct,circ]);
  return(
    <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
      <svg viewBox="0 0 36 36" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ-dash}`} style={{transition:"stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:13,fontWeight:800,color}}>{pct}%</div>
        <div style={{fontSize:7,color:T.muted,fontFamily:"monospace"}}>planned</div>
      </div>
    </div>
  );
}

function TBCard({label,value,sub,accent,glow}) {
  const [h,setH]=useState(false);
  return(
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{background:h?"#1a1a22":T.card,border:`1px solid ${h?"rgba(255,255,255,0.12)":T.border}`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden",transform:h?"translateY(-3px)":"none",boxShadow:h?`0 8px 28px ${glow}`:"none",transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",cursor:"default"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:h?3:2,background:accent,transition:"height 0.25s"}}/>
      {h&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at top,${glow} 0%,transparent 65%)`,pointerEvents:"none"}}/>}
      <div style={{fontFamily:"monospace",fontSize:8,letterSpacing:"0.1em",textTransform:"uppercase",color:T.muted,marginBottom:7,position:"relative"}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:accent,lineHeight:1,marginBottom:4,position:"relative",transform:h?"scale(1.04)":"scale(1)",transition:"transform 0.2s"}}>{value}</div>
      <div style={{fontFamily:"monospace",fontSize:8,color:T.muted,position:"relative"}}>{sub}</div>
    </div>
  );
}

function TravelBuilderPanel() {
  const [actuals,setActuals] = useState(()=>{try{return JSON.parse(localStorage.getItem(TB_SK+"_a")||"{}")}catch{return{}}});
  const [retro,setRetro] = useState(()=>{try{return JSON.parse(localStorage.getItem(TB_SK+"_r")||"{}")}catch{return{worked:"",improve:"",next:""}}});
  const [archive,setArchive] = useState(()=>{try{return JSON.parse(localStorage.getItem(TB_AK)||"[]")}catch{return[]}});
  const [tab,setTab] = useState("budget");
  const [travelerFilter,setTravelerFilter] = useState("all");
  const ITIN_KEY = "fm_itin_v1";
  const [itinDays,setItinDays] = useState(()=>{
    try{
      const saved=localStorage.getItem("fm_itin_v1");
      if(saved) return JSON.parse(saved);
    }catch{}
    return [
      {id:"d12",date:"Jun 12",label:"Friday Jun 12",subtitle:"Kadence arrives NY",traveler:"kadence",events:[
        {id:"e1",type:"flight",title:"Kadence · LAX → JFK",detail:"Nonstop · JetBlue / Delta / AA",status:"unbooked"},
        {id:"e2",type:"note",title:"Kadence settles in with Motes · NY",detail:"Dinner plans TBD",status:"note"}
      ]},
      {id:"d13",date:"Jun 13",label:"Saturday Jun 13",subtitle:"Motes flies to Chicago",traveler:"motes",events:[
        {id:"e3",type:"flight",title:"Motes · LGA → ORD",detail:"O’Hare — NOT Midway",status:"unbooked"},
        {id:"e4",type:"hotel",title:"Marriott Marquis Chicago · check-in",detail:"MM4 rate · $481 · skybridge to Wintrust",status:"booked"},
        {id:"e5",type:"food",title:"Graduation eve dinner",detail:"Restaurant TBD · confirm with Kayliah",status:"tbd"}
      ]},
      {id:"d14",date:"Jun 14",label:"Sunday Jun 14",subtitle:"Kayliah graduation · Wintrust Arena",traveler:"both",anchor:true,events:[
        {id:"e6",type:"event",title:"Kayliah graduation ceremony",detail:"Morning · Wintrust Arena · Chicago",status:"anchor"},
        {id:"e7",type:"flight",title:"Motes · ORD → LGA (if Jun 14)",detail:"Return date TBD — confirm with Dad first",status:"tbd"}
      ]},
      {id:"d22",date:"Jun 22",label:"Monday Jun 22",subtitle:"Kadence returns CA",traveler:"kadence",events:[
        {id:"e8",type:"flight",title:"Kadence · JFK → LAX",detail:"Return leg · nonstop",status:"unbooked"}
      ]}
    ];
  });
  function saveItin(days){setItinDays(days);try{localStorage.setItem("fm_itin_v1",JSON.stringify(days));}catch{}}
  function addItinEvent(dayId,evType){
    const labels={flight:"New flight",hotel:"New hotel",event:"New event",food:"New food/dining",transport:"New transport",note:"New note"};
    const newEv={id:"ev"+Date.now(),type:evType,title:labels[evType]||"New item",detail:"Tap to edit",status:"tbd"};
    saveItin(itinDays.map(d=>d.id===dayId?{...d,events:[...d.events,newEv]}:d));
  }
  function updateItinEvent(dayId,evId,field,val){
    saveItin(itinDays.map(d=>d.id===dayId?{...d,events:d.events.map(ev=>ev.id===evId?{...ev,[field]:val}:ev)}:d));
  }
  function removeItinEvent(dayId,evId){
    saveItin(itinDays.map(d=>d.id===dayId?{...d,events:d.events.filter(ev=>ev.id!==evId)}:d));
  }
  function addItinDay(){
    const mnths=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now=new Date();
    const nd={id:"day"+Date.now(),date:mnths[now.getMonth()]+" "+now.getDate(),label:now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}),subtitle:"New day",traveler:"both",events:[]};
    saveItin([...itinDays,nd]);
  }
  function removeItinDay(dayId){saveItin(itinDays.filter(d=>d.id!==dayId));}
  function TripSectionHeader({label}){
    const isMotes=label.includes("MOTES");
    return <div style={{background:isMotes?"#475569":"#faeeda",color:isMotes?"#fff":"#633806",border:isMotes?"none":"1px solid #ef9f27",borderRadius:10,padding:"10px 14px",margin:"14px 0 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase"}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600,opacity:isMotes?0.86:0.8}}>{isMotes?"Motes · nested within Kadence NY Trip":"Kadence · New York trip timeline"}</span>
    </div>;
  }
  const [resetModal,setResetModal] = useState(false);
  const [archiveModal,setArchiveModal] = useState(false);
  const [newTripModal,setNewTripModal] = useState(false);
  const [newTripName,setNewTripName] = useState("");
  const [newTripDestination,setNewTripDestination] = useState("");
  const [newTripStartDate,setNewTripStartDate] = useState("");
  const [newTripEndDate,setNewTripEndDate] = useState("");
  const [newTripTravelers,setNewTripTravelers] = useState("");
  const [newTripBudget,setNewTripBudget] = useState("");
  const [newTripPurpose,setNewTripPurpose] = useState("");
  const [newTripPreview,setNewTripPreview] = useState(null);
  const [activeTripDraft,setActiveTripDraft] = useState(null);
  const [tripPeople,setTripPeople] = useState(()=>TB_DEFAULT_TRIP_PEOPLE);
  const [editableTripRows,setEditableTripRows] = useState(()=>TB_ROWS.map(r=>normalizeTravelRow({...r,act:r.fixed?r.act:(actuals[r.id]??r.act)})));
  const [selectedPersonBudgetView,setSelectedPersonBudgetView] = useState("all");
  const [flightOptionsForRow,setFlightOptionsForRow] = useState(null);
  const [travelDraftStatus,setTravelDraftStatus] = useState("idle");
  const [toast,setToast] = useState(null);
  const [aiBrief,setAiBrief] = useState("");
  const [briefLoading,setBriefLoading] = useState(false);
  const briefDone = useRef(false);
  const toastTimer = useRef();
  const travelDraftHydratedRef = useRef(false);
  const travelDraftSkipNextSaveRef = useRef(true);

  const displayTripRows = editableTripRows.map(r=>finalizeTravelRowSplit(r,tripPeople));
  const tots = tbCalc(displayTripRows);
  const pp = Math.round((tots.filled/tots.total)*100);
  const sp = Math.min(Math.round((tots.actual/tots.low)*100),150);
  const activeTripTitle = activeTripDraft?.name || "Chicago Graduation Trip";
  const activeTripMeta = activeTripDraft
    ? [activeTripDraft.dateRange||"Dates pending", activeTripDraft.destination||"Destination pending", activeTripDraft.travelers||"Travelers pending", activeTripDraft.purpose||"Purpose pending"]
    : ["June 12–15 2026","Marriott Marquis Chicago","Denarius + Kadence","Kayliah Graduation"];
  const currentTripName = activeTripTitle;
  const bookedTotal = displayTripRows
    .filter(r=>["booked","confirm"].includes(r.status))
    .reduce((sum,r)=>sum+(parseFloat(r.act)||0),0);
  const personTotals = getTripPersonTotals(displayTripRows);
  const paidByTotals = getPaidByTotals(displayTripRows);
  const mismatchRows = getMismatchRows(displayTripRows);
  const tripReconciliation = getTripReconciliation(displayTripRows);
  const selectedBudgetPerson = TB_PEOPLE.find(p=>p.label===selectedPersonBudgetView) || null;
  const budgetBreakdownRows = displayTripRows
    .map(r=>{
      const rowBalance = getRowSplitStatus(r);
      const amount = selectedBudgetPerson ? r[selectedBudgetPerson.shareField] : getReconcilingAmount(r);
      return {row:r,amount,rowBalance};
    })
    .filter(item=>!selectedBudgetPerson || tbToCents(item.amount)!==0);
  const budgetBreakdownTotal = selectedBudgetPerson ? personTotals[selectedBudgetPerson.key] : tripReconciliation.tripTotal;
  const travelDraftStatusText = travelDraftStatus==="restored" ? "Draft restored from this browser." : travelDraftStatus==="saved" ? "Draft saved locally." : travelDraftStatus==="error" ? "Draft save issue — copy your details before leaving." : "Editable draft — not saved to Airtable yet.";

  function safeTravelNotice(message,type=""){setToast({msg:message,type});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),2800);}
  function safeTravelAction(actionName, callback){
    try { callback(); }
    catch(err) {
      console.warn(`Travel Builder ${actionName} failed`, err);
      safeTravelNotice(`${actionName} did not complete. Try again.`, "danger");
    }
  }
  function normalizeRowsForTrip(rows,people=tripPeople){return (Array.isArray(rows)?rows:[]).map(r=>finalizeTravelRowSplit(r,people));}
  function patchTravelRow(row,field,value,people=tripPeople){
    const amountFields=["low","high","denariusShare","kadenceShare","kayliahShare","balanceDifference"];
    const next = {...normalizeTravelRow(row),[field]:amountFields.includes(field)?Number(value)||0:value};
    return finalizeTravelRowSplit(next,people);
  }
  function updateTripRow(id,field,value){setEditableTripRows(rows=>rows.map(r=>r.id===id?patchTravelRow(r,field,value):r));}
  function updateSplitRow(id,field,value){setEditableTripRows(rows=>rows.map(r=>r.id===id?patchTravelRow(r,field,value):r));}
  function toggleRowPerson(id,person){
    setEditableTripRows(rows=>rows.map(r=>{
      if(r.id!==id)return r;
      const cur=sanitizeTripPeople(r.peopleIncluded);
      const people=cur.includes(person)?cur.filter(p=>p!==person):[...cur,person];
      return finalizeTravelRowSplit({...normalizeTravelRow(r),peopleIncluded:people},tripPeople);
    }));
  }
  function updateTripPeopleRoster(person,checked){
    const next=sanitizeTripPeople(checked?[...tripPeople,person]:tripPeople.filter(p=>p!==person));
    setTripPeople(next);
    setActiveTripDraft(d=>d?{...d,people:next}:d);
    setEditableTripRows(rows=>normalizeRowsForTrip(rows,next));
  }
  function addTripRow(cat){
    const newRow=normalizeTravelRow({id:"custom_"+Date.now(),cat:"",label:"New item",low:0,high:0,fixed:false,act:"",status:"est",note:"",url:""});
    setEditableTripRows(rows=>{
      // Find last index of a row belonging to this category group
      let lastIdx=-1;
      let inCat=false;
      rows.forEach((r,i)=>{
        if(r.cat===cat) inCat=true;
        if(inCat&&(r.cat===cat||r.cat==="")) lastIdx=i;
        if(inCat&&r.cat&&r.cat!==cat) inCat=false;
      });
      if(lastIdx===-1) return [...rows,newRow];
      const next=[...rows];
      next.splice(lastIdx+1,0,newRow);
      return next;
    });
    safeTravelNotice("Row added — fill in the details","success");
  }
  function removeTripRow(id){if(!String(id||"").startsWith("custom_"))return;setEditableTripRows(rows=>rows.filter(r=>r.id!==id));}
  const TB_DEFAULT_SECTIONS=["Accommodation","Flights","Ground Transport","Food & Dining","Graduation + Gifts","Misc + Buffer"];
  function deleteBudgetSection(catName){
    if(TB_DEFAULT_SECTIONS.includes(catName)){safeTravelNotice("Default sections cannot be deleted","");return;}
    setEditableTripRows(rows=>{
      let inCat=false;
      return rows.filter(r=>{
        if(r.cat===catName){inCat=true;return false;}
        if(inCat&&r.cat===""&&String(r.id||"").startsWith("custom_"))return false;
        if(r.cat&&r.cat!==catName)inCat=false;
        return true;
      });
    });
    safeTravelNotice("Section removed","success");
  }
  function addBudgetSection(){
    const name=(prompt("New section name:")||"").trim();
    if(!name)return;
    if(editableTripRows.some(r=>r.cat===name)){safeTravelNotice("Section already exists","");return;}
    const newRow=normalizeTravelRow({id:"custom_"+Date.now(),cat:name,label:"New item",low:0,high:0,fixed:false,act:"",status:"est",note:"",url:""});
    setEditableTripRows(rows=>[...rows,newRow]);
    safeTravelNotice("Section “"+name+"” added","success");
  }
  function updateItinDay(dayId,field,val){saveItin(itinDays.map(d=>d.id===dayId?{...d,[field]:val}:d));}
  function setActual(id,val){safeTravelAction("Save local value",()=>{const n={...actuals,[id]:val};setActuals(n);setEditableTripRows(rows=>rows.map(r=>r.id===id?patchTravelRow(r,"act",val):r));localStorage.setItem(TB_SK+"_a",JSON.stringify(n));});}
  function buildTravelDraft(rows=editableTripRows){
    return {activeTripDraft:activeTripDraft?{...activeTripDraft,people:tripPeople}:activeTripDraft,people:tripPeople,editableTripRows:normalizeRowsForTrip(rows),newTripName,newTripDestination,newTripStartDate,newTripEndDate,newTripTravelers,newTripBudget,newTripPurpose,savedAt:new Date().toISOString()};
  }
  function saveTravelDraft(status="saved"){
    try {localStorage.setItem(TRAVEL_DRAFT_KEY,JSON.stringify(buildTravelDraft()));setTravelDraftStatus(status);}
    catch(err){console.warn("Travel draft save failed",err);setTravelDraftStatus("error");}
  }
  function useFlightOption(rowId,opt){setEditableTripRows(rows=>rows.map(r=>r.id===rowId?finalizeTravelRowSplit({...normalizeTravelRow(r),label:opt.title,low:opt.low,high:opt.high,note:opt.note,status:"booknow",url:opt.bookingUrl},tripPeople):r));setFlightOptionsForRow(null);}
  function openFlightBooking(url){window.open(url,"_blank","noopener,noreferrer");}
  function showToast(msg,type=""){safeTravelNotice(msg,type);}
  function continueNewTripPreview(){
    const dates = newTripStartDate && newTripEndDate ? `${newTripStartDate} to ${newTripEndDate}` : "Dates pending";
    const people = parseTripPeople(newTripTravelers);
    const nextPeople = people.length ? people : TB_DEFAULT_TRIP_PEOPLE;
    setTripPeople(nextPeople);
    setActiveTripDraft({
      name:newTripName.trim()||"Untitled Trip",
      destination:newTripDestination.trim()||"Destination pending",
      dateRange:dates,
      travelers:newTripTravelers.trim()||"Travelers pending",
      purpose:newTripPurpose.trim()||"Purpose pending",
      people:nextPeople
    });
    setActuals({});
    setEditableTripRows(normalizeRowsForTrip(tbCloneRows(TB_BLANK_ROWS),nextPeople));
    setNewTripPreview(null);
    setNewTripModal(false);
    safeTravelNotice("Active draft started","success");
  }
  function doReset(){safeTravelAction("Reset",()=>{setActuals({});setEditableTripRows(normalizeRowsForTrip(activeTripDraft?tbCloneRows(TB_BLANK_ROWS):tbCloneRows(TB_ROWS)));localStorage.setItem(TB_SK+"_a","{}");setResetModal(false);safeTravelNotice("Actuals cleared — template ready","success");});}
  function doArchive(){
    safeTravelAction("Archive",()=>{
      const e={id:Date.now(),trip:activeTripTitle,dates:activeTripMeta[0],budget:tots.low,actual:tots.actual,saved:tots.saved,state:{actuals,retro,people:tripPeople,editableTripRows:displayTripRows},archivedAt:new Date().toLocaleDateString()};
      const n=[e,...archive];setArchive(n);localStorage.setItem(TB_AK,JSON.stringify(n));setArchiveModal(false);safeTravelNotice("Trip archived locally","success");setTab("archive");
    });
  }

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(TRAVEL_DRAFT_KEY);
      if(raw){
        const d=JSON.parse(raw);
        if(d&&typeof d==="object"){
          const restoredPeople = sanitizeTripPeople(d.people||d.activeTripDraft?.people||parseTripPeople(d.newTripTravelers||d.activeTripDraft?.travelers));
          const nextPeople = restoredPeople.length ? restoredPeople : TB_DEFAULT_TRIP_PEOPLE;
          setTripPeople(nextPeople);
          if(d.activeTripDraft){
            setActiveTripDraft({...d.activeTripDraft,people:nextPeople});
            if(Array.isArray(d.editableTripRows)){const vr=d.editableTripRows.filter(r=>r&&r.label&&r.label.trim()&&r.label!=="New item");if(vr.length>=3)setEditableTripRows(normalizeRowsForTrip(d.editableTripRows,nextPeople));else{console.warn("Corrupt rows");setEditableTripRows(normalizeRowsForTrip(TB_ROWS,nextPeople));localStorage.removeItem(TRAVEL_DRAFT_KEY);}}
          } else if(d.newTripPreview) {
            setActiveTripDraft({
              name:d.newTripPreview.name||"Untitled Trip",
              destination:d.newTripPreview.destination||"Destination pending",
              dateRange:d.newTripPreview.dates||"Dates pending",
              travelers:d.newTripPreview.travelers||"Travelers pending",
              purpose:d.newTripPreview.purpose||"Purpose pending",
              people:nextPeople
            });
            setEditableTripRows(normalizeRowsForTrip(TB_BLANK_ROWS,nextPeople));
          } else if(Array.isArray(d.editableTripRows)){const vr2=d.editableTripRows.filter(r=>r&&r.label&&r.label.trim()&&r.label!=="New item");if(vr2.length>=3)setEditableTripRows(normalizeRowsForTrip(d.editableTripRows,nextPeople));else{console.warn("Corrupt rows2");setEditableTripRows(normalizeRowsForTrip(TB_ROWS,nextPeople));localStorage.removeItem(TRAVEL_DRAFT_KEY);}}
          setNewTripName(d.newTripName||"");
          setNewTripDestination(d.newTripDestination||"");
          setNewTripStartDate(d.newTripStartDate||"");
          setNewTripEndDate(d.newTripEndDate||"");
          setNewTripTravelers(d.newTripTravelers||"");
          setNewTripBudget(d.newTripBudget||"");
          setNewTripPurpose(d.newTripPurpose||"");
          setTravelDraftStatus("restored");
        }
      }
    } catch(err) {console.warn("Travel draft restore failed",err);setTravelDraftStatus("error");}
    finally {travelDraftHydratedRef.current=true;}
  },[]);

  useEffect(()=>{
    if(!travelDraftHydratedRef.current)return;
    if(travelDraftSkipNextSaveRef.current){travelDraftSkipNextSaveRef.current=false;return;}
    try {setTravelDraftStatus("saving");localStorage.setItem(TRAVEL_DRAFT_KEY,JSON.stringify(buildTravelDraft()));setTravelDraftStatus("saved");}
    catch(err){console.warn("Travel draft autosave failed",err);setTravelDraftStatus("error");}
  },[activeTripDraft,tripPeople,editableTripRows,newTripPreview,newTripName,newTripDestination,newTripStartDate,newTripEndDate,newTripTravelers,newTripBudget,newTripPurpose]);

  useEffect(()=>{
    if(briefDone.current||tab!=="budget")return;
    briefDone.current=true;
    setBriefLoading(true);
    fetch(`${import.meta.env.VITE_API_URL || 'https://deployable-python-codebase-som-production.up.railway.app'}/api/travel/brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip: currentTripName, biz: 'fm' })
    })
      .then(r=>r.json()).then(d=>setAiBrief(d.content?.[0]?.text||""))
      .catch(()=>setAiBrief(`Status: In Progress (${pp}% planned). ${currentTripName} draft is local. Actual: ${tbFmt(tots.actual)} of ${tbFmt(tots.low)}. Savings ~${tbFmt(tots.saved)}+.`))
      .finally(()=>setBriefLoading(false));
  },[tab]);

  const catData=[
    {l:"Accommodation",v:displayTripRows.filter(r=>r.cat==="Accommodation").reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:600,c:T.gold},
    {l:"Flights",v:displayTripRows.filter(r=>["f1","f2","f3"].includes(r.id)).reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:440,c:T.blue},
    {l:"Transport",v:displayTripRows.filter(r=>r.cat==="Ground Transport").reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:110,c:"#4db87a"},
    {l:"Food",v:displayTripRows.filter(r=>r.cat==="Food & Dining"||String(r.id||"").startsWith("d")).reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:440,c:T.amber},
    {l:"Gifts",v:displayTripRows.filter(r=>r.cat==="Graduation + Gifts"||String(r.id||"").startsWith("g")).reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:150,c:"#c95a84"},
    {l:"Misc",v:displayTripRows.filter(r=>r.cat==="Misc + Buffer"||String(r.id||"").startsWith("m")).reduce((a,r)=>a+(parseFloat(r.act)||0),0),max:210,c:T.red},
  ];

  const STS={
    booked:{bg:T.greenDim,c:T.green,t:"Booked"},
    booknow:{bg:T.amberDim,c:T.amber,t:"Book now"},
    confirm:{bg:"rgba(255,255,255,0.06)",c:T.muted,t:"Confirm"},
    est:{bg:"rgba(255,255,255,0.06)",c:T.muted,t:"Estimate"},
    paid:{bg:T.blueDim,c:T.blue,t:"Paid"},
    archived:{bg:"rgba(255,255,255,0.06)",c:T.muted,t:"Archived"}
  };
  const STATUS_OPTIONS=[["est","Estimate"],["booknow","Book now"],["confirm","Confirm"],["booked","Booked"],["paid","Paid"],["archived","Archived"]];

  return(
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#f7f5f2",minHeight:"100%",padding:"2px 0"}}>
      <style>{`
        @keyframes tbShimmer{0%,100%{opacity:0}50%{opacity:1}}
        @keyframes tbFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .tb-row:hover{background:#f0ebe4!important;transform:translateX(2px)!important}
        .tb-row{transition:all 0.15s!important}
        .tb-panel:hover{border-color:rgba(0,0,0,0.15)!important;transform:translateY(-2px)!important;box-shadow:0 8px 28px rgba(0,0,0,0.10)!important}
        .tb-panel{transition:all 0.22s!important}
        .tb-mobile-budget-cards{display:none}
        @media(max-width:600px){.tb-row:hover{transform:none!important}.tb-metric-grid{grid-template-columns:1fr 1fr!important}.tb-bottom-grid{grid-template-columns:1fr!important}.tb-inner-tabs{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}.tb-inner-tabs button{flex:0 0 auto!important}.tb-split-summary-grid,.tb-split-totals-grid{grid-template-columns:1fr!important}.tb-budget-table-wrap{display:none!important}.tb-mobile-budget-cards{display:block!important}.tb-person-breakdown-row{grid-template-columns:1fr!important}.tb-budget-view-toggle{width:100%!important}.tb-budget-view-toggle button{flex:1 1 calc(50% - 4px)!important}}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.green,animation:"pulse 2s infinite"}}/>
            <span style={{fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"#78788a",fontWeight:600}}>Travel Builder — Active trip</span>
          </div>
          <div style={{fontSize:24,fontWeight:700,color:"#1a1a1a"}}>{activeTripTitle}</div>
          <div style={{fontSize:13,color:"#4a4a52",marginTop:6,display:"flex",gap:14,flexWrap:"wrap"}}>
            {activeTripMeta.map(s=>(
              <span key={s} style={{display:"flex",alignItems:"center",gap:4}}><span style={{color:"#d1d5db"}}>·</span>{s}</span>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setNewTripModal(true)}
            style={{position:"relative",background:"rgba(220,38,38,0.08)",color:"#dc2626",border:"1px solid #dc2626",borderRadius:6,padding:"7px 13px",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
            + New Trip
            <span style={{position:"absolute",top:-7,right:-7,background:"#dc2626",color:"#fff",borderRadius:999,padding:"1px 5px",fontSize:8,fontWeight:800,lineHeight:"12px",letterSpacing:"0.04em"}}>NEW</span>
          </button>
          {[
            {l:"↺ Reset",fn:()=>setResetModal(true),bg:"transparent",c:T.muted,b:T.dim},
            {l:"↓ Archive",fn:()=>setArchiveModal(true),bg:T.greenDim,c:T.green,b:`${T.green}40`},
            {l:"◼ Save",fn:()=>safeTravelAction("Save",()=>{localStorage.setItem(TB_SK+"_a",JSON.stringify(actuals));saveTravelDraft();safeTravelNotice("Travel draft saved locally.","success");}),bg:T.goldDim,c:T.gold,b:T.borderHi},
          ].map(b=>(
              <button key={b.l} onClick={b.fn}
                style={{background:b.bg,color:b.c,border:`1px solid ${b.b}`,borderRadius:6,padding:"7px 13px",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                {b.l}
              </button>
          ))}
        </div>
      </div>

      {/* Inner tab nav */}
      <div className="tb-inner-tabs" style={{display:"flex",gap:2,marginBottom:18,borderBottom:`1px solid ${T.border}`}}>
        {["budget","itinerary","analytics","archive","retro"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:"7px 14px",background:tab===t?T.goldDim:"transparent",border:"none",borderBottom:tab===t?`2px solid ${T.gold}`:"2px solid transparent",color:tab===t?T.gold:T.muted,fontSize:11,fontWeight:600,textTransform:"capitalize",cursor:"pointer",transition:"all 0.15s",fontFamily:"inherit"}}>
            {t==="budget"?"Budget Tracker":t==="itinerary"?"Itinerary":t==="analytics"?"Analytics":t==="archive"?"Trip Archive":"Retrospective"}
          </button>
        ))}
      </div>

      {/* BUDGET TAB */}
      {tab==="budget"&&(
        <div style={{animation:"tbFadeIn 0.3s ease"}}>
          <div style={{background:"#faeeda",border:"1px solid #ef9f27",borderRadius:12,padding:"15px 18px",marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"#633806",letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:700}}>FM Executive briefing · for Mya</span>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0,animation:"pulse 2s infinite"}}/>
              {!briefLoading&&<button onClick={()=>{briefDone.current=false;setAiBrief("");setBriefLoading(true);setTimeout(()=>{briefDone.current=false;},50);}} style={{marginLeft:"auto",background:"transparent",border:"1px solid #ef9f27",borderRadius:5,padding:"3px 10px",fontFamily:"inherit",fontSize:12,color:"#633806",cursor:"pointer",fontWeight:600}}>↺ Refresh</button>}
            </div>
            {briefLoading
              ?<div style={{fontSize:14,color:"#92400e",fontStyle:"italic"}}>Generating briefing for Mya...</div>
              :<div style={{fontSize:14,color:"#1c1917",lineHeight:1.65}}>{aiBrief||"Generating..."}</div>}
          </div>

          <div style={{marginBottom:18}}>
            {[
              {l:"Planning progress",pct:pp,      trackBg:"#faeeda",fill:"#f59e0b"},
              {l:"Budget used",      pct:sp,      trackBg:"#dbeafe",fill:sp>100?"#ef4444":"#3b82f6"},
              {l:"Savings captured", pct:Math.min(Math.round((tots.saved/1750)*100),100),trackBg:"#dcfce7",fill:"#22c55e"},
            ].map(p=>(
              <div key={p.l} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{fontSize:13,color:"#4a4a52",width:150,flexShrink:0}}>{p.l}</div>
                <div style={{flex:1,height:7,background:p.trackBg,borderRadius:4,overflow:"hidden",minWidth:0}}>
                  <div style={{width:`${p.pct}%`,height:"100%",background:p.fill,borderRadius:4,transition:"width 1.4s cubic-bezier(0.4,0,0.2,1)",boxShadow:`0 0 8px ${p.fill}66`}}/>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:p.fill,width:36,textAlign:"right",flexShrink:0}}>{p.pct}%</div>
              </div>
            ))}
          </div>

          <div className="tb-metric-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
            {[
              {label:"Booked",      value:tbFmt(bookedTotal),                      sub:"Hotel confirmed",  bg:"#22c55e",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Budget (low)",value:tbFmt(tots.low),                         sub:"Conservative est.",bg:"#e2e8f0",tc:"#1e293b",sc:"#475569"},
              {label:"Actual paid", value:tbFmt(tots.actual),                      sub:"Enter as you pay", bg:"#3b82f6",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Still needed",value:tbFmt(Math.max(0,tots.low-tots.actual)), sub:"Remaining",        bg:"#ef4444",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Total saved", value:"~"+tbFmt(tots.saved),                   sub:"vs full price",    bg:"#f59e0b",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
            ].map(card=>(
              <div key={card.label} style={{background:card.bg,borderRadius:10,padding:"13px 15px",transition:"all 0.22s cubic-bezier(0.4,0,0.2,1)",cursor:"default"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px ${card.bg}99`;}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:card.sc,marginBottom:6}}>{card.label}</div>
                <div style={{fontSize:22,fontWeight:700,color:card.tc,lineHeight:1,marginBottom:3}}>{card.value}</div>
                <div style={{fontSize:11,fontWeight:500,color:card.sc}}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}>
              <div>
                <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700}}>Trip people roster</div>
                <div style={{fontSize:12,color:"#4a4a52",marginTop:3}}>Shared splits use active people only.</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {TB_PEOPLE.map(p=>(
                  <label key={p.key} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a4a52",fontWeight:700,background:tripPeople.includes(p.key)?"#dcfce7":"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:7,padding:"5px 9px"}}>
                    <input type="checkbox" checked={tripPeople.includes(p.key)} onChange={e=>updateTripPeopleRoster(p.key,e.target.checked)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap",borderTop:"0.5px solid rgba(0,0,0,0.08)",paddingTop:12}}>
              <div>
                <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700}}>Budget view</div>
                <div style={{fontSize:12,color:"#4a4a52",marginTop:3}}>{selectedBudgetPerson?`${selectedBudgetPerson.label}'s per-line shares`:"Full trip budget breakdown"}</div>
              </div>
              <div className="tb-budget-view-toggle" style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["all",...TB_PEOPLE.map(p=>p.label)].map(view=>{
                  const active=selectedPersonBudgetView===view;
                  const label=view==="all"?"All":view;
                  return <button key={view} type="button" onClick={()=>setSelectedPersonBudgetView(active||view==="all"?"all":view)}
                    style={{background:active?"#111827":"#f8f7f5",border:active?"1px solid #111827":"0.5px solid rgba(0,0,0,0.12)",borderRadius:8,padding:"7px 10px",fontFamily:"inherit",fontSize:12,fontWeight:800,color:active?"#fff":"#4a4a52",cursor:"pointer",lineHeight:1}}>
                    {label}
                  </button>;
                })}
              </div>
            </div>
            <div className="tb-split-summary-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
              {[
                ["Trip Total",tripReconciliation.tripTotal,"All rows","#1e293b"],
                ["Attributed",tripReconciliation.attributedTotal,"Assigned rows","#15803d"],
                ["Unattributed",tripReconciliation.unattributedTotal,"Unsplit rows","#b45309"],
                ["Mismatches",mismatchRows.length,mismatchRows.length?"Needs review":"Assigned rows balance",mismatchRows.length?"#dc2626":"#15803d"],
              ].map(([label,value,sub,color])=>(
                <div key={label} style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:4}}>{label}</div>
                  <div style={{fontSize:17,fontWeight:800,color}}>{typeof value==="number"&&label!=="Mismatches"?tbFmtMoney(value):value}</div>
                  <div style={{fontSize:11,color:"#78788a",marginTop:2}}>{sub}</div>
                </div>
              ))}
            </div>
            {mismatchRows.length>0&&(
              <div style={{marginTop:10,background:"#fee2e2",border:"0.5px solid rgba(220,38,38,0.25)",borderRadius:8,padding:"8px 10px",fontSize:12,color:"#991b1b",fontWeight:600}}>
                Split mismatch: {mismatchRows.map(r=>r.label||r.id).join(", ")}
              </div>
            )}
          </div>

          <div className="tb-split-totals-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:10}}>Per-person totals</div>
              {TB_PEOPLE.map(p=>(
                <div key={p.key} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:tripPeople.includes(p.key)?"#1a1a1a":"#9ca3af",padding:"4px 0",borderBottom:"0.5px solid rgba(0,0,0,0.05)"}}>
                  <span>{p.label}{tripPeople.includes(p.key)?"":" · not on trip"}</span>
                  <strong>{tbFmtMoney(personTotals[p.key])}</strong>
                </div>
              ))}
            </div>
            <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:10}}>Paid-by totals</div>
              {TB_PEOPLE.map(p=>(
                <div key={p.key} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:tripPeople.includes(p.key)?"#1a1a1a":"#9ca3af",padding:"4px 0",borderBottom:"0.5px solid rgba(0,0,0,0.05)"}}>
                  <span>{p.label}</span>
                  <strong>{tbFmtMoney(paidByTotals[p.key])}</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:14,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700}}>Budget breakdown</div>
                <div style={{fontSize:12,color:"#4a4a52",marginTop:3}}>{selectedBudgetPerson?`${selectedBudgetPerson.label} share view`:"All trip rows"}</div>
              </div>
              <div style={{fontSize:20,fontWeight:900,color:selectedBudgetPerson?"#15803d":"#1e293b"}}>{tbFmtMoney(budgetBreakdownTotal)}</div>
            </div>
            <div style={{display:"grid",gap:8}}>
              {budgetBreakdownRows.length===0?(
                <div style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:9,padding:"12px 14px",fontSize:13,color:"#78788a",fontWeight:700}}>
                  No attributed lines for {selectedBudgetPerson?.label||"this view"}.
                </div>
              ):budgetBreakdownRows.map(({row,amount,rowBalance})=>{
                const amountPaid=getReconcilingAmount(row);
                const statusLabel=STS[row.status]?.t||row.status||"Estimate";
                const color=rowBalance==="Mismatch"?"#dc2626":rowBalance==="Balanced"?"#15803d":"#b45309";
                return <div key={"breakdown_"+row.id} className="tb-person-breakdown-row" style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) 110px 120px",gap:10,alignItems:"center",background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:9,padding:"10px 12px"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#1a1a1a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.label||"Untitled item"}</div>
                    <div style={{fontSize:11,color:"#78788a",marginTop:3}}>{row.cat||"Same section"} · {statusLabel}</div>
                  </div>
                  <div style={{fontSize:12,color:"#4a4a52",fontWeight:800}}>
                    <div style={{fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",marginBottom:2}}>Paid/actual</div>
                    {tbFmtMoney(amountPaid)}
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div>
                      <div style={{fontSize:9,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",marginBottom:2}}>{selectedBudgetPerson?`${selectedBudgetPerson.label} share`:"Row amount"}</div>
                      <div style={{fontSize:14,fontWeight:900,color:"#1a1a1a"}}>{tbFmtMoney(amount)}</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:900,color,background:rowBalance==="Mismatch"?"#fee2e2":rowBalance==="Balanced"?"#dcfce7":"#fef3c7",borderRadius:999,padding:"5px 8px",whiteSpace:"nowrap"}}>{rowBalance}</div>
                  </div>
                </div>;
              })}
            </div>
          </div>

          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
            {[["#22c55e","#dcfce7","Booked"],["#f59e0b","#fef3c7","Book now"],["#78788a","#f1f5f9","Estimate"],["#3b82f6","#dbeafe","Actual — edit fields"],["#ef4444","#fee2e2","Over estimate"]].map(([c,bg,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#4a4a52"}}>
                <div style={{width:8,height:8,borderRadius:2,background:bg,border:`1px solid ${c}`,flexShrink:0}}/>{l}
              </div>
            ))}
            <div style={{fontSize:12,color:travelDraftStatus==="error"?"#ef4444":"#78788a",marginLeft:"auto"}}>{travelDraftStatusText}</div>
          </div>

          <div className="tb-budget-table-wrap" style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:18}}>
            <table className="tb-budget-table" style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
              <colgroup><col style={{width:"17%"}}/><col style={{width:"7%"}}/><col style={{width:"7%"}}/><col style={{width:"9%"}}/><col style={{width:"7%"}}/><col style={{width:"8%"}}/><col style={{width:"18%"}}/><col style={{width:"14%"}}/><col style={{width:"14%"}}/></colgroup>
              <thead>
                <tr style={{background:"#f8f7f5"}}>
                  {["Item","Low est.","High est.","Actual paid","+/–","Status","Split","Shares","Notes"].map((h,i)=>(
                    <th key={h} style={{padding:"9px 12px",textAlign:i>0&&i<5?"right":i===5?"center":"left",fontFamily:"monospace",fontSize:8,letterSpacing:"0.09em",textTransform:"uppercase",color:T.muted,borderBottom:`1px solid ${T.border}`,fontWeight:400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  let lc="";
                  return displayTripRows.map(r=>{
                    const cells=[];
                    if(r.cat&&r.cat!==lc){lc=r.cat;const _cat=r.cat;cells.push(
                      <tr key={"c"+r.cat} style={{background:"#faeeda"}}>
                        <td colSpan={9} style={{padding:"7px 14px",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"#633806",fontWeight:700}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <span>{r.cat}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {!TB_DEFAULT_SECTIONS.includes(_cat)&&(
                                <button onClick={()=>deleteBudgetSection(_cat)} title="Delete this section" style={{background:"#fee2e2",border:"none",borderRadius:5,padding:"3px 9px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:"#dc2626",cursor:"pointer",lineHeight:1}}>&#x2715; Delete</button>
                              )}
                              <button onClick={()=>addTripRow(_cat)} style={{display:"flex",alignItems:"center",gap:3,background:"#22c55e",border:"none",borderRadius:5,padding:"3px 9px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",lineHeight:1}}>
                                <span style={{fontSize:14,lineHeight:1}}>+</span> Add
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );}
                    const section=lc;
                    const isFlightRow=section==="Flights";
                    const val=r.act!==undefined&&r.act!==null?String(r.act):"";
                    const nv=val!==""?parseFloat(val):null;
                    const diff=nv!==null?(Number(r.low)||0)-nv:null;
                    const s=STS[r.status]||STS["est"]||{bg:"#f1f5f9",c:"#64748b",t:"Estimate"};
                    const rowBalance=getRowSplitStatus(r);
                    const rowIncluded=getIncludedPeople(r,tripPeople);
                    cells.push(
                      <tr key={r.id} className="tb-row" style={{borderBottom:"0.5px solid rgba(0,0,0,0.07)",background:"#ffffff"}}>
                        <td style={{padding:"10px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input value={r.label} onChange={e=>updateTripRow(r.id,"label",e.target.value)}
                              style={{background:"transparent",border:"none",color:"#1a1a1a",fontFamily:"inherit",fontSize:14,fontWeight:600,width:"100%",outline:"none"}}/>
                            <span style={{fontSize:12,color:"#d1d5db",flexShrink:0}}>&#9998;</span>
                            {String(r.id||"").startsWith("custom_")&&<button onClick={()=>removeTripRow(r.id)} style={{background:"#ef4444",border:"none",borderRadius:"50%",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"inherit",lineHeight:1}} title="Remove row">&#x2715;</button>}
                          </div>
                        </td>
                        <td style={{padding:"10px 14px",textAlign:"right"}}>
                          <input type="number" value={r.low} onChange={e=>updateTripRow(r.id,"low",e.target.value)}
                            style={{background:"transparent",border:"none",color:"#4a4a52",fontFamily:"inherit",fontSize:13,width:66,textAlign:"right",outline:"none"}}/>
                        </td>
                        <td style={{padding:"10px 14px",textAlign:"right"}}>
                          <input type="number" value={r.high} onChange={e=>updateTripRow(r.id,"high",e.target.value)}
                            style={{background:"transparent",border:"none",color:"#4a4a52",fontFamily:"inherit",fontSize:13,width:66,textAlign:"right",outline:"none"}}/>
                        </td>
                        <td style={{padding:"10px 14px",textAlign:"right"}}>
                          <input type="number" value={val} placeholder="enter" onChange={e=>setActual(r.id,e.target.value)}
                            style={{background:"#dbeafe",border:"none",borderRadius:5,color:"#1d4ed8",fontFamily:"inherit",fontSize:13,fontWeight:600,width:80,textAlign:"right",padding:"3px 8px",outline:"none"}}/>
                        </td>
                        <td style={{padding:"10px 14px",textAlign:"right",fontSize:13,fontWeight:600,color:diff===null?"#d1d5db":diff>0?"#15803d":diff<0?"#dc2626":"#d1d5db"}}>
                          {diff===null?"—":diff>0?tbFmt(diff):diff<0?"("+tbFmt(Math.abs(diff))+")":"$0"}
                        </td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}>
                          <select value={r.status} onChange={e=>updateTripRow(r.id,"status",e.target.value)}
                            style={{background:s.bg,color:s.c,border:`1px solid ${s.c}30`,borderRadius:3,padding:"2px 6px",fontFamily:"monospace",fontSize:9,fontWeight:500,outline:"none"}}>
                            {STATUS_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td style={{padding:"10px 10px",verticalAlign:"top"}}>
                          <select value={r.splitType} onChange={e=>updateSplitRow(r.id,"splitType",e.target.value)}
                            style={{width:"100%",background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:5,padding:"4px 6px",fontFamily:"inherit",fontSize:11,color:"#1a1a1a",outline:"none",marginBottom:5}}>
                            {TB_SPLIT_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                          </select>
                          <select value={r.paidBy} onChange={e=>updateSplitRow(r.id,"paidBy",e.target.value)}
                            style={{width:"100%",background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:5,padding:"4px 6px",fontFamily:"inherit",fontSize:11,color:"#4a4a52",outline:"none",marginBottom:5}}>
                            <option value="">Paid by...</option>
                            {TB_PEOPLE.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
                          </select>
                          {(r.splitType==="selected"||r.splitType==="custom")&&(
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                              {TB_PEOPLE.map(p=>(
                                <label key={p.key} style={{fontSize:10,color:tripPeople.includes(p.key)?"#4a4a52":"#9ca3af",display:"flex",alignItems:"center",gap:2}}>
                                  <input type="checkbox" disabled={!tripPeople.includes(p.key)} checked={r.peopleIncluded.includes(p.key)} onChange={()=>toggleRowPerson(r.id,p.key)} />
                                  {p.label.slice(0,3)}
                                </label>
                              ))}
                            </div>
                          )}
                          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#78788a",marginBottom:4}}>
                            <input type="checkbox" checked={r.reimbursable} onChange={e=>updateSplitRow(r.id,"reimbursable",e.target.checked)} />
                            Reimbursable
                          </label>
                          {r.reimbursable&&(
                            <select value={r.reimbursementStatus} onChange={e=>updateSplitRow(r.id,"reimbursementStatus",e.target.value)}
                              style={{width:"100%",background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:5,padding:"3px 6px",fontFamily:"inherit",fontSize:10,color:"#4a4a52",outline:"none"}}>
                              <option value="pending">Pending</option>
                              <option value="requested">Requested</option>
                              <option value="received">Received</option>
                            </select>
                          )}
                          <div style={{marginTop:5,fontSize:10,fontWeight:800,color:rowBalance==="Mismatch"?"#dc2626":rowBalance==="Balanced"?"#15803d":"#b45309"}}>{rowBalance}</div>
                        </td>
                        <td style={{padding:"10px 10px",verticalAlign:"top",fontSize:11,color:"#4a4a52"}}>
                          {TB_PEOPLE.map(p=>{
                            const active=tripPeople.includes(p.key);
                            const included=rowIncluded.includes(p.key);
                            const editable=r.splitType==="custom"&&included;
                            return <div key={p.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:5,marginBottom:4,color:active?"#4a4a52":"#9ca3af"}}>
                              <span>{p.label.slice(0,3)}</span>
                              {editable
                                ?<input type="number" value={r[p.shareField]} onChange={e=>updateSplitRow(r.id,p.shareField,e.target.value)} style={{width:62,textAlign:"right",background:"#fff7ed",border:"0.5px solid rgba(245,158,11,0.35)",borderRadius:4,padding:"2px 4px",fontSize:11,color:"#92400e",outline:"none"}}/>
                                :<strong style={{color:included?"#1a1a1a":"#9ca3af"}}>{tbFmtMoney(r[p.shareField])}</strong>}
                            </div>;
                          })}
                          {r.splitType==="custom"&&rowBalance==="Mismatch"&&(
                            <div style={{fontSize:10,color:"#dc2626",fontWeight:700}}>Diff {tbFmtMoney(r.balanceDifference)}</div>
                          )}
                        </td>
                        <td style={{padding:"10px 14px",fontSize:12,color:"#78788a",position:"relative"}}>
                          <input value={r.note} onChange={e=>updateTripRow(r.id,"note",e.target.value)}
                            style={{background:"transparent",border:"none",color:"#78788a",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none"}}/>
                          {isFlightRow&&(
                            <button onClick={()=>setFlightOptionsForRow(flightOptionsForRow===r.id?null:r.id)}
                              style={{display:"block",marginTop:5,background:"#fef3c7",border:"1px solid rgba(245,158,11,0.4)",borderRadius:6,padding:"4px 10px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:"#b45309",cursor:"pointer"}}>Options</button>
                          )}
                          {isFlightRow&&flightOptionsForRow===r.id&&(
                            <div style={{position:"absolute",right:8,top:"100%",zIndex:50,width:260,background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:12,padding:14,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#1a1a1a",marginBottom:10}}>Flight Options</div>
                              {TB_FLIGHT_OPTIONS.map(opt=>(
                                <div key={opt.title} style={{borderTop:"0.5px solid rgba(0,0,0,0.08)",paddingTop:10,marginTop:10}}>
                                  <div style={{fontSize:13,fontWeight:600,color:"#1a1a1a"}}>{opt.title}</div>
                                  <div style={{fontSize:12,color:"#b45309",marginTop:3,fontWeight:600}}>{tbFmt(opt.low)}–{tbFmt(opt.high)}</div>
                                  <div style={{fontSize:11,color:"#78788a",marginTop:3,lineHeight:1.5}}>{opt.note}</div>
                                  <div style={{display:"flex",gap:6,marginTop:7}}>
                                    <button onClick={()=>useFlightOption(r.id,opt)} style={{flex:1,background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:6,padding:"6px 0",fontFamily:"inherit",fontSize:12,fontWeight:600,color:"#4a4a52",cursor:"pointer"}}>Use</button>
                                    <button onClick={()=>openFlightBooking(opt.bookingUrl)} style={{flex:1,background:"#3b82f6",border:"none",borderRadius:6,padding:"6px 0",fontFamily:"inherit",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Book Now</button>
                                  </div>
                                </div>
                              ))}
                              <div style={{fontSize:11,color:"#78788a",lineHeight:1.5,marginTop:10}}>Book Now opens the provider website. You review and book manually.</div>
                            </div>
                          )}
                          {r.url
                            ? <a href={r.url} target="_blank" rel="noopener" style={{display:"block",marginTop:5,color:"#b45309",textDecoration:"none",fontWeight:700,fontSize:12}}>Book →</a>
                            : r.status==="booknow" ? <span style={{display:"block",marginTop:4,color:"#d1d5db",fontSize:11}}>No link</span> : null
                          }
                        </td>
                      </tr>
                    );
                    return cells;
                  });
                })()}
                <tr style={{background:"#f8f7f5",borderTop:"1.5px solid rgba(0,0,0,0.12)"}}>
                  <td style={{padding:"12px 14px",fontWeight:700,fontSize:14,color:"#1a1a1a"}}>Total</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:14,color:"#b45309",fontWeight:700}}>{tbFmt(tots.low)}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:14,color:"#b45309",fontWeight:700}}>{tbFmt(tots.high)}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:14,color:"#1d4ed8",fontWeight:700}}>{tbFmt(tots.actual)}</td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontSize:14,color:"#15803d",fontWeight:700}}>{tbFmt(tots.saved)}</td>
                  <td/>
                  <td style={{padding:"12px 14px",fontSize:12,color:"#78788a",fontStyle:"italic"}}>Assigned rows must balance</td>
                  <td style={{padding:"12px 14px",fontSize:12,color:"#78788a",fontStyle:"italic"}}>{tbFmtMoney(tripReconciliation.attributedTotal)}</td>
                  <td style={{padding:"12px 14px",fontSize:12,color:"#78788a",fontStyle:"italic"}}>Edit blue fields as costs come in</td>
                </tr>
              </tbody>
            </table>
            <div style={{padding:"10px 0 4px"}}>
              <button onClick={addBudgetSection} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",background:"#f8f7f5",border:"1.5px dashed rgba(0,0,0,0.12)",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:600,color:"#4a4a52",cursor:"pointer",width:"100%",justifyContent:"center"}}>+ New section</button>
            </div>
          </div>

          <div className="tb-mobile-budget-cards" style={{marginBottom:18}}>
            {(()=>{
              let lc="";
              return displayTripRows.map(r=>{
                const cards=[];
                if(r.cat&&r.cat!==lc){lc=r.cat;const _cat=r.cat;cards.push(
                  <div key={"mcat"+r.cat} style={{background:"#faeeda",border:"1px solid #ef9f27",borderRadius:10,padding:"9px 11px",margin:"12px 0 8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <span style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"#633806",fontWeight:800}}>{r.cat}</span>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {!TB_DEFAULT_SECTIONS.includes(_cat)&&(
                        <button onClick={()=>deleteBudgetSection(_cat)} title="Delete this section" style={{background:"#fee2e2",border:"none",borderRadius:5,padding:"5px 8px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:"#dc2626",cursor:"pointer",lineHeight:1}}>Delete</button>
                      )}
                      <button onClick={()=>addTripRow(_cat)} style={{background:"#22c55e",border:"none",borderRadius:5,padding:"5px 9px",fontFamily:"inherit",fontSize:11,fontWeight:800,color:"#fff",cursor:"pointer",lineHeight:1}}>+ Add</button>
                    </div>
                  </div>
                );}
                const section=lc;
                const isFlightRow=section==="Flights";
                const val=r.act!==undefined&&r.act!==null?String(r.act):"";
                const nv=val!==""?parseFloat(val):null;
                const diff=nv!==null?(Number(r.low)||0)-nv:null;
                const s=STS[r.status]||STS["est"]||{bg:"#f1f5f9",c:"#64748b",t:"Estimate"};
                const rowBalance=getRowSplitStatus(r);
                const rowIncluded=getIncludedPeople(r,tripPeople);
                cards.push(
                  <div key={"mrow"+r.id} style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 0 rgba(0,0,0,0.03)"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9ca3af",fontWeight:800,marginBottom:4}}>{section||"Travel item"}</div>
                        <input value={r.label} onChange={e=>updateTripRow(r.id,"label",e.target.value)}
                          style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,color:"#1a1a1a",fontFamily:"inherit",fontSize:14,fontWeight:700,width:"100%",boxSizing:"border-box",outline:"none",padding:"8px 9px"}}/>
                      </div>
                      {String(r.id||"").startsWith("custom_")&&(
                        <button onClick={()=>removeTripRow(r.id)} style={{background:"#fee2e2",border:"none",borderRadius:7,color:"#dc2626",cursor:"pointer",fontSize:11,fontWeight:800,padding:"8px 9px",fontFamily:"inherit",lineHeight:1}} title="Remove row">Delete</button>
                      )}
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>Low est.
                        <input type="number" value={r.low} onChange={e=>updateTripRow(r.id,"low",e.target.value)}
                          style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,color:"#4a4a52",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box",textAlign:"right",outline:"none",padding:"8px 9px"}}/>
                      </label>
                      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>High est.
                        <input type="number" value={r.high} onChange={e=>updateTripRow(r.id,"high",e.target.value)}
                          style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,color:"#4a4a52",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box",textAlign:"right",outline:"none",padding:"8px 9px"}}/>
                      </label>
                      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>Actual paid
                        <input type="number" value={val} placeholder="enter" onChange={e=>setActual(r.id,e.target.value)}
                          style={{background:"#dbeafe",border:"none",borderRadius:7,color:"#1d4ed8",fontFamily:"inherit",fontSize:13,fontWeight:800,width:"100%",boxSizing:"border-box",textAlign:"right",outline:"none",padding:"8px 9px"}}/>
                      </label>
                      <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>Variance
                        <div style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:7,padding:"8px 9px",fontSize:13,fontWeight:800,textAlign:"right",color:diff===null?"#9ca3af":diff>0?"#15803d":diff<0?"#dc2626":"#9ca3af"}}>
                          {diff===null?"-":diff>0?tbFmt(diff):diff<0?"("+tbFmt(Math.abs(diff))+")":"$0"}
                        </div>
                      </div>
                    </div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>Status
                        <select value={r.status} onChange={e=>updateTripRow(r.id,"status",e.target.value)}
                          style={{background:s.bg,color:s.c,border:`1px solid ${s.c}30`,borderRadius:7,padding:"8px 9px",fontFamily:"inherit",fontSize:12,fontWeight:800,outline:"none",width:"100%",boxSizing:"border-box"}}>
                          {STATUS_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em"}}>Split Type
                        <select value={r.splitType} onChange={e=>updateSplitRow(r.id,"splitType",e.target.value)}
                          style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,padding:"8px 9px",fontFamily:"inherit",fontSize:12,color:"#1a1a1a",outline:"none",width:"100%",boxSizing:"border-box"}}>
                          {TB_SPLIT_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                    </div>

                    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Paid By
                      <select value={r.paidBy} onChange={e=>updateSplitRow(r.id,"paidBy",e.target.value)}
                        style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,padding:"8px 9px",fontFamily:"inherit",fontSize:12,color:"#4a4a52",outline:"none",width:"100%",boxSizing:"border-box"}}>
                        <option value="">Paid by...</option>
                        {TB_PEOPLE.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </label>

                    {(r.splitType==="selected"||r.splitType==="custom")&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>People Included</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {TB_PEOPLE.map(p=>(
                            <label key={p.key} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:tripPeople.includes(p.key)?"#4a4a52":"#9ca3af",background:r.peopleIncluded.includes(p.key)?"#dcfce7":"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:7,padding:"6px 8px",fontWeight:800}}>
                              <input type="checkbox" disabled={!tripPeople.includes(p.key)} checked={r.peopleIncluded.includes(p.key)} onChange={()=>toggleRowPerson(r.id,p.key)} />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:9,padding:10,marginBottom:10}}>
                      <div style={{fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Shares</div>
                      {TB_PEOPLE.map(p=>{
                        const active=tripPeople.includes(p.key);
                        const included=rowIncluded.includes(p.key);
                        const editable=r.splitType==="custom"&&included;
                        return <div key={p.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6,color:active?"#4a4a52":"#9ca3af",fontSize:13}}>
                          <span style={{fontWeight:700}}>{p.label}</span>
                          {editable
                            ?<input type="number" value={r[p.shareField]} onChange={e=>updateSplitRow(r.id,p.shareField,e.target.value)} style={{width:110,textAlign:"right",background:"#fff7ed",border:"0.5px solid rgba(245,158,11,0.35)",borderRadius:6,padding:"6px 8px",fontSize:13,color:"#92400e",outline:"none",boxSizing:"border-box"}}/>
                            :<strong style={{color:included?"#1a1a1a":"#9ca3af"}}>{tbFmtMoney(r[p.shareField])}</strong>}
                        </div>;
                      })}
                    </div>

                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:900,letterSpacing:"0.08em",textTransform:"uppercase",color:"#78788a"}}>Balance status</div>
                      <div style={{fontSize:12,fontWeight:900,color:rowBalance==="Mismatch"?"#dc2626":rowBalance==="Balanced"?"#15803d":"#b45309",background:rowBalance==="Mismatch"?"#fee2e2":rowBalance==="Balanced"?"#dcfce7":"#fef3c7",borderRadius:999,padding:"5px 9px"}}>{rowBalance}</div>
                    </div>
                    {r.splitType==="custom"&&rowBalance==="Mismatch"&&(
                      <div style={{fontSize:12,color:"#dc2626",fontWeight:800,marginBottom:10}}>Difference {tbFmtMoney(r.balanceDifference)}</div>
                    )}

                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#78788a",fontWeight:700,marginBottom:8}}>
                      <input type="checkbox" checked={r.reimbursable} onChange={e=>updateSplitRow(r.id,"reimbursable",e.target.checked)} />
                      Reimbursable
                    </label>
                    {r.reimbursable&&(
                      <select value={r.reimbursementStatus} onChange={e=>updateSplitRow(r.id,"reimbursementStatus",e.target.value)}
                        style={{width:"100%",background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,padding:"8px 9px",fontFamily:"inherit",fontSize:12,color:"#4a4a52",outline:"none",boxSizing:"border-box",marginBottom:10}}>
                        <option value="pending">Pending</option>
                        <option value="requested">Requested</option>
                        <option value="received">Received</option>
                      </select>
                    )}

                    <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:10,color:"#78788a",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Notes
                      <input value={r.note} onChange={e=>updateTripRow(r.id,"note",e.target.value)}
                        style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:7,color:"#4a4a52",fontFamily:"inherit",fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",padding:"8px 9px"}}/>
                    </label>

                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      {isFlightRow&&(
                        <button onClick={()=>setFlightOptionsForRow(flightOptionsForRow===r.id?null:r.id)}
                          style={{background:"#fef3c7",border:"1px solid rgba(245,158,11,0.4)",borderRadius:7,padding:"7px 11px",fontFamily:"inherit",fontSize:12,fontWeight:800,color:"#b45309",cursor:"pointer"}}>Options</button>
                      )}
                      {r.url
                        ? <a href={r.url} target="_blank" rel="noopener" style={{color:"#b45309",textDecoration:"none",fontWeight:800,fontSize:12}}>Book</a>
                        : r.status==="booknow" ? <span style={{color:"#9ca3af",fontSize:12}}>No link</span> : null
                      }
                      <span style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",fontWeight:700}}>Saved locally</span>
                    </div>

                    {isFlightRow&&flightOptionsForRow===r.id&&(
                      <div style={{marginTop:10,background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.12)",borderRadius:10,padding:12,boxShadow:"0 8px 24px rgba(0,0,0,0.08)"}}>
                        <div style={{fontSize:13,fontWeight:800,color:"#1a1a1a",marginBottom:8}}>Flight Options</div>
                        {TB_FLIGHT_OPTIONS.map(opt=>(
                          <div key={opt.title} style={{borderTop:"0.5px solid rgba(0,0,0,0.08)",paddingTop:9,marginTop:9}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#1a1a1a"}}>{opt.title}</div>
                            <div style={{fontSize:12,color:"#b45309",marginTop:3,fontWeight:700}}>{tbFmt(opt.low)}-{tbFmt(opt.high)}</div>
                            <div style={{fontSize:11,color:"#78788a",marginTop:3,lineHeight:1.5}}>{opt.note}</div>
                            <div style={{display:"flex",gap:6,marginTop:7}}>
                              <button onClick={()=>useFlightOption(r.id,opt)} style={{flex:1,background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:6,padding:"7px 0",fontFamily:"inherit",fontSize:12,fontWeight:700,color:"#4a4a52",cursor:"pointer"}}>Use</button>
                              <button onClick={()=>openFlightBooking(opt.bookingUrl)} style={{flex:1,background:"#3b82f6",border:"none",borderRadius:6,padding:"7px 0",fontFamily:"inherit",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>Book Now</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
                return cards;
              });
            })()}
            <button onClick={addBudgetSection} style={{display:"flex",alignItems:"center",gap:6,padding:"11px 16px",background:"#f8f7f5",border:"1.5px dashed rgba(0,0,0,0.12)",borderRadius:10,fontFamily:"inherit",fontSize:13,fontWeight:800,color:"#4a4a52",cursor:"pointer",width:"100%",justifyContent:"center"}}>+ New section</button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:12,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Money saved vs full price</div>
              {[["MM4 hotel discount","~$170"],["No rental car","~$200"],["Kadence buddy pass","~$350"],["No change fees","$0 risk"]].map(([l,a])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>
                  <div style={{flex:1,fontSize:13,color:"#4a4a52"}}>{l}</div>
                  <div style={{fontSize:13,color:"#15803d",fontWeight:600}}>{a}</div>
                </div>
              ))}
              <div style={{borderTop:"0.5px solid rgba(0,0,0,0.08)",marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between",fontSize:13}}>
                <span style={{fontWeight:700,color:"#1a1a1a"}}>Total saved</span>
                <span style={{color:"#15803d",fontWeight:700}}>{"~"+tbFmt(tots.saved)+" +"}</span>
              </div>
            </div>
            <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:12,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Open items — action required</div>
              {[{c:"#ef4444",t:"Book Kadence LAX→JFK Jun 12 — JetBlue / Delta / AA nonstop"},{c:"#ef4444",t:"Book Kadence JFK→LAX Jun 22 — return leg nonstop"},{c:"#f59e0b",t:"Text Kayliah — need 4+ graduation tickets + dinner plans"},{c:"#f59e0b",t:"Confirm hotel dates with Dad — Jun 13–14 or Jun 13–15"},{c:"#3b82f6",t:"Bring original Marriott Explore Form + Photo ID to check-in"}].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:10,fontSize:13,color:"#4a4a52",lineHeight:1.6}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:item.c,flexShrink:0,marginTop:5}}/>
                  <span>{item.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ITINERARY TAB */}
      {tab==="itinerary"&&(
        <div style={{animation:"tbFadeIn 0.3s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontSize:11,color:"#78788a",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:4}}>Itinerary · {activeTripTitle}</div>
              <div style={{fontSize:18,fontWeight:700,color:"#1a1a1a"}}>Jun 12–22 · 10 days · 2 travelers</div>
            </div>
            <button onClick={addItinDay} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 16px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add day</button>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
            {[["#dbeafe","#1d4ed8","KA","Kadence · LAX↔JFK"],["#dcfce7","#15803d","MO","Motes · LGA↔ORD"],["#f3e8ff","#6d28d9","⚓","Anchor event"]].map(([bg,c,ic,lbl])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#4a4a52"}}>
                <div style={{width:28,height:28,borderRadius:7,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:c,flexShrink:0}}>{ic}</div>{lbl}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
            {[["✈","Flight","#3b82f6"],["⌂","Hotel","#f59e0b"],["★","Event","#8b5cf6"],["⚑","Food","#22c55e"],["⦿","Transport","#ef4444"],["✎","Note","#78788a"]].map(([ic,lbl,c])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,border:"0.5px solid rgba(0,0,0,0.08)",background:"#f8f7f5",fontSize:12,color:"#4a4a52"}}>
                <span style={{color:c,fontSize:14,fontWeight:700}}>{ic}</span>{lbl}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {[["all","All Travelers"],["kadence","Kadence"],["motes","Motes"]].map(([key,label])=>{
              const active=travelerFilter===key;
              const activeBg=key==="motes"?"#475569":key==="kadence"?"#f59e0b":"#3b82f6";
              return <button key={key} onClick={()=>setTravelerFilter(key)} style={{padding:"7px 13px",borderRadius:999,border:active?"none":"0.5px solid rgba(0,0,0,0.14)",background:active?activeBg:"#ffffff",color:active?"#fff":"#4a4a52",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>;
            })}
          </div>
          <div>
            {(()=>{let currentSection="";return itinDays.filter(day=>{const t=day.traveler||"both";return travelerFilter==="all"||(travelerFilter==="kadence"&&(t==="kadence"||t==="both"))||(travelerFilter==="motes"&&(t==="motes"||t==="both"));}).map((day)=>{
              const traveler=day.traveler||"both";
              let section=currentSection;
              if(traveler==="kadence") section="KADENCE NEW YORK TRIP";
              if(traveler==="motes") section="MOTES CHICAGO TRIP";
              const showHeader=!!section&&section!==currentSection;
              if(section) currentSection=section;
              const isAnchor=!!day.anchor;
              const hdrBg=isAnchor?"#7c3aed":day.traveler==="kadence"?"#3b82f6":day.traveler==="motes"?"#f59e0b":"#f8f7f5";
              const hdrTxt=isAnchor||day.traveler==="kadence"||day.traveler==="motes"?"#fff":"#1a1a1a";
              const numBg=isAnchor||day.traveler==="kadence"||day.traveler==="motes"?"rgba(255,255,255,0.2)":"rgba(0,0,0,0.06)";
              const statusColors={booked:{bg:"#dcfce7",c:"#15803d"},unbooked:{bg:"#fef3c7",c:"#92400e"},tbd:{bg:"#f1f5f9",c:"#64748b"},anchor:{bg:"#7c3aed",c:"#fff"},note:{bg:"#f1f5f9",c:"#64748b"}};
              const typeIcons={flight:"✈",hotel:"⌂",event:"★",food:"⚑",transport:"⦿",note:"✎"};
              const typeBg={flight:"#dbeafe",hotel:"#fef9c3",event:"#f3e8ff",food:"#dcfce7",transport:"#fee2e2",note:"#f1f5f9"};
              const typeC={flight:"#1d4ed8",hotel:"#b45309",event:"#6d28d9",food:"#15803d",transport:"#dc2626",note:"#78788a"};
              return(
                <React.Fragment key={day.id}>
                  {showHeader&&<TripSectionHeader label={section}/>} 
                  <div style={{background:"#ffffff",border:isAnchor?"1.5px solid #7c3aed":"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,marginBottom:12,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:hdrBg}}>
                    <div style={{width:38,height:38,borderRadius:9,background:numBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:hdrTxt,flexShrink:0}}>{day.date.split(" ")[1]||day.date}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                        <input value={day.label} onChange={e=>updateItinDay(day.id,"label",e.target.value)}
                          style={{background:"transparent",border:"none",borderBottom:"1px dashed rgba(255,255,255,0.3)",color:hdrTxt,fontFamily:"inherit",fontSize:14,fontWeight:700,outline:"none",minWidth:0,flex:1}}/>
                        {isAnchor&&<span title="Fixed milestone · Schedule built around this date" style={{background:"rgba(255,255,255,0.25)",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,flexShrink:0}}>ANCHOR</span>}
                        {isAnchor&&<span style={{fontSize:11,color:"rgba(255,255,255,0.78)",fontStyle:"italic",flexShrink:0}}>Fixed milestone · Schedule built around this date</span>}
                      </div>
                      <input value={day.subtitle} onChange={e=>updateItinDay(day.id,"subtitle",e.target.value)}
                        style={{background:"transparent",border:"none",color:isAnchor||day.traveler==="kadence"||day.traveler==="motes"?"rgba(255,255,255,0.75)":"#78788a",fontFamily:"inherit",fontSize:12,outline:"none",width:"100%"}}/>
                    </div>
                    <button onClick={()=>removeItinDay(day.id)} style={{background:"rgba(255,255,255,0.15)",border:"none",color:hdrTxt,borderRadius:6,width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"inherit"}}>&#x2715;</button>
                  </div>
                  {day.events.map((ev)=>{
                    const sc=statusColors[ev.status]||statusColors.tbd;
                    const ic=typeIcons[ev.type]||"✎";
                    const ibg=typeBg[ev.type]||"#f1f5f9";
                    const ic2=typeC[ev.type]||"#78788a";
                    return(
                      <div key={ev.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderTop:"0.5px solid rgba(0,0,0,0.08)"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:ibg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:ic2,flexShrink:0,fontWeight:700}}>{ic}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <input value={ev.title} onChange={e=>updateItinEvent(day.id,ev.id,"title",e.target.value)}
                            style={{background:"transparent",border:"none",borderBottom:"1px dashed rgba(0,0,0,0.12)",color:"#1a1a1a",fontFamily:"inherit",fontSize:13,fontWeight:600,width:"100%",outline:"none",padding:"1px 0",marginBottom:2,display:"block"}}/>
                          <input value={ev.detail} onChange={e=>updateItinEvent(day.id,ev.id,"detail",e.target.value)}
                            style={{background:"transparent",border:"none",color:"#78788a",fontFamily:"inherit",fontSize:12,width:"100%",outline:"none",padding:0,display:"block"}}/>
                        </div>
                        {ev.status==="booked"
                          ?<div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                            <span style={{background:"#dcfce7",color:"#15803d",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:5}}>Booked ✓</span>
                            <button onClick={()=>updateItinEvent(day.id,ev.id,"status","unbooked")} style={{background:"transparent",border:"none",color:"#d1d5db",cursor:"pointer",fontSize:13,padding:"0 2px",fontFamily:"inherit"}} title="Change status">&#9998;</button>
                          </div>
                          :<select value={ev.status} onChange={e=>updateItinEvent(day.id,ev.id,"status",e.target.value)}
                            style={{background:sc.bg,color:sc.c,border:"none",borderRadius:5,padding:"3px 7px",fontSize:10,fontWeight:700,cursor:"pointer",outline:"none",flexShrink:0}}>
                            <option value="unbooked">Unbooked</option>
                            <option value="tbd">TBD</option>
                            <option value="booked">Booked</option>
                            <option value="note">Note</option>
                          </select>}
                        <button onClick={()=>removeItinEvent(day.id,ev.id)} style={{background:"transparent",border:"none",color:"#78788a",cursor:"pointer",fontSize:14,padding:"0 4px",flexShrink:0,fontFamily:"inherit"}}>&#x2715;</button>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",gap:7,padding:"9px 14px",flexWrap:"wrap",borderTop:"0.5px solid rgba(0,0,0,0.08)",background:"#f8f7f5"}}>
                    {[["✈","flight","#3b82f6"],["⌂","hotel","#f59e0b"],["★","event","#8b5cf6"],["⚑","food","#22c55e"],["⦿","transport","#ef4444"],["✎","note","#78788a"]].map(([ic,tp,c])=>(
                      <button key={tp} onClick={()=>addItinEvent(day.id,tp)}
                        style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:7,border:"0.5px solid rgba(0,0,0,0.08)",background:"#ffffff",cursor:"pointer",fontSize:12,fontWeight:500,color:"#4a4a52",fontFamily:"inherit"}}>
                        <span style={{color:c,fontSize:14,fontWeight:700}}>{ic}</span>{tp.charAt(0).toUpperCase()+tp.slice(1)}
                      </button>
                    ))}
                  </div>
                  </div>
                </React.Fragment>
              );
            })})()}
          </div>
          <div onClick={addItinDay} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:13,border:"1.5px dashed rgba(0,0,0,0.12)",borderRadius:12,cursor:"pointer",color:"#78788a",fontSize:13,fontWeight:500,marginTop:4}}>
            + Add another day
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab==="analytics"&&(
        <div style={{animation:"tbFadeIn 0.3s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:22}}>
            {[
              {label:"Coverage",    value:Math.round((tots.actual/tots.low)*100)+"%", sub:"Actual vs budget",  bg:"#22c55e",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Categories",  value:catData.filter(c=>c.v>0).length+"/"+catData.length, sub:"With actuals", bg:"#f59e0b",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Avg/day",     value:tots.actual>0?tbFmt(Math.round(tots.actual/3)):"—", sub:"3 days total", bg:"#3b82f6",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Savings rate",value:Math.round((tots.saved/1750)*100)+"%", sub:"Of full price", bg:"#22c55e",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
              {label:"Over/under",  value:tbFmt(Math.abs(tots.low-tots.actual)), sub:tots.actual<=tots.low?"under budget":"over budget", bg:tots.actual<=tots.low?"#22c55e":"#ef4444",tc:"#fff",sc:"rgba(255,255,255,0.85)"},
            ].map(card=>(
              <div key={card.label} style={{background:card.bg,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:card.sc,marginBottom:6}}>{card.label}</div>
                <div style={{fontSize:22,fontWeight:700,color:card.tc,lineHeight:1,marginBottom:3}}>{card.value}</div>
                <div style={{fontSize:11,fontWeight:500,color:card.sc}}>{card.sub}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:14,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Spend by category</div>
              {catData.map((c,i)=>(
                <div key={c.l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{fontSize:12,color:"#4a4a52",width:120,flexShrink:0}}>{c.l}</div>
                  <div style={{flex:1,height:7,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:`${c.max>0?Math.round((c.v/c.max)*100):0}%`,height:"100%",background:c.c,borderRadius:4,transition:"width 1.4s cubic-bezier(0.4,0,0.2,1)",boxShadow:`0 0 6px ${c.c}55`}}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:"#4a4a52",width:55,textAlign:"right"}}>{c.v>0?tbFmt(c.v):"—"}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:14,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Trip completion</div>
                <div style={{display:"flex",alignItems:"center",gap:18}}>
                  <TBDonut pct={pp} color="#f59e0b"/>
                  <div>
                    {[{dot:"#22c55e",l:"Booked",v:tbFmt(bookedTotal)},{dot:"#3b82f6",l:"Actual paid",v:tbFmt(tots.actual)},{dot:"#d1d5db",l:"Remaining",v:tbFmt(Math.max(0,tots.low-tots.actual))},{dot:"#22c55e",l:"Saved",v:"~"+tbFmt(tots.saved)}].map(r=>(
                      <div key={r.l} style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
                        <div style={{width:8,height:8,borderRadius:2,background:r.dot,flexShrink:0}}/>
                        <div style={{flex:1,fontSize:12,color:"#4a4a52"}}>{r.l}</div>
                        <div style={{fontSize:12,color:r.dot,fontWeight:600}}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:14,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Budget vs actual</div>
                {[{l:"Budget (low)",v:tots.low,max:tots.low,trackBg:"#f1f5f9",fill:"#d1d5db"},{l:"Actual paid",v:tots.actual,max:tots.low,trackBg:"#dbeafe",fill:"#3b82f6"},{l:"Saved",v:tots.saved,max:tots.low,trackBg:"#dcfce7",fill:"#22c55e"}].map((b,i)=>(
                  <div key={b.l} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{fontSize:12,color:"#4a4a52",width:95,flexShrink:0}}>{b.l}</div>
                    <div style={{flex:1,height:7,background:b.trackBg,borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${Math.min(Math.round((b.v/b.max)*100),100)}%`,height:"100%",background:b.fill,borderRadius:4,transition:"width 1.4s cubic-bezier(0.4,0,0.2,1)",boxShadow:`0 0 8px ${b.fill}66`}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:b.fill,width:55,textAlign:"right"}}>{tbFmt(b.v)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE TAB */}
      {tab==="archive"&&(
        <div style={{animation:"tbFadeIn 0.3s ease"}}>
          {archive.length===0
            ?<div style={{textAlign:"center",padding:"60px 20px",fontSize:13,color:"#78788a",lineHeight:2}}>No archived trips yet.<br/>Complete a trip and click Archive.<br/>Your permanent travel history in FM.</div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {archive.map((a,i)=>(
                  <div key={a.id}
                    style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:18,position:"relative",overflow:"hidden",transition:"all 0.25s",cursor:"default"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#f59e0b,#22c55e)"}}/>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#1a1a1a"}}>{a.trip}</div>
                    <div style={{fontSize:11,color:"#78788a",marginBottom:12}}>{a.dates} · Archived {a.archivedAt}</div>
                    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:12}}>
                      {[["Budget",tbFmt(a.budget),"#4a4a52"],["Actual",tbFmt(a.actual),"#1d4ed8"],["Saved","~"+tbFmt(a.saved),"#15803d"],[a.actual<=a.budget?"Under":"Over",tbFmt(Math.abs(a.budget-a.actual)),a.actual<=a.budget?"#15803d":"#dc2626"]].map(([l,v,c])=>(
                        <div key={l}><div style={{fontSize:10,color:"#78788a",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2,fontWeight:600}}>{l}</div><div style={{fontSize:13,color:c,fontWeight:700}}>{v}</div></div>
                      ))}
                    </div>
                    {a.state?.retro?.worked&&<div style={{fontSize:12,color:"#4a4a52",borderTop:"0.5px solid rgba(0,0,0,0.08)",paddingTop:8,marginBottom:10,lineHeight:1.5}}><span style={{color:"#15803d",fontWeight:600}}>Worked: </span>{a.state.retro.worked.substring(0,80)}...</div>}
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setActuals(a.state.actuals||{});setTab("budget");showToast("Loaded");}} style={{background:"#f8f7f5",border:"0.5px solid rgba(0,0,0,0.1)",borderRadius:6,padding:"5px 12px",fontFamily:"inherit",fontSize:12,color:"#4a4a52",cursor:"pointer",fontWeight:500}}>Load</button>
                      <button onClick={()=>safeTravelAction("Delete archive",()=>{const n=archive.filter((_,j)=>j!==i);setArchive(n);localStorage.setItem(TB_AK,JSON.stringify(n));safeTravelNotice("Deleted","danger");})} style={{background:"#fee2e2",border:"0.5px solid rgba(220,38,38,0.2)",borderRadius:6,padding:"5px 12px",fontFamily:"inherit",fontSize:12,color:"#dc2626",cursor:"pointer",fontWeight:500}}>Delete</button>
                    </div>
                  </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* RETRO TAB */}
      {tab==="retro"&&(
        <div style={{animation:"tbFadeIn 0.3s ease"}}>
          <div style={{background:"#faeeda",border:"1px solid #ef9f27",borderRadius:12,padding:"15px 18px",marginBottom:18,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontSize:18,flexShrink:0}}>◆</div>
            <div>
              <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#633806",fontWeight:700,marginBottom:4}}>Why this matters</div>
              <div style={{fontSize:13,color:"#1c1917",lineHeight:1.7}}>Fill this in after the trip. This becomes the foundation for Travel Builder Template v2. <strong style={{color:"#412402"}}>Every trip makes FM smarter.</strong></div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
            {[{key:"worked",l:"What worked well",a:T.green,ph:"e.g. Marriott skybridge was perfect, buddy pass saved $350..."},{key:"improve",l:"What to improve",a:T.amber,ph:"e.g. Book flights earlier, food budget for Jun 14 was tight..."},{key:"next",l:"Do differently next trip",a:T.blue,ph:"e.g. Always Wanna Get Away Plus, add activity budget line..."}].map(b=>(
                <div key={b.key}
                  style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:16}}>
                  <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:b.a,fontWeight:700,marginBottom:10}}>{b.l}</div>
                  <textarea value={retro[b.key]||""} onChange={e=>safeTravelAction("Save retrospective",()=>{const n={...retro,[b.key]:e.target.value};setRetro(n);localStorage.setItem(TB_SK+"_r",JSON.stringify(n));})} placeholder={b.ph}
                    style={{width:"100%",background:"transparent",border:"none",color:"#1a1a1a",fontFamily:"inherit",fontSize:13,lineHeight:1.7,outline:"none",padding:"4px 0",minHeight:80,resize:"vertical"}}/>
                </div>
            ))}
          </div>
          <div style={{background:"#ffffff",border:"0.5px solid rgba(0,0,0,0.08)",borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:10,letterSpacing:"0.07em",textTransform:"uppercase",color:"#78788a",fontWeight:700,marginBottom:12,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,0.08)"}}>Final comparison  estimated vs actual</div>
            <div style={{fontSize:13,color:"#4a4a52",lineHeight:2.2}}>
              {[["Estimated budget (low)",tbFmt(tots.low),"#1a1a1a"],["Actual spent so far",tbFmt(tots.actual),"#1d4ed8"],["Difference",tots.low>=tots.actual?"Under by "+tbFmt(tots.low-tots.actual):"Over by "+tbFmt(tots.actual-tots.low),tots.low>=tots.actual?"#15803d":"#dc2626"],["Hotel savings (MM4)","~$170","#15803d"],["Total savings captured","~"+tbFmt(tots.saved)+"+","#15803d"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",borderBottom:"0.5px solid rgba(0,0,0,0.06)",paddingBottom:2}}>
                  <span>{l}</span><strong style={{color:c}}>{v}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {newTripModal&&(
        <div role="dialog" aria-modal="true" aria-label="New Trip Builder" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.surface,border:`1px solid ${T.borderHi}`,borderRadius:10,padding:26,maxWidth:420,width:"90%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:10,color:T.white}}>New Trip Builder</div>
            <div style={{fontFamily:"monospace",fontSize:11,color:T.muted,lineHeight:1.8,marginBottom:14}}>Trip creation is being staged safely. Starting the draft will replace the active trip locally.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Trip Name
                <input value={newTripName} onChange={e=>setNewTripName(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Destination
                <input value={newTripDestination} onChange={e=>setNewTripDestination(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Start Date
                <input type="date" value={newTripStartDate} onChange={e=>setNewTripStartDate(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>End Date
                <input type="date" value={newTripEndDate} onChange={e=>setNewTripEndDate(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Travelers
                <input value={newTripTravelers} onChange={e=>setNewTripTravelers(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Budget
                <input inputMode="decimal" value={newTripBudget} onChange={e=>setNewTripBudget(e.target.value)} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11}} />
              </label>
              <label style={{gridColumn:"1 / -1",display:"flex",flexDirection:"column",gap:5,fontFamily:"monospace",fontSize:10,color:T.muted}}>Purpose / Notes
                <textarea value={newTripPurpose} onChange={e=>setNewTripPurpose(e.target.value)} rows={3} style={{background:"#101014",border:`1px solid ${T.dim}`,borderRadius:5,padding:"8px 10px",color:T.white,fontFamily:"inherit",fontSize:11,resize:"vertical"}} />
              </label>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setNewTripModal(false)} style={{background:"transparent",border:`1px solid ${T.dim}`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,color:T.muted,cursor:"pointer"}}>Close</button>
              <button onClick={continueNewTripPreview} style={{background:T.redDim,border:`1px solid ${T.red}40`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:T.red,cursor:"pointer"}}>Start Active Draft</button>
            </div>
          </div>
        </div>
      )}

      {resetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.surface,border:`1px solid ${T.borderHi}`,borderRadius:10,padding:26,maxWidth:420,width:"90%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:10,color:T.white}}>Reset Travel Builder</div>
            <div style={{fontFamily:"monospace",fontSize:11,color:T.muted,lineHeight:1.8,marginBottom:22}}>Clears all actual cost entries. <strong style={{color:T.white}}>Trip details and estimates stay intact</strong> — ready as a clean template.</div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setResetModal(false)} style={{background:"transparent",border:`1px solid ${T.dim}`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,color:T.muted,cursor:"pointer"}}>Cancel</button>
              <button onClick={doReset} style={{background:T.redDim,border:`1px solid ${T.red}40`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:T.red,cursor:"pointer"}}>Reset Actuals</button>
            </div>
          </div>
        </div>
      )}

      {archiveModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.surface,border:`1px solid ${T.borderHi}`,borderRadius:10,padding:26,maxWidth:420,width:"90%"}}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:10,color:T.white}}>Archive This Trip</div>
            <div style={{fontFamily:"monospace",fontSize:11,color:T.muted,lineHeight:1.8,marginBottom:22}}>Saving <strong style={{color:T.white}}>{activeTripTitle}</strong> to archive with all data, actuals, and retro notes.</div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setArchiveModal(false)} style={{background:"transparent",border:`1px solid ${T.dim}`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,color:T.muted,cursor:"pointer"}}>Cancel</button>
              <button onClick={doArchive} style={{background:T.greenDim,border:`1px solid ${T.green}40`,borderRadius:5,padding:"7px 14px",fontFamily:"inherit",fontSize:11,fontWeight:700,color:T.green,cursor:"pointer"}}>Archive Trip</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:28,right:28,background:"#ffffff",border:`0.5px solid ${toast.type==="success"?"#22c55e":toast.type==="danger"?"#ef4444":"#f59e0b"}`,borderRadius:10,padding:"12px 18px",fontFamily:"inherit",fontSize:13,fontWeight:600,color:toast.type==="success"?"#15803d":toast.type==="danger"?"#dc2626":"#b45309",zIndex:600,boxShadow:"0 4px 20px rgba(0,0,0,0.1)",animation:"tbFadeIn 0.25s"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}


// ─── Per-Business Todo List ───────────────────────────────────────────────────
function BizTodoList({ biz }) {
  const [todos, setTodos] = useState(biz.todos || []);
  const [input, setInput] = useState("");

  const toggle = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const add = () => {
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now().toString(), text: input.trim(), done: false }]);
    setInput("");
  };

  const open = todos.filter(t => !t.done).length;
  const done = todos.filter(t => t.done).length;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: biz.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>{biz.name} To-Do</span>
        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: biz.dim, color: biz.color, fontWeight: 700 }}>{open} open</span>
        {done > 0 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: T.greenDim, color: T.green, fontWeight: 700 }}>{done} done</span>}
      </div>
      <div style={{ display: "grid", gap: 5, marginBottom: 10 }}>
        {todos.map(t => (
          <div key={t.id} onClick={() => toggle(t.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: t.done ? T.dim : T.surface, borderRadius: 8,
            border: `1px solid ${t.done ? T.border : biz.color + "20"}`,
            cursor: "pointer", transition: "all 0.15s", opacity: t.done ? 0.5 : 1,
          }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${t.done ? T.green : biz.color}`, background: t.done ? T.greenDim : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {t.done && <span style={{ fontSize: 9, color: T.green, fontWeight: 800 }}>✓</span>}
            </div>
            <span style={{ fontSize: 12, color: t.done ? T.muted : T.white, textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder={`+ Add ${biz.name} task...`}
          style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", color: T.white, fontSize: 12, fontFamily: "inherit", outline: "none" }}
          onFocus={e => { e.target.style.borderColor = biz.color + "50"; }}
          onBlur={e => { e.target.style.borderColor = T.border; }}
        />
        <button onClick={add} disabled={!input.trim()} style={{ background: input.trim() ? biz.dim : T.dim, border: `1px solid ${input.trim() ? biz.color + "40" : T.border}`, color: input.trim() ? biz.color : T.muted, borderRadius: 8, padding: "6px 12px", cursor: input.trim() ? "pointer" : "default", fontSize: 11, fontWeight: 700 }}>Add</button>
      </div>
    </div>
  );
}


// ─── Settings Panel ───────────────────────────────────────────────────────────
const SETTINGS_GROUPS = [
  { label: "Calendar", keys: ["google_calendar_id"] },
  { label: "Notifications", keys: ["notification_email_1", "notification_email_2", "notification_email_3"] },
  { label: "Schedule", keys: ["morning_brief_time", "working_hours_start", "working_hours_end"] },
  { label: "Appearance", keys: ["os_accent_color"] },
];

function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({});
  const [editing, setEditing] = useState({});
  const [saved, setSaved] = useState({});
  const API = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => { if (d.ok) setSettings(d.settings); })
      .catch(() => {});
  }, [API]);

  async function save(key) {
    const value = editing[key] ?? settings[key] ?? "";
    try {
      const r = await fetch(`${API}/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (r.ok) {
        setSettings(s => ({ ...s, [key]: value }));
        setSaved(s => ({ ...s, [key]: true }));
        setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 1800);
      }
    } catch { /* noop */ }
    setEditing(e => { const n = { ...e }; delete n[key]; return n; });
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      display: "flex", justifyContent: "flex-end",
      background: "rgba(0,0,0,0.55)",
      animation: "fadeIn 0.18s ease",
    }} onClick={onClose}>
      <div style={{
        width: 360, height: "100%", background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.white, letterSpacing: "0.04em" }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {SETTINGS_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{group.label}</div>
              {group.keys.map(key => {
                const val = editing[key] !== undefined ? editing[key] : (settings[key] ?? "");
                return (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, letterSpacing: "0.06em" }}>{key.replace(/_/g, " ")}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={val}
                        onChange={e => setEditing(ed => ({ ...ed, [key]: e.target.value }))}
                        style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", color: T.white, fontSize: 12, fontFamily: "inherit", outline: "none" }}
                        onFocus={e => { e.target.style.borderColor = T.gold + "60"; }}
                        onBlur={e => { e.target.style.borderColor = T.border; }}
                      />
                      <button onClick={() => save(key)} style={{
                        background: saved[key] ? T.goldDim : T.dim, border: `1px solid ${saved[key] ? T.gold + "60" : T.border}`,
                        color: saved[key] ? T.gold : T.muted, borderRadius: 6, padding: "6px 10px",
                        cursor: "pointer", fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>{saved[key] ? "✓" : "Save"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MotesartOS() {
  const [open, setOpen] = useState(typeof window !== "undefined" && window.innerWidth > 768);
  const [activeBiz, setActiveBiz] = useState("e7a");
  const [showBizSwitcher, setShowBizSwitcher] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [reviseInputId, setReviseInputId] = useState(null);
  const [reviseReason, setReviseReason] = useState('');
  const [topTab, setTopTab] = useState("overview");
  const { approvals, approve: _approveBackend, revise: _reviseBackend, undo: _undoBackend } = useApprovals();
  const { tasks: dispatchTasks } = useDispatchTasks(activeBiz);

  const isPersonal = activeBiz === "personal";
  const isBook = activeBiz === "book";
  const isFM = activeBiz === "fm";
  const isJean = isPersonal && topTab === "jean";
  const isSpecialView = isPersonal || isBook;
  const biz = isPersonal ? { id: "personal", name: "Personal", full: "Denarius Motes", color: T.green, dim: T.greenDim, icon: "◉", notifications: 1, artists: [], brief: PERSONAL.brief } : (BUSINESSES.find(b => b.id === activeBiz) || BUSINESSES[0]);
  const tabs = isSpecialView ? ["overview"] : ["overview", "notifications", "approvals", ...(isFM ? ["travel builder", "piano"] : []), ...(biz.artists.length > 0 ? ["artists"] : [])];

  function switchBiz(id) { setActiveBiz(id); setSelectedArtist(null); setActiveTab("overview"); setTopTab("overview"); }
  function openTravelBuilder() { setActiveBiz("fm"); setSelectedArtist(null); setActiveTab("travel builder"); setTopTab("overview"); }
  function openMusicLessons() { setActiveBiz("fm"); setSelectedArtist(null); setActiveTab("piano"); setTopTab("overview"); }

  // Phase 4A — approval status is now on each item from useApprovals

  function handleApprove(contentId) {
    _approveBackend(contentId);
    setPreviewItem(null);
    try {
      const item = approvals.find(a => (a.content_id || String(a.id)) === contentId);
      window.dispatchEvent(new CustomEvent("approval-ready-to-schedule", { detail: { item } }));
    } catch { /* noop */ }
  }

  function handleRevise(contentId) {
    setPreviewItem(null);
    setReviseInputId(contentId);
    setReviseReason('');
  }

  function handleReviseSubmit(contentId) {
    if (!reviseReason.trim()) return;
    _reviseBackend(contentId, reviseReason.trim());
    setReviseInputId(null);
    setReviseReason('');
  }

  function handleUndo(contentId) {
    _undoBackend(contentId);
    setPreviewItem(null);
  }

  return (
    <div className="os-root" style={{ display: "flex", height: "100dvh", background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif", color: T.white, overflow: "hidden" }}>

      <Sidebar activeBiz={activeBiz} onSelect={switchBiz} open={open} onToggle={() => setOpen(o => !o)} onPAOpen={() => setChatOpen(true)} onDispatchOpen={() => setDispatchOpen(true)} onSelectPersonal={() => { setActiveBiz("personal"); setActiveTab("overview"); }} onPersonalActive={activeBiz === "personal"} onTravelBuilderOpen={openTravelBuilder} onMusicLessonsOpen={openMusicLessons} onSettingsOpen={() => setSettingsOpen(true)} />

      <div className="os-main" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ borderBottom: `1px solid ${T.border}`, padding: "12px 22px", background: T.surface, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="os-back-btn" onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, minWidth: 36, minHeight: 36, paddingTop: 0, paddingLeft: 0, flexShrink: 0 }}>‹</button>
            <div style={{ width: 3, height: 22, background: biz.color, borderRadius: 2 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                onClick={() => setShowBizSwitcher(!showBizSwitcher)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.3px" }}>
                  {biz.name} <span style={{ fontSize: 12, color: "#888" }}>▾</span>
                </div>
              </button>
              <div style={{ fontSize: 11, color: "#666" }}>MOTESART OS · {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}</div>
              {showBizSwitcher && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "#1a1a1a", borderTop: "1px solid #333",
                  borderBottom: "1px solid #333", zIndex: 200,
                  display: "flex", flexDirection: "column", padding: "8px 0"
                }}>
                  {BUSINESSES.map(b => (
                    <button key={b.id} onClick={() => { switchBiz(b.id); setShowBizSwitcher(false); }}
                      style={{
                        background: activeBiz === b.id ? "#2a2a1a" : "none",
                        border: "none", padding: "12px 20px", cursor: "pointer",
                        textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                        borderLeft: activeBiz === b.id ? `3px solid ${b.color}` : "3px solid transparent"
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, display: "inline-block" }}></span>
                      <span style={{ fontSize: 14, color: "#fff", fontWeight: activeBiz === b.id ? 600 : 400 }}>{b.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isPersonal && (
              <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                {["overview", "jean"].map(tab => (
                  <button key={tab} onClick={() => setTopTab(tab)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "all 0.18s", textTransform: "capitalize",
                    background: topTab === tab ? "rgba(255,255,255,0.10)" : "transparent",
                    border: topTab === tab ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
                    color: topTab === tab ? "#ffffff" : "#5a6a7a",
                  }}>{tab === "jean" ? "Jean" : "Overview"}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.goldDim, border: `1px solid ${T.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: T.gold, fontWeight: 800, cursor: "pointer" }}>D</div>
              {biz.notifications > 0 && (
                <div style={{ position: "absolute", top: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: T.red, border: `2px solid ${T.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff", fontWeight: 900 }}>{biz.notifications}</div>
              )}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 2, padding: "9px 22px 0", borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: activeTab === t ? biz.dim : "transparent",
              border: activeTab === t ? `1px solid ${biz.color}35` : "1px solid transparent",
              borderBottom: activeTab === t ? `1px solid ${T.bg}` : "1px solid transparent",
              color: activeTab === t ? biz.color : T.muted,
              padding: "6px 13px", borderRadius: "5px 5px 0 0", cursor: "pointer",
              fontSize: 11, fontWeight: 600, textTransform: "capitalize",
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}>{t === "piano" ? "Music Lessons" : t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="os-content-area" style={{ flex: 1, overflowY: "auto", padding: 22 }}>

          {/* Book Manager Executive Dashboard */}
          {isBook && (
            <div className="os-book-panel" style={{ margin: -22, height: "calc(100% + 44px)", display: "flex", flexDirection: "column" }}>
              <BookManagerPanel />
            </div>
          )}

          {/* FM Travel Builder Tab */}
          {isFM && activeTab === "travel builder" && (
            <div className="os-travel-panel"><TravelBuilderPanel /></div>
          )}

          {/* FM Music Lessons Tab */}
          {isFM && activeTab === "piano" && (
            <div className="os-piano-panel"><PianoLessonsSection /></div>
          )}

          {/* Personal Main View */}
          {isPersonal && !isJean && (
            <div className="os-personal-view"><PersonalMainView
              onScheduleTask={(task) => {
                setChatOpen(true);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("pa-schedule-task", { detail: task }));
                }, 100);
              }}
              onOpenFM={() => { setActiveBiz("fm"); setActiveTab("overview"); }}
              onAskFM={() => {
                quickDispatch("Finance brief requested", "finance", "fm-executive");
                setChatOpen(true);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("pa-schedule-task", { detail: "Give me a finance brief" }));
                }, 100);
              }}
            /></div>
          )}

          {/* Jean Main View */}
          {isPersonal && isJean && (
            <JeanMainView
              onScheduleTask={(task) => {
                setChatOpen(true);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("pa-schedule-task", { detail: task }));
                }, 100);
              }}
            />
          )}

          {/* PA Brief -- always visible on overview */}
          {!isSpecialView && activeTab === "overview" && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${biz.color}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: biz.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>◉ MYA Brief</span>
                <Badge text={biz.name} color={biz.color} dim={biz.dim} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button style={{ background: T.dim, border: `1px solid ${T.border}`, color: T.muted, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Read</button>
                  <button style={{ background: biz.dim, border: `1px solid ${biz.color}40`, color: biz.color, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Listen</button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: T.white, lineHeight: 1.65 }}>{biz.brief}</p>
            </div>
          )}

          {!isSpecialView && activeTab === "overview" && isFM && (
            <>
              <SmartMonthAlignmentCheckPanel />
              <SmartMonthPreviewPanel />
              <MTSubscriptionsPreviewPanel />
              <CapitalOneLedgerPreviewPanel />
              <SmartMonthSafetyGate />
            </>
          )}

          {/* Phase 3B — SOM Executive Tile (SOM overview only) */}
          {!isSpecialView && activeTab === "overview" && biz.id === "som" && (
            <ExecutiveTile
              executive="som"
              label="SOM Executive"
              color={T.blue}
              dim={T.blueDim}
              description="Backend worker. Picks up the next pending SOM task, writes an audit trail to TASK_UPDATES, and patches MASTER_TASKS. Never marks anything done."
            />
          )}

          {/* ── App Launch Cards — Phase 3C.B — LOCK 3: SOM + Converter only ── */}
          {!isSpecialView && activeTab === "overview" && biz.id === "som" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <AppLauncherCard appId="som-app" />
              <AppLauncherCard appId="motesart-converter" />
            </div>
          )}

          {/* ── Per-Biz To-Do List — overview only ── */}
          {!isSpecialView && activeTab === "overview" && biz.todos && biz.todos.length > 0 && (
            <BizTodoList biz={biz} key={biz.id} />
          )}

          {/* Notifications */}
          {!isSpecialView && (activeTab === "overview" || activeTab === "notifications") && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 9 }}>Notifications</div>
              <div style={{ display: "grid", gap: 5 }}>
                {DEMO_NOTIFICATIONS.filter(n => activeTab === "notifications" ? true : n.biz === biz.name).slice(0, activeTab === "notifications" ? 99 : 3).map((n, idx) => {
                  const col = LEVEL_C[n.level] || LEVEL_C.low;
                  return (
                    <div key={n.id} style={{
                      background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${col.base}`,
                      borderRadius: "0 12px 12px 0", padding: "8px 14px", display: "flex", alignItems: "center", gap: 12,
                      backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      animation: `slideInRight 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 0.07}s both`,
                    }}>
                      <span style={{ flex: 1, fontSize: 12, color: T.white, lineHeight: 1.5 }}>{n.text}</span>
                      <Badge text={n.biz} color={col.base} dim={col.dim} />
                      <span style={{ fontSize: 10, color: T.muted, flexShrink: 0 }}>{n.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ready to Schedule — Phase 4C */}
          {!isSpecialView && (activeTab === "overview" || activeTab === "approvals") && (
            <ReadyToScheduleSection
              items={approvals.filter(a =>
                a.biz === biz.id &&
                a.ready_to_schedule === true &&
                a.item != null &&
                a.biz != null
              )}
            />
          )}

          {/* Active Tasks — Phase 5A */}
          {!isSpecialView && activeTab === "overview" && (
            <ActiveTasksSection tasks={dispatchTasks} />
          )}

          {/* Approvals — Phase 3C.A */}
          {!isSpecialView && (activeTab === "overview" || activeTab === "approvals") && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 9 }}>Needs Approval</div>
              <div style={{ display: "grid", gap: 6 }}>
                {approvals.filter(a => a.biz === biz.id).map(a => {
                  const cid = a.content_id || String(a.id);
                  const status = a.approval_status || "pending";
                  const done = status === "approved";
                  const revise = status === "revision_requested";
                  const rowColor = done ? T.green : revise ? T.amber : null;
                  const rowBg    = done ? T.greenDim : revise ? T.amberDim : T.card;
                  const isPending = !done && !revise;

                  return (
                    <div
                      key={a.id}
                      onClick={() => { if (reviseInputId !== cid) setPreviewItem(a); }}
                      style={{
                        background: rowBg,
                        border: `1px solid ${rowColor ? rowColor + "35" : T.border}`,
                        borderRadius: 12, padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                        opacity: done ? 0.75 : 1,
                        cursor: "pointer",
                        transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 5, marginBottom: 4, alignItems: "center", flexWrap: "wrap" }}>
                          <Badge text={a.type} color={T.blue} dim={T.blueDim} />
                          <Badge text={a.artist} color={T.gold} dim={T.goldDim} />
                          {/* LOCK 4 — visible Preview cue */}
                          <span style={{
                            fontSize: 9,
                            color: T.gold,
                            background: T.goldDim,
                            border: `1px solid ${T.gold}30`,
                            padding: "3px 7px",
                            borderRadius: 4,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}>◉ Preview</span>
                          {isPending && (
                            <span style={{
                              marginLeft: "auto",
                              fontSize: 9,
                              color: T.muted,
                              fontStyle: "italic",
                              letterSpacing: "0.04em",
                            }}>Click to preview →</span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: T.white }}>{a.item}</span>
                        {revise && a.revision_reason && (
                          <div style={{ fontSize: 11, color: T.amber, marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>↺ {a.revision_reason}</div>
                        )}
                      </div>
                      {done ? (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: T.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ animation: "checkPop 0.35s cubic-bezier(0.22,1,0.36,1) both", display: "inline-block" }}>✓</span> Approved
                          </span>
                          <button onClick={() => handleUndo(cid)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em" }}>Undo</button>
                        </div>
                      ) : revise ? (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: T.amber, fontWeight: 700 }}>↺ Revision</span>
                          <button onClick={() => handleUndo(cid)} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em" }}>Undo</button>
                        </div>
                      ) : (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          <button onClick={() => handleApprove(cid)} style={{ background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Approve</button>
                          <button onClick={() => handleRevise(cid)} style={{ background: T.redDim, border: `1px solid ${T.red}40`, color: T.red, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 10 }}>Revise</button>
                        </div>
                      )}
                      {reviseInputId === cid && (
                        <div onClick={e => e.stopPropagation()} style={{ width: "100%", marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                          <textarea
                            autoFocus
                            value={reviseReason}
                            onChange={e => setReviseReason(e.target.value)}
                            placeholder="Describe what needs to be revised..."
                            rows={2}
                            style={{
                              width: "100%", boxSizing: "border-box",
                              background: T.dim, border: `1px solid ${T.amber}40`, borderRadius: 6,
                              color: T.white, fontSize: 12, padding: "8px 10px",
                              fontFamily: "inherit", resize: "none", outline: "none",
                            }}
                          />
                          <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => { setReviseInputId(null); setReviseReason(""); }}
                              style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                            >Cancel</button>
                            <button
                              onClick={() => handleReviseSubmit(cid)}
                              style={{ background: T.amberDim, border: `1px solid ${T.amber}40`, color: T.amber, borderRadius: 5, padding: "4px 12px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                            >Send Revision</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Artist roster */}
          {!isSpecialView && (activeTab === "overview" || activeTab === "artists") && biz.artists.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 9 }}>Artist Roster</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {biz.artists.map(a => (
                  <button key={a.id} onClick={() => setSelectedArtist(a)} className="os-stat-card" style={{
                    background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14,
                    cursor: "pointer", textAlign: "left", transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
                    backdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${a.color}45`; e.currentTarget.style.background = T.cardHi; e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.borderImage = `linear-gradient(135deg, ${a.color}50, transparent) 1`; e.currentTarget.style.borderImageSlice = "1"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderImage = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Pip color={a.color} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.white, flex: 1 }}>{a.name}</span>
                      <Badge text={a.mode} color={a.color} dim={`${a.color}18`} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{a.stage}</span>
                        <span style={{ fontSize: 10, color: a.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}><AnimatedNumber value={a.campaign.pct} suffix="%" /></span>
                      </div>
                      <Bar pct={a.campaign.pct} color={a.color} />
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{a.campaign.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {selectedArtist && <ArtistPanel artist={selectedArtist} onClose={() => setSelectedArtist(null)} />}
      {personalOpen && <PersonalPanel onClose={() => setPersonalOpen(false)} onScheduleTask={(task) => {
        setPersonalOpen(false);
        setChatOpen(true);
        // Inject scheduling request into PA Agent chat after a tick
        setTimeout(() => {
          const event = new CustomEvent("pa-schedule-task", { detail: task });
          window.dispatchEvent(event);
        }, 100);
      }} />}
      {chatOpen && <PAAgentChat onClose={() => setChatOpen(false)} activeBiz={activeBiz} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Phase 3B — Dispatch panel (opened from Sidebar "Dispatch" button) */}
      <MyaDispatchPanel
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        actionBarSlot={<DispatchExecutiveActions />}
      />

      {/* Phase 3C.A — Approval preview modal */}
      <ApprovalPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onApprove={handleApprove}
        onRevise={handleRevise}
        onUndo={handleUndo}
        status={previewItem ? (previewItem.approval_status || "pending") : "pending"}
      />

      {/* Floating MYA pill button */}
      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} className="os-pa-pill" style={{
          position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 20px) + 76px)", right: "max(24px, env(safe-area-inset-right))", zIndex: 150,
          background: `linear-gradient(135deg, ${T.goldDim}, rgba(201,168,76,0.18))`,
          border: `1px solid ${T.borderHi}`,
          borderRadius: "50%", width: 50, height: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: T.gold,
          boxShadow: "0 4px 24px rgba(201,168,76,0.25)",
          transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          animation: "goldPulse 2.5s ease-in-out infinite",
        }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 36px rgba(201,168,76,0.5)"; e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.animationPlayState = "paused"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(201,168,76,0.25)"; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.animationPlayState = "running"; }}
          title="Open MYA"
        ><span style={{ fontSize: 22 }}>◉</span></button>
      )}

      <style>{`
        @keyframes goldPulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(201,168,76,0.25); }
          50% { box-shadow: 0 4px 32px rgba(201,168,76,0.45), 0 0 12px rgba(201,168,76,0.15); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes checkPop {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes barFillIn {
          from { width: 0%; }
        }
        @keyframes criticalPulse {
          0%, 100% { border-left-color: #FF4444; }
          50% { border-left-color: #FF444466; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes arcFill {
          from { stroke-dasharray: 0 113.1; }
        }

        .os-back-btn { display: none; }

        /* ─── Mobile: sidebar → bottom tab bar ─── */
        @media (max-width: 700px) {
          .os-root {
            flex-direction: column !important;
          }
          .os-sidebar {
            width: 100% !important;
            height: calc(56px + env(safe-area-inset-bottom)) !important;
            flex-direction: row !important;
            border-right: none !important;
            border-top: 1px solid rgba(255,255,255,0.055) !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 100 !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding-bottom: env(safe-area-inset-bottom, 16px) !important;
            align-items: center !important;
          }
          .os-sidebar > *:first-child,
          .os-sidebar > *:nth-child(2) { display: none !important; }
          .os-sidebar > *:nth-child(3) {
            flex-direction: row !important;
            padding: 4px 8px !important;
            flex: 1 !important;
            overflow-x: auto !important;
            display: none !important;
            align-items: center !important;
            height: 100% !important;
            white-space: nowrap !important;
          }
          .os-sidebar > *:nth-child(3) button {
            margin-bottom: 0 !important;
            margin-right: 2px !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            white-space: nowrap !important;
            min-width: 44px !important;
            min-height: 44px !important;
          }
          .os-sidebar > *:last-child {
            flex-direction: row !important;
            border-top: none !important;
            border-left: 1px solid rgba(255,255,255,0.055) !important;
            padding: 4px 8px !important;
            gap: 2px !important;
            align-items: center !important;
            height: 100% !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            flex: 1 !important;
            justify-content: space-around !important;
          }
          .os-main {
            padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 64px) !important;
          }
          .os-main .os-content-area {
            padding: 14px !important;
          }
          .os-book-panel {
            height: calc(100dvh - calc(56px + env(safe-area-inset-bottom, 20px))) !important;
            margin: 0 !important;
          }
          .os-personal-view, .os-travel-panel {
            padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 64px) !important;
          }
          .os-pa-pill {
            bottom: calc(env(safe-area-inset-bottom, 20px) + 64px) !important;
            right: max(14px, env(safe-area-inset-right)) !important;
            font-size: 11px !important;
            padding: 10px 16px 10px 14px !important;
          }
          .os-stat-card {
            min-width: 0 !important;
          }
          .os-content-area {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }
          .os-content-area > * {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .os-topbar-title {
            font-size: 13px !important;
          }
          .os-back-btn { display: flex !important; }
        }

        @media (max-width: 480px) {
          .os-main .os-content-area {
            padding: 10px !important;
          }
          .sg-summary-count {
            display: none !important;
          }
          .os-pa-pill {
            font-size: 10px !important;
            padding: 8px 14px 8px 12px !important;
            bottom: calc(64px + env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Phase 3B — Secondary run button inside dispatch panel action bar ───
function ReadyToScheduleSection({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: T.green, fontWeight: 700,
        letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 9,
      }}>✓ Ready to Schedule</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map(a => (
          <div key={a.content_id} style={{
            background: T.card,
            border: `1px solid ${T.green}35`,
            borderLeft: `3px solid ${T.green}`,
            borderRadius: 12,
            padding: "10px 14px",
            backdropFilter: "blur(12px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Badge text={a.type} color={T.blue} dim={T.blueDim} />
              <Badge text={a.artist} color={T.gold} dim={T.goldDim} />
              <span style={{
                marginLeft: "auto", fontSize: 9, fontWeight: 700, color: T.green,
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>✓ Approved</span>
            </div>
            <div style={{
              fontSize: 13, color: T.white, fontWeight: 600,
              letterSpacing: "-0.01em", lineHeight: 1.4,
              marginBottom: a.caption ? 4 : 0,
            }}>{a.item}</div>
            {a.caption && (
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                {a.caption.length > 100 ? a.caption.substring(0, 100) + "…" : a.caption}
              </div>
            )}
            {a.approved_at && (
              <div style={{ fontSize: 9, color: T.muted, marginTop: 6, letterSpacing: "0.06em" }}>
                Approved {new Date(a.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DispatchExecutiveActions() {
  const { run, loading } = useExecutiveRun("som");
  const { available } = useExecutiveHealth();
  const toast = useToast();

  const offline = available === false;
  const disabled = loading || offline || available === null;

  const onRun = async () => {
    const result = await run();
    if (result) {
      toast.success(
        `SOM Executive → ${result.new_status}`,
        result.action_taken || "Run complete",
        { accent: "#5a8fc9" }
      );
    } else {
      toast.error("SOM Executive failed", "Check Railway logs with grep [SOM]");
    }
  };

  return (
    <button
      onClick={offline ? undefined : onRun}
      disabled={disabled}
      title={offline ? "Backend offline" : undefined}
      style={{
        background: disabled ? "#1c1c22" : offline ? "rgba(201,90,90,0.10)" : "rgba(90,143,201,0.12)",
        border: `1px solid ${offline ? "rgba(201,90,90,0.40)" : "rgba(90,143,201,0.40)"}`,
        color: disabled ? "#52525e" : offline ? "#c95a5a" : "#5a8fc9",
        borderRadius: 6,
        padding: "6px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {offline ? "⚠ SOM Offline" : loading ? "◌ Running…" : "▶ Run SOM"}
    </button>
  );
}
/* build: 1777906590 */
