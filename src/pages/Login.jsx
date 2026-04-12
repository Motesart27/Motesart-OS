import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

// ── WebAuthn / Passkey helpers ───────────────────────────────────────────────

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64ToBuffer(base64) {
  const b64 = base64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer
}

function passkeySupported() {
  return !!(window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function')
}

// Store passkey credential ID in localStorage (NOT the private key — that never leaves device)
const PK_KEY = 'motesart_os_passkey_id'

async function registerPasskey(email) {
  const userId = new TextEncoder().encode(email)
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Motesart OS', id: window.location.hostname },
      user: {
        id: userId,
        name: email,
        displayName: 'Denarius Motes',
      },
      pubKeyCredParams: [
        { alg: -7,  type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // device only — Face ID, Touch ID
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
    },
  })

  // Store just the credential ID locally — private key NEVER leaves device
  localStorage.setItem(PK_KEY, bufferToBase64(credential.rawId))
  return credential
}

async function authenticatePasskey() {
  const storedId = localStorage.getItem(PK_KEY)
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const allowCredentials = storedId ? [{
    id: base64ToBuffer(storedId),
    type: 'public-key',
    transports: ['internal'],
  }] : []

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    },
  })

  return assertion
}

// ── Component ────────────────────────────────────────────────────────────────

const extractUser = (data) => ({
  id: data.user?.id || data.id,
  email: data.user?.email || data.email,
  role: data.user?.role || data.role,
  name: data.user?.name || data.name || '',
})

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('passkey') // 'passkey' | 'password' | 'setup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('') // status messages
  const [loading, setLoading] = useState(false)
  const [hasPasskey, setHasPasskey] = useState(false)
  const [pkSupported, setPkSupported] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    if (user) navigate('/os', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const supported = passkeySupported()
    setPkSupported(supported)
    const stored = localStorage.getItem(PK_KEY)
    setHasPasskey(supported && !!stored)
    if (!supported || !stored) setMode('password')
    return () => { mounted.current = false }
  }, [])

  // ── Passkey authenticate ─────────────────────────────────────────────────
  const handlePasskey = async () => {
    setError('')
    setStatus('Verifying identity…')
    setLoading(true)
    try {
      await authenticatePasskey()
      // Passkey verified locally — now do a lightweight backend auth
      // Use stored email as the identity source
      const storedUser = (() => {
        try { return JSON.parse(localStorage.getItem('som_user')) } catch { return null }
      })()
      if (storedUser) {
        // Already have a valid session — passkey just re-verified device ownership
        login(storedUser, localStorage.getItem('som_token'))
        navigate('/os', { replace: true })
        return
      }
      // No existing session — fall through to password to establish first session
      setMode('password')
      setStatus('Identity verified — sign in once to activate session')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Verification cancelled or timed out')
      } else {
        setError('Passkey failed — use email and password instead')
        setMode('password')
      }
    } finally {
      if (mounted.current) { setLoading(false); setTimeout(() => setStatus(''), 3000) }
    }
  }

  // ── Password login ────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email.trim(), password)
      const token = data?.token || data?.access_token || data?.data?.token
      if (!token) { setError('Login failed — check credentials'); return }
      const userData = data?.user || data?.data?.user || extractUser(data) || { email }
      login(userData, token)
      navigate('/os', { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed — check your credentials')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  // ── Passkey setup (after first password login) ────────────────────────────
  const handleSetupPasskey = async () => {
    if (!email) { setError('Enter your email first'); return }
    setError('')
    setStatus('Setting up passkey…')
    setLoading(true)
    try {
      await registerPasskey(email.trim())
      setHasPasskey(true)
      setMode('passkey')
      setStatus('Passkey set up — use Face ID or Touch ID next time')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Setup cancelled')
      } else {
        setError('Passkey setup failed: ' + err.message)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  const clearPasskey = () => {
    localStorage.removeItem(PK_KEY)
    setHasPasskey(false)
    setMode('password')
    setStatus('Passkey removed')
    setTimeout(() => setStatus(''), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Background grid */}
      <div style={S.grid} aria-hidden="true" />

      <div style={S.card}>

        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>
            <span style={S.logoM}>M</span>
          </div>
          <div>
            <div style={S.logoTitle}>Motesart OS</div>
            <div style={S.logoSub}>Executive Command Center</div>
          </div>
        </div>

        <div style={S.divider} />

        {/* Status message */}
        {status && (
          <div style={S.statusMsg}>
            <div style={S.statusDot} />
            {status}
          </div>
        )}

        {/* Error */}
        {error && <div style={S.errorMsg}>{error}</div>}

        {/* ── PASSKEY MODE ── */}
        {mode === 'passkey' && hasPasskey && pkSupported && (
          <div style={S.passkeyWrap}>
            <div style={S.passkeyIcon} onClick={handlePasskey}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="10" r="5" stroke="#c9a84c" strokeWidth="1.5" fill="none"/>
                <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <circle cx="24" cy="20" r="3" fill="rgba(201,168,76,0.2)" stroke="#c9a84c" strokeWidth="1.5"/>
                <path d="M24 22v2" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={S.passkeyLabel}>
              {loading ? 'Verifying…' : 'Touch to sign in'}
            </div>
            <div style={S.passkeyHint}>
              Uses Face ID, Touch ID, or Windows Hello
            </div>
            <button
              style={S.passkeyBtn}
              onClick={handlePasskey}
              disabled={loading}
            >
              {loading ? 'Verifying…' : 'Sign In with Passkey'}
            </button>
            <button
              style={S.switchLink}
              onClick={() => { setMode('password'); setError('') }}
            >
              Use email + password instead
            </button>
          </div>
        )}

        {/* ── PASSWORD MODE ── */}
        {(mode === 'password' || !pkSupported || (!hasPasskey && mode !== 'setup')) && mode !== 'passkey' && (
          <form onSubmit={handlePasswordLogin} style={S.form}>
            <input
              style={S.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
              required
              autoComplete="email"
            />
            <input
              style={S.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.07)'}
              required
              autoComplete="current-password"
            />
            <button
              style={{ ...S.btn, opacity: loading ? 0.6 : 1 }}
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            {/* Passkey setup offer */}
            {pkSupported && !hasPasskey && email && (
              <button
                type="button"
                style={S.setupBtn}
                onClick={handleSetupPasskey}
                disabled={loading}
              >
                + Set up Face ID / Touch ID for next time
              </button>
            )}

            {hasPasskey && (
              <button
                type="button"
                style={S.switchLink}
                onClick={() => { setMode('passkey'); setError('') }}
              >
                Use passkey instead
              </button>
            )}
          </form>
        )}

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerText}>Motesart Tech — Private</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasPasskey && (
              <button style={S.dangerLink} onClick={clearPasskey}>
                Remove passkey
              </button>
            )}
            <button
              style={S.wakeBtn}
              type="button"
              onClick={() => {
                setStatus('Waking servers…')
                api.wake()
                  .then(() => setStatus('Servers are awake!'))
                  .catch(() => setStatus('Starting up — try again in 30s'))
                  .finally(() => setTimeout(() => setStatus(''), 3000))
              }}
            >
              Wake servers
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes gridMove {
          from { transform: translateY(0); }
          to   { transform: translateY(40px); }
        }
      `}</style>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#070709',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    animation: 'gridMove 8s linear infinite',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: '#0c0c10',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.05)',
    animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: 'rgba(201,168,76,0.1)',
    border: '1px solid rgba(201,168,76,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoM: {
    fontSize: 22,
    fontWeight: 900,
    color: '#c9a84c',
    lineHeight: 1,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#f0ede8',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: 10,
    color: '#52525e',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divider: {
    height: '0.5px',
    background: 'rgba(255,255,255,0.07)',
    marginBottom: 24,
  },
  statusMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(76,175,125,0.1)',
    border: '1px solid rgba(76,175,125,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 12,
    color: '#4caf7d',
    marginBottom: 14,
    animation: 'fadeUp 0.2s ease both',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#4caf7d',
    flexShrink: 0,
    animation: 'pulse 1.5s ease infinite',
  },
  errorMsg: {
    background: 'rgba(201,90,90,0.1)',
    border: '1px solid rgba(201,90,90,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 12,
    color: '#c95a5a',
    marginBottom: 14,
    textAlign: 'center',
  },
  // Passkey
  passkeyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0 4px',
  },
  passkeyIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.08)',
    border: '1px solid rgba(201,168,76,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: 4,
  },
  passkeyLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f0ede8',
    letterSpacing: '-0.01em',
  },
  passkeyHint: {
    fontSize: 11,
    color: '#52525e',
    textAlign: 'center',
    marginBottom: 6,
  },
  passkeyBtn: {
    width: '100%',
    padding: '12px 0',
    borderRadius: 8,
    border: '1px solid rgba(201,168,76,0.28)',
    background: 'rgba(201,168,76,0.1)',
    color: '#c9a84c',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    letterSpacing: '0.03em',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#52525e',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 0',
    transition: 'color 0.15s',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  // Password form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    padding: '11px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#111116',
    color: '#f0ede8',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  btn: {
    padding: '12px 0',
    borderRadius: 8,
    border: '1px solid rgba(201,168,76,0.28)',
    background: 'rgba(201,168,76,0.1)',
    color: '#c9a84c',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 2,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    letterSpacing: '0.03em',
  },
  setupBtn: {
    padding: '9px 0',
    borderRadius: 8,
    border: '1px solid rgba(76,175,125,0.2)',
    background: 'rgba(76,175,125,0.06)',
    color: '#4caf7d',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  // Footer
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 14,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  footerText: {
    fontSize: 10,
    color: '#52525e',
    letterSpacing: '0.06em',
  },
  wakeBtn: {
    padding: '4px 10px',
    background: 'rgba(201,168,76,0.08)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 5,
    color: '#c9a84c',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerLink: {
    background: 'none',
    border: 'none',
    color: '#52525e',
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
}
