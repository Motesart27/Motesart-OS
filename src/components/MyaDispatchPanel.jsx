import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ROUTES,
  loadDispatches,
  loadQueue,
  saveDispatches,
  saveQueue,
  genDispatchId,
  executeDispatch,
  retryQueueItem,
  dropQueueItem,
  formatTime,
  formatDate,
} from '../services/dispatchService';

// ══════════════════════════════════════════════════════
// MYA DISPATCH PANEL
// Fullscreen overlay — opens from PA Agent button
// Matches Motesart OS dark theme + gold accent
// ══════════════════════════════════════════════════════

// ── THEME (extracted from Motesart OS screenshot) ────
const T = {
  bg:       '#0a0b0f',
  bg2:      '#131620',
  bg3:      '#1a1e28',
  bg4:      '#222838',
  border:   'rgba(255,255,255,0.06)',
  border2:  'rgba(255,255,255,0.10)',
  border3:  'rgba(255,255,255,0.16)',
  gold:     '#c9a644',
  goldDim:  '#a08530',
  goldGlow: 'rgba(201,166,68,0.12)',
  goldGlow2:'rgba(201,166,68,0.06)',
  teal:     '#3aaf8e',
  tealBg:   'rgba(58,175,142,0.10)',
  green:    '#4caf50',
  greenBg:  'rgba(76,175,80,0.10)',
  red:      '#ef5350',
  redBg:    'rgba(239,83,80,0.10)',
  amber:    '#e8a838',
  amberBg:  'rgba(232,168,56,0.10)',
  blue:     '#42a5f5',
  blueBg:   'rgba(66,165,245,0.10)',
  pink:     '#e25565',
  pinkBg:   'rgba(226,85,101,0.10)',
  text:     '#e5e3de',
  t2:       '#8a8e98',
  t3:       '#4e5460',
  t4:       '#333845',
  mono:     "'JetBrains Mono', 'SF Mono', monospace",
  sans:     "'Nunito', -apple-system, sans-serif",
  serif:    "'Lora', Georgia, serif",
  r:        '14px',
  rsm:      '10px',
};

// ── COMPONENT ────────────────────────────────────────

