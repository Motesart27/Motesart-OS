// mini-dom.js — a minimal DOM sufficient for react-dom 18 client mounting in
// Node (no jsdom — the repo forbids new dependencies). Implements exactly the
// surface react-dom touches at mount/commit time: node tree ops, attribute
// storage with reflection for the attributes React sets, textContent
// clearing, per-node listener maps (React attaches all supported events at
// the root container), SVG namespace creation, portals into document.body,
// and document-level visibilitychange for the 9.3 hidden-tab instrumentation.
// Query helpers (findAll/byClass/attr) serve test assertions; this is a test
// fixture, not a browser.

const HTML_NS = 'http://www.w3.org/1999/xhtml'

class MiniNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument ?? null
    this.parentNode = null
    this.childNodes = []
    this.listeners = new Map()
  }

  get firstChild() { return this.childNodes[0] ?? null }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] ?? null }

  get nextSibling() {
    if (!this.parentNode) return null
    const siblings = this.parentNode.childNodes
    return siblings[siblings.indexOf(this) + 1] ?? null
  }

  get previousSibling() {
    if (!this.parentNode) return null
    const siblings = this.parentNode.childNodes
    return siblings[siblings.indexOf(this) - 1] ?? null
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null
  }

  appendChild(node) { return this.insertBefore(node, null) }

  insertBefore(node, ref) {
    if (node.parentNode) node.parentNode.removeChild(node)
    const index = ref ? this.childNodes.indexOf(ref) : -1
    if (ref && index === -1) throw new Error('insertBefore: reference node not found')
    if (index === -1) this.childNodes.push(node)
    else this.childNodes.splice(index, 0, node)
    node.parentNode = this
    return node
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node)
    if (index === -1) throw new Error('removeChild: node not found')
    this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.nodeValue ?? ''
    return this.childNodes.map((child) => child.textContent).join('')
  }

  set textContent(value) {
    if (this.nodeType === 3 || this.nodeType === 8) {
      this.nodeValue = String(value)
      return
    }
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes = []
    if (value !== '') {
      const doc = this.ownerDocument ?? this
      this.appendChild(doc.createTextNode(String(value)))
    }
  }

  contains(node) {
    let current = node
    while (current) {
      if (current === this) return true
      current = current.parentNode
    }
    return false
  }

  get isConnected() {
    let node = this
    while (node.parentNode) node = node.parentNode
    return node.nodeType === 9
  }

  addEventListener(type, listener, options) {
    const capture = options === true || Boolean(options && options.capture)
    const key = `${type}:${capture ? 'capture' : 'bubble'}`
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key).add(listener)
  }

  removeEventListener(type, listener, options) {
    const capture = options === true || Boolean(options && options.capture)
    const key = `${type}:${capture ? 'capture' : 'bubble'}`
    const set = this.listeners.get(key)
    if (set) set.delete(listener)
  }

  listenerCount(type, capture = false) {
    return this.listeners.get(`${type}:${capture ? 'capture' : 'bubble'}`)?.size ?? 0
  }

  // Invokes this node's own listeners for the type (bubble phase by default).
  // React's root listener walks the fiber tree itself, so dispatching at the
  // nearest listening container reproduces browser event delivery for the
  // synthetic-event system.
  fireListeners(type, event, capture = false) {
    const set = this.listeners.get(`${type}:${capture ? 'capture' : 'bubble'}`)
    if (!set) return
    for (const listener of [...set]) listener(event)
  }
}

class MiniText extends MiniNode {
  constructor(ownerDocument, text, nodeType = 3) {
    super(ownerDocument)
    this.nodeType = nodeType
    this.nodeValue = String(text)
  }

  get nodeName() { return this.nodeType === 8 ? '#comment' : '#text' }
  get data() { return this.nodeValue }
  set data(value) { this.nodeValue = String(value) }
}

class MiniElement extends MiniNode {
  constructor(ownerDocument, tagName, namespaceURI = HTML_NS) {
    super(ownerDocument)
    this.nodeType = 1
    this.localName = tagName
    this.namespaceURI = namespaceURI
    this.tagName = namespaceURI === HTML_NS ? tagName.toUpperCase() : tagName
    this.nodeName = this.tagName
    this.attributes = new Map()
    this.className = ''
    this.id = ''
    this.disabled = false
    this.style = {
      setProperty: (name, value) => { this.style[name] = value },
      removeProperty: (name) => { delete this.style[name] },
      getPropertyValue: (name) => this.style[name] ?? '',
    }
  }

  setAttribute(name, value) {
    const text = String(value)
    this.attributes.set(name, text)
    if (name === 'class') this.className = text
    else if (name === 'id') this.id = text
    else if (name === 'disabled') this.disabled = true
    else if (name === 'tabindex') this.tabIndex = Number(text)
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null
  }

  hasAttribute(name) { return this.attributes.has(name) }

  removeAttribute(name) {
    this.attributes.delete(name)
    if (name === 'class') this.className = ''
    else if (name === 'id') this.id = ''
    else if (name === 'disabled') this.disabled = false
  }

  focus() {
    const doc = this.ownerDocument
    if (doc) doc.activeElement = this
  }

  blur() {
    const doc = this.ownerDocument
    if (doc && doc.activeElement === this) doc.activeElement = null
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  }

