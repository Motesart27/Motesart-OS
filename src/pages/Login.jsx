import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const extractUser = (data) => ({
  id: data.user?.id || data.id,
  email: data.user?.email || data.email,
  role: data.user?.role || data.role,
  name: data.user?.name || data.name || '',
})

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/os', { replace: true })
  }, [user, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(email.trim(), password)
      const token = data?.token || data?.access_token || data?.data?.token
      if (!token) {
        setError('Login failed — check credentials')
        return
      }
      const userData = data?.user || data?.data?.user || extractUser(data) || { email }
      login(userData, token)
      navigate('/os', { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://deployable-python-codebase-som-production.up.railway.app'
    window.location.href = `${backendUrl}/auth/google`
  }

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoMark}>M</div>
          <div>
            <div style={S.logoTitle}>Motesart OS</div>
            <div style={S.logoSub}>Executive Command Center</div>
          </div>
        </div>

        <div style={S.dividerLine} />

        {/* Login form */}
        <form onSubmit={handleLogin} style={S.form}>
          <input
            style={S.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={S.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p style={S.error}>{error}</p>}
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={S.orRow}><span style={S.orText}>or</span></div>

        <button style={S.googleBtn} onClick={handleGoogle} type="button">
          Continue with Google
        </button>

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerText}>Motesart Tech — Private Access</span>
          <button
            style={S.wakeBtn}
            type="button"
            onClick={() => api.wake()
              .then(() => alert('Server is awake!'))
              .catch(() => alert('Server may be starting up…'))}
          >
            Wake servers
          </button>
        </div>

      </div>
    </div>
  )
}

const T = {
  bg:      '#070709',
  surface: '#0c0c10',
  card:    '#111116',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#c9a84c',
  goldDim: 'rgba(201,168,76,0.1)',
  borderHi:'rgba(201,168,76,0.28)',
  white:   '#f0ede8',
  muted:   '#52525e',
  red:     '#c95a5a',
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.bg,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: 16,
  },
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
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
    background: T.goldDim,
    border: `1px solid ${T.borderHi}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 900,
    color: T.gold,
    flexShrink: 0,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: T.white,
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: 10,
    color: T.muted,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  dividerLine: {
    height: '0.5px',
    background: T.border,
    marginBottom: 24,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  input: {
    padding: '11px 14px',
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: T.card,
    color: T.white,
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  btn: {
    padding: '12px 0',
    borderRadius: 8,
    border: `1px solid ${T.borderHi}`,
    background: T.goldDim,
    color: T.gold,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  error: {
    color: T.red,
    fontSize: 12,
    margin: 0,
    textAlign: 'center',
  },
  orRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '18px 0',
  },
  orText: {
    color: T.muted,
    fontSize: 12,
    width: '100%',
    textAlign: 'center',
  },
  googleBtn: {
    width: '100%',
    padding: '11px 0',
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: 'transparent',
    color: T.white,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTop: `1px solid ${T.border}`,
  },
  footerText: {
    fontSize: 10,
    color: T.muted,
    letterSpacing: '0.06em',
  },
  wakeBtn: {
    padding: '4px 12px',
    background: T.goldDim,
    border: `1px solid ${T.borderHi}`,
    borderRadius: 5,
    color: T.gold,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}
