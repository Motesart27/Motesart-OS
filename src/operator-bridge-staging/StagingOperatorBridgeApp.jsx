import { useCallback, useEffect, useMemo, useState } from 'react'

import { STAGING_BANNER, StagingClient } from './api.js'
import './staging.css'

const BOARD = [
  ['Inbox', ['DRAFT']],
  ['Queued', ['QUEUED']],
  ['Claimed', ['CLAIMED']],
  ['Running', ['RUNNING']],
  ['Verifying', ['VERIFYING']],
  ['Ready for Approval', ['READY_FOR_APPROVAL']],
  ['Blocked', ['BLOCKED']],
  ['Failed', ['FAILED', 'CANCELLED', 'EXPIRED']],
  ['Completed', ['COMPLETED']],
]

function short(hash) {
  return hash ? `${hash.slice(0, 12)}…` : '—'
}

function Login({ client, onAuthenticated }) {
  const [ownerId, setOwnerId] = useState('denarius-staging-owner')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    try {
      await client.login(ownerId, password)
      setPassword('')
      onAuthenticated()
    } catch (failure) {
      setPassword('')
      setError(failure.code)
    }
  }
  return (
    <main className="bridge-login">
      <section className="bridge-login-card">
        <div className="bridge-kicker">{STAGING_BANNER}</div>
        <h1>MYA Operator Bridge</h1>
        <p>Short-lived staging owner session. Credentials are never stored in this browser.</p>
        <form onSubmit={submit}>
          <label>Owner identity<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} autoComplete="username" /></label>
          <label>Staging password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {error && <div className="bridge-error">{error}</div>}
          <button type="submit">Enter supervised staging</button>
        </form>
      </section>
    </main>
  )
}

function NewWorkOrder({ client, onCreated }) {
  const [instruction, setInstruction] = useState('')
  const [taskType, setTaskType] = useState('github_pr_read_only_review')
  const [scope, setScope] = useState('{"repository":"Motesart27/Motesart-OS","pull_request":22,"read_only":true}')
  const [priority, setPriority] = useState('normal')
  const [executor, setExecutor] = useState('AUTO_ROUTE')
  const [error, setError] = useState(null)
  const [createdId, setCreatedId] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    try {
      const parsedScope = JSON.parse(scope)
      const result = await client.submit({
        instruction,
        originating_surface: 'motesart-os-netlify-preview',
        task_type: taskType,
        scope: parsedScope,
        priority,
        approval_class: 'READ_ONLY',
        executor,
        idempotency_key: `phone-preview:${client.buildHead}:${crypto.randomUUID()}`,
      })
      setCreatedId(result.work_order.work_order_id)
      setInstruction('')
      onCreated(result.work_order.work_order_id)
    } catch (failure) {
      setError(failure.code ?? 'INVALID_SCOPE_JSON')
    }
  }
  return (
    <section className="bridge-panel bridge-new-order">
      <div className="bridge-panel-heading"><h2>New Work Order</h2><span>Structured input only</span></div>
      <form onSubmit={submit}>
        <label>Instruction<textarea required maxLength={12000} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Safe, read-only supervised instruction" /></label>
        <div className="bridge-form-grid">
          <label>Task type<select value={taskType} onChange={(event) => setTaskType(event.target.value)}><option value="github_pr_read_only_review">GitHub PR review</option><option value="architecture_review">Architecture review</option></select></label>
          <label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>low</option><option>normal</option><option>high</option></select></label>
          <label>Approval class<select value="READ_ONLY" disabled><option>READ_ONLY</option></select></label>
          <label>Executor<select value={executor} onChange={(event) => setExecutor(event.target.value)}><option>AUTO_ROUTE</option><option>ORCA</option></select></label>
        </div>
        <label>Structured scope<textarea required value={scope} onChange={(event) => setScope(event.target.value)} /></label>
        {error && <div className="bridge-error">{error}</div>}
        {createdId && <div className="bridge-created">Created: <code>{createdId}</code></div>}
        <button type="submit">Create governed work order</button>
      </form>
    </section>
  )
}

function WorkBoard({ orders, onSelect }) {
  return (
    <section className="bridge-panel">
      <div className="bridge-panel-heading"><h2>Work Board</h2><span>{orders.length} work orders</span></div>
      <div className="bridge-board">
        {BOARD.map(([label, states]) => {
          const items = orders.filter((order) => states.includes(order.status))
          return <div className="bridge-column" key={label}><h3>{label}<span>{items.length}</span></h3>{items.map((order) => <button className="bridge-order-card" key={order.work_order_id} onClick={() => onSelect(order.work_order_id)}><strong>{order.task_type}</strong><small>{order.work_order_id}</small><span>{order.executor} · attempt {order.attempt_count}</span>{order.blocker_code && <em>{order.blocker_code}</em>}</button>)}</div>
        })}
      </div>
    </section>
  )
}

