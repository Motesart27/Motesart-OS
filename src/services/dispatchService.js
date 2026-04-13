// ══════════════════════════════════════════════════════
// MYA DISPATCH SERVICE
// Portable module — no React dependency
// Handles: routing config, data persistence, AI classification,
//          receipt generation, offline queue
// ══════════════════════════════════════════════════════

// ── ROUTING CONFIG (hardcoded Phase 1) ───────────────

export const ROUTES = {
  pa:      { label: 'PA Agent',        icon: '🗂', desc: 'Personal assistant tasks, scheduling, reminders, errands' },
  book:    { label: 'Book Manager',    icon: '📚', desc: 'Book project tasks, writing, editing, publishing' },
  som:     { label: 'SOM',             icon: '🎵', desc: 'Music, audio, Ma Sol, production, church gigs' },
  claude:  { label: 'Personal Claude', icon: '🧠', desc: 'AI research, analysis, brainstorming, deep questions' },
  os:      { label: 'Motesart OS',     icon: '⚙️', desc: 'App features, bugs, tech, subscriptions, system tasks' },
  finance: { label: 'FinanceMind',     icon: '💰', desc: 'Bills, payments, budgeting, credit, savings, tax items' },
};

// ── DATA LAYER ───────────────────────────────────────

const DISPATCH_KEY = '_mos_dispatches';
const QUEUE_KEY = '_mos_queue';

export function loadDispatches() {
  try { return JSON.parse(localStorage.getItem(DISPATCH_KEY) || '[]'); }
  catch { return []; }
}

export function saveDispatches(list) {
  try { localStorage.setItem(DISPATCH_KEY, JSON.stringify(list)); } catch {}
}

export function loadQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

export function saveQueue(list) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list)); } catch {}
}

export function genDispatchId() {
  return 'mya_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ── CLASSIFY SERVICE (Anthropic Messages API) ────────

export async function classifyDispatch(record) {
  const key = getApiKey();
  if (!key) throw new Error('No API key — set _mos_key or _fm_key in localStorage');

  const routeList = Object.entries(ROUTES)
    .map(([k, v]) => `${k}: ${v.label} — ${v.desc}`)
    .join('\n');

  const sys = `You are Mya, the dispatch intelligence for Motesart OS. Classify incoming messages and produce a routing receipt.

Available routes:
${routeList}

User's selected route: ${record.route === 'auto' ? 'AUTO — you decide the best route' : record.route}
Priority: ${record.priority}
Attachments: ${record.attachments?.length > 0 ? record.attachments.map(a => a.name).join(', ') : 'none'}

Respond ONLY with a JSON object (no markdown, no backticks, no explanation):
{
  "route": "pa|book|som|claude|os|finance",
  "confidence": "high|medium|low",
  "reason": "one sentence why this route",
  "summary": "2-3 sentence summary for the receipt card",
  "next_action": "one clear next step",
  "category": "task|question|request|update|escalation"
}`;

  const res = await fetch('/.netlify/functions/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: sys,
      messages: [{ role: 'user', content: record.message }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');

  const text = (data.content?.[0]?.text || '').trim();
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return {
      route: record.route === 'auto' ? 'pa' : record.route,
      confidence: 'medium',
      reason: 'Auto-classified based on content',
      summary: record.message.substring(0, 140),
      next_action: 'Review and act on this dispatch',
      category: 'task',
    };
  }
}

// ── RECEIPT SERVICE ──────────────────────────────────

export function buildReceipt(record, ai) {
  return {
    routed_to: ROUTES[record.route]?.label || record.route,
    confidence: ai.confidence || 'high',
    reason: ai.reason || '',
    summary: ai.summary || '',
    next_action: ai.next_action || '',
    category: ai.category || 'task',
    timestamp: new Date().toISOString(),
  };
}

// ── FULL DISPATCH FLOW ───────────────────────────────

export async function executeDispatch(record, { dispatches, queue, onUpdate }) {
  // Offline → queue
  if (!navigator.onLine) {
    record.status = 'queued';
    queue.push(record);
    saveQueue(queue);
    onUpdate({ dispatches, queue, status: 'queued', message: 'Offline — queued for retry' });
    return { success: false, reason: 'offline' };
  }

  try {
    const ai = await classifyDispatch(record);
    record.aiResult = ai;
    record.route = (record.route === 'auto' && ai.route) ? ai.route : record.route;
    record.status = 'routed';
    record.receipt = buildReceipt(record, ai);

    dispatches.unshift(record);
    saveDispatches(dispatches);
    onUpdate({ dispatches, queue, status: 'routed', message: `Dispatched → ${ROUTES[record.route]?.label || record.route}` });
    return { success: true };

  } catch (e) {
    record.status = 'queued';
    record.error = e.message || String(e);
    queue.push(record);
    saveQueue(queue);
    onUpdate({ dispatches, queue, status: 'error', message: 'API error — queued for retry' });
    return { success: false, reason: 'error' };
  }
}

// ── QUEUE RETRY ──────────────────────────────────────

export async function retryQueueItem(idx, { dispatches, queue, onUpdate }) {
  if (idx < 0 || idx >= queue.length) return;
  const record = queue.splice(idx, 1)[0];
  record.status = 'pending';
  delete record.error;
  saveQueue(queue);
  onUpdate({ dispatches, queue });

  try {
    const ai = await classifyDispatch(record);
    record.aiResult = ai;
    record.route = (record.route === 'auto' && ai.route) ? ai.route : record.route;
    record.status = 'routed';
    record.receipt = buildReceipt(record, ai);
    dispatches.unshift(record);
    saveDispatches(dispatches);
  } catch (e) {
    record.status = 'queued';
    record.error = e.message || String(e);
    queue.push(record);
    saveQueue(queue);
  }
  onUpdate({ dispatches, queue });
}

export function dropQueueItem(idx, { queue, onUpdate, dispatches }) {
  if (idx < 0 || idx >= queue.length) return;
  queue.splice(idx, 1);
  saveQueue(queue);
  onUpdate({ dispatches, queue });
}

// ── HELPERS ──────────────────────────────────────────

function getApiKey() {
  try { return localStorage.getItem('_mos_key') || localStorage.getItem('_fm_key') || ''; }
  catch { return ''; }
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
