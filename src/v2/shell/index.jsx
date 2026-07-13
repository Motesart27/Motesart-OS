import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../tokens.css'
import './shell.css'

const modules = [
  ['home', 'Home', 'home'],
  ['mya', 'Mya', 'spark'],
  ['exec', 'Executive', 'exec'],
  ['work', 'Work', 'work'],
  ['life', 'Life', 'life'],
  ['som', 'School', 'school'],
  ['book', 'Book', 'book'],
  ['money', 'Money', 'money'],
  ['crm', 'CRM', 'people'],
]

const focusModes = ['Balanced', 'Teach', 'Write', 'Money', 'CEO']
const moduleNames = Object.fromEntries(modules.map(([slug, label]) => [slug, label]))

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (
    target.matches('input, textarea, select') || target.isContentEditable
  )
}

function useLayoutShiftProof() {
  useEffect(() => {
    const proof = { cls: 0, entries: [] }
    window.__MOSV2_PHASE_B_PERF__ = proof
    if (!('PerformanceObserver' in window)) return undefined

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.hadRecentInput) return
        proof.cls += entry.value
        proof.entries.push({ value: entry.value, startTime: entry.startTime })
      })
    })
    observer.observe({ type: 'layout-shift', buffered: true })
    return () => observer.disconnect()
  }, [])
}

