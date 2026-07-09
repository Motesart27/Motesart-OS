// ══════════════════════════════════════════════════════
// MYA DISPATCH SERVICE
// Portable module — no React dependency
// Handles: routing config, data persistence, AI classification,
//          receipt generation, offline queue
// ══════════════════════════════════════════════════════

import api from './api'

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
const LEGACY_AI_KEY_PREFIX = '_';
const LEGACY_AI_KEY_SUFFIXES = ['mos_key', 'fm_key'];

try {
  LEGACY_AI_KEY_SUFFIXES.forEach((suffix) => localStorage.removeItem(`${LEGACY_AI_KEY_PREFIX}${suffix}`));
} catch {}

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

export async function loadDispatchesFromBackend() {
  const data = await api.getDispatches(50)
  const records = (data.dispatches || []).map(d => ({
    id: d.client_dispatch_id || d.id,
    server_id: d.id,
    message: d.message,
    route: d.route,
    priority: d.priority,
    status: d.status,
    source: d.source,
    created: d.created_at,
    receipt: (d.ai_summary || d.ai_next_action) ? {
      summary: d.ai_summary,
      next_action: d.ai_next_action,
      category: d.ai_category,
      confidence: 'high',
    } : null,
    aiResult: null,
    attachments: [],
  }))
  saveDispatches(records)
  return records
}

export async function quickDispatch(message, route = 'pa', source = 'motesart-os') {
  try {
    const id = genDispatchId()
    await api.postDispatch({ message, route, priority: 'normal', source, client_dispatch_id: id })
  } catch {
    // fire-and-forget — silently ignore errors
  }
}

// ── CLASSIFY SERVICE ────────────────────────────────

export async function classifyDispatch(record) {
  const route = ['auto', ...Object.keys(ROUTES)].includes(record.route) ? record.route : 'auto';
  return api.classifyMyaDispatch({
    message: record.message || '',
    route,
    priority: record.priority || 'normal',
    attachments: (record.attachments || []).map((item) => String(item?.name || item)).filter(Boolean),
    client_dispatch_id: record.client_dispatch_id || record.id || '',
  });
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
    // 1. Post to backend via /api/mya/dispatch
    const response = await api.postMyaDispatch(record.message, record.biz || 'som');

    if (response.execution_status === 'needs_clarification') {
      return {
        type: 'clarification',
        questions: response.clarification_questions,
        pending_dispatch: response.pending_dispatch,
      };
    }

    const calendarEvent = response.execution_status === 'calendar_event_created'
      ? response.calendar_event
      : null;

    // 2. Try AI classification for receipt (best-effort — does not block dispatch)
    let ai = null;
    try {
      ai = await classifyDispatch(record);
      record.aiResult = ai;
      record.route = (record.route === 'auto' && ai.route) ? ai.route : record.route;
    } catch {
      if (record.route === 'auto') record.route = 'pa';
    }

    record.status = 'routed';
    record.receipt = buildReceipt(record, ai || {
      confidence: 'medium',
      summary: record.message.length > 140 ? record.message.substring(0, 140) + '…' : record.message,
      next_action: 'Review this dispatch',
      category: 'task',
    });

    // Phase 5A — fire-and-forget task promotion
    const _bizMap = { pa:'os', book:'book', som:'som', claude:'os', os:'os', finance:'fm', auto:'os', e7a:'e7a' };
    try {
      await api.createDispatchTask({
        dispatch_id: record.server_id || record.id,
        biz: _bizMap[record.route] || 'os',
        title: record.message.substring(0, 80),
        message: record.message,
        priority: record.priority || 'normal',
        task_origin: 'dispatch',
      });
    } catch { /* best-effort — dispatch already saved */ }

    dispatches.unshift(record);
    saveDispatches(dispatches);
    onUpdate({ dispatches, queue, status: 'routed', message: `Dispatched → ${ROUTES[record.route]?.label || record.route}` });
    return { success: true, calendarEvent };

  } catch (e) {
    record.status = 'queued';
    record.error = e.message || String(e);
    queue.push(record);
    saveQueue(queue);
    onUpdate({ dispatches, queue, status: 'error', message: e.message || String(e) });
    return { success: false, reason: 'error' };
  }
}

export async function resubmitClarification(pendingDispatch, { dispatches, queue, onUpdate }) {
  if (!navigator.onLine) {
    const record = { id: genDispatchId(), ...pendingDispatch, status: 'queued', created: new Date().toISOString() };
    queue.push(record);
    saveQueue(queue);
    onUpdate({ dispatches, queue, status: 'queued', message: 'Offline — queued for retry' });
    return { success: false, reason: 'offline' };
  }
  try {
    const response = await api.postMyaDispatchPending(pendingDispatch);
    if (response.execution_status === 'needs_clarification') {
      return {
        type: 'clarification',
        questions: response.clarification_questions,
        pending_dispatch: response.pending_dispatch,
      };
    }
    const calendarEvent = response.execution_status === 'calendar_event_created'
      ? response.calendar_event
      : null;
    const record = {
      id: genDispatchId(),
      message: pendingDispatch.message || '',
      route: 'pa',
      priority: 'normal',
      status: 'routed',
      created: new Date().toISOString(),
      source: 'motesart-os',
      receipt: { summary: 'Clarification provided and dispatched', confidence: 'high', category: 'task' },
    };
    dispatches.unshift(record);
    saveDispatches(dispatches);
    onUpdate({ dispatches, queue, status: 'routed', message: 'Dispatched' });
    return { success: true, calendarEvent };
  } catch (e) {
    onUpdate({ dispatches, queue, status: 'error', message: e.message || String(e) });
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
    // Re-post to backend on retry
    const backendResult = await api.postDispatch({
      message: record.message,
      route: record.route,
      priority: record.priority,
      source: record.source || 'motesart-os',
      client_dispatch_id: record.client_dispatch_id || record.id,
    });
    record.server_id = backendResult.id;

    let ai = null;
    try {
      ai = await classifyDispatch(record);
      record.aiResult = ai;
      record.route = (record.route === 'auto' && ai.route) ? ai.route : record.route;
    } catch {
      if (record.route === 'auto') record.route = 'pa';
    }
    record.status = 'routed';
    record.receipt = buildReceipt(record, ai || {
      confidence: 'medium',
      summary: record.message.length > 140 ? record.message.substring(0, 140) + '…' : record.message,
      next_action: 'Review this dispatch',
      category: 'task',
    });
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

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