function WorkDetail({ detail }) {
  if (!detail) return <section className="bridge-panel bridge-empty"><h2>Work-Order Detail</h2><p>Select a work order to inspect its immutable timeline and artifacts.</p></section>
  const { work_order: order } = detail.order
  return (
    <section className="bridge-panel bridge-detail">
      <div className="bridge-panel-heading"><h2>Work-Order Detail</h2><span className={`bridge-status status-${order.status.toLowerCase()}`}>{order.status}</span></div>
      <h3>{order.work_order_id}</h3>
      <p className="bridge-instruction">{order.instruction}</p>
      <dl className="bridge-metadata">
        <div><dt>Executor</dt><dd>{order.executor}</dd></div><div><dt>Lease owner</dt><dd>{order.lease_owner ?? '—'}</dd></div>
        <div><dt>Heartbeat</dt><dd>{order.heartbeat_at ?? '—'}</dd></div><div><dt>Lease expires</dt><dd>{order.lease_expires_at ?? '—'}</dd></div>
        <div><dt>Attempts</dt><dd>{order.attempt_count}</dd></div><div><dt>Approval</dt><dd>{order.approval_class}</dd></div>
        <div><dt>Blocker</dt><dd>{order.blocker_code ?? '—'}</dd></div><div><dt>Next action</dt><dd>{order.next_action}</dd></div>
      </dl>
      <h3>Timeline</h3>
      <ol className="bridge-timeline">{detail.events.events.map((event) => <li key={event.event_id}><time>{event.created_at}</time><strong>{event.code}</strong><span>{event.from_status ?? '∅'} → {event.to_status}</span><code>{short(event.event_hash)}</code></li>)}</ol>
      <h3>Artifacts and hashes</h3>
      <div className="bridge-artifacts">{detail.artifacts.artifacts.length ? detail.artifacts.artifacts.map((artifact) => <div key={artifact.artifact_id}><strong>{artifact.artifact_type}</strong><code>{artifact.sha256}</code><span>{artifact.byte_count} bytes · {artifact.producer}</span></div>) : <p>No artifacts yet.</p>}</div>
      <h3>Executor results</h3>
      <div className="bridge-results"><div><span>Kimi</span><strong>{detail.card.decision_card?.kimi_result?.status ?? 'Pending'}</strong></div><div><span>Codex</span><strong>{detail.card.decision_card?.codex_result?.status ?? 'Pending'}</strong></div><div><span>Fable</span><strong>{detail.card.decision_card?.fable_verdict?.status ?? 'Pending'}</strong></div></div>
      <h3>Decision card</h3>
      {detail.card.decision_card ? <pre>{JSON.stringify(detail.card.decision_card, null, 2)}</pre> : <p>Not available.</p>}
      <div className="bridge-controls"><button disabled>Approve — disabled</button><button disabled>Reject — disabled</button><button disabled>Revise — disabled</button></div>
    </section>
  )
}

export default function StagingOperatorBridgeApp({ buildHead }) {
  const client = useMemo(() => new StagingClient({ buildHead }), [buildHead])
  const [authenticated, setAuthenticated] = useState(false)
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [serviceError, setServiceError] = useState(null)

  const refresh = useCallback(async () => {
    if (!authenticated) return
    try {
      const result = await client.list()
      setOrders(result.work_orders)
      setServiceError(null)
      if (selectedId) {
        const [order, events, artifacts, card] = await client.detail(selectedId)
        setDetail({ order, events, artifacts, card })
      }
    } catch (failure) {
      setServiceError(failure.code)
      if (failure.code === 'SESSION_EXPIRED' || failure.code === 'AUTHENTICATION_INVALID') {
        client.logout()
        setAuthenticated(false)
      }
    }
  }, [authenticated, client, selectedId])

  useEffect(() => {
    if (!authenticated) return undefined
    refresh()
    const interval = window.setInterval(refresh, 3000)
    return () => window.clearInterval(interval)
  }, [authenticated, refresh])

  const select = (id) => setSelectedId(id)
  if (!authenticated) return <Login client={client} onAuthenticated={() => setAuthenticated(true)} />
  return (
    <div className="bridge-app">
      <header className="bridge-header"><div><div className="bridge-kicker">{STAGING_BANNER}</div><h1>MYA Operator Bridge</h1></div><div className="bridge-head">Preview head <code>{buildHead}</code></div></header>
      {serviceError && <div className="bridge-error bridge-global-error">{serviceError}</div>}
      <NewWorkOrder client={client} onCreated={(id) => { setSelectedId(id); refresh() }} />
      <WorkBoard orders={orders} onSelect={select} />
      <WorkDetail detail={detail} />
    </div>
  )
}