export function Shell() {
  const { module = 'home' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [execActive, setExecActive] = useState(false)
  const [focusMode, setFocusMode] = useState('Balanced')
  const [bootVisible, setBootVisible] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const restoreTarget = useRef(null)

  useLayoutShiftProof()

  useEffect(() => {
    if (!moduleNames[module]) navigate('/v2/home', { replace: true })
  }, [module, navigate])

  useEffect(() => {
    if (reducedMotion) {
      setBootVisible(false)
      return undefined
    }
    if (!bootVisible) return undefined
    const timer = window.setTimeout(() => setBootVisible(false), 1500)
    return () => window.clearTimeout(timer)
  }, [bootVisible, reducedMotion])

  const openPalette = useCallback(() => {
    restoreTarget.current = document.activeElement
    setPaletteOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setPaletteOpen(false)
    window.requestAnimationFrame(() => {
      const target = restoreTarget.current
      if (target instanceof HTMLElement && target.isConnected && !target.hasAttribute('disabled')) {
        target.focus()
      } else {
        document.querySelector('[data-mya-bar]')?.focus()
      }
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openPalette()
      } else if (event.code === 'Space') {
        event.preventDefault()
        openPalette()
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        setExecActive((active) => !active)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openPalette])

  const title = moduleNames[module] || 'Home'

  return (
    <div className={`v2-shell${execActive ? ' v2-shell--exec' : ''}`} data-path={location.pathname}>
      <RailNav />
      <TopBar
        title={title}
        focusMode={focusMode}
        onFocusMode={setFocusMode}
        execActive={execActive}
        onExec={() => setExecActive((active) => !active)}
        onSearch={openPalette}
      />
      <Stage module={module} />
      <MyaBar onOpen={openPalette} />
      {paletteOpen && <PaletteShell onClose={closePalette} />}
      {bootVisible && <BootSequence onSkip={() => setBootVisible(false)} />}
    </div>
  )
}

export function RailNav({ preview = false, expanded = false }) {
  return (
    <nav className={`v2-rail${preview ? ' v2-rail--preview' : ''}${expanded ? ' v2-rail--forced-expanded' : ''}`} aria-label="Motes OS modules">
      <NavLink className="v2-rail__brand" to="/v2/home" aria-label="Motes OS home">
        <span className="v2-orb" aria-hidden="true" />
        <span className="v2-rail__brand-text">MOTES OS<small>THE COCKPIT</small></span>
      </NavLink>
      <div className="v2-rail__links">
        {modules.map(([slug, label, icon]) => (
          <NavLink key={slug} to={`/v2/${slug}`} className={({ isActive }) => `v2-rail__link${isActive ? ' is-active' : ''}`}>
            <ShellIcon name={icon} />
            <span className="v2-rail__label">{label}</span>
          </NavLink>
        ))}
      </div>
      <div className="v2-rail__foot">
        <div className="v2-rail__status"><span className="v2-system-dot" aria-hidden="true" /><span className="v2-rail__label">All systems green</span></div>
        <button type="button" className="v2-rail__link"><ShellIcon name="settings" /><span className="v2-rail__label">Settings</span></button>
        <div className="v2-rail__identity"><span className="v2-avatar" aria-hidden="true">DM</span><span className="v2-rail__label">Denarius Motes<small>Executive</small></span></div>
      </div>
    </nav>
  )
}

export function TopBar({ title = 'Home', focusMode = 'Balanced', onFocusMode = () => {}, execActive = false, onExec = () => {}, onSearch = () => {}, preview = false }) {
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return (
    <header className={`v2-topbar${preview ? ' v2-topbar--preview' : ''}`}>
      <div className="v2-topbar__title"><strong>{title}</strong><span>{date}</span></div>
      <button type="button" className="v2-search-pill" onClick={onSearch} aria-label="Open command palette">
        <ShellIcon name="search" /><span>Ask Mya or search</span><kbd>⌘K</kbd>
      </button>
      <div className="v2-topbar__right">
        <div className="v2-focus-switcher" aria-label="Focus mode preview">
          {focusModes.map((mode) => <button type="button" key={mode} className={focusMode === mode ? 'is-active' : ''} aria-pressed={focusMode === mode} onClick={() => onFocusMode(mode)}>{mode}</button>)}
        </div>
        <button type="button" className={`v2-exec-button${execActive ? ' is-active' : ''}`} aria-pressed={execActive} onClick={onExec}>EXEC</button>
        <button type="button" className="v2-bell" aria-label="Notifications"><ShellIcon name="bell" /><span aria-label="Unread notifications" /></button>
      </div>
    </header>
  )
}

export function Stage({ module = 'home', preview = false }) {
  return (
    <main className={`v2-stage${preview ? ' v2-stage--preview' : ''}`}>
      {module === 'home' ? <HomeSkeleton /> : <WorkspaceSkeleton module={module} />}
    </main>
  )
}

function HomeSkeleton() {
  const zones = [
    ['Today', 'Your cockpit is ready'],
    ['Projects', 'Work in motion'],
    ['Business', 'Executive signals'],
    ['Life', 'Personal alignment'],
    ['Mya', 'Quiet intelligence'],
  ]
  return (
    <section className="v2-home" aria-labelledby="v2-home-title">
      <header className="v2-stage-heading"><p>THE COCKPIT</p><h1 id="v2-home-title">Good evening, Denarius.</h1><span>Shell ready · live data arrives in Phase C</span></header>
      <div className="v2-stage-grid">
        {zones.map(([label, title], index) => (
          <section className={`v2-zone v2-zone--${index + 1}`} key={label} style={{ '--zone-order': index }}>
            <div className="v2-zone__label"><span>{label}</span><i /></div>
            <h2>{title}</h2>
            <div className="v2-skeleton-lines" aria-hidden="true"><i /><i /><i /></div>
          </section>
        ))}
      </div>
    </section>
  )
}

export function WorkspaceSkeleton({ module = 'work' }) {
  const title = moduleNames[module] || module
  return (
    <section className="v2-workspace" aria-labelledby={`v2-${module}-title`}>
      <header className="v2-workspace__header">
        <div><p>WORKSPACE</p><h1 id={`v2-${module}-title`}>{title}</h1><span>Module shell · content arrives in its approved phase</span></div>
        <span className="v2-placeholder-chip">PLACEHOLDER</span>
      </header>
      <div className="v2-kpi-strip" aria-label="KPI skeletons">{[1, 2, 3].map((item) => <div key={item}><i /><b /><span /></div>)}</div>
      <div className="v2-workspace__body">
        <section className="v2-worklist"><div className="v2-zone__label"><span>Worklist</span><i /></div>{[1, 2, 3, 4].map((item) => <div className="v2-worklist__row" key={item}><i /><span /><b /></div>)}</section>
        <aside className="v2-context-rail"><div className="v2-zone__label"><span>Context</span><i /></div><div className="v2-context-block" /><div className="v2-context-block" /></aside>
      </div>
    </section>
  )
}

export function MyaBar({ onOpen = () => {}, preview = false }) {
  return <button type="button" data-mya-bar className={`v2-mya-bar${preview ? ' v2-mya-bar--preview' : ''}`} onClick={onOpen}><span className="v2-orb" aria-hidden="true" /><span>How can I help?</span><kbd>Space</kbd></button>
}

export function PaletteShell({ onClose = () => {}, preview = false }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (preview) return undefined
    inputRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialogRef.current.querySelectorAll('input, button, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, preview])

  return (
    <div className={`v2-palette-layer${preview ? ' v2-palette-layer--preview' : ''}`}>
      {!preview && <button type="button" className="v2-palette-veil" onClick={onClose} aria-label="Close command palette" />}
      <section ref={dialogRef} className="v2-palette" role="dialog" aria-modal={!preview || undefined} aria-labelledby="v2-palette-title">
        <div className="v2-palette__pin"><span className="v2-orb" aria-hidden="true" /><label id="v2-palette-title" className="v2-visually-hidden" htmlFor="v2-palette-input">Command palette</label><input ref={inputRef} id="v2-palette-input" placeholder="How can I help?" autoComplete="off" /><button type="button" aria-label="Voice controls arrive in Phase D" disabled><ShellIcon name="mic" /></button></div>
        <div className="v2-palette__empty"><span>Visual shell</span><p>Search and actions arrive in Phase D.</p></div>
        <footer><span><kbd>↵</kbd> run</span><span><kbd>esc</kbd> close</span><strong>MYA · READY</strong></footer>
      </section>
    </div>
  )
}

function BootSequence({ onSkip }) {
  return <button type="button" className="v2-boot" onClick={onSkip} aria-label="Skip Motes OS boot sequence"><span className="v2-boot__wordmark">MOTES OS</span><span className="v2-boot__orb" /><span className="v2-boot__hint">Click anywhere to enter</span></button>
}

function ShellIcon({ name }) {
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7"/></>,
    spark: <><path d="M12 3v18M3 12h18"/><path d="m5.5 5.5 13 13m0-13-13 13"/></>,
    exec: <><path d="M4 19V9l8-5 8 5v10"/><path d="M8 19v-6h8v6M3 19h18"/></>,
    work: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18"/></>,
    life: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
    school: <><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 13v4c3 2 7 2 10 0v-4M21 10v6"/></>,
    book: <><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 1V4Z"/><path d="M18 7h2v13h-9"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-1-2-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 4 7.5 1.5 7.5 5.5 0 1.5-1.4 2.5-4 2.5-1.8 0-3.2-.5-4-1.5M12 5v14"/></>,
    people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20c.3-4 2-6 5.5-6s5.2 2 5.5 6M14 15c3.5-.8 6 .8 6.5 4.5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></>,
  }
  return <svg className="v2-shell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
