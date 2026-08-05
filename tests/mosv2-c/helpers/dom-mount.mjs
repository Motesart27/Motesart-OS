// dom-mount.mjs — React mounting over the mini DOM for mosv2-c DOM tests.
// Registers the esbuild/CSS ESM hooks FIRST (static imports of .jsx would
// otherwise fail), installs the mini DOM globals, then dynamically imports
// React. Tests import { React, act, mount, fireEvent, dom, findAll, byClass,
// textOf } from this module and dynamically import the .jsx under test.
//
//   const { default: Gallery } = await import('../../src/v2/Gallery.jsx')
//   const mounted = await mount(React.createElement(Gallery))

import { register } from 'node:module'

register('./esm-hooks.mjs', import.meta.url)

import { installMiniDom } from './mini-dom.js'

export const dom = installMiniDom()
export const React = await import('react')
export const { createRoot } = await import('react-dom/client')

export const act = React.unstable_act
export const h = React.createElement

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Mounts an element into a fresh container attached to document.body.
export async function mount(element) {
  const container = dom.document.createElement('div')
  dom.document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(element) })
  return {
    container,
    root,
    async unmount() {
      await act(async () => { root.unmount() })
      if (container.parentNode) container.parentNode.removeChild(container)
    },
  }
}

// Console spy: React reports component errors and dev warnings through
// console.error/console.warn — the specimen law is zero console output, so
// tests capture both channels for the duration of a mount.
export function spyConsole() {
  const calls = { error: [], warn: [] }
  const originals = { error: console.error, warn: console.warn }
  console.error = (...args) => { calls.error.push(args.map(String).join(' ')) }
  console.warn = (...args) => { calls.warn.push(args.map(String).join(' ')) }
  return {
    calls,
    restore() {
      console.error = originals.error
      console.warn = originals.warn
    },
  }
}

function makeEvent(type, target, init) {
  return {
    type,
    target,
    currentTarget: null,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    timeStamp: Date.now(),
    isTrusted: false,
    eventPhase: 3,
    preventDefault() { this.defaultPrevented = true },
    stopPropagation() {},
    stopImmediatePropagation() {},
    composedPath() {
      const path = []
      let node = target
      while (node) { path.push(node); node = node.parentNode }
      return path
    },
    ...init,
  }
}

// Delivers an event the way the browser would for React's delegation: the
// root listener lives on the nearest ancestor container that registered one
// (createRoot containers, and document.body for portal content like toasts).
export function fireEvent(target, type, init = {}) {
  const event = makeEvent(type, target, init)
  let node = target
  let delivered = false
  while (node) {
    if (node.listenerCount && node.listenerCount(type) > 0) {
      event.currentTarget = node
      node.fireListeners(type, event)
      delivered = true
      break
    }
    node = node.parentNode
  }
  if (!delivered) throw new Error(`fireEvent: no listener found for "${type}" on any ancestor`)
  return event
}

// ─── Assertion query helpers ────────────────────────────────────────────────

export function findAll(root, predicate) {
  const out = []
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 1) {
        if (predicate(child)) out.push(child)
        walk(child)
      }
    }
  }
  walk(root)
  return out
}

export function byClass(root, className) {
  return findAll(root, (el) => (el.className ?? '').split(/\s+/).includes(className))
}

export function textOf(node) {
  return node ? node.textContent : ''
}

// Poll an assertion expression until it holds or the deadline lapses.
export async function waitFor(check, { timeoutMs = 5000, intervalMs = 20, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = check()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`waitFor timeout: ${label}`)
    await sleep(intervalMs)
  }
}
