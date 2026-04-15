import { useState, useEffect } from 'react';

// ══════════════════════════════════════════════════════
// JEAN CYCLE TRACKER
// Motesart OS → Personal → Jean section
// Small dashboard card — red zone alerts 7 days before
// ══════════════════════════════════════════════════════

const STORAGE_KEY = '_mos_jean_cycle';
const DEFAULT_CYCLE_LENGTH = 28;
const RED_ZONE_DAYS = 7;

// ── THEME (matches Motesart OS dark palette) ─────────
const C = {
  bg:      '#131620',
  bg2:     '#1a1e28',
  bg3:     '#222838',
  border:  'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.10)',
  text:    '#e5e3de',
  t2:      '#8a8e98',
  t3:      '#4e5460',
  red:     '#ef5350',
  redBg:   'rgba(239,83,80,0.08)',
  redBd:   'rgba(239,83,80,0.20)',
  green:   '#4caf50',
  greenBg: 'rgba(76,175,80,0.08)',
  greenBd: 'rgba(76,175,80,0.20)',
  amber:   '#e8a838',
  amberBg: 'rgba(232,168,56,0.08)',
  amberBd: 'rgba(232,168,56,0.20)',
  mono:    "'JetBrains Mono', monospace",
  sans:    "'Nunito', sans-serif",
};

