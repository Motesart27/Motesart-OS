// src/components/ActiveTasksSection.jsx
// Phase 5A — Display dispatch-originated tasks. Execution in Phase 5B.

const T = {
  bg:       '#070709',
  card:     '#111116',
  border:   'rgba(255,255,255,0.055)',
  white:    '#f0ede8',
  muted:    '#52525e',
  dim:      '#1c1c22',
  surface:  '#0e0e12',
  green:    '#4caf7d',
  greenDim: 'rgba(76,175,125,0.12)',
  red:      '#c95a5a',
  redDim:   'rgba(201,90,90,0.12)',
  blue:     '#5a8fc9',
  blueDim:  'rgba(90,143,201,0.12)',
  amber:    '#c9914c',
  amberDim: 'rgba(201,145,76,0.12)',
  gold:     '#c9a84c',
  goldDim:  'rgba(201,168,76,0.10)',
}

const STATUS_MAP = {
  pending:     { label: 'Pending',     color: T.amber, dim: T.amberDim },
  in_progress: { label: 'In Progress', color: T.blue,  dim: T.blueDim  },
  blocked:     { label: 'Blocked',     color: T.red,   dim: T.redDim   },
  done:        { label: 'Done',        color: T.green, dim: T.greenDim },
  canceled:    { label: 'Canceled',    color: T.muted, dim: T.dim      },
}

function Badge({ text, color, dim }) {
  return (
    <span style={{
      fontSize: 10, color, fontWeight: 700,
      background: dim, border: `1px solid ${color}30`,
      padding: '2px 7px', borderRadius: 4,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      flexShrink: 0,
    }}>{text}</span>
  )
}

function TaskCard({ task }) {
  const s = STATUS_MAP[task.status] || STATUS_MAP.pending
  const created = task.created_at ? new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${s.color}50`,
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 7, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge text={s.label} color={s.color} dim={s.dim} />
        {task.priority && task.priority !== 'normal' && (
          <Badge text={task.priority} color={T.gold} dim={T.goldDim} />
        )}
        {task.assigned_executive && (
          <span style={{ fontSize: 9, color: T.muted, marginLeft: 'auto', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {task.assigned_executive}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: T.white, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4, marginBottom: 6 }}>
        {task.title}
      </div>

      {task.message && task.message !== task.title && (
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 6 }}>
          {task.message.length > 120 ? task.message.substring(0, 120) + '…' : task.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        {created && (
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: '0.06em' }}>{created}</span>
        )}
        {task.dispatch_id && (
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: '0.04em', fontFamily: 'monospace' }}>
            {task.dispatch_id.substring(0, 16)}…
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <div title="Execution available in Phase 5B" style={{ position: 'relative', display: 'inline-block' }}>
            <button
              disabled
              aria-label="Run task — available in Phase 5B"
              style={{
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 14px',
                background: T.dim,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.muted,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'not-allowed',
                fontFamily: 'inherit',
                letterSpacing: '0.06em',
              }}
            >
              Run ▸
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ActiveTasksSection({ tasks }) {
  if (!tasks || tasks.length === 0) return null

  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'canceled')
  if (active.length === 0) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: T.blue, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 9, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        Active Tasks
        <span style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 4,
          background: T.blueDim, color: T.blue, fontWeight: 700,
        }}>{active.length}</span>
        <span style={{ fontSize: 9, color: T.muted, fontWeight: 400, letterSpacing: '0.04em', textTransform: 'none' }}>
          execution in 5B
        </span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {active.map(t => <TaskCard key={t.id || t.task_id} task={t} />)}
      </div>
    </div>
  )
}