  // Minimal matcher for test assertions: 'tag', '.class', '[attr]',
  // '[attr="value"]', or a compound like 'div.v2-tile[data-status="stale"]'.
  matches(selector) {
    const compound = selector.trim()
    const attrMatch = compound.match(/\[([a-zA-Z-]+)(?:="([^"]*)")?\]/g) ?? []
    const tag = (compound.match(/^[a-zA-Z][a-zA-Z0-9-]*/) ?? [null])[0]
    const classes = [...compound.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1])
    if (tag && this.localName !== tag.toLowerCase()) return false
    const own = this.className ? this.className.split(/\s+/) : []
    for (const cls of classes) if (!own.includes(cls)) return false
    for (const attr of attrMatch) {
      const parsed = attr.match(/\[([a-zA-Z-]+)(?:="([^"]*)")?\]/)
      if (!this.hasAttribute(parsed[1])) return false
      if (parsed[2] !== undefined && this.getAttribute(parsed[1]) !== parsed[2]) return false
    }
    return true
  }

  querySelectorAll(selector) {
    return queryAll(this, selector)
  }

  querySelector(selector) {
    return queryAll(this, selector)[0] ?? null
  }
}

function queryAll(root, selector) {
  const parts = selector.trim().split(/\s+/)
  let current = [root]
  for (const part of parts) {
    const next = []
    for (const node of current) {
      walkElements(node, (el) => { if (el.matches(part)) next.push(el) })
    }
    current = next
  }
  return current
}

function walkElements(node, visit) {
  for (const child of node.childNodes) {
    if (child.nodeType === 1) {
      visit(child)
      walkElements(child, visit)
    }
  }
}

class MiniDocument extends MiniNode {
  constructor() {
    super(null)
    this.nodeType = 9
    this.nodeName = '#document'
    this.documentElement = new MiniElement(this, 'html')
    this.head = new MiniElement(this, 'head')
    this.body = new MiniElement(this, 'body')
    this.documentElement.appendChild(this.head)
    this.documentElement.appendChild(this.body)
    this.appendChild(this.documentElement)
    this.hidden = false
    this.visibilityState = 'visible'
    this.activeElement = null
    this.defaultView = null
  }

  createElement(tagName) { return new MiniElement(this, String(tagName).toLowerCase()) }

  createElementNS(namespaceURI, tagName) {
    return new MiniElement(this, String(tagName).toLowerCase(), namespaceURI)
  }

  createTextNode(text) { return new MiniText(this, text) }

  createComment(text) { return new MiniText(this, text, 8) }

  getElementById(id) {
    let found = null
    walkElements(this, (el) => { if (!found && el.id === id) found = el })
    return found
  }

  querySelectorAll(selector) { return queryAll(this, selector) }

  querySelector(selector) { return queryAll(this, selector)[0] ?? null }

  // 9.3 instrumentation: flip document.hidden and deliver visibilitychange to
  // every registered listener — the same signal useTileSource subscribes to.
  setVisibility(hidden) {
    this.hidden = Boolean(hidden)
    this.visibilityState = this.hidden ? 'hidden' : 'visible'
    this.fireListeners('visibilitychange', { type: 'visibilitychange', target: this })
  }
}

class MiniStorage {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null }
  setItem(key, value) { this.map.set(String(key), String(value)) }
  removeItem(key) { this.map.delete(String(key)) }
  clear() { this.map.clear() }
  key(index) { return [...this.map.keys()][index] ?? null }
  get length() { return this.map.size }
}

class MiniWindow extends MiniNode {
  constructor(document) {
    super(null)
    this.document = document
    this.localStorage = new MiniStorage()
    this.navigator = { onLine: true }
    this.innerWidth = 1440
    this.innerHeight = 900
    this.scrollY = 0
    // react-dom's selection bookkeeping walks activeElement through
    // iframes via `element instanceof window.HTMLIFrameElement`.
    this.HTMLIFrameElement = class HTMLIFrameElement {}
  }

  matchMedia(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false },
    }
  }

  requestAnimationFrame(callback) { return setTimeout(() => callback(Date.now()), 16) }
  cancelAnimationFrame(id) { clearTimeout(id) }
  setTimeout(callback, ms, ...args) { return setTimeout(callback, ms, ...args) }
  clearTimeout(id) { clearTimeout(id) }
  setInterval(callback, ms, ...args) { return setInterval(callback, ms, ...args) }
  clearInterval(id) { clearInterval(id) }
  getComputedStyle() { return { getPropertyValue: () => '', transitionDuration: '0s' } }
}

// Installs the mini DOM as this process's globals and returns handles. Each
// test file runs in its own node --test process, so globals never leak
// between files. Idempotent within a file (helpers share one install).
let installed = null
export function installMiniDom() {
  if (installed) return installed
  const document = new MiniDocument()
  const window = new MiniWindow(document)
  document.defaultView = window
  globalThis.window = window
  globalThis.document = document
  globalThis.HTMLElement = MiniElement
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  globalThis.getComputedStyle = window.getComputedStyle.bind(window)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  installed = { document, window, localStorage: window.localStorage, MiniDocument, MiniElement }
  return installed
}

export { MiniDocument, MiniElement, MiniText, HTML_NS }
