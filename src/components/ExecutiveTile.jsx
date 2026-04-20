// src/components/ExecutiveTile.jsx
//
// Reusable executive scoreboard tile.
// Phase 3B: SOM tile on SOM overview tab.
// Phase 3C: FM / E7A / Book — same component, different props.
//
// Props:
//   executive   string   required   e.g. "som" → POST /api/executives/som/run
//   label       string   required   Display name, e.g. "SOM Executive"
//   color       string   required   Accent color (from T theme)
//   dim         string   required   Dim variant of accent (from T theme)
//   description string   optional   Shown when no run has happened yet

import { useCallback } from 'react'
import useExecutiveRun from '../hooks/useExecutiveRun'
import useExecutiveHealth from '../hooks/useExecutiveHealth'
import { useToast } from './Toast'

const C = {
  card:    '#111116',
  border:  'rgba(255,255,255,0.055)',
  white:   '#f0ede8',
  muted:   '#52525e',
  dim:     '#1c1c22',
  green:   '#4caf7d',
  amber:   '#c9914c',
  red:     '#c95a5a',
  blue:    '#5a8fc9',
}

function statusColor(status) {
  if (status === 'in_progress') return C.green
  if (status === 'blocked')     return C.amber
  if (status === 'pending')     return C.muted
  return C.muted
}

function Pill({ color, children }) {
  return (
    <span style={{
      fontSize: 9, color, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 4,
      border: `1px solid ${color}40`,
      background: `${color}12`,
    }}>{children}</span>
  )
}

function ActionButton({ onClick, disabled, primary, color, dim, children }) {
  const tint = primary ? color : C.muted
  const bg   = primary ? dim   : 'transparent'
  const bord = primary ? `${color}40` : C.border
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? C.dim : bg,
        border: `1px solid ${disabled ? C.border : bord}`,
        color: disabled ? C.muted : tint,
        borderRadius: 6,
        padding: '7px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        transition: 'all 0.18s',
        opacity: disabled ? 0.6 : 1,
        fontFamily: 'inherit',
      }}
    >{children}</button>
  )
}

export default function ExecutiveTile({
  executive,
  label,
  color,
  dim,
  description = 'Backend executive worker. Click Run to pick up the next task.',
}) {
  const { run, runDryRun, loading, lastResult, error } = useExecutiveRun(executive)
  const { available, checking, recheck } = useExecutiveHealth()
  const toast = useToast()

  const isOffline = available === false

  const onRun = useCallback(async () => {
    const result = await run()
    if (result) {
      toast.success(
        `${label} → ${result.new_status}`,
        result.action_taken || result.latest_update_summary || 'Run complete',
        { accent: color }
      )
    } else {
      toast.error(`${label} failed`, 'Check Railway logs with grep [SOM]')
    }
  }, [run, toast, label, color])

  const onDryRun = useCallback(async () => {
    const result = await runDryRun()
    if (result) {
      toast.info(
        `${label} · Dry run`,
        `Would set → ${result.new_status}. ${result.action_taken || ''}`.trim(),
        { accent: color }
      )
    } else {
      toast.error(`${label} dry run failed`, 'Check Railway logs')
    }
  }, [runDryRun, toast, label, color])

  const status = lastResult?.new_status
  const actionText = lastResult?.action_taken
  const nextAction = lastResult?.next_action

  // Disable actions when offline OR checking initial health (available === null)
  const actionsDisabled = loading || isOffline || available === null

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${isOffline ? C.red : color}`,
      borderRadius: 12,
      padding: '14px 18px',
      marginBottom: 18,
      backdropFilter: 'blur(12px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      opacity: isOffline ? 0.85 : 1,
      transition: 'border-left-color 0.3s, opacity 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, color: isOffline ? C.muted : color, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>◉ {label}</span>

        {/* Status / health pills */}
        {isOffline ? (
          <Pill color={C.red}>Offline</Pill>
        ) : available === null ? (
          <Pill color={C.muted}>Checking…</Pill>
        ) : status ? (
          <Pill color={statusColor(status)}>{status.replace('_', ' ')}</Pill>
        ) : (
          <Pill color={C.green}>Live</Pill>
        )}
        {error && !isOffline && <Pill color={C.red}>Error</Pill>}

        {/* Right-aligned action buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {isOffline ? (
            <ActionButton onClick={recheck} disabled={checking} primary color={C.red} dim="rgba(201,90,90,0.12)">
              {checking ? '◌ Checking…' : '↻ Recheck'}
            </ActionButton>
          ) : (
            <>
              <ActionButton onClick={onDryRun} disabled={actionsDisabled} color={color} dim={dim}>
                {loading ? '◌' : 'Dry Run'}
              </ActionButton>
              <ActionButton onClick={onRun} disabled={actionsDisabled} primary color={color} dim={dim}>
                {loading ? '◌ Running…' : '▶ Run Now'}
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {isOffline ? (
        <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          SOM backend is unreachable. The executive cannot run until the Railway deployment responds to{' '}
          <span style={{ color: C.white, fontFamily: 'monospace', fontSize: 11 }}>/api/health</span>.
          Rechecks automatically every 60 seconds.
        </p>
      ) : lastResult ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: C.white, lineHeight: 1.6 }}>
            {actionText || 'Run complete.'}
          </p>
          {nextAction && (
            <p style={{
              margin: '6px 0 0 0', fontSize: 11, color: C.muted,
              lineHeight: 1.5, fontStyle: 'italic',
            }}>
              Next: {nextAction}
            </p>
          )}
          {lastResult.decision_source && (
            <div style={{
              marginTop: 8, fontSize: 9, color: C.muted,
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
            }}>
              via {lastResult.decision_source}
              {lastResult.smart_build_path && ` · ${lastResult.smart_build_path} path`}
            </div>
          )}
        </>
      ) : error ? (
        <p style={{ margin: 0, fontSize: 12, color: C.red, lineHeight: 1.5 }}>
          {error}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          {description}
        </p>
      )}
    </div>
  )
}