export default function JeanCycleTracker() {
  const [data, setData] = useState(() => loadData());
  const [editing, setEditing] = useState(false);
  const [inputDate, setInputDate] = useState('');

  // ── CALCULATIONS ─────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastStart = data.lastStart ? new Date(data.lastStart) : null;
  const cycleLen = data.cycleLength || DEFAULT_CYCLE_LENGTH;

  let nextStart = null;
  let daysUntil = null;
  let dayOfCycle = null;
  let zone = 'unknown'; // green | amber | red | active

  if (lastStart) {
    lastStart.setHours(0, 0, 0, 0);
    nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + cycleLen);

    const diffMs = today - lastStart;
    dayOfCycle = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    daysUntil = Math.floor((nextStart - today) / (1000 * 60 * 60 * 24));

    if (dayOfCycle <= 5) {
      zone = 'active'; // currently on cycle (approx days 1-5)
    } else if (daysUntil <= RED_ZONE_DAYS && daysUntil > 0) {
      zone = 'red';
    } else if (daysUntil <= 12 && daysUntil > RED_ZONE_DAYS) {
      zone = 'amber';
    } else if (daysUntil > 12) {
      zone = 'green';
    } else if (daysUntil <= 0) {
      zone = 'red'; // overdue
    }
  }

  // ── HANDLERS ─────────────────────────────────────
  const handleSetDate = () => {
    if (!inputDate) return;
    const updated = { ...data, lastStart: inputDate, history: [...(data.history || []), inputDate] };
    setData(updated);
    saveData(updated);
    setEditing(false);
    setInputDate('');
  };

  const handleStartedToday = () => {
    const todayStr = today.toISOString().split('T')[0];
    const updated = { ...data, lastStart: todayStr, history: [...(data.history || []), todayStr] };
    setData(updated);
    saveData(updated);
    setEditing(false);
  };

  const handleCycleLength = (len) => {
    const updated = { ...data, cycleLength: len };
    setData(updated);
    saveData(updated);
  };

  // ── ZONE STYLES ──────────────────────────────────
  const zoneConfig = {
    active: { label: 'ACTIVE',   color: C.red,   bg: C.redBg,   bd: C.redBd,   icon: '🔴' },
    red:    { label: 'RED ZONE', color: C.red,   bg: C.redBg,   bd: C.redBd,   icon: '🔴' },
    amber:  { label: 'HEADS UP', color: C.amber, bg: C.amberBg, bd: C.amberBd, icon: '🟡' },
    green:  { label: 'CLEAR',    color: C.green, bg: C.greenBg, bd: C.greenBd, icon: '🟢' },
    unknown:{ label: 'NOT SET',  color: C.t3,    bg: 'transparent', bd: C.border2, icon: '⚪' },
  };
  const z = zoneConfig[zone];

  // ── RENDER ───────────────────────────────────────
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${z.bd}`,
      borderRadius: 14,
      padding: '14px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle top glow for red zone */}
      {(zone === 'red' || zone === 'active') && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${C.red}, transparent)`,
          opacity: 0.5,
        }} />
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: lastStart ? 10 : 6,
      }}>
        <span style={{
          fontFamily: C.mono, fontSize: 9, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: C.t3,
        }}>
          Jean — Cycle
        </span>
        <span style={{
          padding: '2px 8px', borderRadius: 10,
          fontFamily: C.mono, fontSize: 8, fontWeight: 700,
          letterSpacing: '0.04em',
          background: z.bg, color: z.color,
          border: `1px solid ${z.bd}`,
        }}>
          {z.icon} {z.label}
        </span>
      </div>

      {/* Main content */}
      {lastStart ? (
        <div>
          {/* Countdown or status */}
          {zone === 'active' ? (
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 6 }}>
              Day {dayOfCycle} — currently on cycle
            </div>
          ) : zone === 'red' || daysUntil <= 0 ? (
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 6 }}>
              {daysUntil > 0 ? `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away` : 'Expected today or overdue'}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>
              {daysUntil} day{daysUntil !== 1 ? 's' : ''} until next cycle
            </div>
          )}

          {/* Progress bar */}
          <div style={{
            height: 4, borderRadius: 2, background: C.bg3,
            marginBottom: 8, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${Math.min(100, ((dayOfCycle || 0) / cycleLen) * 100)}%`,
              background: zone === 'red' || zone === 'active'
                ? `linear-gradient(90deg, ${C.red}, ${C.amber})`
                : zone === 'amber'
                  ? C.amber
                  : C.green,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Details row */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap',
            fontFamily: C.mono, fontSize: 9, color: C.t3,
          }}>
            <span>Day {dayOfCycle}/{cycleLen}</span>
            <span>Next: {nextStart?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span
              onClick={() => setEditing(!editing)}
              style={{ color: C.t2, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Update
            </span>
          </div>

          {/* Red zone alert banner */}
          {zone === 'red' && daysUntil > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 8,
              background: C.redBg, border: `1px solid ${C.redBd}`,
              fontSize: 11, color: C.red, fontWeight: 600,
            }}>
              ⚠️ Red zone — {daysUntil} day{daysUntil !== 1 ? 's' : ''} out. Be ready.
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.t2, marginBottom: 8 }}>
          No cycle date set yet.
        </div>
      )}

      {/* Edit / Set Date */}
      {(editing || !lastStart) && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleStartedToday}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.redBd}`,
                background: C.redBg, color: C.red,
                fontFamily: C.sans, fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Started Today
            </button>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.t3 }}>or</span>
            <input
              type="date"
              value={inputDate}
              onChange={e => setInputDate(e.target.value)}
              style={{
                padding: '5px 8px', borderRadius: 6,
                border: `1px solid ${C.border2}`, background: C.bg2,
                color: C.text, fontFamily: C.mono, fontSize: 10,
                outline: 'none',
              }}
            />
            {inputDate && (
              <button
                onClick={handleSetDate}
                style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none',
                  background: C.green, color: '#fff',
                  fontFamily: C.sans, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Set
              </button>
            )}
          </div>

          {/* Cycle length adjuster */}
          <div style={{
            display: 'flex', gap: 6, alignItems: 'center', marginTop: 8,
            fontFamily: C.mono, fontSize: 9, color: C.t3,
          }}>
            <span>Cycle length:</span>
            {[26, 28, 30, 32].map(n => (
              <span
                key={n}
                onClick={() => handleCycleLength(n)}
                style={{
                  padding: '3px 7px', borderRadius: 6, cursor: 'pointer',
                  background: cycleLen === n ? C.bg3 : 'transparent',
                  color: cycleLen === n ? C.text : C.t3,
                  border: `1px solid ${cycleLen === n ? C.border2 : 'transparent'}`,
                  fontWeight: cycleLen === n ? 700 : 400,
                }}
              >
                {n}d
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PERSISTENCE ──────────────────────────────────────

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}