export default function MyaDispatchPanel({ open, onClose, actionBarSlot = null }) {
  const [tab, setTab] = useState('compose');
  const [dispatches, setDispatches] = useState([]);
  const [queue, setQueue] = useState([]);
  const [msg, setMsg] = useState('');
  const [route, setRoute] = useState('auto');
  const [prio, setPrio] = useState('normal');
  const [attachments, setAttachments] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ text: '', color: T.t3 });
  const [filter, setFilter] = useState('all');
  const [online, setOnline] = useState(navigator.onLine);
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const bodyRef = useRef(null);

  // Load data on mount
  useEffect(() => {
    setDispatches(loadDispatches());
    setQueue(loadQueue());
  }, [open]);

  // Online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Auto-retry when coming online
  useEffect(() => {
    if (online && queue.length > 0) {
      const timer = setTimeout(() => handleRetry(0), 1500);
      return () => clearTimeout(timer);
    }
  }, [online]);

  const handleUpdate = useCallback(({ dispatches: d, queue: q, status: s, message: m }) => {
    if (d) setDispatches([...d]);
    if (q) setQueue([...q]);
    if (m) setStatus({ text: s === 'routed' ? `✓ ${m}` : s === 'queued' ? `📴 ${m}` : `⚠ ${m}`, color: s === 'routed' ? T.green : s === 'queued' ? T.amber : T.amber });
  }, []);

  // ── DISPATCH ─────────────────────────────────────
  const handleDispatch = async () => {
    if (!msg.trim()) {
      setStatus({ text: '⚠ Write a message first', color: T.red });
      return;
    }
    setSending(true);
    setStatus({ text: '', color: T.t3 });

    const record = {
      id: genDispatchId(),
      client_dispatch_id: genDispatchId(),
      message: msg.trim(),
      route,
      priority: prio,
      attachments: attachments.map(f => ({ name: f.name, type: f.type, size: f.size })),
      created: new Date().toISOString(),
      source: 'motesart-os',
      status: 'pending',
      receipt: null,
      aiResult: null,
    };

    const result = await executeDispatch(record, { dispatches, queue, onUpdate: handleUpdate });
    setSending(false);

    if (result.success) {
      clearForm();
      setTimeout(() => setTab('history'), 600);
    } else {
      clearForm();
    }
  };

  const clearForm = () => {
    setMsg('');
    setRoute('auto');
    setPrio('normal');
    setAttachments([]);
    setPreviews([]);
  };

  // ── FILES ────────────────────────────────────────
  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
    files.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => setPreviews(prev => [...prev, { name: f.name, src: ev.target.result, type: 'image' }]);
        reader.readAsDataURL(f);
      } else {
        setPreviews(prev => [...prev, { name: f.name, type: 'file' }]);
      }
    });
    e.target.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // ── QUEUE ────────────────────────────────────────
  const handleRetry = async (idx) => {
    await retryQueueItem(idx, { dispatches, queue, onUpdate: handleUpdate });
  };

  const handleDrop = (idx) => {
    dropQueueItem(idx, { dispatches, queue, onUpdate: handleUpdate });
  };

  // ── RENDER ───────────────────────────────────────
  if (!open) return null;

  const filteredDispatches = filter === 'all' ? dispatches : dispatches.filter(d => d.route === filter);

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        {/* HEADER */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.diamond}>◇</div>
            <div>
              <div style={S.headerTitle}>Mya Dispatch</div>
              <div style={S.headerSub}>
                {online ? (
                  <span style={{ color: T.green }}>
                    <span style={S.statusDot(T.green)}></span> ONLINE
                  </span>
                ) : (
                  <span style={{ color: T.amber }}>
                    <span style={S.statusDot(T.amber)}></span> OFFLINE
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* TABS */}
        <div style={S.tabs}>
          {['compose', 'history', 'queue'].map(t => (
            <div
              key={t}
              onClick={() => setTab(t)}
              style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}
            >
              {t === 'compose' ? 'Dispatch' : t === 'history' ? 'History' : 'Queue'}
              {t === 'queue' && queue.length > 0 && <span style={S.tabBadge}>{queue.length}</span>}
            </div>
          ))}
        </div>

        {/* Phase 3B — Executive action bar slot */}
        {actionBarSlot && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(201,168,76,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 9,
              color: '#9a9aa5',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginRight: 4,
            }}>Executives</span>
            {actionBarSlot}
          </div>
        )}

        {/* BODY */}
        <div style={S.body} ref={bodyRef}>

          {/* ═══ COMPOSE ═══ */}
          {tab === 'compose' && (
            <div style={S.form}>
              {/* Message */}
              <div style={S.field}>
                <label style={S.label}>What do you need?</label>
                <textarea
                  style={S.textarea}
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  placeholder="Describe the task, request, or message…"
                  rows={4}
                />
              </div>

              {/* Routes */}
              <div style={S.field}>
                <label style={S.label}>Route To</label>
                <div style={S.chips}>
                  {[...Object.entries(ROUTES), ['auto', { label: 'Auto-Route', icon: '◇' }]].map(([key, r]) => (
                    <div
                      key={key}
                      onClick={() => setRoute(key)}
                      style={{ ...S.chip, ...(route === key ? S.chipOn : {}) }}
                    >
                      <span style={{ fontSize: 14 }}>{r.icon}</span> {r.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div style={S.field}>
                <label style={S.label}>Priority</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'low', color: T.green },
                    { key: 'normal', color: T.blue },
                    { key: 'high', color: T.amber },
                    { key: 'urgent', color: T.red },
                  ].map(p => (
                    <div
                      key={p.key}
                      onClick={() => setPrio(p.key)}
                      style={{
                        ...S.prio,
                        color: prio === p.key ? '#fff' : p.color,
                        borderColor: prio === p.key ? p.color : `${p.color}33`,
                        background: prio === p.key ? p.color : 'transparent',
                      }}
                    >
                      {p.key.toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div style={S.field}>
                <label style={S.label}>Attachments</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={S.attachBtn} onClick={() => fileRef.current?.click()}>📎 File</div>
                  <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.csv" style={{ display: 'none' }} onChange={handleFiles} />
                  <div style={S.attachBtn} onClick={() => imgRef.current?.click()}>📷 Photo</div>
                  <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFiles} />
                  <div style={S.voiceBtn}>🎙 Voice <span style={S.voiceSoon}>PHASE 1.5</span></div>
                </div>
                {previews.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {previews.map((p, i) => (
                      p.type === 'image' ? (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p.src} alt="" style={S.thumb} />
                          <span style={S.thumbX} onClick={() => removeAttachment(i)}>✕</span>
                        </div>
                      ) : (
                        <div key={i} style={S.fileTag}>
                          📄 {p.name.length > 18 ? p.name.substr(0, 15) + '…' : p.name}
                          <span style={S.thumbX} onClick={() => removeAttachment(i)}>✕</span>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
                <button
                  onClick={handleDispatch}
                  disabled={sending}
                  style={{ ...S.dispatchBtn, opacity: sending ? 0.5 : 1 }}
                >
                  {sending ? '⏳ Dispatching…' : '◇ Dispatch'}
                </button>
                {status.text && <span style={{ ...S.statusText, color: status.color }}>{status.text}</span>}
              </div>
            </div>
          )}

          {/* ═══ HISTORY ═══ */}
          {tab === 'history' && (
            <div>
              {/* Filters */}
              <div style={S.filters}>
                {['all', ...Object.keys(ROUTES)].map(k => (
                  <div
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{ ...S.filterChip, ...(filter === k ? S.filterOn : {}) }}
                  >
                    {k === 'all' ? 'All' : ROUTES[k]?.label || k}
                  </div>
                ))}
              </div>

              {filteredDispatches.length === 0 ? (
                <div style={S.empty}>
                  <div style={S.emptyIc}>◇</div>
                  <div style={S.emptyTitle}>No dispatches yet</div>
                  <div style={S.emptySub}>Compose your first dispatch and it will appear here with a full AI receipt.</div>
                </div>
              ) : (
                filteredDispatches.map((d, i) => <ReceiptCard key={d.id || i} d={d} />)
              )}
            </div>
          )}

          {/* ═══ QUEUE ═══ */}
          {tab === 'queue' && (
            <div>
              {queue.length === 0 ? (
                <div style={S.empty}>
                  <div style={S.emptyIc}>✓</div>
                  <div style={S.emptyTitle}>Queue is clear</div>
                  <div style={S.emptySub}>Offline dispatches waiting for retry will appear here.</div>
                </div>
              ) : (
                queue.map((d, i) => (
                  <div key={d.id || i} style={{ ...S.receipt, borderColor: `${T.amber}22` }}>
                    <div style={S.receiptHead}>
                      <div style={S.receiptRoute}>📴 Queued Dispatch</div>
                      <span style={{ ...S.badge, ...S.badgeQueued }}>QUEUED</span>
                    </div>
                    <div style={S.receiptBody}>
                      {d.message.length > 160 ? d.message.substring(0, 160) + '…' : d.message}
                    </div>
                    <div style={S.receiptMeta}>
                      <span style={S.tag}>{formatTime(d.created)}</span>
                      <span style={S.tag}>{d.priority?.toUpperCase()}</span>
                      {d.error && <span style={{ ...S.tag, color: T.red }}>{d.error}</span>}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button style={S.retryBtn} onClick={() => handleRetry(i)}>↻ Retry</button>
                      <button style={S.dropBtn} onClick={() => handleDrop(i)}>✕ Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── DISPATCH RECEIPT (shown after successful send) ─────
function DispatchReceipt({ receipt, routes, onHistory, onNew }) {
  const routeLabel = routes[receipt.route]?.label || receipt.route;
  const routeIcon = routes[receipt.route]?.icon || '◇';
  const statusColor = receipt.status === 'routed' ? '#4caf50' : '#e8a838';
  const idDisplay = receipt.server_id || receipt.id || '—';

  return (
    <div style={{
      background: 'rgba(201,166,68,0.06)', border: '1px solid rgba(201,166,68,0.22)',
      borderRadius: 14, padding: 20,
    }}>
      {/* Success banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(76,175,80,0.12)', border: '1.5px solid #4caf5055',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#4caf50',
        }}>✓</div>
        <div>
          <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 15, fontWeight: 700, color: '#e5e3de' }}>Dispatch Sent</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#6a6e78', marginTop: 2 }}>
            {new Date(receipt.created).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
        <span style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 20,
          background: receipt.status === 'routed' ? 'rgba(76,175,80,0.1)' : 'rgba(232,168,56,0.1)',
          color: statusColor,
          fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>{receipt.status}</span>
      </div>

      {/* Receipt fields */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Dispatch ID', value: idDisplay, mono: true },
          { label: 'Route', value: `${routeIcon} ${routeLabel}` },
          { label: 'Priority', value: receipt.priority?.toUpperCase() },
          { label: 'Status', value: receipt.status?.toUpperCase() },
        ].map(({ label, value, mono }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#4e5460', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>{label}</span>
            <span style={{ fontFamily: mono ? "'JetBrains Mono',monospace" : 'inherit', fontSize: mono ? 10 : 12, color: '#8a8e98', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* AI summary if present */}
      {receipt.receipt?.summary && (
        <div style={{
          background: 'rgba(201,166,68,0.08)', borderRadius: 8, padding: '10px 12px',
          fontSize: 12, color: '#c9a644', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 14,
        }}>◇ {receipt.receipt.summary}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onHistory}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #c9a644, #a08530)',
            color: '#fff', fontWeight: 800, fontSize: 13,
          }}
        >View in History →</button>
        <button
          onClick={onNew}
          style={{
            padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: '#6a6e78', fontSize: 12, fontWeight: 700,
          }}
        >+ New</button>
      </div>
    </div>
  );
}

// ── RECEIPT CARD SUB-COMPONENT ────────────────────────

function ReceiptCard({ d }) {
  const r = ROUTES[d.route] || { label: d.route, icon: '◇' };
  const badgeStyle = d.status === 'routed' ? S.badgeRouted :
                     d.status === 'queued' ? S.badgeQueued :
                     d.status === 'failed' ? S.badgeFailed : S.badgePending;

  return (
    <div style={S.receipt}>
      <div style={S.receiptGlow}></div>
      <div style={S.receiptHead}>
        <div style={S.receiptRoute}>{r.icon} {r.label}</div>
        <span style={{ ...S.badge, ...badgeStyle }}>{d.status?.toUpperCase()}</span>
      </div>
      <div style={S.receiptBody}>
        {d.message.length > 220 ? d.message.substring(0, 220) + '…' : d.message}
      </div>
      {d.receipt?.summary && (
        <div style={S.receiptAi}>
          ◇ {d.receipt.summary}
          {d.receipt.next_action && (
            <><br /><strong style={{ fontStyle: 'normal', color: T.text }}>Next:</strong> {d.receipt.next_action}</>
          )}
        </div>
      )}
      <div style={S.receiptMeta}>
        <span style={S.tag}>📱 From Motesart OS — {formatTime(d.created)}</span>
        <span style={S.tag}>{formatDate(d.created)}</span>
        <span style={S.tag}>{d.priority?.toUpperCase()}</span>
        {d.receipt?.confidence && <span style={S.tag}>Confidence: {d.receipt.confidence}</span>}
        {d.attachments?.length > 0 && <span style={S.tag}>📎 {d.attachments.length} file{d.attachments.length > 1 ? 's' : ''}</span>}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════
// STYLES (inline — matches Motesart OS pattern)
// ══════════════════════════════════════════════════════

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'flex-end',
    animation: 'fadeIn .2s ease',
  },
  panel: {
    background: T.bg,
    borderTop: `1px solid ${T.border2}`,
    borderRadius: '20px 20px 0 0',
    display: 'flex', flexDirection: 'column',
    height: '94dvh', maxHeight: '94dvh',
    overflow: 'hidden',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 12px',
    paddingTop: 'max(16px, env(safe-area-inset-top))',
    borderBottom: `1px solid ${T.border}`,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  diamond: {
    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
    borderRadius: 10, fontSize: 15, color: '#fff',
    boxShadow: `0 3px 12px ${T.goldGlow}`,
  },
  headerTitle: { fontFamily: T.serif, fontSize: 17, fontWeight: 700, color: T.text },
  headerSub: { fontFamily: T.mono, fontSize: 9, letterSpacing: '0.1em', marginTop: 2 },
  closeBtn: {
    background: T.bg3, border: `1px solid ${T.border2}`,
    borderRadius: 10, width: 44, height: 44, minWidth: 44, minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.t2, fontSize: 14, cursor: 'pointer', flexShrink: 0,
  },
  statusDot: (color) => ({
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: color, boxShadow: `0 0 6px ${color}66`,
    marginRight: 5, verticalAlign: 'middle',
  }),

  // Tabs
  tabs: {
    display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.bg2,
  },
  tab: {
    flex: 1, padding: '12px 0', textAlign: 'center',
    fontFamily: T.mono, fontSize: 10, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: T.t3, cursor: 'pointer',
    borderBottom: '2px solid transparent', fontWeight: 600,
    transition: 'all .2s',
  },
  tabOn: { color: T.gold, borderBottomColor: T.gold },
  tabBadge: {
    display: 'inline-block', padding: '1px 5px', borderRadius: 8,
    background: T.amber, color: T.bg, fontSize: 8, fontWeight: 700,
    marginLeft: 5, verticalAlign: 'middle',
  },

  // Body
  body: {
    flex: 1, overflowY: 'auto',
    padding: '18px 20px 40px',
    paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
  },

  // Form
  form: { maxWidth: 640 },
  field: { marginBottom: 18 },
  label: {
    display: 'block', marginBottom: 7,
    fontFamily: T.mono, fontSize: 9, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: T.t3,
  },
  textarea: {
    width: '100%', padding: '13px 16px',
    background: T.bg3, border: `1px solid ${T.border2}`,
    borderRadius: T.rsm, color: T.text,
    fontFamily: T.sans, fontSize: 15,
    outline: 'none', resize: 'none',
    minHeight: 110, lineHeight: 1.6,
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7,
    background: T.bg3, border: `1.5px solid ${T.border2}`,
    borderRadius: 22, fontSize: 12, fontWeight: 700,
    color: T.t2, cursor: 'pointer', transition: 'all .2s',
    userSelect: 'none',
  },
  chipOn: {
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
    color: '#fff', borderColor: 'transparent',
    boxShadow: `0 3px 14px ${T.goldGlow}`,
  },
  prio: {
    padding: '7px 13px', borderRadius: 8,
    fontFamily: T.mono, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'all .2s',
    border: '1.5px solid',
  },

  // Attachments
  attachBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '9px 14px', border: `1.5px dashed ${T.border2}`,
    borderRadius: T.rsm, fontSize: 12, fontWeight: 700,
    color: T.t3, cursor: 'pointer',
  },
  voiceBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 14px', border: `1.5px solid ${T.border2}`,
    borderRadius: T.rsm, fontSize: 12, color: T.t4,
    cursor: 'not-allowed', opacity: 0.45,
  },
  voiceSoon: {
    fontFamily: T.mono, fontSize: 8, background: T.amberBg,
    color: T.amber, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
  },
  thumb: {
    width: 50, height: 50, borderRadius: 8, objectFit: 'cover',
    border: `1px solid ${T.border2}`,
  },
  thumbX: {
    position: 'absolute', top: -4, right: -4,
    background: T.bg3, border: `1px solid ${T.border2}`,
    borderRadius: '50%', width: 18, height: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 9, color: T.t2, cursor: 'pointer',
  },
  fileTag: {
    padding: '6px 10px', background: T.bg3, border: `1px solid ${T.border}`,
    borderRadius: 8, fontSize: 10, color: T.t2,
    display: 'flex', alignItems: 'center', gap: 6,
  },

  // Submit
  dispatchBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '13px 32px', borderRadius: 12, border: 'none',
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
    color: '#fff', fontFamily: T.sans, fontSize: 14, fontWeight: 800,
    cursor: 'pointer', boxShadow: `0 4px 18px ${T.goldGlow}`,
  },
  statusText: { fontFamily: T.mono, fontSize: 10 },

  // Receipt cards
  receipt: {
    background: T.bg2, border: `1px solid ${T.border2}`,
    borderRadius: T.r, padding: 18, marginBottom: 14,
    position: 'relative', overflow: 'hidden',
  },
  receiptGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, ${T.gold}, ${T.goldDim})`,
    opacity: 0.6,
  },
  receiptHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 10,
  },
  receiptRoute: { fontFamily: T.serif, fontWeight: 700, fontSize: 15, color: T.text },
  badge: {
    padding: '3px 10px', borderRadius: 20,
    fontFamily: T.mono, fontSize: 9, fontWeight: 700,
    letterSpacing: '0.06em', textTransform: 'uppercase',
  },
  badgeRouted:  { background: T.greenBg, color: T.green },
  badgePending: { background: T.amberBg, color: T.amber },
  badgeQueued:  { background: T.blueBg,  color: T.blue },
  badgeFailed:  { background: T.redBg,   color: T.red },
  receiptBody: {
    fontSize: 13, color: T.t2, lineHeight: 1.65, marginBottom: 10,
    borderLeft: `2px solid ${T.goldGlow}`, paddingLeft: 12,
  },
  receiptAi: {
    marginTop: 10, padding: '10px 13px',
    background: T.goldGlow, borderRadius: T.rsm,
    fontSize: 12, color: T.gold, lineHeight: 1.55, fontStyle: 'italic',
  },
  receiptMeta: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10,
    fontFamily: T.mono, fontSize: 9, color: T.t3,
  },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', background: T.bg3, borderRadius: 6,
  },

  // Filters
  filters: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  filterChip: {
    padding: '6px 12px', border: `1px solid ${T.border}`,
    borderRadius: 16, fontSize: 11, fontWeight: 700,
    color: T.t3, cursor: 'pointer',
  },
  filterOn: { background: T.gold, color: '#fff', borderColor: T.gold },

  // Empty
  empty: { textAlign: 'center', padding: '60px 24px' },
  emptyIc: { fontSize: 48, marginBottom: 14, opacity: 0.3, color: T.gold },
  emptyTitle: { fontFamily: T.serif, fontSize: 18, fontWeight: 700, color: T.t2, marginBottom: 6 },
  emptySub: { fontSize: 13, color: T.t3, lineHeight: 1.6 },

  // Queue buttons
  retryBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none',
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
    color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  dropBtn: {
    padding: '7px 14px', borderRadius: 8,
    border: `1px solid ${T.red}33`, background: T.redBg,
    color: T.red, fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
};
